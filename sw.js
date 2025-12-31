// Minimal service worker for PWA installability
// No caching - just enough to make the app installable

self.addEventListener('install', (event) => {
    console.log('Service Worker: Installed');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activated');
    event.waitUntil(clients.claim());
});

// Pass through all fetch requests (no caching)
self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});
