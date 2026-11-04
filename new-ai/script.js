/* ==========================================================================
   NEW AI — personal AI agent
   Vanilla JavaScript. No frameworks, no build step.

   Security notes:
   - The browser never stores a provider API key. Requests go to a local
     proxy (server/server.js) that reads the key from server/.env.
   - Every browser tool is allowlisted and goes through a permission prompt
     (unless the user explicitly changed the policy in Settings).
   - There are no canned assistant replies. If the backend is missing or
     misconfigured the UI shows a real error instead of pretending.
   ========================================================================== */

(() => {
  'use strict';

  /* =====================================================================
     Utilities
     ===================================================================== */

  const $ = (id) => document.getElementById(id);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const uid = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

  const escapeHtml = (value) =>
    String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));

  const truncate = (value, max) => {
    const str = String(value || '');
    return str.length > max ? str.slice(0, max - 1) + '…' : str;
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const formatTime = (stamp) => {
    try {
      return new Date(stamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const timeAgo = (stamp) => {
    const diff = Date.now() - Number(stamp || 0);
    if (!Number.isFinite(diff) || diff < 0) return 'now';
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return mins + 'm ago';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h ago';
    const days = Math.floor(hours / 24);
    if (days < 7) return days + 'd ago';
    return new Date(stamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const prefersReducedMotion = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // A page served from a public domain has no local proxy behind it. Used to
  // give accurate setup guidance instead of telling hosted visitors to run
  // a command on a server they do not have.
  const isLocalHost = () => {
    if (location.protocol === 'file:') return true;
    return /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/i.test(location.hostname);
  };

  // True when the page is hosted somewhere public and the user has not pointed
  // Settings at a proxy of their own. Such a page cannot answer at all.
  const isStaticDemo = () =>
    !isLocalHost() && !HOSTED_PROXY && settings.proxyUrl === defaultProxyUrl();

  /* =====================================================================
     Storage
     ===================================================================== */

  const KEY = {
    settings: 'newai.settings.v1',
    sessions: 'newai.sessions.v1',
    memories: 'newai.memories.v1',
    tasks: 'newai.tasks.v1',
    active: 'newai.active.v1',
  };

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const value = JSON.parse(raw);
      return value == null ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      toast('Local storage is full. Delete old conversations or memories.', 'error');
      return false;
    }
  }

  /* =====================================================================
     Tool registry (allowlisted browser actions only)
     ===================================================================== */

  const TOOLS = {
    open_website: {
      label: 'Open website',
      icon: 'i-globe',
      description: 'Open an http(s) address in a new browser tab.',
      async run(args) {
        const url = normalizeHttpUrl(args && args.url);
        if (!url) throw new Error('A valid http(s) URL is required.');
        const win = openSecureTab(url);
        return {
          summary: win
            ? 'Opened ' + url + ' in a new tab.'
            : 'The browser blocked the new tab for ' + url + '. Use the Open button on this card.',
          data: { url, blocked: !win },
        };
      },
    },
    web_search: {
      label: 'Web search',
      icon: 'i-search',
      description: 'Run a search query in a new tab.',
      async run(args) {
        const query = String((args && args.query) || '').trim().slice(0, 300);
        if (!query) throw new Error('A search query is required.');
        const url = 'https://duckduckgo.com/?q=' + encodeURIComponent(query);
        const win = openSecureTab(url);
        return {
          summary: win
            ? 'Searched the web for “' + query + '”.'
            : 'The browser blocked the search tab. Use the Open button on this card.',
          data: { query, url, blocked: !win },
        };
      },
    },
    copy_text: {
      label: 'Copy text',
      icon: 'i-clipboard',
      description: 'Copy approved text to the clipboard.',
      async run(args) {
        const text = String((args && args.text) || '').slice(0, 20000);
        if (!text.trim()) throw new Error('Nothing to copy.');
        await copyToClipboard(text);
        return { summary: 'Copied ' + text.length + ' characters to the clipboard.' };
      },
    },
    open_app: {
      label: 'Open desktop app',
      icon: 'i-bolt',
      description: 'Ask an optional local bridge to open an allowlisted app.',
      async run(args) {
        const app = String((args && args.app) || '').trim();
        if (!/^[a-z0-9 ._-]{1,40}$/i.test(app)) throw new Error('Invalid app name.');
        if (!settings.bridgeUrl) {
          throw new Error('No native bridge is configured. Add a bridge URL in Settings first.');
        }
        const base = settings.bridgeUrl.replace(/\/+$/, '');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);
        try {
          const res = await fetch(base + '/open', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ app }),
            signal: controller.signal,
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'The bridge refused to open ' + app + '.');
          return { summary: 'The local bridge opened ' + app + '.' };
        } catch (err) {
          if (err.name === 'AbortError') throw new Error('The native bridge did not respond.');
          throw new Error(err.message || 'Native bridge unreachable.');
        } finally {
          clearTimeout(timer);
        }
      },
    },
  };

  const TOOL_PROTOCOL = [
    'You can request approved browser tools. To call one, reply with ONLY a fenced code block tagged tool, containing JSON, for example:',
    '```tool',
    '{"name":"open_website","arguments":{"url":"https://example.com"}}',
    '```',
    'Use at most one tool per reply. Never invent a tool result. After the tool runs, the app sends you a message starting with [Tool result:]. Then continue and answer normally.',
  ].join('\n');

  /* =====================================================================
     Defaults & state
     ===================================================================== */

  // Filled in once the proxy is deployed (for example
  // https://nabeel-ameen.onrender.com/api/chat). Public pages use it
  // automatically so visitors do not have to type an endpoint.
  const HOSTED_PROXY = 'https://nabeel-ameen.loca.lt/api/chat';

  function defaultProxyUrl() {
    const web = location.protocol === 'http:' || location.protocol === 'https:';
    if (web && !isLocalHost() && HOSTED_PROXY) return HOSTED_PROXY;
    if (web) return location.origin + '/api/chat';
    return 'http://localhost:8787/api/chat';
  }

  const DEFAULT_SETTINGS = {
    proxyUrl: defaultProxyUrl(),
    token: '',
    model: 'gpt-4o-mini',
    modelTouched: false,
    maxTokens: 1024,
    temperature: 0.7,
    streaming: true,
    username: '',
    style: 'balanced',
    context: 24,
    voiceOutput: true,
    autospeak: false,
    voiceURI: '',
    lang: 'en-US',
    rate: 1,
    pitch: 1,
    wake: 'hey new ai',
    toolsEnabled: true,
    bridgeUrl: '',
    memoryEnabled: true,
    toolPolicy: {
      open_website: 'ask',
      web_search: 'ask',
      copy_text: 'ask',
      open_app: 'ask',
    },
  };

  const STYLE_PROMPTS = {
    concise: 'Be concise. Lead with the answer, then only the essential detail.',
    balanced: 'Be clear and thorough, but avoid padding. Use short sections when helpful.',
    detailed: 'Give deep, well-structured explanations with examples and edge cases.',
  };

  function normalizeSettings(input) {
    const merged = Object.assign({}, DEFAULT_SETTINGS, input || {});
    merged.toolPolicy = Object.assign({}, DEFAULT_SETTINGS.toolPolicy, (input && input.toolPolicy) || {});
    merged.maxTokens = clamp(Number(merged.maxTokens) || 1024, 64, 8192);
    merged.temperature = clamp(Number(merged.temperature) || 0, 0, 2);
    merged.context = clamp(Number(merged.context) || 24, 6, 60);
    merged.rate = clamp(Number(merged.rate) || 1, 0.5, 2);
    merged.pitch = clamp(Number(merged.pitch) || 1, 0.5, 2);
    // A static host serves no API, so a saved same-origin endpoint would fail.
    // Once a hosted proxy is configured, quietly switch such browsers to it.
    const sameOriginProxy =
      (location.protocol === 'http:' || location.protocol === 'https:') &&
      merged.proxyUrl === location.origin + '/api/chat';
    if (!merged.proxyUrl || (HOSTED_PROXY && sameOriginProxy && !isLocalHost())) {
      merged.proxyUrl = defaultProxyUrl();
    }
    merged.token = String(merged.token || '').trim();
    return merged;
  }

  let settings = normalizeSettings(readJSON(KEY.settings, {}));
  let sessions = readJSON(KEY.sessions, []);
  let memories = readJSON(KEY.memories, []);
  let tasks = readJSON(KEY.tasks, []);
  if (!Array.isArray(sessions)) sessions = [];
  if (!Array.isArray(memories)) memories = [];
  if (!Array.isArray(tasks)) tasks = [];
  sessions = sessions
    .filter((session) => session && session.id)
    .map((session) => ({
      ...session,
      messages: Array.isArray(session.messages) ? session.messages : [],
    }));
  memories = memories.filter((memory) => memory && memory.id && memory.text);
  tasks = tasks.filter((task) => task && task.id);

  const runtime = {
    busy: false,
    controller: null,
    agentRunning: false,
    agentAbort: null,
    agentTask: null,
    sessionPermissions: Object.create(null),
    voiceMode: false,
    wakeMode: false,
    pendingWake: false,
    listening: false,
    wakeListening: false,
    wakeProcessing: false,
    speaking: false,
    dictating: false,
    waveTarget: 0.06,
    authFailed: false,
    activeModel: null,
    fallbackModels: [],
    skipModelUntil: Object.create(null),
  };

  let activeSessionId = localStorage.getItem(KEY.active) || null;
  if (activeSessionId && !sessions.some((s) => s.id === activeSessionId)) {
    activeSessionId = null;
  }

  function saveSettings() {
    writeJSON(KEY.settings, settings);
  }
  function saveSessions() {
    writeJSON(KEY.sessions, sessions);
  }
  function saveMemories() {
    writeJSON(KEY.memories, memories);
  }
  function saveTasks() {
    writeJSON(KEY.tasks, tasks.slice(0, 40));
  }

  function getSession(id = activeSessionId) {
    return sessions.find((s) => s.id === id) || null;
  }

  function createSession() {
    const session = {
      id: uid(),
      title: 'New conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    sessions.unshift(session);
    activeSessionId = session.id;
    localStorage.setItem(KEY.active, activeSessionId);
    saveSessions();
    return session;
  }

  /* =====================================================================
     Toast + modal primitives
     ===================================================================== */

  function toast(message, type = 'info', timeout = 4200) {
    const root = $('toast-root');
    if (!root) return;
    const node = document.createElement('div');
    node.className = 'toast' + (type === 'error' ? ' is-error' : '');
    node.innerHTML =
      '<svg class="icon"><use href="#' +
      (type === 'error' ? 'i-alert' : 'i-check') +
      '"></use></svg><span>' +
      escapeHtml(message) +
      '</span>';
    root.appendChild(node);
    setTimeout(() => {
      node.style.opacity = '0';
      node.style.transform = 'translateY(6px)';
      setTimeout(() => node.remove(), 220);
    }, timeout);
  }

  function openModal({ title, subtitle = '', body = '', actions = [], wide = false, dismissible = true }) {
    return new Promise((resolve) => {
      const root = $('modal-root');
      if (!root) return resolve(null);
      const buttons = actions
        .map(
          (action, index) =>
            '<button class="btn ' +
            (action.variant || 'btn--ghost') +
            '" type="button" data-modal-action="' +
            index +
            '">' +
            escapeHtml(action.label) +
            '</button>'
        )
        .join('');

      root.innerHTML =
        '<div class="modal-backdrop" data-modal-backdrop>' +
        '<div class="modal ' +
        (wide ? 'modal--wide' : '') +
        '" role="dialog" aria-modal="true" aria-label="' +
        escapeHtml(title || 'Dialog') +
        '">' +
        '<div class="modal__head"><div>' +
        (title ? '<h3>' + escapeHtml(title) + '</h3>' : '') +
        (subtitle ? '<p>' + escapeHtml(subtitle) + '</p>' : '') +
        '</div>' +
        (dismissible
          ? '<button class="icon-btn modal__close" type="button" data-modal-close aria-label="Close"><svg class="icon"><use href="#i-x"></use></svg></button>'
          : '') +
        '</div>' +
        '<div class="modal__body">' +
        body +
        '</div>' +
        (buttons ? '<div class="modal__actions">' + buttons + '</div>' : '') +
        '</div></div>';

      const finish = (value) => {
        document.removeEventListener('keydown', onKey);
        root.innerHTML = '';
        resolve(value);
      };

      const onKey = (event) => {
        if (event.key === 'Escape' && dismissible) finish(null);
      };
      document.addEventListener('keydown', onKey);

      root.querySelectorAll('[data-modal-action]').forEach((button) => {
        button.addEventListener('click', () => {
          const action = actions[Number(button.dataset.modalAction)];
          finish(action ? action.value : null);
        });
      });
      const closeButton = root.querySelector('[data-modal-close]');
      if (closeButton) closeButton.addEventListener('click', () => finish(null));
      const backdrop = root.querySelector('[data-modal-backdrop]');
      if (backdrop) {
        backdrop.addEventListener('click', (event) => {
          if (event.target === backdrop && dismissible) finish(null);
        });
      }
    });
  }

  async function confirmAction(title, text, confirmLabel = 'Confirm', danger = true) {
    const choice = await openModal({
      title,
      body: '<p>' + escapeHtml(text) + '</p>',
      actions: [
        { label: 'Cancel', value: 'cancel' },
        { label: confirmLabel, value: 'ok', variant: danger ? 'btn--danger' : 'btn--primary' },
      ],
    });
    return choice === 'ok';
  }

  /* =====================================================================
     Safe Markdown renderer
     Everything is escaped first; only a small allowlist of tags is emitted.
     ===================================================================== */

  function codeBlockHtml(lang, code) {
    const label = lang ? lang.toUpperCase() : 'CODE';
    return (
      '<div class="code-block"><div class="code-head"><span>' +
      escapeHtml(label) +
      '</span><button class="code-copy" type="button" data-copy-code><svg class="icon"><use href="#i-copy"></use></svg>Copy</button></div>' +
      '<pre><code>' +
      escapeHtml(code) +
      '</code></pre></div>'
    );
  }

  function inlineMarkdown(text, codeBlocks) {
    const stash = [];
    let out = text.replace(/`([^`\n]+)`/g, (match, code) => {
      stash.push('<code>' + escapeHtml(code) + '</code>');
      return '\u0000I' + (stash.length - 1) + '\u0000';
    });

    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, href) => {
      const decoded = href.replace(/&amp;/g, '&');
      if (!/^(https?:\/\/|mailto:)/i.test(decoded)) return match;
      return (
        '<a href="' +
        href +
        '" target="_blank" rel="noopener noreferrer">' +
        label +
        '</a>'
      );
    });

    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    out = out.replace(/\u0000CB(\d+)\u0000/g, (match, index) => {
      const block = codeBlocks[Number(index)];
      return block ? codeBlockHtml(block.lang, block.code) : '';
    });
    out = out.replace(/\u0000I(\d+)\u0000/g, (match, index) => stash[Number(index)] || '');
    return out;
  }

  function renderMarkdown(source) {
    const codeBlocks = [];
    let text = String(source == null ? '' : source).replace(/\r\n?/g, '\n');

    text = text.replace(/```([^\n`]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      codeBlocks.push({ lang: String(lang || '').trim(), code });
      return '\u0000CB' + (codeBlocks.length - 1) + '\u0000';
    });
    text = text.replace(/```([^\n`]*)\n([\s\S]*)$/, (match, lang, code) => {
      codeBlocks.push({ lang: String(lang || '').trim(), code });
      return '\u0000CB' + (codeBlocks.length - 1) + '\u0000';
    });

    const lines = escapeHtml(text).split('\n');
    const html = [];
    let i = 0;

    const isTableDivider = (line) =>
      line != null && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);

    const blockStarter = (line, next) => {
      if (!line) return true;
      if (/^\s*$/.test(line)) return true;
      if (/^\u0000CB\d+\u0000\s*$/.test(line)) return true;
      if (/^\s*#{1,6}\s+/.test(line)) return true;
      if (/^\s*>\s?/.test(line)) return true;
      if (/^\s*([-*+]|\d+\.)\s+/.test(line)) return true;
      if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) return true;
      if (line.includes('|') && isTableDivider(next)) return true;
      return false;
    };

    while (i < lines.length) {
      const line = lines[i];

      if (/^\s*$/.test(line)) {
        i += 1;
        continue;
      }

      const fence = line.match(/^\u0000CB(\d+)\u0000\s*$/);
      if (fence) {
        const block = codeBlocks[Number(fence[1])];
        if (block) html.push(codeBlockHtml(block.lang, block.code));
        i += 1;
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        const level = Math.min(6, heading[1].length);
        html.push('<h' + level + '>' + inlineMarkdown(heading[2], codeBlocks) + '</h' + level + '>');
        i += 1;
        continue;
      }

      if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
        html.push('<hr>');
        i += 1;
        continue;
      }

      if (/^\s*>\s?/.test(line)) {
        const quoted = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          quoted.push(lines[i].replace(/^\s*>\s?/, ''));
          i += 1;
        }
        html.push(
          '<blockquote>' +
            quoted.map((q) => inlineMarkdown(q, codeBlocks)).join('<br>') +
            '</blockquote>'
        );
        continue;
      }

      if (line.includes('|') && isTableDivider(lines[i + 1])) {
        const splitRow = (row) => {
          let value = row.trim();
          if (value.startsWith('|')) value = value.slice(1);
          if (value.endsWith('|')) value = value.slice(0, -1);
          return value.split('|').map((cell) => cell.trim());
        };
        const headers = splitRow(line);
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].includes('|') && !/^\s*$/.test(lines[i])) {
          rows.push(splitRow(lines[i]));
          i += 1;
        }
        html.push(
          '<table><thead><tr>' +
            headers.map((cell) => '<th>' + inlineMarkdown(cell, codeBlocks) + '</th>').join('') +
            '</tr></thead><tbody>' +
            rows
              .map(
                (row) =>
                  '<tr>' +
                  row.map((cell) => '<td>' + inlineMarkdown(cell, codeBlocks) + '</td>').join('') +
                  '</tr>'
              )
              .join('') +
            '</tbody></table>'
        );
        continue;
      }

      const listMatch = line.match(/^\s*([-*+]|\d+\.)\s+/);
      if (listMatch) {
        const ordered = /\d+\./.test(listMatch[1]);
        const items = [];
        while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, ''));
          i += 1;
        }
        html.push(
          '<' +
            (ordered ? 'ol' : 'ul') +
            '>' +
            items.map((item) => '<li>' + inlineMarkdown(item, codeBlocks) + '</li>').join('') +
            '</' +
            (ordered ? 'ol' : 'ul') +
            '>'
        );
        continue;
      }

      const paragraph = [];
      while (i < lines.length && !blockStarter(lines[i], lines[i + 1])) {
        paragraph.push(lines[i]);
        i += 1;
      }
      if (!paragraph.length) {
        paragraph.push(line);
        i += 1;
      }
      html.push('<p>' + inlineMarkdown(paragraph.join('\n'), codeBlocks).replace(/\n/g, '<br>') + '</p>');
    }

    return '<div class="md">' + html.join('') + '</div>';
  }

  /* =====================================================================
     Chat rendering
     ===================================================================== */

  const TOOL_ICONS = {
    open_website: 'i-globe',
    web_search: 'i-search',
    copy_text: 'i-clipboard',
    open_app: 'i-bolt',
  };

  function welcomeHtml() {
    const suggestions = [
      { icon: 'i-code', title: 'Debug code', text: 'Find the bug in my JS', prompt: 'Review this JavaScript and explain the bug:' },
      { icon: 'i-globe', title: 'Research', text: 'Compare options', prompt: 'Compare three good laptops for a computer-science student and recommend one.' },
      { icon: 'i-edit', title: 'Write', text: 'Draft and polish', prompt: 'Help me write a short, professional email asking for a deadline extension.' },
      { icon: 'i-sparkles', title: 'Plan a task', text: 'Break it into steps', prompt: 'Plan a 7-day study schedule for learning JavaScript fundamentals.' },
    ];
    return (
      '<div class="welcome">' +
      '<div class="core core--xl" aria-hidden="true"><span class="core__ring"></span><span class="core__ring core__ring--2"></span><span class="core__ring core__ring--3"></span><span class="core__orb"></span></div>' +
      '<span class="welcome__eyebrow">NEW AI — online</span>' +
      '<h2>Good to see you. <span>What should we build?</span></h2>' +
      '<p>Ask for code, research, writing, math or a plan. I can use approved browser tools when you give permission.</p>' +
      '<div class="suggestions">' +
      suggestions
        .map(
          (item) =>
            '<button class="suggestion" type="button" data-prompt="' +
            escapeHtml(item.prompt) +
            '"><svg class="icon"><use href="#' +
            item.icon +
            '"></use></svg><span><b>' +
            escapeHtml(item.title) +
            '</b><small>' +
            escapeHtml(item.text) +
            '</small></span></button>'
        )
        .join('') +
      '</div></div>'
    );
  }

  function toolsHtml(message) {
    if (!message.meta || !Array.isArray(message.meta.tools) || !message.meta.tools.length) return '';
    return (
      '<div class="tool-calls">' +
      message.meta.tools
        .map((call) => {
          const status = call.status || 'pending';
          const label = TOOLS[call.name] ? TOOLS[call.name].label : call.name;
          const openUrl =
            call.blocked && call.args && typeof call.args.url === 'string'
              ? normalizeHttpUrl(call.args.url)
              : null;
          const link = openUrl
            ? '<a class="tool-call__link" href="' +
              escapeHtml(openUrl) +
              '" target="_blank" rel="noopener noreferrer">Open</a>'
            : '';
          return (
            '<div class="tool-call is-' +
            status +
            (call.blocked ? ' is-blocked' : '') +
            '"><svg class="icon"><use href="#' +
            (TOOL_ICONS[call.name] || 'i-bolt') +
            '"></use></svg><div class="tool-call__body"><b>' +
            escapeHtml(label) +
            '</b><small>' +
            escapeHtml(call.detail || (status === 'pending' ? 'Waiting for permission…' : 'Done')) +
            '</small></div>' +
            link +
            '<span class="tool-call__state">' +
            escapeHtml(status === 'done' ? 'done' : status === 'error' ? 'failed' : '…') +
            '</span></div>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function messageHtml(message) {
    const isUser = message.role === 'user';
    const error = message.meta && message.meta.error;
    const raw = String(message.content || '');
    let bubble;

    if (error) {
      bubble =
        '<div class="msg__error-title"><svg class="icon"><use href="#i-alert"></use></svg>' +
        escapeHtml(error.message || 'Something went wrong.') +
        '</div>' +
        (error.hint ? '<div class="msg__error-hint">' + error.hint + '</div>' : '');
    } else if (isUser) {
      bubble = escapeHtml(raw).replace(/\n/g, '<br>');
    } else if (message.streaming && !raw.trim()) {
      bubble = '<span class="typing"><span></span><span></span><span></span></span>';
    } else {
      bubble = renderMarkdown(raw);
      if (message.streaming) bubble += '<span class="stream-caret"></span>';
    }

    const actions = isUser
      ? ''
      : '<div class="msg__actions">' +
        '<button class="msg__action" type="button" data-copy-msg="' +
        message.id +
        '" title="Copy response" aria-label="Copy response"><svg class="icon"><use href="#i-copy"></use></svg></button>' +
        '<button class="msg__action" type="button" data-speak-msg="' +
        message.id +
        '" title="Read aloud" aria-label="Read aloud"><svg class="icon"><use href="#i-volume"></use></svg></button>' +
        '</div>';

    return (
      '<article class="msg msg--' +
      (isUser ? 'user' : 'assistant') +
      (error ? ' is-error' : '') +
      '" data-msg-id="' +
      message.id +
      '">' +
      '<div class="msg__avatar"><svg class="icon"><use href="#' +
      (isUser ? 'i-chat' : 'i-sparkles') +
      '"></use></svg></div>' +
      '<div class="msg__main"><div class="msg__bubble">' +
      bubble +
      '</div>' +
      toolsHtml(message) +
      '<div class="msg__meta"><span>' +
      (isUser ? 'You' : 'NEW AI') +
      '</span><span>·</span><span>' +
      formatTime(message.createdAt) +
      '</span>' +
      (message.meta && message.meta.stopped ? '<span>· stopped</span>' : '') +
      actions +
      '</div></div></article>'
    );
  }

  let chatRenderQueued = false;

  function scheduleChatRender() {
    if (chatRenderQueued) return;
    chatRenderQueued = true;
    requestAnimationFrame(() => {
      chatRenderQueued = false;
      renderChat({ stick: true });
    });
  }

  function isNearBottom() {
    const scroller = $('chat-scroll');
    if (!scroller) return true;
    return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 180;
  }

  function scrollToBottom() {
    const scroller = $('chat-scroll');
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
    const button = $('scroll-bottom');
    if (button) button.hidden = true;
  }

  function updateScrollButton() {
    const button = $('scroll-bottom');
    if (button) button.hidden = isNearBottom();
  }

  function renderChat({ stick = false } = {}) {
    const session = getSession();
    const mount = $('chat-messages');
    if (!mount) return;
    const shouldStick = stick || isNearBottom();

    if (!session || !session.messages.length) {
      mount.innerHTML = welcomeHtml();
    } else {
      mount.innerHTML = session.messages
        .filter((message) => !(message.meta && message.meta.hidden))
        .map(messageHtml)
        .join('');
    }

    if (shouldStick) scrollToBottom();
    updateScrollButton();
  }

  /* =====================================================================
     Session list
     ===================================================================== */

  function renderSessionList() {
    const mount = $('conversation-list');
    if (!mount) return;
    const query = ($('conversation-search').value || '').trim().toLowerCase();

    const visible = sessions
      .filter((session) => {
        if (!query) return true;
        if (String(session.title || '').toLowerCase().includes(query)) return true;
        return session.messages.some(
          (message) =>
            !(message.meta && message.meta.hidden) &&
            String(message.content || '').toLowerCase().includes(query)
        );
      })
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    $('conversation-count').textContent = String(sessions.length);

    if (!visible.length) {
      mount.innerHTML =
        '<p class="history-empty" role="listitem">' +
        (sessions.length ? 'No conversations match.' : 'No conversations yet.') +
        '</p>';
      return;
    }

    mount.innerHTML = visible
      .map(
        (session) =>
          '<div class="history-item' +
          (session.id === activeSessionId ? ' is-active' : '') +
          '" data-session="' +
          session.id +
          '" role="listitem">' +
          '<div class="history-item__body"><div class="history-item__title">' +
          escapeHtml(session.title || 'New conversation') +
          '</div><div class="history-item__meta">' +
          timeAgo(session.updatedAt) +
          ' · ' +
          session.messages.filter(
            (message) => message.role === 'user' && !(message.meta && message.meta.hidden)
          ).length +
          ' prompts</div></div>' +
          '<button class="history-item__more" type="button" data-session-menu="' +
          session.id +
          '" aria-label="Conversation options"><svg class="icon"><use href="#i-more"></use></svg></button>' +
          '</div>'
      )
      .join('');
  }

  function loadSession(id) {
    if (runtime.busy || runtime.agentRunning) {
      toast('Wait for the current run to finish first.');
      return;
    }
    const session = getSession(id);
    if (!session) return;
    activeSessionId = id;
    localStorage.setItem(KEY.active, id);
    renderSessionList();
    renderChat();
    switchView('chat');
  }

  function startNewChat() {
    if (runtime.busy) {
      toast('Stop the current response first.');
      return;
    }
    activeSessionId = null;
    localStorage.removeItem(KEY.active);
    renderSessionList();
    renderChat();
    switchView('chat');
    const input = $('prompt-input');
    if (input) {
      input.value = '';
      autoResizeComposer();
      input.focus();
    }
  }

  function deleteSession(id) {
    sessions = sessions.filter((session) => session.id !== id);
    if (activeSessionId === id) {
      activeSessionId = null;
      localStorage.removeItem(KEY.active);
    }
    saveSessions();
    renderSessionList();
    renderChat();
    toast('Conversation deleted.');
  }

  async function openSessionMenu(id) {
    const session = getSession(id);
    if (!session) return;
    const choice = await openModal({
      title: truncate(session.title || 'Conversation', 64),
      subtitle: 'Updated ' + timeAgo(session.updatedAt),
      body: '<p>Rename this conversation or delete it from local storage.</p>',
      actions: [
        { label: 'Rename', value: 'rename' },
        { label: 'Delete', value: 'delete', variant: 'btn--danger' },
        { label: 'Close', value: 'close' },
      ],
    });
    if (choice === 'rename') {
      const name = await openTextModal({
        title: 'Rename conversation',
        value: session.title || '',
        placeholder: 'Conversation title',
        saveLabel: 'Save',
      });
      if (name && name.trim()) {
        session.title = truncate(name.trim(), 80);
        session.updatedAt = Date.now();
        saveSessions();
        renderSessionList();
      }
    } else if (choice === 'delete') {
      const yes = await confirmAction(
        'Delete conversation?',
        'This removes the conversation from this browser. It cannot be undone.',
        'Delete'
      );
      if (yes) deleteSession(id);
    }
  }

  function openTextModal({ title, subtitle = '', value = '', placeholder = '', saveLabel = 'Save' }) {
    return new Promise((resolve) => {
      const root = $('modal-root');
      if (!root) return resolve(null);
      root.innerHTML =
        '<div class="modal-backdrop" data-modal-backdrop><div class="modal" role="dialog" aria-modal="true" aria-label="' +
        escapeHtml(title) +
        '"><div class="modal__head"><div><h3>' +
        escapeHtml(title) +
        '</h3>' +
        (subtitle ? '<p>' + escapeHtml(subtitle) + '</p>' : '') +
        '</div><button class="icon-btn modal__close" type="button" data-cancel aria-label="Close"><svg class="icon"><use href="#i-x"></use></svg></button></div>' +
        '<div class="modal__body"><label class="field-label" for="text-modal-input">Name</label><input class="field" id="text-modal-input" type="text" value="' +
        escapeHtml(value) +
        '" placeholder="' +
        escapeHtml(placeholder) +
        '"></div>' +
        '<div class="modal__actions"><button class="btn btn--ghost" type="button" data-cancel>Cancel</button><button class="btn btn--primary" type="button" data-save>' +
        escapeHtml(saveLabel) +
        '</button></div></div></div>';

      const input = $('text-modal-input');
      const finish = (result) => {
        document.removeEventListener('keydown', onKey);
        root.innerHTML = '';
        resolve(result);
      };
      const onKey = (event) => {
        if (event.key === 'Escape') finish(null);
        if (event.key === 'Enter' && event.target === input) finish(input.value);
      };
      document.addEventListener('keydown', onKey);
      root.querySelectorAll('[data-cancel]').forEach((btn) =>
        btn.addEventListener('click', () => finish(null))
      );
      root.querySelector('[data-save]').addEventListener('click', () => finish(input.value));
      input.focus();
      input.select();
    });
  }

  /* =====================================================================
     Clipboard + URL helpers
     ===================================================================== */

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      /* fall through */
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    if (!ok) throw new Error('Clipboard access was blocked by the browser.');
    return true;
  }

  function normalizeHttpUrl(value) {
    let raw = String(value || '').trim();
    if (!raw) return null;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) raw = 'https://' + raw;
    if (!/^https?:\/\//i.test(raw)) return null;
    if (raw.length > 2048) return null;
    try {
      const url = new URL(raw);
      if (!url.hostname) return null;
      return url.toString();
    } catch {
      return null;
    }
  }

  // window.open with the 'noopener' feature returns null even on success, which
  // made every working tab look like a blocked popup. Open first, then detach
  // the opener manually so the return value stays truthful.
  function openSecureTab(url) {
    let win = null;
    try {
      win = window.open(url, '_blank');
    } catch {
      win = null;
    }
    if (win) {
      try {
        win.opener = null;
      } catch {
        /* cross-origin handle: the opener is already severed */
      }
    }
    return win;
  }

  /* =====================================================================
     AI transport — OpenAI-compatible proxy
     ===================================================================== */

  class ApiError extends Error {
    constructor(message, status = 0, detail = '') {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.detail = detail;
    }
  }

  function humanizeRetry(raw) {
    const hours = Number((/(\d+)\s*h/i.exec(raw) || [])[1] || 0);
    const minutes = Number((/(\d+)\s*m/i.exec(raw) || [])[1] || 0);
    const seconds = Math.ceil(Number((/([\d.]+)\s*s/i.exec(raw) || [])[1] || 0));
    if (hours) return hours + 'h' + (minutes ? ' ' + minutes + 'm' : '');
    if (minutes) return minutes + 'm';
    return seconds + 's';
  }

  function friendlyStatus(status, detail) {
    const raw = String(detail || '').replace(/\s+/g, ' ');
    const clean = raw.replace(/[.\s]+$/, '').slice(0, 240);
    const extra = clean ? ' — ' + clean : '';
    if (status === 401 || status === 403) {
      return 'The provider rejected the API key' + extra + '. Check server/.env.';
    }
    if (status === 404) {
      return 'The provider or model was not found' + extra + '. Check the base URL and model name.';
    }
    if (status === 429) {
      // Free-tier providers usually say exactly which quota ran out and when it
      // resets. Surface that instead of a vague "try again later".
      const limit = /limit:\s*(\d+)/i.exec(raw);
      const model = /model:\s*([\w.\-]+)/i.exec(raw);
      const retry = /retry in\s*([\dhms.\s]+)/i.exec(raw);
      const daily = /per day limit exceeded/i.test(raw);
      let message = daily ? 'Daily quota reached' : 'Rate limit reached';
      if (limit) {
        message += ' (' + limit[1] + ' requests' + (daily ? '/day' : '') +
          (model ? ' for ' + model[1] : '') + ')';
      }
      if (retry) message += ' — resets in about ' + humanizeRetry(retry[1]);
      else message += ' — wait a moment and retry';
      return message + '.';
    }
    if (status === 400) {
      return 'The provider rejected the request' + extra + '.';
    }
    if (status === 405) {
      return 'This page was served by a static host, which does not accept chat requests. Run the local server instead.';
    }
    if (status === 503) {
      return 'The AI backend is not ready' + extra + '.';
    }
    if (status >= 500) {
      return 'The AI backend or provider failed' + extra + '.';
    }
    return (clean || 'The AI backend returned HTTP ' + status) + '.';
  }

  function describeError(error) {
    if (error && error.name === 'AbortError') {
      return { message: 'Generation stopped.', hint: '' };
    }
    if (!navigator.onLine) {
      return {
        message: 'This device is offline.',
        hint: 'Reconnect to the internet, then try again.',
      };
    }
    if (error instanceof TypeError || /failed to fetch|networkerror|load failed|fetch failed/i.test(String(error && error.message))) {
      return {
        message: 'NEW AI cannot reach its backend.',
        hint: isLocalHost()
          ? 'Start the local proxy with <code>node server/server.js</code> and make sure the endpoint in Settings matches. A static page cannot call a provider securely on its own.'
          : 'This copy is hosted as a static page, so it has no AI backend. Run <code>node server/server.js</code> on your computer and use the local URL, or point Settings → Proxy endpoint at an HTTPS proxy you control.',
      };
    }
    if (error instanceof ApiError) {
      if (error.status === 0) {
        return {
          message: error.message,
          hint: 'Check the endpoint and the provider configuration in <code>server/.env</code>.',
        };
      }
      return {
        message: error.message,
        hint:
          error.status === 401 && settings.token
            ? 'The proxy rejected the access token. Check Settings → Access token.'
            : error.status === 401 || error.status === 403
              ? 'The key stays on the server. Put it in <code>server/.env</code>, never in the browser.'
              : error.status === 429
              ? 'Free-tier quotas reset automatically. Switch the model in Settings, add billing to the key, or wait for the reset shown above.'
              : 'Server logs may contain more detail. Do not expose secrets in the browser console.',
      };
    }
    return {
      message: (error && error.message) || 'Unexpected error.',
      hint: 'Try again, or test the connection from Settings.',
    };
  }

  // The optional token only exists for public proxies. It is stored in this
  // browser's localStorage and never bundled into the site.
  function authHeaders(extra = {}) {
    const headers = Object.assign({}, extra);
    if (settings.token) headers.Authorization = 'Bearer ' + settings.token;
    return headers;
  }

  // One request against one model. callChat() wraps this with quota fallback.
  async function callChatOnce(messages, { signal, onDelta, streamOverride, model } = {}) {
    if (!settings.proxyUrl) {
      throw new ApiError('No AI endpoint is configured. Open Settings and add a proxy URL.', 0);
    }
    const wantsStream = streamOverride === undefined ? Boolean(settings.streaming) : Boolean(streamOverride);
    const body = {
      model: model || settings.model,
      messages,
      temperature: Number(settings.temperature),
      max_tokens: Number(settings.maxTokens),
      stream: wantsStream,
    };

    let response;
    try {
      response = await fetch(settings.proxyUrl, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new ApiError('Could not reach ' + settings.proxyUrl + '. Is the server running?', 0);
    }

    if (!response.ok) {
      let detail = '';
      let message = '';
      try {
        const data = await response.json();
        detail = (data && data.error && data.error.message) || (data && data.error) || (data && data.message) || '';
        if (typeof detail !== 'string') detail = JSON.stringify(detail);
        message = (data && data.error && data.error.message) || '';
      } catch {
        try {
          detail = await response.text();
        } catch {
          detail = '';
        }
      }
      throw new ApiError(friendlyStatus(response.status, detail), response.status, detail);
    }

    const contentType = response.headers.get('content-type') || '';

    if (wantsStream && contentType.includes('text/event-stream') && response.body && response.body.getReader) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';
      let finished = false;

      while (!finished) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });

        let newline = buffer.indexOf('\n');
        while (newline !== -1) {
          const line = buffer.slice(0, newline).replace(/\r$/, '');
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf('\n');
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          if (payload === '[DONE]') {
            finished = true;
            break;
          }
          let parsed;
          try {
            parsed = JSON.parse(payload);
          } catch {
            continue;
          }
          if (parsed.error) {
            throw new ApiError(
              (parsed.error && parsed.error.message) || 'The provider reported an error.',
              0
            );
          }
          const choice = parsed.choices && parsed.choices[0];
          const delta =
            (choice && choice.delta && choice.delta.content) ||
            (choice && choice.message && choice.message.content) ||
            (choice && choice.text) ||
            '';
          if (delta) {
            full += delta;
            if (onDelta) onDelta(delta);
          }
        }
      }

      if (!full.trim()) throw new ApiError('The provider returned an empty response.');
      return full;
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new ApiError('The backend returned a response that was not JSON.');
    }
    const choice = data && data.choices && data.choices[0];
    const text =
      (choice && choice.message && choice.message.content) ||
      (choice && choice.text) ||
      (data && data.content) ||
      '';
    if (typeof text !== 'string' || !text.trim()) {
      throw new ApiError('The provider returned an empty response. Check the model name.');
    }
    if (onDelta) onDelta(text);
    return text;
  }

  function retryDelayMs(raw) {
    const hours = Number((/(\d+)\s*h/i.exec(raw) || [])[1] || 0);
    const minutes = Number((/(\d+)\s*m/i.exec(raw) || [])[1] || 0);
    const seconds = Number((/([\d.]+)\s*s/i.exec(raw) || [])[1] || 0);
    return ((hours * 60 + minutes) * 60 + seconds) * 1000;
  }

  // Free-tier providers can refuse a model for the day while another model on
  // the same key still has quota. The server lists those fallbacks in
  // /api/health, so a quota error becomes a slower answer instead of a dead end.
  async function callChat(messages, opts = {}) {
    const primary = settings.model;
    const fallbacks = (runtime.fallbackModels || []).filter((name) => name && name !== primary);
    const skipPrimary =
      fallbacks.length > 0 &&
      runtime.skipModelUntil &&
      runtime.skipModelUntil[primary] > Date.now();
    const candidates = skipPrimary ? [...fallbacks, primary] : [primary, ...fallbacks];
    let produced = false;
    let lastError = null;

    for (let index = 0; index < candidates.length; index += 1) {
      const model = candidates[index];
      try {
        const text = await callChatOnce(messages, {
          signal: opts.signal,
          streamOverride: opts.streamOverride,
          model,
          onDelta: opts.onDelta
            ? (delta) => {
                produced = true;
                opts.onDelta(delta);
              }
            : undefined,
        });
        const changed = runtime.activeModel !== model;
        runtime.activeModel = model;
        if (model !== primary && changed) {
          toast('“' + primary + '” is out of quota — answering with “' + model + '”.');
        }
        updateModelPill();
        return text;
      } catch (error) {
        lastError = error;
        const status = error instanceof ApiError ? error.status : 0;
        if (status === 429) {
          // Remember when this model resets so the next message skips it.
          const raw = String((error && error.detail) || '');
          const wait = retryDelayMs((/retry in\s*([\dhms.\s]+)/i.exec(raw) || [])[1] || '');
          runtime.skipModelUntil = runtime.skipModelUntil || Object.create(null);
          runtime.skipModelUntil[model] = Date.now() + Math.min(wait, 24 * 60 * 60 * 1000);
        }
        const retryable = status === 429 || status === 503;
        const canRetry =
          retryable &&
          !produced &&
          !(opts.signal && opts.signal.aborted) &&
          index < candidates.length - 1;
        if (!canRetry) throw error;
      }
    }

    throw lastError || new ApiError('The provider returned no response.');
  }

  /* =====================================================================
     Tool calls & permissions
     ===================================================================== */

  function extractToolCalls(content) {
    const calls = [];
    const cleanText = String(content || '')
      .replace(/```tool[ \t]*\r?\n([\s\S]*?)```/gi, (match, json) => {
        let parsed;
        try {
          parsed = JSON.parse(json.trim());
        } catch {
          return match;
        }
        if (!parsed || typeof parsed.name !== 'string') return match;
        calls.push({
          id: uid(),
          name: parsed.name,
          args: parsed.arguments && typeof parsed.arguments === 'object' ? parsed.arguments : {},
          status: 'pending',
        });
        return '';
      })
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return { cleanText, calls };
  }

  async function requestToolPermission(call) {
    const policy = settings.toolPolicy[call.name] || 'ask';
    if (policy === 'block') {
      return { granted: false, reason: 'This tool is blocked in Settings.' };
    }
    if (call.name === 'open_app') {
      if (runtime.sessionPermissions.open_app) return { granted: true };
      return promptToolPermission(call);
    }
    if (policy === 'allow' || runtime.sessionPermissions[call.name]) {
      return { granted: true };
    }
    return promptToolPermission(call);
  }

  async function promptToolPermission(call) {
    const tool = TOOLS[call.name];
    const label = tool ? tool.label : call.name;
    const pretty = escapeHtml(JSON.stringify(call.args || {}, null, 2));
    const result = await openModal({
      title: 'Permission required',
      subtitle: 'NEW AI wants to use a browser tool',
      body:
        '<div class="permission-icon"><svg class="icon"><use href="#i-shield"></use></svg></div>' +
        '<p>NEW AI requested:</p>' +
        '<span class="permission-name"><svg class="icon" style="width:12px;height:12px"><use href="#' +
        (TOOL_ICONS[call.name] || 'i-bolt') +
        '"></use></svg>' +
        escapeHtml(call.name) +
        '</span>' +
        '<div class="permission-args">' +
        pretty +
        '</div>' +
        '<p class="fine-print" style="margin-top:12px"><svg class="icon"><use href="#i-alert"></use></svg>Only allow actions you understand. NEW AI cannot run arbitrary commands.</p>',
      actions: [
        { label: 'Deny', value: 'deny' },
        { label: 'Allow once', value: 'once', variant: 'btn--primary' },
        { label: 'Allow for session', value: 'session' },
      ],
    });
    if (result === 'session') {
      runtime.sessionPermissions[call.name] = true;
      return { granted: true };
    }
    if (result === 'once') return { granted: true };
    return { granted: false, reason: 'Permission denied by the user.' };
  }

  async function executeToolCall(call) {
    const tool = TOOLS[call.name];
    if (!tool) return { ok: false, summary: 'Unknown tool: ' + call.name };
    if (!settings.toolsEnabled) return { ok: false, summary: 'Tool use is disabled in Settings.' };

    const permission = await requestToolPermission(call);
    if (!permission.granted) {
      return { ok: false, summary: permission.reason || 'Permission denied.' };
    }

    try {
      const result = await tool.run(call.args || {});
      return { ok: true, summary: (result && result.summary) || 'Done.', data: result && result.data };
    } catch (error) {
      return { ok: false, summary: error.message || 'The tool failed.' };
    }
  }

  /* =====================================================================
     Prompt construction
     ===================================================================== */

  function buildSystemPrompt(query) {
    const parts = [
      'You are NEW AI, a JARVIS-inspired personal AI agent: intelligent, professional, friendly and practical. You help with coding, mathematics, general knowledge, writing, translation, study and everyday tasks.',
      'Current date: ' + new Date().toDateString() + '.',
      'Answer style: ' + (STYLE_PROMPTS[settings.style] || STYLE_PROMPTS.balanced),
      settings.username ? 'The user\u2019s name is ' + settings.username + '. Address them naturally.' : '',
      'Use Markdown: short headings, lists, tables when useful, and fenced code blocks with a language tag. Never invent facts, sources, quotes or test results. Say when you are unsure.',
    ];

    if (settings.memoryEnabled) {
      const relevant = relevantMemories(query);
      if (relevant.length) {
        parts.push(
          'User-approved memories (use only when relevant, do not repeat them unnecessarily):\n' +
            relevant.map((memory) => '- (' + memory.category + ') ' + memory.text).join('\n')
        );
      }
    }

    if (settings.toolsEnabled) {
      const available = Object.keys(TOOLS)
        .filter((name) => settings.toolPolicy[name] !== 'block')
        .map((name) => '- ' + name + ': ' + TOOLS[name].description)
        .join('\n');
      parts.push(
        'Approved tools available to you:\n' +
          available +
          '\n\n' +
          TOOL_PROTOCOL +
          '\n\nRules: never claim that a site was opened, text was copied, an app was launched or a search was run unless a [Tool result:] confirms it. Ask before sensitive or irreversible actions. Do not attempt to call tools that are not listed.'
      );
    } else {
      parts.push('Tool use is currently disabled. Do not output tool blocks; answer with text only.');
    }

    return parts.filter(Boolean).join('\n\n');
  }

  function buildRequestMessages(session, excludeId) {
    const lastUser = [...session.messages]
      .reverse()
      .find((message) => message.role === 'user' && !(message.meta && message.meta.hidden));
    const system = {
      role: 'system',
      content: buildSystemPrompt(lastUser ? lastUser.content : ''),
    };

    const history = session.messages
      .filter((message) => {
        if (message.id === excludeId) return false;
        if (message.meta && message.meta.error) return false;
        if (message.meta && message.meta.hidden && !message.meta.toolResult) return false;
        if (message.role !== 'user' && message.role !== 'assistant') return false;
        if (message.role === 'assistant' && !String(message.content || '').trim()) {
          return Boolean(message.meta && message.meta.tools && message.meta.tools.length);
        }
        return true;
      })
      .slice(-Math.max(6, settings.context))
      .map((message) => {
        let content = String(message.content || '');
        if (
          message.role === 'assistant' &&
          !content.trim() &&
          message.meta &&
          message.meta.tools &&
          message.meta.tools.length
        ) {
          content = '[Requested tool: ' + message.meta.tools.map((tool) => tool.name).join(', ') + ']';
        }
        return { role: message.role, content: truncate(content, 24000) };
      });

    return [system, ...history];
  }

  /* =====================================================================
     Chat turn
     ===================================================================== */

  function updateComposerState() {
    const send = $('send-btn');
    const stop = $('stop-btn');
    const dot = $('composer-dot');
    const status = $('composer-status');
    if (send) send.disabled = runtime.busy;
    if (stop) stop.hidden = !runtime.busy;
    if (dot) dot.className = 'status-dot status-dot--tiny' + (runtime.busy ? ' is-busy' : '');
    if (status) {
      status.textContent = runtime.busy
        ? 'NEW AI is working…'
        : isStaticDemo()
          ? 'Static demo — run node server/server.js, then open http://127.0.0.1:8787'
          : 'NEW AI can make mistakes. Verify important information.';
    }
  }

  function autoResizeComposer() {
    const input = $('prompt-input');
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = Math.min(180, Math.max(48, input.scrollHeight)) + 'px';
    const count = $('char-count');
    if (count) count.textContent = String(input.value.length);
  }

  function stopGeneration() {
    if (runtime.controller) {
      runtime.controller.abort();
    }
  }

  async function generateReply(session, opts = {}) {
    const controller = new AbortController();
    runtime.controller = controller;
    let toolRounds = 0;
    let totalToolCalls = 0;
    let lastText = '';

    while (toolRounds < 3) {
      const assistant = {
        id: uid(),
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        streaming: true,
        meta: {},
      };
      session.messages.push(assistant);
      renderChat({ stick: true });

      let raw = '';
      try {
        const messages = buildRequestMessages(session, assistant.id);
        await callChat(messages, {
          signal: controller.signal,
          onDelta(delta) {
            raw += delta;
            assistant.content = raw;
            scheduleChatRender();
          },
        });
      } catch (error) {
        assistant.streaming = false;
        if (error.name === 'AbortError') {
          if (raw.trim()) {
            assistant.content = raw;
            assistant.meta.stopped = true;
          } else {
            session.messages = session.messages.filter((message) => message.id !== assistant.id);
          }
          session.updatedAt = Date.now();
          saveSessions();
          renderChat({ stick: true });
          throw error;
        }
        session.messages = session.messages.filter((message) => message.id !== assistant.id);
        const errorMessage = {
          id: uid(),
          role: 'assistant',
          content: '',
          createdAt: Date.now(),
          meta: { error: describeError(error) },
        };
        session.messages.push(errorMessage);
        session.updatedAt = Date.now();
        saveSessions();
        renderChat({ stick: true });
        throw error;
      }

      assistant.streaming = false;
      const parsed = extractToolCalls(raw);
      assistant.content = parsed.cleanText;
      lastText = parsed.cleanText;

      if (!parsed.calls.length) {
        assistant.meta.finished = true;
        session.updatedAt = Date.now();
        saveSessions();
        renderChat({ stick: true });
        return lastText;
      }

      assistant.meta.tools = [];
      let askedModelAgain = false;

      for (const call of parsed.calls) {
        if (controller.signal.aborted) break;
        if (totalToolCalls >= 6) {
          assistant.meta.tools.push({
            name: call.name,
            args: call.args,
            status: 'error',
            detail: 'Tool limit reached for this turn.',
          });
          renderChat({ stick: true });
          continue;
        }
        totalToolCalls += 1;

        const card = {
          name: call.name,
          args: call.args,
          status: 'pending',
          detail: 'Waiting for permission…',
          blocked: false,
        };
        assistant.meta.tools.push(card);
        renderChat({ stick: true });

        const result = await executeToolCall(call);
        card.status = result.ok ? 'done' : 'error';
        card.detail = result.summary;
        card.blocked = Boolean(result.data && result.data.blocked);
        assistant.meta.tools = assistant.meta.tools.slice();
        renderChat({ stick: true });

        session.messages.push({
          id: uid(),
          role: 'user',
          content:
            '[Tool result: ' +
            call.name +
            ']\n' +
            JSON.stringify({ ok: result.ok, summary: result.summary }).slice(0, 4000),
          createdAt: Date.now(),
          meta: { hidden: true, toolResult: true },
        });

        askedModelAgain = true;
        session.updatedAt = Date.now();
        saveSessions();
      }

      if (controller.signal.aborted) {
        assistant.meta.stopped = true;
        saveSessions();
        renderChat({ stick: true });
        throw new DOMException('Aborted', 'AbortError');
      }

      if (!askedModelAgain) {
        assistant.meta.finished = true;
        saveSessions();
        renderChat({ stick: true });
        return lastText;
      }

      toolRounds += 1;
      if (toolRounds >= 3) {
        const note = {
          id: uid(),
          role: 'assistant',
          content: 'I used the approved tools. Ask me to continue if you need another step.',
          createdAt: Date.now(),
          meta: { finished: true },
        };
        session.messages.push(note);
        session.updatedAt = Date.now();
        saveSessions();
        renderChat({ stick: true });
        return note.content;
      }
    }

    return lastText;
  }

  async function sendMessage(text, opts = {}) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return '';
    if (runtime.busy || runtime.agentRunning) {
      toast('NEW AI is busy. Stop the current run first.');
      return '';
    }
    if (trimmed.length > 24000) {
      toast('That message is too long. Split it into smaller parts.', 'error');
      return '';
    }

    // Do not fire a doomed POST at a static host: GitHub Pages answers 405 and
    // the user sees a confusing "AI backend" error. Say what to do instead.
    if (isStaticDemo()) {
      let session = getSession();
      if (!session) session = createSession();
      session.messages.push({
        id: uid(),
        role: 'user',
        content: trimmed,
        createdAt: Date.now(),
        meta: { via: opts.viaVoice ? 'voice' : 'text' },
      });
      session.messages.push({
        id: uid(),
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        meta: {
          error: {
            message: 'This published copy is a static demo, so it has no AI backend.',
            hint:
              'Run <code>node server/server.js</code> inside the <code>NEW-AI</code> folder, then open <code>http://127.0.0.1:8787</code>. A github.io page cannot host a server. Never paste a provider API key into a public page.',
          },
        },
      });
      session.updatedAt = Date.now();
      saveSessions();
      renderSessionList();
      renderChat({ stick: true });
      return '';
    }

    let session = getSession();
    if (!session) session = createSession();

    const userMessage = {
      id: uid(),
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
      meta: { via: opts.viaVoice ? 'voice' : 'text' },
    };
    session.messages.push(userMessage);

    const userCount = session.messages.filter(
      (message) => message.role === 'user' && !(message.meta && message.meta.hidden)
    ).length;
    if (userCount === 1) {
      session.title = truncate(trimmed.replace(/\s+/g, ' '), 70);
    }
    session.updatedAt = Date.now();
    saveSessions();
    renderSessionList();
    renderChat({ stick: true });

    const input = $('prompt-input');
    if (input) input.value = '';
    autoResizeComposer();

    runtime.busy = true;
    updateComposerState();

    try {
      const finalText = await generateReply(session, opts);
      if (finalText && settings.voiceOutput && (opts.viaVoice || settings.autospeak)) {
        await speak(finalText);
      }
      return finalText;
    } catch (error) {
      if (error.name === 'AbortError') {
        toast('Generation stopped.');
      } else {
        toast(describeError(error).message, 'error');
        // A 404 usually means the saved model does not exist at the provider.
        // Re-read the server config so the UI can adopt the right model.
        if (error instanceof ApiError && error.status === 404) checkBackend();
      }
      return '';
    } finally {
      runtime.busy = false;
      runtime.controller = null;
      updateComposerState();
      saveSessions();
    }
  }

  /* =====================================================================
     Agent system — plan, execute, report
     ===================================================================== */

  const AGENT_META = {
    assistant: {
      label: 'Personal',
      icon: 'i-sparkles',
      role: 'a pragmatic personal assistant who plans everyday tasks, tracks constraints and produces clear next steps.',
    },
    coding: {
      label: 'Coding',
      icon: 'i-code',
      role: 'a senior software engineer who writes correct, runnable code, explains trade-offs and includes verification steps.',
    },
    research: {
      label: 'Research',
      icon: 'i-globe',
      role: 'a careful researcher who separates verified facts from assumptions, compares options and cites sources only when real evidence exists.',
    },
    writing: {
      label: 'Writing',
      icon: 'i-edit',
      role: 'an experienced writer and editor who adapts tone, structure and clarity to the audience.',
    },
  };

  const AGENT_STATUS_LABELS = {
    planning: 'Planning',
    running: 'Running',
    synthesizing: 'Summarising',
    done: 'Complete',
    error: 'Failed',
    stopped: 'Stopped',
  };

  function completeChat(messages, { signal, onDelta, stream = false } = {}) {
    return callChat(messages, { signal, onDelta, streamOverride: stream });
  }

  function extractJson(text) {
    let source = String(text || '').trim();
    source = source.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    try {
      return JSON.parse(source);
    } catch {
      const start = source.indexOf('{');
      const end = source.lastIndexOf('}');
      if (start === -1 || end <= start) return null;
      try {
        return JSON.parse(source.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }

  function setAgentStatus(label, tone = '') {
    const badge = $('agent-status');
    if (!badge) return;
    badge.textContent = label;
    badge.className = 'badge ' + (tone || 'badge--soft');
  }

  function updateAgentButtons() {
    const run = $('agent-run');
    const stop = $('agent-stop');
    if (run) {
      run.disabled = runtime.agentRunning || runtime.busy;
      run.classList.toggle('is-loading', runtime.agentRunning);
    }
    if (stop) stop.disabled = !runtime.agentRunning;
  }

  function renderAgentResult() {
    const box = $('agent-result');
    if (!box) return;
    const task = runtime.agentTask;
    if (!task || !String(task.result || '').trim()) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    box.hidden = false;
    box.innerHTML =
      '<h4>Result</h4>' +
      renderMarkdown(task.result) +
      (task.error ? '<p class="form-error">' + escapeHtml(task.error) + '</p>' : '');
  }

  function renderAgentSteps() {
    const mount = $('agent-steps');
    if (!mount) return;
    const task = runtime.agentTask;
    if (!task || !Array.isArray(task.steps) || !task.steps.length) {
      mount.innerHTML =
        '<li class="timeline__empty"><span class="icon-tile"><svg class="icon"><use href="#i-agent"></use></svg></span><p>No active run. Describe a goal and NEW AI will build a plan here.</p></li>';
      const bar = $('agent-progress');
      if (bar) bar.style.width = '0%';
      renderAgentResult();
      return;
    }

    mount.innerHTML = task.steps
      .map((step, index) => {
        const status = step.status || 'pending';
        const marker =
          status === 'done'
            ? '<svg class="icon" style="width:11px;height:11px"><use href="#i-check"></use></svg>'
            : status === 'error'
              ? '!'
              : String(index + 1);
        return (
          '<li class="timeline-step is-' +
          status +
          '"><div class="timeline-step__marker">' +
          marker +
          '</div><div class="timeline-step__body"><div class="timeline-step__title">' +
          escapeHtml(step.title) +
          '</div>' +
          (step.detail ? '<div class="timeline-step__desc">' + escapeHtml(step.detail) + '</div>' : '') +
          (step.error ? '<div class="timeline-step__desc" style="color:#ffc4cd">' + escapeHtml(step.error) + '</div>' : '') +
          (step.tools && step.tools.length
            ? '<div class="timeline-step__meta">' +
              step.tools
                .map(
                  (tool) =>
                    '<code>' + escapeHtml(tool.name) + ' · ' + escapeHtml(tool.status) + '</code>'
                )
                .join('') +
              '</div>'
            : '') +
          '</div></li>'
        );
      })
      .join('');

    const done = task.steps.filter((step) => step.status === 'done' || step.status === 'error').length;
    const bar = $('agent-progress');
    if (bar) bar.style.width = Math.round((done / task.steps.length) * 100) + '%';
    renderAgentResult();
  }

  function renderTasks() {
    const mount = $('task-list');
    if (!mount) return;
    const count = $('task-count');
    if (count) count.textContent = String(tasks.length);
    if (!tasks.length) {
      mount.innerHTML = '<p class="task-empty">Completed and failed runs appear here.</p>';
      return;
    }
    mount.innerHTML = tasks
      .slice(0, 12)
      .map((task) => {
        const tone =
          task.status === 'done'
            ? 'is-online'
            : task.status === 'error'
              ? 'is-offline'
              : task.status === 'running' || task.status === 'planning'
                ? 'is-busy'
                : '';
        return (
          '<div class="task-item" data-task="' +
          task.id +
          '"><div class="task-item__title">' +
          escapeHtml(task.title || task.goal) +
          '</div><div class="task-item__meta"><span class="status-dot ' +
          tone +
          '"></span><span>' +
          escapeHtml(AGENT_META[task.type] ? AGENT_META[task.type].label : 'Agent') +
          '</span><span>·</span><span>' +
          escapeHtml(AGENT_STATUS_LABELS[task.status] || task.status) +
          '</span></div></div>'
        );
      })
      .join('');
  }

  function loadTask(id) {
    if (runtime.agentRunning) {
      toast('Wait for the current run to finish.');
      return;
    }
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    runtime.agentTask = task;
    setAgentStatus(AGENT_STATUS_LABELS[task.status] || task.status, task.status === 'done' ? 'is-done' : task.status === 'error' ? 'is-error' : 'badge--soft');
    renderAgentSteps();
    renderAgentResult();
  }

  function getAgentType() {
    const checked = document.querySelector('input[name="agent-type"]:checked');
    return checked ? checked.value : 'assistant';
  }

  async function planAgent(type, goal, signal) {
    const plannerPrompt = [
      'You are the planning module of NEW AI, a careful personal AI agent.',
      'Create a practical, concrete plan for the goal. Each step must be independently useful and executable by an AI assistant with optional approved browser tools (open_website, web_search, copy_text, open_app).',
      'Do not include steps that require unapproved system access. Do not invent facts.',
      'Return ONLY valid JSON with this shape:',
      '{"summary":"one sentence","steps":[{"title":"short action title","detail":"what to do and what output is expected"}]}',
      'Use 3 to 6 steps. No markdown fences, no commentary.',
    ].join('\n');

    const text = await completeChat(
      [
        { role: 'system', content: plannerPrompt },
        {
          role: 'user',
          content:
            'Agent role: ' +
            (AGENT_META[type] ? AGENT_META[type].role : type) +
            '\nGoal: ' +
            goal,
        },
      ],
      { signal, stream: false }
    );

    const parsed = extractJson(text);
    if (!parsed || !Array.isArray(parsed.steps) || !parsed.steps.length) {
      throw new Error('The planner did not return a usable plan. Try rephrasing the goal.');
    }

    const steps = parsed.steps
      .filter((step) => step && step.title)
      .slice(0, 6)
      .map((step) => ({
        title: truncate(String(step.title).trim(), 120),
        detail: truncate(String(step.detail || '').trim(), 500),
        status: 'pending',
        result: '',
        error: '',
        tools: [],
      }));

    if (!steps.length) throw new Error('The planner returned an empty plan.');
    return {
      summary: truncate(String(parsed.summary || '').trim(), 400),
      steps,
    };
  }

  async function executeAgentStep(task, step, index, signal) {
    const previous = task.steps
      .slice(0, index)
      .filter((item) => item.status === 'done' && item.result)
      .map((item) => '• ' + item.title + ': ' + truncate(item.result, 1200))
      .join('\n');

    const system = [
      'You are the execution module of NEW AI, working step by step on a user-approved task.',
      'Act as ' +
        (AGENT_META[task.type] ? AGENT_META[task.type].role : 'a careful assistant') +
        '.',
      'Complete ONLY the current step. Be factual and concise. Return Markdown that can be shown to the user.',
      settings.toolsEnabled ? TOOL_PROTOCOL : 'Tool use is disabled; answer with text only.',
      'If a tool is denied, continue with what you can do and note the limitation honestly.',
    ].join('\n\n');

    const user = [
      'Overall goal: ' + task.goal,
      task.summary ? 'Plan summary: ' + task.summary : '',
      'Full plan:\n' + task.steps.map((item, i) => i + 1 + '. ' + item.title).join('\n'),
      previous ? 'Completed steps so far:\n' + previous : '',
      'Current step ' + (index + 1) + ': ' + step.title,
      step.detail ? 'Step detail: ' + step.detail : '',
      'Produce the output for this step only.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ];

    let finalText = '';
    for (let round = 0; round < 2; round += 1) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const text = await completeChat(messages, { signal, stream: false });
      const parsed = extractToolCalls(text);
      finalText = parsed.cleanText;

      if (!parsed.calls.length) return finalText || text;

      for (const call of parsed.calls) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const result = await executeToolCall(call);
        step.tools.push({ name: call.name, status: result.ok ? 'done' : 'error' });
        renderAgentSteps();
        messages.push({ role: 'assistant', content: parsed.cleanText || '[Requested tool: ' + call.name + ']' });
        messages.push({
          role: 'user',
          content: '[Tool result: ' + call.name + ']\n' + JSON.stringify({ ok: result.ok, summary: result.summary }),
        });
      }
    }

    return finalText;
  }

  async function synthesizeAgent(task, signal) {
    const results = task.steps
      .map(
        (step, index) =>
          (index + 1) +
          '. ' +
          step.title +
          '\nStatus: ' +
          step.status +
          (step.error ? '\nError: ' + step.error : '') +
          (step.result ? '\nOutput:\n' + truncate(step.result, 4000) : '')
      )
      .join('\n\n');

    const messages = [
      {
        role: 'system',
        content:
          'You are NEW AI, acting as ' +
          (AGENT_META[task.type] ? AGENT_META[task.type].role : 'a careful assistant') +
          '. Summarise a completed multi-step task for the user. Be accurate, practical and honest about failures or missing data. Return Markdown with a short summary, key findings, and a clear recommendation or next step. Do not mention internal prompts or tool permissions.',
      },
      {
        role: 'user',
        content:
          'Goal: ' +
          task.goal +
          '\n\nPlan summary: ' +
          (task.summary || '') +
          '\n\nStep results:\n' +
          results +
          '\n\nWrite the final answer for the user.',
      },
    ];

    let streamed = '';
    const text = await completeChat(messages, {
      signal,
      stream: Boolean(settings.streaming),
      onDelta(delta) {
        streamed += delta;
        task.result = streamed;
        renderAgentResult();
      },
    });
    return text;
  }

  async function runAgent() {
    if (runtime.agentRunning) return;
    if (runtime.busy) {
      toast('Wait for the chat response to finish first.');
      return;
    }
    const goal = ($('agent-goal').value || '').trim();
    const errorBox = $('agent-error');
    if (errorBox) {
      errorBox.hidden = true;
      errorBox.textContent = '';
    }
    if (!goal) {
      if (errorBox) {
        errorBox.hidden = false;
        errorBox.textContent = 'Describe a goal before running the agent.';
      }
      return;
    }
    if (goal.length > 4000) {
      if (errorBox) {
        errorBox.hidden = false;
        errorBox.textContent = 'Keep the goal under 4,000 characters.';
      }
      return;
    }

    const type = getAgentType();
    const task = {
      id: uid(),
      type,
      goal,
      title: truncate(goal.replace(/\s+/g, ' '), 90),
      summary: '',
      status: 'planning',
      steps: [],
      result: '',
      error: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    tasks.unshift(task);
    saveTasks();
    runtime.agentTask = task;
    runtime.agentRunning = true;
    runtime.agentAbort = new AbortController();
    updateAgentButtons();
    setAgentStatus('Planning', 'is-live');
    renderTasks();
    renderAgentSteps();
    renderAgentResult();

    try {
      const plan = await planAgent(type, goal, runtime.agentAbort.signal);
      task.summary = plan.summary;
      task.steps = plan.steps;
      task.status = 'running';
      task.updatedAt = Date.now();
      saveTasks();
      setAgentStatus('Running', 'is-live');
      renderAgentSteps();

      for (let index = 0; index < task.steps.length; index += 1) {
        const step = task.steps[index];
        if (runtime.agentAbort.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        step.status = 'running';
        renderAgentSteps();
        saveTasks();

        try {
          const output = await executeAgentStep(task, step, index, runtime.agentAbort.signal);
          step.result = output || 'No output returned for this step.';
          step.status = 'done';
        } catch (error) {
          if (error.name === 'AbortError') throw error;
          step.status = 'error';
          step.error = describeError(error).message;
        }
        task.updatedAt = Date.now();
        renderAgentSteps();
        saveTasks();
      }

      if (runtime.agentAbort.signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      task.status = 'synthesizing';
      setAgentStatus('Summarising', 'is-live');
      renderTasks();
      saveTasks();

      const result = await synthesizeAgent(task, runtime.agentAbort.signal);
      task.result = result;
      task.status = 'done';
      task.updatedAt = Date.now();
      setAgentStatus('Complete', 'is-done');
      toast('Agent run complete.');
    } catch (error) {
      task.updatedAt = Date.now();
      if (error.name === 'AbortError') {
        task.status = 'stopped';
        setAgentStatus('Stopped', 'badge--soft');
        toast('Agent run stopped.');
      } else {
        task.status = 'error';
        task.error = describeError(error).message;
        setAgentStatus('Failed', 'is-error');
        if (errorBox) {
          errorBox.hidden = false;
          errorBox.textContent = task.error;
        }
        toast(task.error, 'error');
      }
    } finally {
      runtime.agentRunning = false;
      runtime.agentAbort = null;
      updateAgentButtons();
      saveTasks();
      renderTasks();
      renderAgentSteps();
      renderAgentResult();
    }
  }

  function stopAgent() {
    if (runtime.agentAbort) {
      runtime.agentAbort.abort();
      setAgentStatus('Stopping…', 'badge--soft');
    }
  }

  /* =====================================================================
     Voice — Web Speech API + animated waveform
     ===================================================================== */

  const SpeechRecognitionCtor =
    window.SpeechRecognition || window.webkitSpeechRecognition || null;

  let activeRecognition = null;
  let wakeRecognition = null;
  let dictationRecognition = null;
  let speechToken = 0;
  let speechTimer = null;
  let currentSpeechResolve = null;

  function initSpeech() {
    if (!('speechSynthesis' in window)) {
      const warning = $('voice-unsupported');
      if (warning) warning.hidden = false;
    }
    if (!SpeechRecognitionCtor) {
      const warning = $('voice-unsupported');
      if (warning) warning.hidden = false;
      ['voice-mic', 'wake-toggle', 'mic-btn'].forEach((id) => {
        const button = $(id);
        if (button) {
          button.disabled = true;
          button.title = 'Speech recognition is not supported in this browser.';
        }
      });
    }
    populateVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = populateVoices;
    }
  }

  function populateVoices() {
    const select = $('set-voice');
    if (!select || !('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return;
    select.innerHTML =
      '<option value="">System default</option>' +
      voices
        .map(
          (voice) =>
            '<option value="' +
            escapeHtml(voice.voiceURI) +
            '">' +
            escapeHtml(voice.name + ' — ' + voice.lang) +
            '</option>'
        )
        .join('');
    const match = voices.find((voice) => voice.voiceURI === settings.voiceURI);
    select.value = match ? settings.voiceURI : '';
    if (!match) settings.voiceURI = '';
  }

  function cleanForSpeech(text) {
    return String(text || '')
      .replace(/```[\s\S]*?```/g, ' Code block omitted. ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/[*_~>#|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4500);
  }

  function speak(text, { force = false } = {}) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) return resolve(false);
      if (!force && !settings.voiceOutput) return resolve(false);
      const clean = cleanForSpeech(text);
      if (!clean) return resolve(false);

      if (currentSpeechResolve) {
        const previous = currentSpeechResolve;
        currentSpeechResolve = null;
        previous(false);
      }
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
      if (speechTimer) clearTimeout(speechTimer);

      const token = ++speechToken;
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = settings.lang || 'en-US';
      utterance.rate = Number(settings.rate) || 1;
      utterance.pitch = Number(settings.pitch) || 1;
      if (settings.voiceURI) {
        const voice = window.speechSynthesis.getVoices().find((item) => item.voiceURI === settings.voiceURI);
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang || utterance.lang;
        }
      }

      let settled = false;
      const finish = (ok = true) => {
        if (settled) return;
        settled = true;
        if (currentSpeechResolve === finish) currentSpeechResolve = null;
        if (token === speechToken) {
          runtime.speaking = false;
          if (speechTimer) {
            clearTimeout(speechTimer);
            speechTimer = null;
          }
          setVoiceState(runtime.voiceMode ? 'listening' : runtime.wakeMode ? 'wake' : 'idle');
        }
        resolve(Boolean(ok));
      };
      currentSpeechResolve = finish;

      utterance.onstart = () => {
        if (token !== speechToken) return;
        runtime.speaking = true;
        setVoiceState('speaking');
      };
      utterance.onend = finish;
      utterance.onerror = finish;

      speechTimer = setTimeout(() => {
        if (token !== speechToken) return;
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* ignore */
        }
        finish();
      }, Math.min(120000, 15000 + clean.length * 90));

      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        finish();
      }
    });
  }

  function stopSpeaking() {
    speechToken += 1;
    const pending = currentSpeechResolve;
    currentSpeechResolve = null;
    if (speechTimer) {
      clearTimeout(speechTimer);
      speechTimer = null;
    }
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
    runtime.speaking = false;
    if (pending) pending(false);
  }

  function setVoiceState(state) {
    const core = $('voice-core');
    const labels = {
      idle: 'Standby',
      listening: 'Listening',
      thinking: 'Processing',
      speaking: 'Speaking',
      wake: 'Wake phrase armed',
    };
    const tones = {
      idle: '',
      listening: 'is-listening',
      thinking: 'is-thinking',
      speaking: 'is-speaking',
      wake: 'is-listening',
    };
    const targets = {
      idle: 0.06,
      listening: 0.62,
      thinking: 0.32,
      speaking: 0.85,
      wake: 0.22,
    };

    runtime.voiceState = state;
    runtime.waveTarget = targets[state] || 0.06;
    const status = $('voice-status');
    if (status) status.textContent = labels[state] || 'Standby';
    if (core) {
      core.classList.remove('is-listening', 'is-speaking', 'is-thinking');
      if (tones[state]) core.classList.add(tones[state]);
    }
    updateVoiceButtons();
  }

  function updateVoiceButtons() {
    const mic = $('voice-mic');
    const wake = $('wake-toggle');
    const replies = $('voice-replies-toggle');
    const badge = $('voice-nav-badge');

    if (mic) {
      mic.classList.toggle('is-active', runtime.voiceMode);
      mic.setAttribute('aria-pressed', runtime.voiceMode ? 'true' : 'false');
      const label = mic.querySelector('b');
      if (label) label.textContent = runtime.voiceMode ? 'Stop' : 'Talk';
    }
    if (wake) wake.setAttribute('aria-pressed', runtime.wakeMode ? 'true' : 'false');
    if (replies) replies.setAttribute('aria-pressed', settings.voiceOutput ? 'true' : 'false');
    if (badge) badge.hidden = !(runtime.voiceMode || runtime.wakeMode);

    const wakeLabel = $('wake-label');
    if (wakeLabel) wakeLabel.textContent = '“' + (settings.wake || 'hey new ai') + '”';

    const micButton = $('mic-btn');
    if (micButton) micButton.classList.toggle('is-active', runtime.dictating);
  }

  function startVoiceMode() {
    if (!SpeechRecognitionCtor) {
      toast('This browser does not support speech recognition. Use Chrome or Edge.', 'error');
      return;
    }
    if (runtime.wakeMode) setWakeMode(false);
    runtime.voiceMode = true;
    runtime.pendingWake = false;
    switchView('voice');
    setVoiceState('listening');
    startListening();
  }

  function stopVoiceMode() {
    runtime.voiceMode = false;
    runtime.pendingWake = false;
    if (activeRecognition) {
      try {
        activeRecognition.onend = null;
        activeRecognition.abort();
      } catch {
        /* ignore */
      }
      activeRecognition = null;
    }
    runtime.listening = false;
    stopSpeaking();
    setVoiceState(runtime.wakeMode ? 'wake' : 'idle');
    updateVoiceButtons();
  }

  function startListening() {
    if (!SpeechRecognitionCtor || runtime.listening || !runtime.voiceMode) return;
    if (runtime.speaking) stopSpeaking();
    try {
      window.speechSynthesis && window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }

    let recognition;
    try {
      recognition = new SpeechRecognitionCtor();
    } catch {
      toast('Speech recognition could not start.', 'error');
      return;
    }
    activeRecognition = recognition;
    recognition.lang = settings.lang || 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalText = '';

    recognition.onstart = () => {
      runtime.listening = true;
      setVoiceState('listening');
      const transcript = $('voice-transcript');
      if (transcript) transcript.textContent = 'Listening… speak now.';
    };

    recognition.onresult = (event) => {
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0] ? result[0].transcript : '';
        if (result.isFinal) finalText += text;
        else interim += text;
      }
      const transcript = $('voice-transcript');
      if (transcript) transcript.textContent = (finalText + ' ' + interim).trim() || 'Listening…';
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        toast('Microphone permission was denied.', 'error');
        stopVoiceMode();
      } else if (event.error === 'no-speech') {
        /* normal timeout */
      } else if (event.error !== 'aborted') {
        toast('Voice error: ' + event.error, 'error');
      }
    };

    recognition.onend = () => {
      runtime.listening = false;
      activeRecognition = null;
      updateVoiceButtons();
      if (!runtime.voiceMode) return;

      if (finalText.trim()) {
        handleVoiceUtterance(finalText.trim());
      } else {
        setVoiceState('idle');
        setTimeout(() => {
          if (runtime.voiceMode && !runtime.listening && !runtime.speaking) startListening();
        }, 450);
      }
    };

    try {
      recognition.start();
    } catch {
      runtime.listening = false;
      activeRecognition = null;
      toast('Speech recognition is already starting. Try again.', 'error');
    }
  }

  async function handleVoiceUtterance(text) {
    const transcript = $('voice-transcript');
    if (transcript) transcript.textContent = text;
    setVoiceState('thinking');
    await sendMessage(text, { viaVoice: true });
    if (runtime.voiceMode && !runtime.listening && !runtime.speaking) {
      setVoiceState('listening');
      setTimeout(() => {
        if (runtime.voiceMode && !runtime.listening && !runtime.speaking) startListening();
      }, 500);
    } else if (!runtime.voiceMode) {
      setVoiceState('idle');
    }
  }

  function buildWakeRegex() {
    const words = String(settings.wake || 'hey new ai')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!words.length) return null;
    return new RegExp(words.join('[\\s,]+'), 'i');
  }

  function setWakeMode(on) {
    if (on && !SpeechRecognitionCtor) {
      toast('This browser does not support wake-phrase listening. Use Chrome or Edge.', 'error');
      return;
    }
    if (on) {
      if (runtime.voiceMode) stopVoiceMode();
      runtime.wakeMode = true;
      runtime.pendingWake = false;
      switchView('voice');
      setVoiceState('wake');
      const transcript = $('voice-transcript');
      if (transcript) {
        transcript.textContent =
          'Say “' + (settings.wake || 'hey new ai') + '” followed by a command.';
      }
      startWakeRecognition();
      toast('Wake phrase armed. Keep this tab open.');
    } else {
      runtime.wakeMode = false;
      runtime.pendingWake = false;
      stopWakeRecognition();
      setVoiceState('idle');
    }
    updateVoiceButtons();
  }

  function startWakeRecognition() {
    if (!runtime.wakeMode || runtime.wakeListening || runtime.wakeProcessing || !SpeechRecognitionCtor) {
      return;
    }
    const pattern = buildWakeRegex();
    if (!pattern) return;

    let recognition;
    try {
      recognition = new SpeechRecognitionCtor();
    } catch {
      return;
    }
    wakeRecognition = recognition;
    recognition.lang = settings.lang || 'en-US';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      runtime.wakeListening = true;
    };

    recognition.onresult = (event) => {
      let transcript = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        if (event.results[index].isFinal) {
          transcript += event.results[index][0].transcript;
        }
      }
      transcript = transcript.trim();
      if (!transcript) return;

      let command = '';
      if (runtime.pendingWake) {
        runtime.pendingWake = false;
        command = transcript;
      } else {
        const match = transcript.match(pattern);
        if (match) {
          command = transcript.slice(match.index + match[0].length).replace(/^[\s,.:;!?-]+/, '');
        }
      }

      if (command && command.trim().length > 1) {
        runtime.wakeProcessing = true;
        stopWakeRecognition();
        setVoiceState('thinking');
        const el = $('voice-transcript');
        if (el) el.textContent = command.trim();
        handleWakeCommand(command.trim());
      } else if (pattern.test(transcript)) {
        runtime.pendingWake = true;
        setVoiceState('wake');
        const el = $('voice-transcript');
        if (el) el.textContent = 'Listening for your command…';
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        toast('Microphone permission was denied. Wake phrase disabled.', 'error');
        runtime.wakeMode = false;
        updateVoiceButtons();
      }
    };

    recognition.onend = () => {
      runtime.wakeListening = false;
      wakeRecognition = null;
      if (runtime.wakeMode && !runtime.wakeProcessing) {
        setTimeout(() => startWakeRecognition(), 500);
      }
    };

    try {
      recognition.start();
    } catch {
      runtime.wakeListening = false;
      wakeRecognition = null;
    }
  }

  function stopWakeRecognition() {
    if (wakeRecognition) {
      try {
        wakeRecognition.onend = null;
        wakeRecognition.abort();
      } catch {
        /* ignore */
      }
      wakeRecognition = null;
    }
    runtime.wakeListening = false;
  }

  async function handleWakeCommand(text) {
    try {
      await sendMessage(text, { viaVoice: true });
    } finally {
      runtime.wakeProcessing = false;
      if (runtime.wakeMode) {
        runtime.pendingWake = false;
        setVoiceState('wake');
        const el = $('voice-transcript');
        if (el) el.textContent = 'Say “' + (settings.wake || 'hey new ai') + '” followed by a command.';
        startWakeRecognition();
      }
    }
  }

  function setVoiceOutput(on) {
    settings.voiceOutput = Boolean(on);
    saveSettings();
    if (!settings.voiceOutput) stopSpeaking();
    updateVoiceButtons();
    const checkbox = $('set-voice-output');
    if (checkbox) checkbox.checked = settings.voiceOutput;
  }

  function startDictation() {
    if (!SpeechRecognitionCtor) {
      toast('Speech recognition is not supported in this browser.', 'error');
      return;
    }
    if (runtime.dictating) {
      if (dictationRecognition) {
        try {
          dictationRecognition.stop();
        } catch {
          /* ignore */
        }
      }
      return;
    }

    const input = $('prompt-input');
    if (!input) return;
    const base = input.value ? input.value.replace(/\s*$/, ' ') : '';
    let finalText = '';

    let recognition;
    try {
      recognition = new SpeechRecognitionCtor();
    } catch {
      toast('Dictation could not start.', 'error');
      return;
    }
    dictationRecognition = recognition;
    recognition.lang = settings.lang || 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      runtime.dictating = true;
      updateVoiceButtons();
      toast('Dictation on — speak now.');
    };

    recognition.onresult = (event) => {
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0] ? result[0].transcript : '';
        if (result.isFinal) finalText += text;
        else interim += text;
      }
      input.value = (base + finalText + interim).trimStart();
      autoResizeComposer();
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        toast('Microphone permission was denied.', 'error');
      }
    };

    recognition.onend = () => {
      runtime.dictating = false;
      dictationRecognition = null;
      updateVoiceButtons();
      input.focus();
    };

    try {
      recognition.start();
    } catch {
      runtime.dictating = false;
      dictationRecognition = null;
      updateVoiceButtons();
    }
  }

  function startWaveform() {
    const canvas = $('waveform');
    if (!canvas || !canvas.getContext) return;
    const context = canvas.getContext('2d');
    let time = 0;
    let level = 0.06;

    const frame = () => {
      const width = canvas.clientWidth || 720;
      const height = canvas.clientHeight || 76;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      level += (runtime.waveTarget - level) * 0.075;
      time += 0.045;
      const bars = 72;
      const gap = width / bars;
      const center = height / 2;
      const gradient = context.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, 'rgba(34, 211, 238, 0.75)');
      gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.9)');
      gradient.addColorStop(1, 'rgba(139, 92, 246, 0.75)');
      context.strokeStyle = gradient;
      context.lineWidth = Math.max(1.4, gap * 0.34);
      context.lineCap = 'round';

      for (let index = 0; index < bars; index += 1) {
        const envelope = Math.sin((Math.PI * index) / (bars - 1));
        const ripple =
          Math.sin(time * 2.2 + index * 0.34) * 0.55 +
          Math.sin(time * 1.3 + index * 0.17) * 0.3;
        const amplitude = (2.5 + level * 30 * envelope) * (0.55 + Math.abs(ripple) * 0.85);
        const x = index * gap + gap / 2;
        context.beginPath();
        context.moveTo(x, center - amplitude);
        context.lineTo(x, center + amplitude);
        context.stroke();
      }

      requestAnimationFrame(frame);
    };

    if (prefersReducedMotion()) {
      runtime.waveTarget = 0.06;
    }
    requestAnimationFrame(frame);
  }

  /* =====================================================================
     Memory
     ===================================================================== */

  const MEMORY_CATEGORIES = {
    preference: 'Preference',
    personal: 'Personal',
    project: 'Project',
    instruction: 'Instruction',
  };

  function relevantMemories(query) {
    if (!settings.memoryEnabled || !memories.length) return [];
    const words =
      String(query || '')
        .toLowerCase()
        .match(/[a-z0-9\u0600-\u06FF]{3,}/g) || [];
    if (!words.length) return [];

    return memories
      .map((memory) => {
        const text = String(memory.text || '').toLowerCase();
        let score = 0;
        words.forEach((word) => {
          if (text.includes(word)) score += 2;
        });
        if (memory.category === 'instruction') score += 0.5;
        return { memory, score };
      })
      .filter((item) => item.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score || (b.memory.updatedAt || 0) - (a.memory.updatedAt || 0)
      )
      .slice(0, 5)
      .map((item) => item.memory);
  }

  function renderMemories() {
    const mount = $('memory-list');
    const empty = $('memory-empty');
    if (!mount) return;
    const query = ($('memory-search').value || '').trim().toLowerCase();
    const visible = memories
      .filter((memory) => !query || String(memory.text || '').toLowerCase().includes(query))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    const count = $('memory-count');
    if (count) {
      count.textContent = memories.length + (memories.length === 1 ? ' memory' : ' memories');
    }
    const navCount = $('memory-nav-count');
    if (navCount) navCount.textContent = String(memories.length);

    if (empty) empty.hidden = memories.length > 0;

    if (!visible.length) {
      mount.innerHTML = memories.length
        ? '<p class="task-empty" style="grid-column:1/-1">No memories match that search.</p>'
        : '';
      return;
    }

    mount.innerHTML = visible
      .map(
        (memory) =>
          '<article class="memory-card"><div class="memory-card__head"><span class="memory-card__cat">' +
          escapeHtml(MEMORY_CATEGORIES[memory.category] || memory.category || 'Note') +
          '</span><div class="memory-card__actions">' +
          '<button class="msg__action" type="button" data-memory-edit="' +
          memory.id +
          '" title="Edit memory" aria-label="Edit memory"><svg class="icon"><use href="#i-edit"></use></svg></button>' +
          '<button class="msg__action" type="button" data-memory-delete="' +
          memory.id +
          '" title="Delete memory" aria-label="Delete memory"><svg class="icon"><use href="#i-trash"></use></svg></button>' +
          '</div></div><p class="memory-card__text">' +
          escapeHtml(memory.text) +
          '</p><span class="memory-card__date">Updated ' +
          timeAgo(memory.updatedAt || memory.createdAt) +
          '</span></article>'
      )
      .join('');
  }

  function openMemoryEditor(existing) {
    return new Promise((resolve) => {
      const root = $('modal-root');
      if (!root) return resolve(null);
      const category = (existing && existing.category) || 'preference';
      const text = (existing && existing.text) || '';
      const options = Object.entries(MEMORY_CATEGORIES)
        .map(
          ([value, label]) =>
            '<option value="' +
            value +
            '"' +
            (value === category ? ' selected' : '') +
            '>' +
            label +
            '</option>'
        )
        .join('');

      root.innerHTML =
        '<div class="modal-backdrop" data-modal-backdrop><div class="modal" role="dialog" aria-modal="true" aria-label="' +
        (existing ? 'Edit memory' : 'Add memory') +
        '"><div class="modal__head"><div><h3>' +
        (existing ? 'Edit memory' : 'Add a memory') +
        '</h3><p>Only save what you want NEW AI to remember.</p></div><button class="icon-btn modal__close" type="button" data-cancel aria-label="Close"><svg class="icon"><use href="#i-x"></use></svg></button></div>' +
        '<div class="modal__body"><label class="field-label" for="memory-category">Category</label><select class="field" id="memory-category">' +
        options +
        '</select><label class="field-label" for="memory-text">Memory</label><textarea class="field field--area" id="memory-text" placeholder="Example: I prefer TypeScript and concise answers.">' +
        escapeHtml(text) +
        '</textarea><p class="form-error" id="memory-error" hidden>Write something first.</p></div>' +
        '<div class="modal__actions"><button class="btn btn--ghost" type="button" data-cancel>Cancel</button><button class="btn btn--primary" type="button" data-save>' +
        (existing ? 'Save changes' : 'Save memory') +
        '</button></div></div></div>';

      const finish = (value) => {
        document.removeEventListener('keydown', onKey);
        root.innerHTML = '';
        resolve(value);
      };
      const onKey = (event) => {
        if (event.key === 'Escape') finish(null);
      };
      document.addEventListener('keydown', onKey);
      root.querySelectorAll('[data-cancel]').forEach((button) =>
        button.addEventListener('click', () => finish(null))
      );
      root.querySelector('[data-save]').addEventListener('click', () => {
        const value = $('memory-text').value.trim();
        if (!value) {
          const error = $('memory-error');
          if (error) error.hidden = false;
          return;
        }
        finish({ category: $('memory-category').value, text: truncate(value, 2000) });
      });
      const field = $('memory-text');
      if (field) {
        field.focus();
        field.setSelectionRange(field.value.length, field.value.length);
      }
    });
  }

  async function addMemory() {
    const value = await openMemoryEditor(null);
    if (!value) return;
    memories.unshift({
      id: uid(),
      category: value.category,
      text: value.text,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    saveMemories();
    renderMemories();
    toast('Memory saved locally.');
  }

  async function editMemory(id) {
    const memory = memories.find((item) => item.id === id);
    if (!memory) return;
    const value = await openMemoryEditor(memory);
    if (!value) return;
    memory.category = value.category;
    memory.text = value.text;
    memory.updatedAt = Date.now();
    saveMemories();
    renderMemories();
    toast('Memory updated.');
  }

  async function deleteMemory(id) {
    const memory = memories.find((item) => item.id === id);
    if (!memory) return;
    const yes = await confirmAction(
      'Delete this memory?',
      truncate(memory.text, 160),
      'Delete'
    );
    if (!yes) return;
    memories = memories.filter((item) => item.id !== id);
    saveMemories();
    renderMemories();
    toast('Memory deleted.');
  }

  /* =====================================================================
     Settings UI
     ===================================================================== */

  let savedFlashTimer = null;

  function flashSaved() {
    const badge = $('settings-saved');
    if (!badge) return;
    badge.textContent = 'Saved locally';
    badge.classList.add('is-done');
    if (savedFlashTimer) clearTimeout(savedFlashTimer);
    savedFlashTimer = setTimeout(() => {
      badge.classList.remove('is-done');
      badge.textContent = 'Saved locally';
    }, 1600);
  }

  function updateModelPill() {
    const text = $('model-pill-text');
    const showing = runtime.activeModel || settings.model;
    if (text) text.textContent = showing ? truncate(showing, 28) : 'no model';
    const pill = $('model-pill');
    if (pill) {
      const fallback = runtime.activeModel && runtime.activeModel !== settings.model;
      pill.title = fallback
        ? 'Answering with ' + runtime.activeModel + ' because ' + settings.model + ' ran out of quota'
        : 'Active model: ' + (settings.model || 'none');
    }
  }

  function applySettingsToForm() {
    const values = {
      'set-proxy': settings.proxyUrl,
      'set-token': settings.token,
      'set-model': settings.model,
      'set-maxtokens': settings.maxTokens,
      'set-temp': settings.temperature,
      'set-username': settings.username,
      'set-style': settings.style,
      'set-context': settings.context,
      'set-lang': settings.lang,
      'set-rate': settings.rate,
      'set-pitch': settings.pitch,
      'set-wake': settings.wake,
      'set-bridge': settings.bridgeUrl,
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = $(id);
      if (element) element.value = value;
    });

    const checks = {
      'set-streaming': settings.streaming,
      'set-voice-output': settings.voiceOutput,
      'set-autospeak': settings.autospeak,
      'set-tools': settings.toolsEnabled,
      'set-memory': settings.memoryEnabled,
      'memory-enabled': settings.memoryEnabled,
    };
    Object.entries(checks).forEach(([id, value]) => {
      const element = $(id);
      if (element) element.checked = Boolean(value);
    });

    const labels = {
      'set-temp-value': Number(settings.temperature).toFixed(1),
      'set-context-value': settings.context + ' messages',
      'set-rate-value': Number(settings.rate).toFixed(1) + '×',
      'set-pitch-value': Number(settings.pitch).toFixed(1),
    };
    Object.entries(labels).forEach(([id, value]) => {
      const element = $(id);
      if (element) element.textContent = value;
    });

    const toolsToggle = $('tools-toggle');
    if (toolsToggle) toolsToggle.setAttribute('aria-pressed', settings.toolsEnabled ? 'true' : 'false');

    updateModelPill();
    updateVoiceButtons();
    if (settings.voiceURI) {
      const voiceSelect = $('set-voice');
      if (voiceSelect) voiceSelect.value = settings.voiceURI;
    }
  }

  function bindSetting(id, key, options = {}) {
    const element = $(id);
    if (!element) return;
    const type = options.type || 'text';
    const read = () =>
      type === 'bool' ? element.checked : type === 'num' ? Number(element.value) : element.value;
    const handler = () => {
      settings[key] = read();
      saveSettings();
      flashSaved();
      if (options.after) options.after(settings[key]);
    };
    if (type === 'bool' || type === 'select') element.addEventListener('change', handler);
    else element.addEventListener('input', handler);
  }

  function renderToolList() {
    const mount = $('tool-list');
    if (!mount) return;
    mount.innerHTML = Object.entries(TOOLS)
      .map(([name, tool]) => {
        const policy = settings.toolPolicy[name] || 'ask';
        return (
          '<div class="tool-row"><svg class="icon"><use href="#' +
          (TOOL_ICONS[name] || 'i-bolt') +
          '"></use></svg><div class="tool-row__body"><div class="tool-row__name">' +
          escapeHtml(tool.label) +
          '</div><div class="tool-row__desc">' +
          escapeHtml(tool.description) +
          '</div></div><select class="field tool-policy" data-tool-policy="' +
          name +
          '" aria-label="Policy for ' +
          escapeHtml(tool.label) +
          '"><option value="ask"' +
          (policy === 'ask' ? ' selected' : '') +
          '>Ask</option><option value="allow"' +
          (policy === 'allow' ? ' selected' : '') +
          '>Allow</option><option value="block"' +
          (policy === 'block' ? ' selected' : '') +
          '>Block</option></select></div>'
        );
      })
      .join('');

    mount.querySelectorAll('[data-tool-policy]').forEach((select) => {
      select.addEventListener('change', () => {
        settings.toolPolicy[select.dataset.toolPolicy] = select.value;
        saveSettings();
        flashSaved();
        toast('Tool policy updated.');
      });
    });
  }

  /* =====================================================================
     Backend health
     ===================================================================== */

  function healthUrl() {
    try {
      const url = new URL(settings.proxyUrl);
      return url.origin + '/api/health';
    } catch {
      return '';
    }
  }

  function setNetState(kind, text, sub) {
    const dot = $('net-dot');
    const label = $('net-text');
    const subLabel = $('net-sub');
    const pill = $('net-pill');
    const pillDot = $('net-pill-dot');
    const pillText = $('net-pill-text');

    ['is-online', 'is-offline', 'is-busy'].forEach((cls) => {
      if (dot) dot.classList.remove(cls);
      if (pillDot) pillDot.classList.remove(cls);
    });

    const cls = kind === 'online' ? 'is-online' : kind === 'offline' ? 'is-offline' : 'is-busy';
    if (dot) dot.classList.add(cls);
    if (pillDot) pillDot.classList.add(cls);
    if (label) label.textContent = text;
    if (subLabel) subLabel.textContent = sub;
    if (pill) {
      pill.classList.remove('is-online', 'is-offline');
      if (kind === 'online') pill.classList.add('is-online');
      if (kind === 'offline') pill.classList.add('is-offline');
    }
    if (pillText) {
      pillText.textContent =
        kind === 'online' ? 'online' : kind === 'offline' ? 'offline' : kind === 'warn' ? 'no key' : 'checking';
    }
  }

  function markBackendOffline(sub) {
    setNetState('offline', 'Backend offline', sub);
    const badge = $('conn-badge');
    if (badge) {
      badge.textContent = 'offline';
      badge.className = 'badge is-error';
    }
    const connStatus = $('conn-status');
    if (connStatus) {
      connStatus.textContent = 'Not reachable';
      connStatus.className = 'conn-status is-error';
    }
    const modelText = $('model-pill-text');
    if (modelText) modelText.textContent = 'no backend';
    updateComposerState();
  }

  async function checkBackend() {
    const endpoint = healthUrl();
    if (!endpoint) {
      setNetState('offline', 'Invalid endpoint', 'Check the proxy URL');
      return null;
    }

    // A page on a public domain has no /api routes behind it. Probing the
    // auto-derived endpoint would only log a 404, so report the real setup
    // instead of pretending to check. A proxy the user actually entered is
    // still probed, even when it is remote.
    if (!isLocalHost() && settings.proxyUrl === defaultProxyUrl()) {
      markBackendOffline('Static demo — set an HTTPS proxy in Settings');
      return null;
    }
    setNetState('busy', 'Checking backend…', 'AI connection');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(endpoint, {
        headers: authHeaders({ Accept: 'application/json' }),
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();

      runtime.fallbackModels = Array.isArray(data && data.fallbackModels)
        ? data.fallbackModels.filter((name) => typeof name === 'string' && name.trim())
        : [];

      // Until the user picks a model, follow the server's DEFAULT_MODEL so a
      // provider switch in server/.env does not leave a stale model behind.
      // A leftover built-in default is also replaced, even if it was stored
      // before this rule existed.
      const builtInDefault = settings.model === 'gpt-4o-mini';
      if (
        data &&
        data.model &&
        data.model !== settings.model &&
        (!settings.modelTouched || builtInDefault)
      ) {
        settings.model = data.model;
        runtime.activeModel = null;
        saveSettings();
        updateModelPill();
        const modelField = $('set-model');
        if (modelField) modelField.value = data.model;
      }

      if (data && data.hasKey) {
        setNetState('online', 'Backend online', (data.model || settings.model) + ' ready');
        runtime.authFailed = false;
      } else {
        setNetState(
          'warn',
          'Backend online',
          data && data.placeholderKey
            ? 'API key is still the example placeholder'
            : 'API key missing in server/.env'
        );
      }
      const badge = $('conn-badge');
      if (badge) {
        badge.textContent = data && data.hasKey ? 'configured' : 'no key';
        badge.className = 'badge ' + (data && data.hasKey ? 'is-done' : 'is-error');
      }
      const connStatus = $('conn-status');
      if (connStatus) {
        connStatus.textContent = data && data.hasKey
          ? 'Connected — key configured'
          : data && data.placeholderKey
            ? 'Backend up — key is still the placeholder'
            : 'Backend up — key missing';
        connStatus.className = 'conn-status ' + (data && data.hasKey ? 'is-ok' : 'is-error');
      }
      if (data && data.authRequired && !settings.token) {
        setNetState('warn', 'Backend online', 'Access token needed — open Settings');
        const conn = $('conn-status');
        if (conn) {
          conn.textContent = 'Connected — add the access token';
          conn.className = 'conn-status is-error';
        }
      }
      updateModelPill();
      return data;
    } catch {
      const customProxy = settings.proxyUrl !== defaultProxyUrl();
      markBackendOffline(
        customProxy
          ? 'Proxy unreachable — check the endpoint in Settings'
          : isLocalHost()
            ? 'Run node server/server.js'
            : 'Static demo — set an HTTPS proxy in Settings'
      );
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async function testConnection() {
    const status = $('conn-status');
    if (status) {
      status.textContent = 'Testing…';
      status.className = 'conn-status';
    }
    const data = await checkBackend();
    if (data && data.hasKey) {
      toast('Connection works. The server has an API key configured.');
    } else if (data) {
      toast('The server is running but no API key is configured.', 'error');
    } else {
      toast('Could not reach the backend. Is the server running?', 'error');
    }
  }

  /* =====================================================================
     Local data
     ===================================================================== */

  function exportData() {
    const payload = {
      app: 'NEW AI',
      exportedAt: new Date().toISOString(),
      settings: Object.assign({}, settings),
      sessions,
      memories,
      tasks,
    };
    delete payload.settings.proxyUrl;
    delete payload.settings.token;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'new-ai-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Backup exported.');
  }

  async function clearConversations() {
    const yes = await confirmAction(
      'Clear all conversations?',
      'Every chat and agent task in this browser will be deleted. Export a backup first if you need one.',
      'Clear conversations'
    );
    if (!yes) return;
    sessions = [];
    tasks = [];
    activeSessionId = null;
    localStorage.removeItem(KEY.active);
    saveSessions();
    saveTasks();
    renderSessionList();
    renderChat();
    renderTasks();
    runtime.agentTask = null;
    renderAgentSteps();
    renderAgentResult();
    toast('All conversations cleared.');
  }

  async function clearMemories() {
    const yes = await confirmAction(
      'Clear all memories?',
      'NEW AI will forget every saved preference and fact in this browser.',
      'Clear memories'
    );
    if (!yes) return;
    memories = [];
    saveMemories();
    renderMemories();
    toast('Memories cleared.');
  }

  async function resetSettings() {
    const yes = await confirmAction(
      'Reset settings?',
      'Connection, voice, style and permission preferences return to their defaults. Conversations and memories are kept.',
      'Reset settings'
    );
    if (!yes) return;
    settings = normalizeSettings({});
    saveSettings();
    runtime.sessionPermissions = Object.create(null);
    applySettingsToForm();
    renderToolList();
    updateComposerState();
    checkBackend();
    toast('Settings reset to defaults.');
  }

  function syncToolsToggle() {
    const toggle = $('tools-toggle');
    if (toggle) toggle.setAttribute('aria-pressed', settings.toolsEnabled ? 'true' : 'false');
  }

  /* =====================================================================
     Routing
     ===================================================================== */

  function switchView(name) {
    const valid = ['chat', 'agent', 'voice', 'memory', 'settings'];
    if (!valid.includes(name)) name = 'chat';
    qsa('.view').forEach((view) => {
      view.classList.toggle('is-active', view.id === 'view-' + name);
    });
    qsa('.side-nav__item[data-view]').forEach((item) => {
      item.classList.toggle('is-active', item.dataset.view === name);
    });
    const section = $('view-' + name);
    if (section) {
      const title = $('view-title');
      const kicker = $('view-kicker');
      if (title) title.textContent = section.dataset.title || name;
      if (kicker) kicker.textContent = section.dataset.kicker || 'Workspace';
    }
    if (name === 'memory') renderMemories();
    if (name === 'agent') {
      renderTasks();
      renderAgentSteps();
      renderAgentResult();
    }
    if (name === 'voice') updateVoiceButtons();
    if (name === 'settings') {
      applySettingsToForm();
      renderToolList();
    }
    if (name === 'chat') {
      renderChat();
      requestAnimationFrame(() => {
        const scroller = $('chat-scroll');
        if (scroller) scroller.scrollTop = scroller.scrollHeight;
      });
    }
    closeSidebar();
  }

  function openSidebar() {
    const sidebar = $('sidebar');
    const scrim = $('sidebar-scrim');
    if (sidebar) sidebar.classList.add('is-open');
    if (scrim) scrim.hidden = false;
  }

  function closeSidebar() {
    const sidebar = $('sidebar');
    const scrim = $('sidebar-scrim');
    if (sidebar) sidebar.classList.remove('is-open');
    if (scrim) scrim.hidden = true;
  }

  /* =====================================================================
     Event wiring
     ===================================================================== */

  function bindEvents() {
    const newChat = $('new-chat');
    if (newChat) newChat.addEventListener('click', startNewChat);

    const sidebarToggle = $('sidebar-toggle');
    if (sidebarToggle) sidebarToggle.addEventListener('click', openSidebar);
    const sidebarClose = $('sidebar-close');
    if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
    const scrim = $('sidebar-scrim');
    if (scrim) scrim.addEventListener('click', closeSidebar);

    qsa('[data-view]').forEach((button) => {
      button.addEventListener('click', () => switchView(button.dataset.view));
    });

    const search = $('conversation-search');
    if (search) search.addEventListener('input', renderSessionList);

    const sessionList = $('conversation-list');
    if (sessionList) {
      sessionList.addEventListener('click', (event) => {
        const menu = event.target.closest('[data-session-menu]');
        if (menu) {
          event.stopPropagation();
          openSessionMenu(menu.dataset.sessionMenu);
          return;
        }
        const item = event.target.closest('[data-session]');
        if (item) loadSession(item.dataset.session);
      });
    }

    const composer = $('composer');
    if (composer) {
      composer.addEventListener('submit', (event) => {
        event.preventDefault();
        const input = $('prompt-input');
        if (!input) return;
        const value = input.value.trim();
        if (!value) return;
        sendMessage(value);
      });
    }

    const prompt = $('prompt-input');
    if (prompt) {
      prompt.addEventListener('input', autoResizeComposer);
      prompt.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
          event.preventDefault();
          const value = prompt.value.trim();
          if (value && !runtime.busy) {
            prompt.value = '';
            autoResizeComposer();
            sendMessage(value);
          }
        }
      });
    }

    const toolsToggle = $('tools-toggle');
    if (toolsToggle) {
      toolsToggle.addEventListener('click', () => {
        settings.toolsEnabled = !settings.toolsEnabled;
        saveSettings();
        syncToolsToggle();
        const checkbox = $('set-tools');
        if (checkbox) checkbox.checked = settings.toolsEnabled;
        toast(settings.toolsEnabled ? 'Tool use enabled.' : 'Tool use disabled.');
      });
    }

    const micButton = $('mic-btn');
    if (micButton) micButton.addEventListener('click', startDictation);

    const stopButton = $('stop-btn');
    if (stopButton) stopButton.addEventListener('click', stopGeneration);

    const scrollButton = $('scroll-bottom');
    if (scrollButton) scrollButton.addEventListener('click', scrollToBottom);

    const chatScroll = $('chat-scroll');
    if (chatScroll) chatScroll.addEventListener('scroll', updateScrollButton, { passive: true });

    const chatMessages = $('chat-messages');
    if (chatMessages) {
      chatMessages.addEventListener('click', async (event) => {
        const suggestion = event.target.closest('[data-prompt]');
        if (suggestion) {
          sendMessage(suggestion.dataset.prompt || '');
          return;
        }
        const codeCopy = event.target.closest('[data-copy-code]');
        if (codeCopy) {
          const block = codeCopy.closest('.code-block');
          const code = block ? block.querySelector('code') : null;
          if (code) {
            try {
              await copyToClipboard(code.textContent);
              toast('Code copied.');
            } catch (error) {
              toast(error.message, 'error');
            }
          }
          return;
        }
        const copyButton = event.target.closest('[data-copy-msg]');
        if (copyButton) {
          const session = getSession();
          const message = session
            ? session.messages.find((item) => item.id === copyButton.dataset.copyMsg)
            : null;
          if (message) {
            try {
              await copyToClipboard(message.content);
              toast('Response copied.');
            } catch (error) {
              toast(error.message, 'error');
            }
          }
          return;
        }
        const speakButton = event.target.closest('[data-speak-msg]');
        if (speakButton) {
          const session = getSession();
          const message = session
            ? session.messages.find((item) => item.id === speakButton.dataset.speakMsg)
            : null;
          if (message) speak(message.content, { force: true });
        }
      });
    }

    const voiceQuick = $('voice-quick');
    if (voiceQuick) voiceQuick.addEventListener('click', () => switchView('voice'));

    const voiceMic = $('voice-mic');
    if (voiceMic) {
      voiceMic.addEventListener('click', () => {
        if (runtime.voiceMode) stopVoiceMode();
        else startVoiceMode();
      });
    }

    const wakeToggle = $('wake-toggle');
    if (wakeToggle) {
      wakeToggle.addEventListener('click', () => setWakeMode(!runtime.wakeMode));
    }

    const repliesToggle = $('voice-replies-toggle');
    if (repliesToggle) {
      repliesToggle.addEventListener('click', () => setVoiceOutput(!settings.voiceOutput));
    }

    const testVoice = $('test-voice');
    if (testVoice) {
      testVoice.addEventListener('click', () => {
        speak('Hello. I am NEW AI. Your voice settings are working.', { force: true });
      });
    }

    const agentRun = $('agent-run');
    if (agentRun) agentRun.addEventListener('click', runAgent);
    const agentStop = $('agent-stop');
    if (agentStop) agentStop.addEventListener('click', stopAgent);

    qsa('input[name="agent-type"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        qsa('.agent-type').forEach((label) => {
          const input = label.querySelector('input');
          label.classList.toggle('is-checked', Boolean(input && input.checked));
        });
      });
    });

    const agentGoal = $('agent-goal');
    if (agentGoal) {
      agentGoal.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          runAgent();
        }
      });
    }

    const taskList = $('task-list');
    if (taskList) {
      taskList.addEventListener('click', (event) => {
        const item = event.target.closest('[data-task]');
        if (item) loadTask(item.dataset.task);
      });
    }

    const memoryAdd = $('memory-add');
    if (memoryAdd) memoryAdd.addEventListener('click', addMemory);
    const memoryEmptyAdd = $('memory-empty-add');
    if (memoryEmptyAdd) memoryEmptyAdd.addEventListener('click', addMemory);

    const memorySearch = $('memory-search');
    if (memorySearch) memorySearch.addEventListener('input', renderMemories);

    const memoryList = $('memory-list');
    if (memoryList) {
      memoryList.addEventListener('click', (event) => {
        const edit = event.target.closest('[data-memory-edit]');
        if (edit) {
          editMemory(edit.dataset.memoryEdit);
          return;
        }
        const remove = event.target.closest('[data-memory-delete]');
        if (remove) deleteMemory(remove.dataset.memoryDelete);
      });
    }

    /* Settings */
    bindSetting('set-proxy', 'proxyUrl');
    bindSetting('set-token', 'token');
    const proxyField = $('set-proxy');
    if (proxyField) {
      proxyField.addEventListener('change', () => {
        checkBackend();
        flashSaved();
      });
    }
    bindSetting('set-model', 'model', {
      after: () => {
        settings.modelTouched = true;
        runtime.activeModel = null;
        saveSettings();
        updateModelPill();
      },
    });
    bindSetting('set-maxtokens', 'maxTokens', { type: 'num' });
    bindSetting('set-temp', 'temperature', {
      type: 'num',
      after: (value) => {
        const label = $('set-temp-value');
        if (label) label.textContent = Number(value).toFixed(1);
      },
    });
    bindSetting('set-streaming', 'streaming', { type: 'bool' });
    bindSetting('set-username', 'username');
    bindSetting('set-style', 'style', { type: 'select' });
    bindSetting('set-context', 'context', {
      type: 'num',
      after: (value) => {
        const label = $('set-context-value');
        if (label) label.textContent = value + ' messages';
      },
    });
    bindSetting('set-voice-output', 'voiceOutput', {
      type: 'bool',
      after: (value) => {
        if (!value) stopSpeaking();
        updateVoiceButtons();
      },
    });
    bindSetting('set-autospeak', 'autospeak', { type: 'bool' });
    bindSetting('set-voice', 'voiceURI', { type: 'select' });
    bindSetting('set-lang', 'lang', {
      after: () => {
        if (runtime.wakeMode) {
          stopWakeRecognition();
          startWakeRecognition();
        }
      },
    });
    bindSetting('set-rate', 'rate', {
      type: 'num',
      after: (value) => {
        const label = $('set-rate-value');
        if (label) label.textContent = Number(value).toFixed(1) + '×';
      },
    });
    bindSetting('set-pitch', 'pitch', {
      type: 'num',
      after: (value) => {
        const label = $('set-pitch-value');
        if (label) label.textContent = Number(value).toFixed(1);
      },
    });
    bindSetting('set-wake', 'wake', {
      after: () => {
        updateVoiceButtons();
        if (runtime.wakeMode) {
          stopWakeRecognition();
          startWakeRecognition();
        }
      },
    });
    bindSetting('set-tools', 'toolsEnabled', {
      type: 'bool',
      after: syncToolsToggle,
    });
    bindSetting('set-bridge', 'bridgeUrl');
    bindSetting('set-memory', 'memoryEnabled', {
      type: 'bool',
      after: (value) => {
        const other = $('memory-enabled');
        if (other) other.checked = value;
        renderMemories();
      },
    });
    bindSetting('memory-enabled', 'memoryEnabled', {
      type: 'bool',
      after: (value) => {
        const other = $('set-memory');
        if (other) other.checked = value;
        renderMemories();
      },
    });

    const testConnectionButton = $('test-connection');
    if (testConnectionButton) testConnectionButton.addEventListener('click', testConnection);

    const resetPerms = $('reset-perms');
    if (resetPerms) {
      resetPerms.addEventListener('click', () => {
        runtime.sessionPermissions = Object.create(null);
        toast('Session permissions cleared. Tools will ask again.');
      });
    }

    const exportButton = $('export-data');
    if (exportButton) exportButton.addEventListener('click', exportData);
    const clearChats = $('clear-chats');
    if (clearChats) clearChats.addEventListener('click', clearConversations);
    const clearMemoryButton = $('clear-memories');
    if (clearMemoryButton) clearMemoryButton.addEventListener('click', clearMemories);
    const resetSettingsButton = $('reset-settings');
    if (resetSettingsButton) resetSettingsButton.addEventListener('click', resetSettings);

    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        startNewChat();
      }
      if (event.key === 'Escape') closeSidebar();
    });

    window.addEventListener('online', checkBackend);
    window.addEventListener('offline', () => setNetState('offline', 'Device offline', 'Check your connection'));
    window.addEventListener('beforeunload', () => {
      saveSettings();
      saveSessions();
      saveMemories();
      saveTasks();
    });
  }

  /* =====================================================================
     Init
     ===================================================================== */

  function init() {
    initSpeech();
    applySettingsToForm();
    renderToolList();
    renderSessionList();
    renderChat();
    renderTasks();
    renderAgentSteps();
    renderAgentResult();
    renderMemories();
    updateComposerState();
    updateVoiceButtons();
    autoResizeComposer();
    bindEvents();
    startWaveform();
    switchView('chat');
    checkBackend();
    setVoiceState(runtime.wakeMode ? 'wake' : 'idle');

    if (!settings.proxyUrl) {
      toast('Add a proxy endpoint in Settings to start chatting.', 'error');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
