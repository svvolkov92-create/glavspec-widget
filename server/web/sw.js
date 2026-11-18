// Makes the web version installable on a phone's home screen; the data are not cached here (the page keeps its own copy).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
