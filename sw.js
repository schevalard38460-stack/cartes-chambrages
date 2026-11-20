// Cartes & Chambrages v0.5.3 — mise à jour robuste du cache Android.
// Firebase et les réponses réseau ne sont jamais mis en cache.
const CACHE='cartes-chambrages-v053-firebase';
const ASSETS=[
 './','./index.html','./style.css','./app-v053.mjs','./firebase-net-v053.mjs',
 './rules.mjs','./reactions.mjs','./show.mjs','./firebase-transaction.mjs',
 './firebase-config.js','./manifest.webmanifest','./assets/franck.webp',
 './assets/mathias.webp','./assets/stephane.webp','./assets/icon-192.png','./assets/icon-512.png'
];
self.addEventListener('install',e=>{
 e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
 e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k.startsWith('cartes-chambrages-')).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
 const req=e.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin)return;
 // Toujours récupérer les pages et les modules les plus récents si connecté.
 e.respondWith(fetch(req,{cache:'no-store'}).then(response=>{
   if(response.ok){const copy=response.clone();
     caches.open(CACHE).then(cache=>cache.put(req,copy)).catch(()=>{});}
   return response;
 }).catch(()=>caches.match(req).then(response=>response||Response.error())));
});
