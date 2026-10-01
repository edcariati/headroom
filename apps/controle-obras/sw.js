/* Service worker do Controle de Obras Cariati.
   Guarda o aplicativo para abrir sem internet depois do primeiro acesso.
   A versão é gerada pelo build.py (hash do index.html + config.js).
   Uma versão nova NÃO assume sozinha: o app avisa e o usuário confirma (nunca troca no meio de um registro). */
var VERSAO = 'd4ed242038e1';
var CACHE = 'cob-' + VERSAO;
var SHELL = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
var CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2';

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all([c.addAll(SHELL), c.add(new Request(CDN, { mode: 'no-cors' }))]);
  }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('cob-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('message', function (e) { if (e.data && e.data.tipo === 'ATUALIZAR') self.skipWaiting(); if (e.data && e.data.tipo === 'VERSAO' && e.source) e.source.postMessage({ tipo: 'VERSAO', versao: VERSAO }); });
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.hostname.indexOf('supabase.co') >= 0 || url.pathname.indexOf('/_blob/') === 0) return;   // dados e arquivos: nunca do cache do app
  var mesmaOrigem = url.origin === self.location.origin, ehCdn = req.url === CDN;
  if (!mesmaOrigem && !ehCdn) return;
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (r) {
    if (r) return r;
    return fetch(req).catch(function () {
      if (req.mode === 'navigate') return caches.match('index.html');
      return new Response('', { status: 504, statusText: 'Sem internet' });
    });
  }));
});
