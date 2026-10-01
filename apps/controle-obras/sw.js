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
    // a biblioteca externa é guardada sem travar a instalação (se a rede falhar agora, entra no 1º uso)
    return c.addAll(SHELL).then(function () { return c.add(new Request(CDN, { mode: 'no-cors' })).catch(function () {}); });
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
  if (ehCdn) {   // rede primeiro (e guarda cópia); sem rede, usa a cópia guardada
    e.respondWith(fetch(req).then(function (res) { var c = res.clone(); caches.open(CACHE).then(function (ch) { ch.put(req, c); }); return res; }).catch(function () { return caches.match(req); }));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (r) {
    if (r) return r;
    return fetch(req).catch(function () {
      if (req.mode === 'navigate') return caches.match('index.html');
      return new Response('', { status: 504, statusText: 'Sem internet' });
    });
  }));
});
