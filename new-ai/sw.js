/* NEW AI service worker.
 *
 * The app shell is cached so the installed icon opens instantly (and still
 * shows its UI offline). Everything that talks to the AI provider stays
 * network-only: cached chat answers would be fake answers.
 */

const VERSION = 'new-ai-v3';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
];

// Never cache these: they must always reflect the live backend.
function isLiveRequest(url) {
  return /\/api\//i.test(url.pathname) || /proxy\.json$/i.test(url.pathname);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      // addAll rejects the whole batch when one file is missing, so add each
      // separately; a single missing icon must not break the install.
      await Promise.all(
        SHELL.map((file) => cache.add(file).catch(() => undefined))
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isLiveRequest(url)) return;

  // Pages: network first, cache as the offline fallback. That way a new
  // deploy shows up right away instead of being pinned by the cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(VERSION);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          return (await caches.match(request)) || (await caches.match('./index.html')) || Response.error();
        }
      })()
    );
    return;
  }

  // Static assets: serve from cache immediately, refresh in the background.
  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => null);
      return cached || (await network) || Response.error();
    })()
  );
});
