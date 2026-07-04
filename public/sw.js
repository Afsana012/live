self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Simple pass-through fetch handler.
  // Crucial for PWA validation on Chrome/Safari without caching live video segments.
  event.respondWith(fetch(event.request));
});
