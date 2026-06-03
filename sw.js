// ── MM Pakkam Service Worker ──
const CACHE_NAME = 'mm-pakkam-v1';

// Pages and assets to cache for offline use
const PRECACHE_URLS = [
    '/login.html',
    '/index.html',
    '/purchase.html',
    '/sales.html',
    '/report.html',
    '/customer.html',
    '/doctor.html',
    '/setup.html',
    '/manage-users.html',
    '/js/auth.js',
    '/js/supabase.js',
    '/icon-192.png',
    '/icon-512.png',
    '/manifest.json'
];

// ── Install: pre-cache all core files ──
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[SW] Pre-caching core files');
            // Cache individually so one failure doesn't block all
            return Promise.allSettled(
                PRECACHE_URLS.map(url => cache.add(url).catch(() => {}))
            );
        }).then(() => self.skipWaiting())
    );
});

// ── Activate: remove old caches ──
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => {
                        console.log('[SW] Deleting old cache:', key);
                        return caches.delete(key);
                    })
            )
        ).then(() => self.clients.claim())
    );
});

// ── Fetch: Network-first for API/Supabase, Cache-first for assets ──
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Always go network-first for Supabase API calls
    if (url.hostname.includes('supabase') || url.hostname.includes('googleapis')) {
        event.respondWith(
            fetch(event.request).catch(() =>
                new Response(JSON.stringify({ error: 'offline' }), {
                    headers: { 'Content-Type': 'application/json' }
                })
            )
        );
        return;
    }

    // For HTML pages: Network-first (get latest), fall back to cache
    if (event.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Save fresh copy to cache
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // For JS/CSS/images: Cache-first (fast), update in background
    event.respondWith(
        caches.match(event.request).then(cached => {
            const networkFetch = fetch(event.request).then(response => {
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
                return response;
            });
            return cached || networkFetch;
        })
    );
});

// ── Background Sync: notify when back online ──
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
