'use strict';

/* ==========================================================================
   NEW AI — zero-dependency local server

   Serves the static app and proxies OpenAI-compatible chat requests so the
   provider API key never reaches the browser.

   Run:  node server/server.js
   Env:  copy server/.env.example to server/.env and edit it.
   ========================================================================== */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* --------------------------------------------------------------------------
   Environment
   -------------------------------------------------------------------------- */

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const contents = fs.readFileSync(file, 'utf8');
  for (const rawLine of contents.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('export ')) line = line.slice(7).trim();
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv(path.join(__dirname, '.env'));

const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || '127.0.0.1';
// Treat the example placeholder as "no key" so the UI reports the real problem
// instead of forwarding a fake key and showing a confusing 401.
const PLACEHOLDER_KEYS = new Set([
  'replace-with-your-key',
  'your-key-here',
  'your-api-key',
  'sk-your-real-key',
  'changeme',
  'todo',
]);
const RAW_API_KEY = String(process.env.API_KEY || '').trim();
const API_KEY = PLACEHOLDER_KEYS.has(RAW_API_KEY.toLowerCase()) ? '' : RAW_API_KEY;
const BASE_URL = (process.env.PROVIDER_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'gpt-4o-mini';
// Extra models tried by the browser when the default one is rate-limited.
// They must be models the same provider/key can serve.
const FALLBACK_MODELS = (process.env.FALLBACK_MODELS || '')
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value && value !== DEFAULT_MODEL);
const ALLOW_NO_KEY = String(process.env.ALLOW_NO_KEY || 'false').toLowerCase() === 'true';
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS) || 120000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
// Optional shared secret for public deployments. When set, /api/chat requires
// "Authorization: Bearer <token>", so a public URL cannot be used by strangers.
const AUTH_TOKEN = String(process.env.AUTH_TOKEN || '').trim();

const ROOT = path.resolve(__dirname, '..');
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_MESSAGES = 200;
const MAX_TOTAL_CHARS = 500000;

/* --------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */

function redact(text) {
  let value = String(text == null ? '' : text);
  if (API_KEY) value = value.split(API_KEY).join('[redacted]');
  return value;
}

function sendJSON(res, status, payload) {
  if (res.destroyed) return;
  if (res.headersSent || res.writableEnded) {
    try {
      res.end();
    } catch {
      /* the client is already gone */
    }
    return;
  }
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes('*') ? '*' : origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '600');
    return true;
  }
  // Same-origin requests do not need CORS headers. Only block a foreign origin
  // when the operator explicitly configured an allowlist.
  if (!ALLOWED_ORIGINS.length) return true;
  return false;
}

// When AUTH_TOKEN is configured, require it as a bearer token on the chat
// endpoint so a public deployment is not an open door to the provider quota.
function isAuthorized(req) {
  if (!AUTH_TOKEN) return true;
  const header = String(req.headers.authorization || '');
  const token = (header.replace(/^Bearer\s+/i, '').trim() || String(req.headers['x-newai-token'] || '').trim());
  const given = Buffer.from(token);
  const expected = Buffer.from(AUTH_TOKEN);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

function readBody(req) {  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body is too large.'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) throw new Error('messages must be an array.');
  if (messages.length > MAX_MESSAGES) throw new Error('Too many messages in one request.');
  let total = 0;
  const clean = [];
  for (const message of messages) {
    if (!message || !['system', 'user', 'assistant'].includes(message.role)) continue;
    if (typeof message.content !== 'string' || !message.content.trim()) continue;
    total += message.content.length;
    if (total > MAX_TOTAL_CHARS) throw new Error('Conversation context is too large.');
    clean.push({ role: message.role, content: message.content });
  }
  if (!clean.length) throw new Error('No usable messages were provided.');
  return clean;
}

/* --------------------------------------------------------------------------
   Static files (explicit allowlist)
   -------------------------------------------------------------------------- */

const STATIC_FILES = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/index.html': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/style.css': { file: 'style.css', type: 'text/css; charset=utf-8' },
  '/script.js': { file: 'script.js', type: 'application/javascript; charset=utf-8' },
};

function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end('Method not allowed');
    return;
  }
  if (pathname === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (pathname === '/robots.txt') {
    const body = 'User-agent: *\nDisallow: /\n';
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
    return;
  }
  const entry = STATIC_FILES[pathname];
  if (!entry) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const fullPath = path.join(ROOT, entry.file);
  fs.readFile(fullPath, (error, data) => {
    if (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Could not read ' + entry.file);
      return;
    }
    res.writeHead(200, {
      'Content-Type': entry.type,
      'Content-Length': data.length,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'SAMEORIGIN',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
}

/* --------------------------------------------------------------------------
   Health
   -------------------------------------------------------------------------- */

function handleHealth(req, res) {
  let provider = 'unknown';
  try {
    provider = new URL(BASE_URL).host;
  } catch {
    provider = 'invalid';
  }
  sendJSON(res, 200, {
    ok: true,
    app: 'NEW AI',
    provider,
    model: DEFAULT_MODEL,
    fallbackModels: FALLBACK_MODELS,
    hasKey: Boolean(API_KEY) || ALLOW_NO_KEY,
    auth: API_KEY ? 'api-key' : ALLOW_NO_KEY ? 'none' : 'missing',
    placeholderKey: Boolean(RAW_API_KEY) && !API_KEY,
    authRequired: Boolean(AUTH_TOKEN),
    uptime: Math.round(process.uptime()),
  });
}

/* --------------------------------------------------------------------------
   Chat proxy
   -------------------------------------------------------------------------- */

async function handleChat(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { Allow: 'POST' });
    res.end('Method not allowed');
    return;
  }

  if (!API_KEY && !ALLOW_NO_KEY) {
    sendJSON(res, 503, {
      error: {
        message:
          'The server is not configured. Copy server/.env.example to server/.env and set API_KEY (or ALLOW_NO_KEY=true for a local model).',
      },
    });
    return;
  }

  let payload;
  try {
    const raw = await readBody(req);
    if (!raw) throw new Error('Empty request body.');
    payload = JSON.parse(raw);
  } catch (error) {
    sendJSON(res, error.statusCode || 400, { error: { message: redact(error.message) } });
    return;
  }

  let messages;
  try {
    messages = sanitizeMessages(payload.messages);
  } catch (error) {
    sendJSON(res, 400, { error: { message: error.message } });
    return;
  }

  const wantsStream = Boolean(payload.stream);
  const model =
    typeof payload.model === 'string' && payload.model.trim()
      ? payload.model.trim().slice(0, 120)
      : DEFAULT_MODEL;
  const temperature = Math.min(2, Math.max(0, Number(payload.temperature) || 0));
  const maxTokens = Math.min(8192, Math.max(1, Number(payload.max_tokens) || 1024));

  const upstreamBody = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: wantsStream,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onClose = () => {
    if (!res.writableEnded) controller.abort();
  };
  res.on('close', onClose);

  try {
    const headers = {
      'Content-Type': 'application/json',
      Accept: wantsStream ? 'text/event-stream' : 'application/json',
    };
    if (API_KEY) headers.Authorization = 'Bearer ' + API_KEY;

    // Free tiers often refuse one model for the day or briefly overload it
    // while another model on the same key still answers, so walk the
    // configured fallbacks before giving up. Nothing has been written to the
    // client yet, which keeps this safe for streaming requests too.
    const RETRYABLE = new Set([429, 500, 502, 503, 504]);
    const candidates = [model, ...FALLBACK_MODELS.filter((name) => name && name !== model)];
    let upstream = null;
    for (let index = 0; index < candidates.length; index += 1) {
      const attempt = await fetch(BASE_URL + '/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...upstreamBody, model: candidates[index] }),
        signal: controller.signal,
      });
      if (attempt.ok) {
        upstream = attempt;
        break;
      }
      const text = await attempt.text();
      let detail = text;
      try {
        const parsed = JSON.parse(text);
        detail =
          (parsed.error && parsed.error.message) ||
          (parsed.error && typeof parsed.error === 'string' ? parsed.error : '') ||
          parsed.message ||
          text;
      } catch {
        /* keep text */
      }
      const status = attempt.status >= 400 && attempt.status < 600 ? attempt.status : 502;
      if (!RETRYABLE.has(status) || index === candidates.length - 1) {
        sendJSON(res, status, {
          error: {
            message: redact(String(detail || 'The provider rejected the request.')).slice(0, 1200),
            status,
            modelsTried: candidates.slice(0, index + 1),
          },
        });
        return;
      }
    }

    if (!upstream) {
      sendJSON(res, 502, { error: { message: 'No configured model could answer right now.' } });
      return;
    }

    if (wantsStream && upstream.body) {
      res.writeHead(200, {
        'Content-Type': upstream.headers.get('content-type') || 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        'X-Content-Type-Options': 'nosniff',
      });
      const reader = upstream.body.getReader();
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        if (!res.write(Buffer.from(chunk.value))) {
          await new Promise((resolve) => res.once('drain', resolve));
        }
      }
      res.end();
      return;
    }

    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': Buffer.byteLength(text),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(text);
  } catch (error) {
    if (res.writableEnded) return;
    if (res.headersSent) {
      // Headers were already sent for a stream; the only safe ending is to
      // close the connection. Do not attempt to send a JSON error page.
      try {
        res.end();
      } catch {
        /* ignore */
      }
      return;
    }
    if (error.name === 'AbortError') {
      sendJSON(res, 504, {
        error: { message: 'The provider request timed out or the client disconnected.' },
      });
      return;
    }
    sendJSON(res, 502, {
      error: {
        message: redact(
          'Could not reach the AI provider. Check PROVIDER_BASE_URL and your network. ' +
            (error.message || '')
        ).slice(0, 1200),
      },
    });
  } finally {
    clearTimeout(timer);
    res.removeListener('close', onClose);
  }
}

/* --------------------------------------------------------------------------
   Server
   -------------------------------------------------------------------------- */

const server = http.createServer(async (req, res) => {
  let pathname = '/';
  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
  } catch {
    pathname = '/';
  }

  const corsOk = applyCors(req, res);
  const origin = req.headers.origin;
  if (!corsOk && origin) {
    sendJSON(res, 403, { error: { message: 'Origin is not allowed by ALLOWED_ORIGIN.' } });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (pathname === '/api/health') {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD' });
        res.end('Method not allowed');
        return;
      }
      handleHealth(req, res);
      return;
    }
    if (pathname === '/api/chat') {
      if (!isAuthorized(req)) {
        sendJSON(res, 401, {
          error: { message: 'Access token required. Add it under Settings → Access token.' },
        });
        return;
      }
      await handleChat(req, res);
      return;
    }
    serveStatic(req, res, pathname);
  } catch (error) {
    if (!res.writableEnded && !res.headersSent) {
      sendJSON(res, 500, { error: { message: redact(error.message || 'Internal server error.') } });
    } else {
      try {
        res.end();
      } catch {
        /* ignore */
      }
    }
  }
});

if (typeof fetch !== 'function') {
  console.error('NEW AI requires Node.js 18 or newer (global fetch is missing).');
  process.exit(1);
}

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  NEW AI is running');
  console.log('  → http://' + (HOST === '0.0.0.0' ? 'localhost' : HOST) + ':' + PORT);
  console.log('  Provider: ' + BASE_URL);
  console.log('  Key: ' + (API_KEY ? 'configured' : ALLOW_NO_KEY ? 'none (ALLOW_NO_KEY)' : 'MISSING — add it to server/.env'));
  console.log('');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error('Port ' + PORT + ' is already in use. Change PORT in server/.env.');
  } else {
    console.error('Server error:', error.message);
  }
  process.exit(1);
});
