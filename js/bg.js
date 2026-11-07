// Работа в фоне, звук и системные уведомления, переворот камеры.
// Важно про фон: телефон ставит на паузу <video>, когда приложение свёрнуто, поэтому звук собеседников
// идёт через отдельные <audio> — они в фоне продолжают играть, и страница не «засыпает» посреди звонка.

// ---------- Звук собеседников через <audio> ----------
const rAudio={};
function remoteAudio(key,stream){
  let a=rAudio[key];
  if(!a){a=rAudio[key]=document.createElement('audio');a.autoplay=true;a.playsInline=true;a.className='hide';a.dataset.k=key;document.body.append(a)}
  if(a.srcObject!==stream){a.srcObject=stream;a.play().catch(()=>{})}
}
function dropAudio(key){const a=rAudio[key];if(!a)return;a.srcObject=null;a.remove();delete rAudio[key]}
function dropAllAudio(){Object.keys(rAudio).forEach(dropAudio)}
// Вернулись в приложение — запускаем видео, которые телефон поставил на паузу
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)return;
  document.querySelectorAll('#call video,#gcall video,audio[data-k]').forEach(v=>{if(v.srcObject&&v.paused)v.play().catch(()=>{})});
  [audioCtx,toneCtx,talkCtx].forEach(c=>c?.state==='suspended'&&c.resume().catch(()=>{}));
  if(cur)clearNotes(cur);
});

// ---------- Управление звонком из шторки / экрана блокировки (Media Session) ----------
function callSession(on,title,o={}){
  const ms=navigator.mediaSession;if(!ms)return;
  const set=(a,f)=>{try{ms.setActionHandler(a,on?f:null)}catch{}};
  if(on){
    try{ms.metadata=new MediaMetadata({title,artist:'Нить · звонок',artwork:[{src:'icons/icon-192.png',sizes:'192x192',type:'image/png'}]})}catch{}
    try{ms.playbackState='playing'}catch{}
  }else{try{ms.metadata=null;ms.playbackState='none'}catch{}}
  set('hangup',o.hangup);set('togglemicrophone',o.mic);set('togglecamera',o.cam);
  set('enterpictureinpicture',o.pip);
}
function setSessionMic(on){try{navigator.mediaSession?.setMicrophoneActive?.(on)}catch{}}
function setSessionCam(on){try{navigator.mediaSession?.setCameraActive?.(on)}catch{}}

// ---------- Звук: разблокировка на телефоне ----------
// Телефоны не дают играть звук, пока человек ни разу не коснулся страницы — «будим» звук при первом касании
const soundOn=()=>{try{return localStorage.getItem('nit-sound')!=='0'}catch{return true}};
function unlockAudio(){
  try{audioCtx||=new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume()}catch{}
  try{if(toneCtx?.state==='suspended')toneCtx.resume()}catch{}
}
['pointerdown','keydown','touchstart'].forEach(e=>document.addEventListener(e,unlockAudio,{passive:true}));
// Один раз сами предлагаем включить уведомления (по касанию — иначе браузер не покажет вопрос)
document.addEventListener('pointerdown',async function ask(){
  if(!me||!('Notification' in window))return;
  document.removeEventListener('pointerdown',ask);
  try{if(localStorage.getItem('nit-asked'))return;localStorage.setItem('nit-asked','1')}catch{return}
  if(Notification.permission==='granted'){try{localStorage.setItem('nit-notify','1')}catch{}return}
  if(Notification.permission==='default'){const p=await Notification.requestPermission().catch(()=>'denied');if(p==='granted')try{localStorage.setItem('nit-notify','1')}catch{}}
});

// ---------- Системные уведомления ----------
// На Android «new Notification()» не работает — показываем через service worker, так уведомление
// приходит со звуком и вибрацией системы, даже когда приложение свёрнуто.
async function sysNotify(title,o={}){
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  const opt={body:o.body||'',tag:o.tag||'nit',icon:o.icon||'icons/icon-192.png',badge:'icons/icon-192.png',renotify:true,
    vibrate:o.call?[400,200,400,200,400]:[120,60,120],requireInteraction:!!o.call,data:{chat:o.chat||null},silent:false};
  try{
    const reg=await navigator.serviceWorker?.getRegistration?.();
    if(reg){await reg.showNotification(title,opt);return}
  }catch{}
  try{const n=new Notification(title,opt);n.onclick=()=>{window.focus();if(o.chat)openChat(o.chat);n.close()}}catch{}
}
// Закрываем уведомления чата, когда его открыли
async function clearNotes(tag){try{const reg=await navigator.serviceWorker?.getRegistration?.();(await reg?.getNotifications({tag}))?.forEach(n=>n.close())}catch{}}
// Нажали на уведомление — service worker просит открыть нужный чат
navigator.serviceWorker?.addEventListener('message',e=>{const k=e.data?.open;if(k&&me&&chatName(k))openChat(k)});

// ---------- Переворот камеры (фронтальная / задняя) ----------
let camCount=0;
async function countCams(){
  try{camCount=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput').length}catch{camCount=0}
  return camCount;
}
// Меняем видеодорожку в потоке и у всех соединений без пересоздания звонка
async function flipCamera(local,pcs){
  const old=local?.getVideoTracks()[0];if(!old)return null;
  const st=old.getSettings?.()||{},was=st.facingMode||(local._facing||'user'),next=was==='environment'?'user':'environment';
  const on=old.enabled,size={width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}};
  old.stop(); // многие телефоны не открывают две камеры одновременно
  let s=null,facing=next;
  try{s=await navigator.mediaDevices.getUserMedia({video:{facingMode:{exact:next},...size}})}catch{}
  if(!s){ // компьютер или камеры без «стороны» — просто берём следующую по списку
    try{const cams=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
      const i=cams.findIndex(c=>c.deviceId===st.deviceId),n=cams[(i+1)%cams.length];
      if(n)s=await navigator.mediaDevices.getUserMedia({video:{deviceId:{exact:n.deviceId},...size}});facing=s?.getVideoTracks()[0].getSettings().facingMode||next}catch{}
  }
  if(!s){try{s=await navigator.mediaDevices.getUserMedia({video:{facingMode:was,...size}});facing=was}catch{}}
  if(!s){toast('Не удалось переключить камеру');local.removeTrack(old);return null}
  const nt=s.getVideoTracks()[0];nt.enabled=on;
  local.removeTrack(old);local.addTrack(nt);local._facing=facing;
  for(const pc of pcs){
    const snd=pc.getSenders().find(x=>x.track===old)||pc.getSenders().find(x=>x.track?.kind==='video');
    try{await snd?.replaceTrack(nt)}catch(e){console.warn('flip',e)}
  }
  return facing;
}
// Показ своего видео: зеркалим только фронтальную камеру
function mirrorLocal(v,facing){v?.classList.toggle('back-cam',facing==='environment')}

$('cflip').onclick=async()=>{
  if(!call?.local)return;$('cflip').disabled=true;
  const f=await flipCamera(call.local,call.pc?[call.pc]:[]);$('cflip').disabled=false;if(!f)return;
  const v=$('lv');v.srcObject=null;v.srcObject=call.local;v.play().catch(()=>{});mirrorLocal(v,f);
  $('cflip').classList.toggle('spun');
};
$('gcflip').onclick=async()=>{
  if(!gc?.local)return;$('gcflip').disabled=true;
  const f=await flipCamera(gc.local,Object.values(gc.peers));$('gcflip').disabled=false;if(!f)return;
  const t=document.querySelector('.tile.me'),v=t?.querySelector('video');
  if(v){v.srcObject=null;v.srcObject=gc.local;v.play().catch(()=>{})}mirrorLocal(t,f);
  $('gcflip').classList.toggle('spun');
};
// Кнопка видна только в видеозвонке и если камер больше одной
async function showFlip(btn,stream){
  const has=!!stream?.getVideoTracks().length;btn.classList.add('hide');
  if(has&&await countCams()>1)btn.classList.remove('hide');
}
