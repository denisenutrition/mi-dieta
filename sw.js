/**
 * App de la clienta · funcionar sin conexión. Guarda la «carcasa» de la app (no la dieta: esa
 * va en localStorage). Al cambiar cualquier fichero de la app, sube VERSION.
 */
var VERSION = 'mi-dieta-10';
var CARCASA = ['./', 'index.html', 'config.js', 'logica.js', 'app.js', 'manifest.webmanifest', 'icono.svg', 'icono-192.png', 'icono-512.png', 'icono-180.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(CARCASA); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// La carcasa: primero la red (para coger cambios), y si no hay conexión, lo guardado.
// Lo demás (la dieta de ejemplo, el portal, las fuentes) va directo a la red.
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.indexOf('/ejemplo/') !== -1) return;
  // cache: 'no-cache' → pregunta siempre a GitHub si hay versión nueva (no usa la copia del navegador).
  e.respondWith(fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }).then(function (r) {
    if (r.ok) { var copia = r.clone(); caches.open(VERSION).then(function (c) { c.put(e.request, copia); }); }
    return r;
  }).catch(function () {
    return caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); });
  }));
});
