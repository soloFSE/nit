// Прочитано (галочки), счётчики непрочитанных, уведомления, черновики
let myReads={},peerReads={},readsOk=true,markTimer=0;
// Ключ чата для базы: 'dm:<id1>:<id2>' или 'g:<id>'
const dmKey=u=>'dm:'+[me,u].sort().join(':');
const readKey=k=>isGroupKey(k)?k:dmKey(k);
const keyFromRead=c=>c.startsWith('g:')?c:c.slice(3).split(':').find(x=>x!==me);

// При входе: сколько непрочитанных в каждом чате
async function loadUnread(){
  const mine=await sb.from('reads').select('chat,last_id').eq('user_id',me);
  if(mine.error){readsOk=false;return}
  (mine.data||[]).forEach(r=>myReads[r.chat]=r.last_id);
  if(!(mine.data||[]).length){
    // Первый запуск: считаем всё старое прочитанным, чтобы не было «999 непрочитанных»
    const keys=[...fr.filter(f=>f.status==='accepted').map(f=>dmKey(f.a===me?f.b:f.a)),...Object.keys(groups).map(g=>'g:'+g)];
    if(keys.length)await sb.from('reads').upsert(keys.map(chat=>({user_id:me,chat,last_id:lastId})));
    keys.forEach(k=>myReads[k]=lastId);return;
  }
  const {data,error}=await sb.rpc('unread_counts');if(error)return;
  unread={};(data||[]).forEach(r=>{const k=keyFromRead(r.chat);if(k)unread[k]=Number(r.n)});
  render();updateBadge();
}

// Отмечаем открытый чат прочитанным (не чаще раза в секунду)
function markRead(){
  if(!cur||document.hidden||!readsOk)return;
  clearTimeout(markTimer);
  markTimer=setTimeout(async()=>{
    if(!cur)return;
    const k=readKey(cur),ids=Object.keys(nodes).map(Number),max=Math.max(0,...ids);
    if(unread[cur]){unread[cur]=0;render();updateBadge()}
    if(!max||(myReads[k]||0)>=max)return;
    myReads[k]=max;
    const {error}=await sb.from('reads').upsert({user_id:me,chat:k,last_id:max,updated_at:new Date().toISOString()});
    if(error&&/relation|does not exist|schema cache/i.test(error.message))readsOk=false;
  },400);
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)markRead()});
window.addEventListener('focus',markRead);

// Галочки: чьи отметки «прочитано» есть в открытом чате
async function loadPeerReads(k){
  if(!readsOk)return;
  const rk=readKey(k);
  const {data,error}=await sb.from('reads').select('user_id,last_id').eq('chat',rk);
  if(error||cur!==k)return;
  peerReads={};(data||[]).forEach(r=>{if(r.user_id!==me)peerReads[r.user_id]=r.last_id});
  refreshTicks();
}
function onReadEvent(r){
  if(!r||r.user_id===me||!cur||r.chat!==readKey(cur))return;
  peerReads[r.user_id]=r.last_id;refreshTicks();
}
const isReadByPeer=m=>Object.values(peerReads).some(v=>v>=m.id);
function tickEl(m){
  const t=el('span','tick');
  if(!readsOk){t.textContent='';return t}
  const r=isReadByPeer(m);t.textContent=r?'✓✓':'✓';t.classList.toggle('read',r);
  t.title=r?'Прочитано':'Доставлено';return t;
}
function refreshTicks(){
  Object.entries(nodes).forEach(([id,d])=>{
    const m=msgs[id],old=d.querySelector('.tick');if(!m||!old)return;old.replaceWith(tickEl(m));
  });
}

// ---------- Уведомления ----------
const notifyOn=()=>{try{return localStorage.getItem('nit-notify')==='1'}catch{return false}};
async function setNotify(on){
  if(on&&'Notification' in window&&Notification.permission!=='granted'){
    const p=await Notification.requestPermission();if(p!=='granted'){alert('Браузер не разрешил уведомления.');on=false}
  }
  try{localStorage.setItem('nit-notify',on?'1':'0')}catch{}
  return on;
}
let audioCtx=null;
function ping(){
  try{
    audioCtx||=new (window.AudioContext||window.webkitAudioContext)();
    const t=audioCtx.currentTime;
    [[880,0],[1320,.09]].forEach(([f,d])=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(.0001,t+d);g.gain.exponentialRampToValueAtTime(.12,t+d+.02);g.gain.exponentialRampToValueAtTime(.0001,t+d+.18);
      o.connect(g).connect(audioCtx.destination);o.start(t+d);o.stop(t+d+.2)});
  }catch{}
}
function notify(m){
  const k=chatKey(m);if(cur===k&&!document.hidden)return;
  if(isBlocked(m.sender))return;
  ping();
  if(!notifyOn()||!('Notification' in window)||Notification.permission!=='granted'||!document.hidden)return;
  const title=isGroupKey(k)?chatName(k)+' · '+nameOf(m.sender):nameOf(m.sender);
  try{const n=new Notification(title,{body:preview(m),icon:prof[m.sender]?.avatar_path?avatarUrl(prof[m.sender].avatar_path):undefined,tag:k});
    n.onclick=()=>{window.focus();openChat(k);n.close()}}catch{}
}
// Число непрочитанных во вкладке браузера и на значке
function updateBadge(){
  const n=Object.values(unread).reduce((a,b)=>a+(+b||0),0);
  document.title=(n?'('+n+') ':'')+'Нить';
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="%23e5172b"/><path d="M5 21c5 0 6-10 11-10s6 10 11 10" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"/>${n?'<circle cx="25" cy="7" r="6" fill="%23ffd400" stroke="white" stroke-width="2"/>':''}</svg>`;
  let l=document.querySelector('link[rel=icon]');if(!l){l=document.createElement('link');l.rel='icon';document.head.append(l)}
  l.href='data:image/svg+xml,'+svg.replace(/#/g,'%23');
}
updateBadge();

// ---------- Черновики ----------
const draftKey=k=>'nit-draft:'+k;
function saveDraft(){if(!cur)return;try{const v=$('msg').value;v?localStorage.setItem(draftKey(cur),v):localStorage.removeItem(draftKey(cur))}catch{}}
function loadDraft(k){try{$('msg').value=localStorage.getItem(draftKey(k))||''}catch{$('msg').value=''}}
const hasDraft=k=>{try{return !!localStorage.getItem(draftKey(k))}catch{return false}};
$('msg').addEventListener('input',saveDraft);
