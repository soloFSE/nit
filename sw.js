// Service worker «Нити»: держит копию оболочки сайта, чтобы приложение открывалось быстро
// и устанавливалось на главный экран. Данные чатов не кэшируются — они всегда свежие из Supabase.
const CACHE='nit-v20';
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
// Нажатие на уведомление открывает приложение и нужный чат
self.addEventListener('notificationclick',e=>{
  e.notification.close();const chat=e.notification.data?.chat;
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async cs=>{
    const c=cs[0];
    if(c){await c.focus().catch(()=>{});if(chat)c.postMessage({open:chat});return}
    const w=await self.clients.openWindow('./');if(w&&chat)setTimeout(()=>w.postMessage({open:chat}),3000);
  }));
});
