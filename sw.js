const CACHE_VERSION = 'bowls-tracker-v3';
const STATIC_CACHE = CACHE_VERSION + '-static';
const DYNAMIC_CACHE = CACHE_VERSION + '-dynamic';

// Determine base path dynamically from service worker location
const SW_BASE = self.location.pathname.replace(/sw\.js$/, '');

const PRECACHE_URLS = [
  SW_BASE,
  SW_BASE + 'index.html',
  SW_BASE + 'offline.html',
  SW_BASE + 'manifest.json',
  SW_BASE + 'css/main.css',
  SW_BASE + 'css/analytics.css',
  SW_BASE + 'js/db.js',
  SW_BASE + 'js/app.js',
  SW_BASE + 'js/analytics.js',
  SW_BASE + 'js/export.js',
  SW_BASE + 'js/demo-data.js',
  SW_BASE + 'icons/icon-192.png',
  SW_BASE + 'icons/icon-512.png'
];

// Install: pre-cache critical resources
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker v1...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Pre-caching critical resources');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
      .catch(err => {
        console.error('[SW] Pre-cache failed:', err);
      })
  );
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker v1...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch: network-first for HTML, cache-first for static assets
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    // Allow CDN requests (Chart.js) with cache-first
    if (url.hostname === 'cdn.jsdelivr.net') {
      event.respondWith(cacheFirst(request));
      return;
    }
    return;
  }

  // HTML: network-first
  if (request.headers.get('accept')?.includes('text/html') || url.pathname === SW_BASE || url.pathname.endsWith('.html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets (CSS, JS, images): cache-first
  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    // Return offline page for navigation requests
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match(SW_BASE + 'offline.html');
    }
    return new Response('Offline', { status: 503 });
  }
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    console.log('[SW] Cache miss and network failed:', request.url);
    return new Response('Offline', { status: 503 });
  }
}
