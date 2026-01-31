/**
 * Service Worker - SubTracker
 * Enables offline functionality
 */

const CACHE_NAME = 'subtracker-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/variables.css',
    '/css/base.css',
    '/css/components.css',
    '/css/layout.css',
    '/css/animations.css',
    '/css/responsive.css',
    '/js/utils.js',
    '/js/api.js',
    '/js/auth.js',
    '/js/ui.js',
    '/js/charts.js',
    '/js/app.js',
    '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] Skip waiting');
                return self.skipWaiting();
            })
            .catch(err => console.error('[SW] Cache error:', err))
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name !== CACHE_NAME)
                        .map(name => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Claiming clients');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip API requests - let them go to network
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) {
        event.respondWith(networkFirst(request));
        return;
    }
    
    // For static assets, try cache first
    event.respondWith(cacheFirst(request));
});

// Cache first strategy
async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    
    if (cached) {
        // Return cached response and update in background
        fetch(request)
            .then(response => {
                if (response.ok) {
                    cache.put(request, response.clone());
                }
            })
            .catch(() => {});
        
        return cached;
    }
    
    // Not in cache, fetch from network
    try {
        const response = await fetch(request);
        
        if (response.ok) {
            cache.put(request, response.clone());
        }
        
        return response;
    } catch (error) {
        console.error('[SW] Fetch error:', error);
        
        // Return offline fallback for HTML requests
        if (request.headers.get('accept')?.includes('text/html')) {
            return cache.match('/index.html');
        }
        
        throw error;
    }
}

// Network first strategy (for API calls)
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache successful API responses
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[SW] Network failed, trying cache:', request.url);
        
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        
        if (cached) {
            return cached;
        }
        
        // Return offline response for API
        return new Response(
            JSON.stringify({ 
                error: 'Offline',
                message: 'Нет подключения к интернету. Данные будут синхронизированы позже.'
            }),
            {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

// Background sync for offline requests
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-subscriptions') {
        console.log('[SW] Background sync triggered');
        event.waitUntil(syncSubscriptions());
    }
});

async function syncSubscriptions() {
    // Notify clients to process offline queue
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({ type: 'SYNC_REQUIRED' });
    });
}

// Push notifications (for future use)
self.addEventListener('push', (event) => {
    console.log('[SW] Push received:', event);
    
    const data = event.data?.json() || {};
    
    const options = {
        body: data.body || 'Напоминание о подписке',
        icon: '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/icon-72x72.png',
        tag: data.tag || 'subscription-reminder',
        requireInteraction: true,
        actions: [
            { action: 'open', title: 'Открыть' },
            { action: 'dismiss', title: 'Закрыть' }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'SubTracker', options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            self.clients.openWindow('/')
        );
    }
});

// Message from client
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);
    
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
