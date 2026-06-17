/**
 * DEBATRE Kalkulator PLTS - Service Worker
 * Strategi Caching: Cache-First untuk asset statis, Network-First untuk data dinamis
 * Memastikan aplikasi berfungsi 100% offline setelah diinstal
 */

const CACHE_NAME = 'debatre-plts-v1';
const OFFLINE_URL = '/index.html';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap',
  'https://fonts.gstatic.com'
];

/**
 * INSTALL EVENT - Precache all critical assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching critical assets for offline support');
        // Precache main assets
        return cache.addAll([
          '/',
          '/index.html',
          '/manifest.json'
        ])
          .then(() => {
            console.log('[SW] Critical assets cached successfully');
            // Attempt to cache Tailwind CSS (non-critical, errors are ignored)
            return Promise.allSettled([
              cache.add('https://cdn.tailwindcss.com'),
              cache.add('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap')
            ]);
          })
          .catch((error) => {
            console.warn('[SW] Some assets could not be cached (this is OK):', error.message);
          });
      })
      .catch((error) => {
        console.error('[SW] Cache open failed:', error);
      })
  );

  // Skip waiting - activate the new SW immediately
  self.skipWaiting();
});

/**
 * ACTIVATE EVENT - Clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old cache versions
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
  );

  // Claim clients immediately
  self.clients.claim();
});

/**
 * FETCH EVENT - Intelligent caching strategy
 * - Cache-First for static assets (HTML, CSS, JS, fonts)
 * - Network-First for dynamic content (allows offline + updates)
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and cross-origin requests with different policies
  if (request.method !== 'GET') {
    return;
  }

  // Strategy 1: Cache-First for local assets
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          // Return cached response if available
          if (cachedResponse) {
            console.log('[SW] Cache HIT:', request.url);
            return cachedResponse;
          }

          // Fetch from network if not in cache
          console.log('[SW] Cache MISS - fetching from network:', request.url);
          return fetch(request)
            .then((response) => {
              // Don't cache non-successful responses
              if (!response || response.status !== 200) {
                return response;
              }

              // Clone the response to cache it
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(request, responseToCache);
                  console.log('[SW] Cached new asset:', request.url);
                })
                .catch((error) => {
                  console.warn('[SW] Failed to cache:', error.message);
                });

              return response;
            })
            .catch((error) => {
              // Network request failed - try to return cached version
              console.warn('[SW] Network request failed:', error.message);
              return caches.match(request)
                .then((cachedResponse) => {
                  if (cachedResponse) {
                    console.log('[SW] Returning cached fallback:', request.url);
                    return cachedResponse;
                  }
                  
                  // Return offline page if available
                  if (request.destination === 'document') {
                    return caches.match(OFFLINE_URL);
                  }

                  return new Response('Offline - Resource not available', {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: new Headers({
                      'Content-Type': 'text/plain'
                    })
                  });
                });
            });
        })
        .catch((error) => {
          console.error('[SW] Fetch handler error:', error);
        })
    );
    return;
  }

  // Strategy 2: Network-First for external resources (CDN, fonts)
  if (url.hostname === 'cdn.tailwindcss.com' || 
      url.hostname === 'fonts.googleapis.com' ||
      url.hostname === 'fonts.gstatic.com') {
    
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
                console.log('[SW] Cached external resource:', request.url);
              })
              .catch((error) => {
                console.warn('[SW] Failed to cache external resource:', error.message);
              });
          }
          return response;
        })
        .catch((error) => {
          // Network failed - return cached version if available
          console.warn('[SW] External resource fetch failed:', error.message);
          return caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                console.log('[SW] Returning cached external resource:', request.url);
                return cachedResponse;
              }
              throw error;
            });
        })
    );
  }
});

/**
 * MESSAGE EVENT - Handle client messages
 * Allows manual cache updates and status checks
 */
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skipping waiting - activating immediately');
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_CACHE_STATUS') {
    caches.keys()
      .then((cacheNames) => {
        Promise.all(
          cacheNames.map((cacheName) =>
            caches.open(cacheName)
              .then((cache) =>
                cache.keys()
                  .then((keys) => ({
                    cacheName,
                    itemCount: keys.length,
                    size: keys.length * 50 // Rough estimate in KB
                  }))
              )
          )
        )
          .then((cacheStatus) => {
            event.ports[0].postMessage({
              type: 'CACHE_STATUS',
              caches: cacheStatus,
              timestamp: new Date().toISOString()
            });
          });
      });
  }
});

console.log('[SW] Service Worker script loaded');
