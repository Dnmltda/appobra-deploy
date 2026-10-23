// APP OBRA instalável (pedido do Diego, 23/10/2026).
// Só guarda os arquivos fixos do app (pasta /assets, que mudam de nome a cada
// versão) e as imagens da marca, para abrir mais rápido. Dados do servidor
// (/api) e as telas nunca saem daqui: sempre vêm da internet, atualizados.
const CACHE = "appobra-arquivos-v2";
const FIXOS = /^\/(assets\/|logo-dnm|app-obra-|icone-|favicon-app|apple-touch-icon)/;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin || !FIXOS.test(url.pathname)) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const salvo = await c.match(e.request);
    if (salvo) return salvo;
    const r = await fetch(e.request);
    if (r.ok) c.put(e.request, r.clone());
    return r;
  }));
});
