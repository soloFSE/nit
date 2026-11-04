// Service worker «Нити»: держит копию оболочки сайта, чтобы приложение открывалось быстро
// и устанавливалось на главный экран. Данные чатов не кэшируются — они всегда свежие из Supabase.
const CACHE='nit-v3';
const SHELL=['./','index.html','css/style.css','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
// Свои файлы: сначала сеть (чтобы обновления приходили сразу), без сети — из кэша
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return;
  e.respondWith(fetch(e.request).then(r=>{
    if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}
    return r;
  }).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))));
});
// Нажатие на уведомление открывает приложение
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window'}).then(cs=>cs[0]?cs[0].focus():self.clients.openWindow('./')));
});
