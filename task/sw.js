var CACHE_NAME = 'notes-v1';
var ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './favicon.svg',
    './manifest.json'
];

self.addEventListener('install', function(e) {
    e.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(ASSETS);
        }).then(function() {
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', function(e) {
    e.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(function(key) {
                    return key !== CACHE_NAME;
                }).map(function(key) {
                    return caches.delete(key);
                })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function(e) {
    e.respondWith(
        caches.match(e.request).then(function(response) {
            return response || fetch(e.request).then(function(resp) {
                if (resp && resp.status === 200 && e.request.method === 'GET') {
                    var respClone = resp.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(e.request, respClone);
                    });
                }
                return resp;
            }).catch(function() {
                return caches.match('./index.html');
            });
        })
    );
});
