/* Starlight Island — cache static game + BGM */
const VERSION = 'starlight-shell-v2';
const AUDIO_CACHE = 'starlight-audio-v1';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const base = self.registration.scope;
    const shell = [
      './',
      './index.html',
      './app.bundle.js',
      './css/style.css',
      './vendor/peerjs.min.js',
      './favicon.ico',
      './audio/boss.mp3',
      './audio/journey.mp3',
      './audio/ultra.mp3',
    ].map((p) => new URL(p, base).href);
    const cache = await caches.open(VERSION);
    await Promise.all(shell.map(async (u) => {
      try {
        const res = await fetch(u, { cache: 'reload' });
        if (res.ok) await cache.put(u, res);
      } catch {}
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([VERSION, AUDIO_CACHE]);
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isAudio = url.pathname.includes('/audio/') && url.pathname.endsWith('.mp3');
  const isShell = /\.(js|css|html|ico)$/.test(url.pathname) || url.pathname.endsWith('/');

  if (!isAudio && !isShell) return;

  event.respondWith((async () => {
    const cacheName = isAudio ? AUDIO_CACHE : VERSION;
    const cache = await caches.open(cacheName);
    const hit = await cache.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.ok) {
        try { await cache.put(req, res.clone()); } catch {}
      }
      return res;
    } catch (e) {
      if (hit) return hit;
      throw e;
    }
  })());
});
