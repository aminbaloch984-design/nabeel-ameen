# NEW AI — personal AI agent

NEW AI is a JARVIS-inspired personal assistant built with **HTML5, CSS3 and vanilla JavaScript**. It combines a ChatGPT-style chat workspace with voice input/output, a permission-gated tool system, multi-step agents, and a local memory store.

There is **no fake AI layer**. If the backend is missing, unreachable or misconfigured, NEW AI shows a real error with setup guidance instead of inventing an answer.

```
NEW-AI/
├── index.html          # App shell, all views and icons
├── style.css           # Dark futuristic design system + responsive layout
├── script.js           # Chat, streaming, tools, agents, voice, memory, settings
├── README.md
└── server/
    ├── server.js       # Zero-dependency static server + secure AI proxy
    ├── package.json    # Optional start script, no dependencies
    ├── .env.example    # Copy to .env and fill in
    └── .gitignore      # Keeps .env out of git
```

---

## 1. Quick start

Requirements: **Node.js 18 or newer** and a modern browser (Chrome or Edge recommended for voice).

```bash
cd NEW-AI
copy server\.env.example server\.env      # Windows
# cp server/.env.example server/.env      # macOS / Linux
```

Edit `server/.env`:

```ini
PROVIDER_BASE_URL=https://api.openai.com/v1
API_KEY=sk-your-real-key
DEFAULT_MODEL=gpt-4o-mini
```

Start the server:

```bash
node server/server.js
# or: cd server && npm start
```

Open **http://127.0.0.1:8787**.

The server does two jobs:

1. Serves `index.html`, `style.css` and `script.js`.
2. Proxies `POST /api/chat` to the provider and exposes `GET /api/health`.

The browser never receives the API key.

> Opening `index.html` directly with `file://` works for the UI, but the default endpoint becomes `http://localhost:8787/api/chat`. For voice and clipboard features, use `http://127.0.0.1:8787` (a secure context) rather than a file URL.

---

## 2. Supported providers

NEW AI speaks the OpenAI-compatible chat-completions protocol, including SSE streaming. Set the base URL, key and model in `server/.env`; the model can also be changed in Settings.

| Provider | `PROVIDER_BASE_URL` | Example model | Key |
| --- | --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` | required |
| Google AI Studio (Gemini) | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-2.5-flash` | required |
| OpenRouter | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` | required |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | required |
| Together | `https://api.together.xyz/v1` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` | required |
| Ollama (local) | `http://127.0.0.1:11434/v1` | `llama3.2` | set `ALLOW_NO_KEY=true` |

For a local model:

```ini
PROVIDER_BASE_URL=http://127.0.0.1:11434/v1
DEFAULT_MODEL=llama3.2
ALLOW_NO_KEY=true
API_KEY=
```

For Google AI Studio (Gemini), create a key at `aistudio.google.com`. Gemini keeps the same OpenAI-compatible path:

```ini
PROVIDER_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
API_KEY=AQ.your-google-ai-studio-key
DEFAULT_MODEL=gemini-3.6-flash
```

Newer Gemini models spend part of the token budget on internal reasoning, so raise **Max output tokens** to 2048 or more in Settings if long answers get cut off. If a model ID stops working, the provider error names its replacement.

The app follows the server's `DEFAULT_MODEL` until you change the model in Settings, so switching providers in `server/.env` does not leave a stale model behind.

Some providers need extra headers or a different token field. Adjust `server/server.js` on your own machine if necessary; never move that logic into `script.js` with a secret.

The Settings screen has **Proxy endpoint**, **Model**, **max tokens**, **temperature**, **streaming**, and **Test connection**. The default proxy endpoint is the origin that served the page plus `/api/chat`.

---

## 3. What is implemented

### Chat
- Multi-turn context with a configurable window (6–60 messages).
- Streaming responses (when the provider supports SSE) with a typing caret.
- Markdown: headings, lists, tables, blockquotes, links, inline code and fenced code blocks with a copy button.
- Copy any response, read it aloud, stop generation mid-stream.
- Conversation sidebar with search, rename and delete.
- Long history stored locally; only the recent window is sent as context.
- Error states for offline backend, missing key, bad model, rate limits and timeouts.

### Voice
- Speech recognition through the Web Speech API.
- Speech synthesis with voice, language, speed and pitch controls.
- A voice screen with an animated core, live status and waveform.
- Optional hands-free conversation mode (mic → answer → listen again).
- Wake phrase (default “hey new ai”) where the browser keeps continuous recognition alive.
- Composer dictation button on desktop.

### Agents
- Four presets: Personal, Coding, Research, Writing.
- AI-generated plan, then sequential multi-step execution with live status.
- Progress bar, per-step output, tool badges and a final synthesised answer.
- Task history stored locally, with stop control.
- Tools used during a run still require permission.

### Browser tools (allowlisted)
| Tool | Action |
| --- | --- |
| `open_website` | Opens an approved `http(s)` URL in a new tab. |
| `web_search` | Opens a DuckDuckGo search in a new tab. |
| `copy_text` | Copies approved text to the clipboard. |
| `open_app` | Calls an optional local bridge to open an allowlisted app. |

The model requests a tool with a fenced `tool` JSON block. NEW AI asks for permission, executes only the registered browser action, returns a real result to the model, and then continues. Unknown tool names are rejected. Every tool can be set to **Ask**, **Allow** or **Block** in Settings. `open_app` always prompts at least once per session.

### Memory
- Add, edit, delete and search approved memories.
- Categories: Preference, Personal, Project, Instruction.
- Keyword retrieval injects only relevant memories into the prompt.
- Enable/disable memory entirely.
- Everything is stored in `localStorage`; export a JSON backup at any time.

### Interface
- Dark dashboard, animated circular core, waveform, live status pills.
- Chat, Agents, Voice, Memory and Settings views.
- Responsive sidebar and layouts for mobile, tablet and desktop.
- Reduced-motion support.
- No frameworks, no bundler, no build step.

---

## 4. Security model

### API key
- The key lives **only** in `server/.env`.
- `.env` is git-ignored and never served as a static file.
- `script.js` holds no secrets and sends requests to your local proxy.
- The proxy binds to `127.0.0.1` by default, caps request size, validates roles, clamps parameters, applies a timeout and redacts the key from errors.

### Tool permissions
- No arbitrary shell commands and no OS-level control from the browser.
- The tool registry is a fixed allowlist in `script.js`.
- Permission prompts show the exact tool and arguments.
- Denied tools return a real “denied” result to the model; the model is instructed not to pretend the action happened.
- Popups may still be blocked by the browser. When that happens NEW AI reports it instead of claiming success.

### What a webpage cannot do
A normal web page cannot:
- Launch desktop applications.
- Read local files or run terminal commands.
- Control the operating system, mouse or keyboard outside the page.
- Reliably listen for a wake phrase while closed or in the background.
- Guarantee clipboard or voice permissions without a user gesture.

Those capabilities need a **native helper** installed by the user. This project explains that boundary instead of pretending it does not exist.

### Optional native bridge
`open_app` expects a local HTTP service, for example `http://127.0.0.1:8790`, with:

```
POST /open
Content-Type: application/json

{ "app": "notepad" }
```

The bridge must:
- Keep its own allowlist of app names (never accept arbitrary command lines).
- Validate the image path or launch arguments.
- Require a token or OS-level local-only binding.
- Refuse requests from unknown origins.
- Log every launch.

Example response: `{ "ok": true }`. NEW AI itself never runs a shell command; it only asks the bridge. The bridge is deliberately **not included**, because a safe launcher is OS-specific and must be audited by the person installing it.

---

## 5. Data and privacy

| Data | Where it lives | How to remove it |
| --- | --- | --- |
| Conversations | `localStorage` (`newai.sessions.v1`) | Settings → Clear conversations |
| Memories | `localStorage` (`newai.memories.v1`) | Memory page or Settings |
| Settings | `localStorage` (`newai.settings.v1`) | Settings → Reset settings |
| Agent tasks | `localStorage` (`newai.tasks.v1`) | Clear conversations |
| API key | `server/.env` on disk | Delete the file or the key |
| Prompts/answers | Sent to your chosen provider when you send a message | Provider policy applies |

Export everything from **Settings → Export data** (the proxy URL and API key are not included; keys are never stored in the browser).

---

## 6. Configuration reference

| Setting | Purpose |
| --- | --- |
| Proxy endpoint | URL of the local `/api/chat` proxy. |
| Model | Model ID sent to the provider. |
| Max output tokens | Hard cap for one response (64–8192). |
| Creativity | Temperature, 0–1.4 in the UI. |
| Streaming | Token-by-token output when supported. |
| Answer style | Concise, balanced or detailed system guidance. |
| Context | Number of recent messages included in a request. |
| Voice output / autospeak | Spoken replies and automatic speaking. |
| Recognition language | BCP-47 tag, e.g. `en-US`, `ur-PK`, `hi-IN`. |
| Wake phrase | Phrase that arms hands-free listening. |
| Tools | Global tool switch plus per-tool policy. |
| Native bridge URL | Optional local app launcher. |
| Memory | Whether approved memories are retrieved. |

Server environment:

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `8787` | Local web server port. |
| `HOST` | `127.0.0.1` | Keep local unless you trust the network. |
| `PROVIDER_BASE_URL` | OpenAI | No trailing slash. |
| `API_KEY` | empty | Required unless `ALLOW_NO_KEY=true`. |
| `DEFAULT_MODEL` | `gpt-4o-mini` | Used by health fallback. |
| `ALLOW_NO_KEY` | `false` | Only for trusted local providers. |
| `ALLOWED_ORIGIN` | empty | Comma-separated dev origins, optional. |
| `REQUEST_TIMEOUT_MS` | `120000` | Upstream timeout. |

---

## 7. Troubleshooting

**“NEW AI cannot reach its backend.”**
Start `node server/server.js`. Check that Settings → Proxy endpoint points at `http://127.0.0.1:8787/api/chat` (or your port). If you changed `HOST`, use that host.

**“The server is not configured.”**
`server/.env` is missing `API_KEY`. Copy `.env.example`, add the key, restart the server. For Ollama set `ALLOW_NO_KEY=true`.

**401 / 403 from the provider**
The key is wrong, expired, or lacks access to the model. Test the same key with the provider directly. Never paste it into the browser or Settings.

**404 model not found**
Check `PROVIDER_BASE_URL` and the exact model ID. OpenRouter models usually include a vendor prefix.

**Streaming does not appear**
Turn streaming off in Settings to test the non-streaming path, or confirm the provider emits `text/event-stream` and `data:` lines.

**Voice input does nothing**
Use Chrome or Edge over `http://127.0.0.1` or `https://`. Check microphone permission. Firefox support for speech recognition is limited. Wake-phrase listening is best-effort: browsers may stop recognition when the tab is in the background.

**Wake phrase never triggers**
Make sure the voice screen is open or the tab is visible, the mic permission is granted, and the phrase is set in Settings. Continuous recognition varies by browser and platform.

**Popups are blocked**
Allow popups for the NEW AI origin. NEW AI reports blocked popups rather than pretending a site opened.

**Port already in use**
Change `PORT` in `server/.env`, then update the proxy endpoint in Settings.

---

## 8. Browser support

| Feature | Chrome / Edge | Firefox | Safari |
| --- | --- | --- | --- |
| Chat, streaming, Markdown | yes | yes | yes |
| localStorage, clipboard | yes | yes | yes (clipboard needs a gesture) |
| Speech recognition | yes | limited | limited |
| Speech synthesis | yes | yes | yes |
| Wake phrase | best-effort | unlikely | unlikely |

Google Fonts are loaded from a CDN with system-font fallbacks. The interface still works offline once the page and backend are local.

---

## 9. Development notes

- No build step. Edit the three front-end files and refresh.
- `script.js` is organised into sections: utilities, storage, tools, markdown, chat, transport, permissions, agents, voice, memory, settings, routing, events.
- The Markdown renderer escapes all input first and emits a small allowlist of tags. Code blocks are rendered separately, and links are restricted to `http(s)` and `mailto`.
- To add a browser tool: add it to the `TOOLS` object, give it an icon, add its policy default, and optionally document it. Never add shell execution.
- To change the tool protocol, update `TOOL_PROTOCOL` and `extractToolCalls` together.

### Manual test checklist
1. Start the server with a key: health pill turns green.
2. Send a message: streaming, Markdown, copy and stop behave.
3. Ask for a website: permission modal appears, denial is reported honestly.
4. Run an agent: plan, steps, result and task history appear.
5. Add/edit/delete a memory; reload and confirm persistence.
6. Toggle voice, dictation, wake phrase and spoken replies.
7. Export data, clear conversations and reset settings.
8. Resize to mobile width and use the sidebar overlay.

---

## 10. Honest limitations

- NEW AI is a strong personal assistant UI, not a system-level JARVIS. It cannot control your OS, files or other apps without a native bridge you install and trust.
- Browser speech APIs are powerful but inconsistent across engines and operating systems.
- The app sends prompts to whichever provider you configure; review that provider’s data policy.
- Local history is not encrypted. Use full-disk encryption and export/clear data on shared machines.
- The proxy is intended for local use. If you expose it publicly, add authentication, TLS, rate limiting and a strict origin allowlist first.

Built as a clean, dependency-free foundation you can extend without hiding what is really happening.
