// Service worker: what makes this installable, and what makes it useful on a bad signal.
//
// Two different caching rules, because the two kinds of file fail differently.
//
// The board is network-first. Opening the app must show today's deadlines, and a stale
// board is actively harmful here - it could show a closing date that has already gone. So
// the network is tried first and the cache is only a fallback for when there is no signal,
// which is the honest degradation: yesterday's list, clearly dated, rather than nothing.
//
// The shell is cache-first. The HTML, script and icon change only when the app is rebuilt,
// so serving them from the cache makes it open instantly, and a fresh copy is fetched in
// the background for next time.
//
// Adverts' newspaper clippings are cross-origin and large. They are not intercepted at
// all: they would fill the cache for something already folded away behind a tap.
//
// Nothing here calls event.waitUntil after an await. The event has finished dispatching by
// then and some browsers throw InvalidStateError, which would take the whole response down
// with it. Background refreshes are deliberately fire-and-forget instead.

const VERSION = 'naukri-v1';
const SHELL = ['./', 'index.html', 'app.js', 'manifest.json', 'icon.png'];
const isData = url => /(?:people|board-[a-z0-9]+)\.json$/.test(url.pathname);

self.addEventListener('install', event => {
  // Added one at a time rather than with addAll, which fails the whole install if any
  // single file 404s - one missing icon would leave the app permanently uninstallable.
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.all(SHELL.map(path => cache.add(path).catch(() => { })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== VERSION).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

function store(request, response) {
  // Fire and forget. A failed write must never fail the response.
  caches.open(VERSION).then(cache => cache.put(request, response)).catch(() => { });
}

async function boardFirst(request) {
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) store(request, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw e;
  }
}

async function shellFirst(request) {
  const cached = await caches.match(request);
  if (!cached) return fetch(request);
  fetch(request).then(fresh => {
    if (fresh && fresh.ok) store(request, fresh.clone());
  }).catch(() => { });
  return cached;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(isData(url) ? boardFirst(request) : shellFirst(request));
});
