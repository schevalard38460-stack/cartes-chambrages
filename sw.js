// Shell statique uniquement ; les réponses Firebase ne sont jamais mises en cache.
const CACHE='cartes-chambrages-v052-authfix-1';
const ASSETS=['./','./index.html','./style.css','./app.mjs','./rules.mjs','./reactions.mjs','./show.mjs','./firebase-net.mjs','./firebase-transaction.mjs','./firebase-config.js','./manifest.webmanifest','./assets/franck.webp','./assets/mathias.webp','./assets/stephane.webp','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const req=e.request,u=new URL(req.url);if(req.method!=='GET'||u.origin!==self.location.origin)return;
  e.respondWith(fetch(req).then(resp=>{if(resp.ok){const copy=resp.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));}return resp;}).catch(()=>caches.match(req)));
});
