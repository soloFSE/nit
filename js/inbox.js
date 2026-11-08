// Список чатов как в Telegram: друзья и группы вместе, по времени последнего сообщения,
// с превью, временем, галочками, «печатает…», черновиками, папками и поиском.
// Плюс «живое» поле ввода: микрофон превращается в «отправить», когда есть текст.
let lastOf={},folder='all',chatsT=0;
try{folder=localStorage.getItem('nit-folder')||'all'}catch{}

// ---------- Последнее сообщение каждого чата ----------
async function loadLast(){
  const {data,error}=await sb.from('messages').select('id,sender,recipient,group_id,body,image_path,created_at,deleted_at,expires_at')
    .order('id',{ascending:false}).limit(500);
  if(error)return;
  const now=new Date();
  (data||[]).forEach(m=>{
    if(hidden.has(m.id)||(m.expires_at&&new Date(m.expires_at)<=now))return;
    const k=chatKey(m);if(!lastOf[k]||m.id>lastOf[k].id)lastOf[k]=m;
  });
  scheduleChats();
}
function noteLast(m){
  if(!m||hidden.has(m.id))return;const k=chatKey(m);
  if(!lastOf[k]||m.id>=lastOf[k].id){lastOf[k]=m;scheduleChats()}
}
function scheduleChats(){clearTimeout(chatsT);chatsT=setTimeout(renderChats,30)}

// ---------- Время в списке: 14:05 / вчера / пн / 12.10 ----------
function shortTime(t){
  const d=new Date(t),n=new Date(),day=864e5,sd=x=>new Date(x.getFullYear(),x.getMonth(),x.getDate()).getTime();
  const diff=(sd(n)-sd(d))/day;
  if(diff<1)return d.toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'});
  if(diff<2)return 'вчера';
  if(diff<7)return d.toLocaleDateString('ru',{weekday:'short'});
  return d.toLocaleDateString('ru',{day:'2-digit',month:'2-digit',...(d.getFullYear()!==n.getFullYear()?{year:'2-digit'}:{})});
}

// ---------- Папки ----------
const FOLDERS=[['all','Все'],['dm','Личные'],['groups','Группы'],['unread','Непрочитанные']];
// ---------- Закреп и архив (хранится на устройстве и, если есть таблица chat_prefs, в базе — supabase/v4.sql) ----------
let chatPrefs={};try{chatPrefs=JSON.parse(localStorage.getItem('nit-prefs')||'{}')}catch{}
let prefsDb=true;
const isPinned=k=>!!chatPrefs[k]?.p,isArchived=k=>!!chatPrefs[k]?.a;
function savePrefs(k){
  try{localStorage.setItem('nit-prefs',JSON.stringify(chatPrefs))}catch{}
  const p=chatPrefs[k]||{};if(!prefsDb||!me)return;
  sb.from('chat_prefs').upsert({user_id:me,chat:readKey(k),pinned:!!p.p,archived:!!p.a,pin_at:p.p||null}).then(({error})=>{if(error&&/relation|does not exist|schema cache/i.test(error.message))prefsDb=false});
}
async function loadPrefs(){
  const {data,error}=await sb.from('chat_prefs').select('chat,pinned,archived,pin_at');
  if(error){prefsDb=false;return}
  (data||[]).forEach(r=>{const k=keyFromRead(r.chat);if(!k)return;chatPrefs[k]={p:r.pinned?(r.pin_at||1):0,a:r.archived?1:0}});
  try{localStorage.setItem('nit-prefs',JSON.stringify(chatPrefs))}catch{}scheduleChats();
}
function setPref(k,key,on){
  const p=chatPrefs[k]||(chatPrefs[k]={});
  if(key==='p'){const lim=(typeof isPremium==='function'&&isPremium(me))?10:5;if(on&&Object.keys(chatPrefs).filter(x=>chatPrefs[x].p).length>=lim){toast('Можно закрепить не больше '+lim+' чатов'+(lim===5?' (с Премиумом — 10)':''));return}p.p=on?Date.now():0}
  else{p.a=on?1:0;if(on)p.p=0}
  savePrefs(k);renderChats();toast(key==='p'?(on?'Чат закреплён':'Чат откреплён'):(on?'Чат в архиве':'Чат возвращён из архива'));
}
// Меню чата: долгое нажатие или правая кнопка мыши
function chatMenu(it){
  const k=it.k;navigator.vibrate?.(10);
  openModal(s=>{
    s.classList.add('cm-sheet');
    const h=el('div','cm-head');h.append(it.group?groupAvatar(it.g,44):avatar(k,44),el('b',null,it.name));s.append(h);
    const opt=(ic,t,d,f,cls)=>{const r=giRow(ic,t,d,cls);r.onclick=()=>{closeModal();f()};s.append(r)};
    if(!isArchived(k))opt('i-pin',isPinned(k)?'Открепить':'Закрепить','Закреплённые чаты всегда сверху (до 5)',()=>setPref(k,'p',!isPinned(k)));
    opt('i-download',isArchived(k)?'Вернуть из архива':'В архив','Уберёт чат из общего списка',()=>setPref(k,'a',!isArchived(k)));
    opt('i-chats','Открыть',null,()=>openChat(k));
  });
}
function inFolder(it){
  if(folder==='archive')return isArchived(it.k);
  if(isArchived(it.k))return false;
  if(folder==='dm')return !it.group;
  if(folder==='groups')return it.group;
  if(folder==='unread')return (+unread[it.k]||0)>0;
  return true;
}
function renderFolders(items){
  const box=$('folders');if(!box)return;const tmp=document.createElement('div');
  FOLDERS.forEach(([v,t])=>{
    const n=items.filter(it=>(v==='dm'?!it.group:v==='groups'?it.group:true)&&(+unread[it.k]||0)>0).length;
    const b=el('button','fold'+(folder===v?' on':''));b.append(el('span',null,t));if(n)b.append(el('i',null,n>99?'99+':String(n)));
    b.onclick=()=>{folder=v;try{localStorage.setItem('nit-folder',v)}catch{}renderChats();$('list').scrollIntoView?.({block:'nearest'})};
    tmp.append(b);
  });
  if(tmp.innerHTML!==box._html){box._html=tmp.innerHTML;box.replaceChildren(...tmp.childNodes)}
}

// ---------- Все чаты ----------
function chatItems(){
  const items=[];
  fr.filter(f=>f.status==='accepted').forEach(f=>{const id=f.a===me?f.b:f.a;items.push({k:id,name:nameOf(id),group:false})});
  Object.values(groups).forEach(g=>items.push({k:'g:'+g.id,name:g.name,group:true,g}));
  return items;
}
function draftOf(k){try{return localStorage.getItem('nit-draft:'+k)||''}catch{return ''}}
function chatRow(it){
  const k=it.k,m=lastOf[k],n=+unread[k]||0,t=typing[k],isTyping=t&&t.until>Date.now();
  const r=el('div','crow'+(cur===k?' on':'')+(n?' unread':''));r.dataset.k=k;
  r.append(it.group?groupAvatar(it.g,52):avatar(k,52));
  const body=el('div','crow-b');
  const top=el('div','crow-t');const nb=el('b',null,it.name);if(!it.group&&typeof premMark==='function'){const pm=premMark(k);if(pm)nb.append(pm)}top.append(nb);
  if(m){const tm=el('time',null,shortTime(m.created_at));top.append(tm)}
  const bot=el('div','crow-s');
  const pv=el('span','crow-p');
  const draft=cur!==k&&draftOf(k);
  if(isTyping){pv.classList.add('typing');pv.textContent=(it.group?nameOf(t.from)+' печатает':'печатает');const d=el('span','dots');d.append(el('i'),el('i'),el('i'));pv.append(d)}
  else if(draft){pv.append(el('em','draft','Черновик: '),document.createTextNode(draft))}
  else if(m){
    if(m.sender===me&&!m.deleted_at&&typeof tickEl==='function'){const tk=tickEl(m);if(tk.childNodes.length)bot.append(tk)}
    const who=m.sender===me?'Вы: ':it.group?nameOf(m.sender)+': ':'';
    if(who)pv.append(el('em','who',who));
    pv.append(fillRich(el('span','pv-t'),preview(m).replace(/\s+/g,' ')));
  }else pv.textContent=it.group?(gm[it.g.id]||[]).length+' '+plural((gm[it.g.id]||[]).length,'участник','участника','участников'):'@'+(people[k]||'?');
  bot.append(pv);
  if(mentionOf[k])bot.append(el('span','badge at','@'));
  if(n)bot.append(el('span','badge',n>99?'99+':String(n)));
  body.append(top,bot);r.append(body);
  if(isPinned(k)){const pin=el('span','crow-pin');pin.append(svgI('i-pin'));bot.append(pin)}
  let lp=0,fired=false;
  r.onclick=()=>{if(fired){fired=false;return}openChat(k)};
  r.oncontextmenu=e=>{e.preventDefault();chatMenu(it)};
  r.addEventListener('touchstart',()=>{fired=false;clearTimeout(lp);lp=setTimeout(()=>{fired=true;chatMenu(it)},480)},{passive:true});
  ['touchend','touchmove','touchcancel'].forEach(t=>r.addEventListener(t,()=>clearTimeout(lp),{passive:true}));
  return r;
}
// Пока чаты грузятся — серые «заглушки» строк вместо пустоты и надписи «Чатов пока нет»
let chatsReady=false;
function chatSkeleton(){const f=document.createDocumentFragment();[70,52,64,44,58,48].forEach(w=>{const r=el('div','crow sk-row');r.append(el('span','sk-ava'));const b=el('div','sk-lines');const a=el('i');a.style.width=w+'%';const c=el('i');c.style.width=(w+20)+'%';b.append(a,c);r.append(b);f.append(r)});return f}
function renderChats(){
  const list=$('list');if(!list||!me)return;
  if(!chatsReady){if(!list.querySelector('.sk-row')){list.innerHTML='';list.append(chatSkeleton())}return}
  const q=($('csearch')?.value||'').trim().toLowerCase();
  const all=chatItems();renderFolders(all);
  let items=all.filter(inFolder);
  if(q)items=items.filter(it=>it.name.toLowerCase().includes(q)||(!it.group&&(people[it.k]||'').includes(q)));
  items.sort((a,b)=>((chatPrefs[b.k]?.p?1:0)-(chatPrefs[a.k]?.p?1:0))||((chatPrefs[b.k]?.p||0)-(chatPrefs[a.k]?.p||0))||(lastOf[b.k]?.id||0)-(lastOf[a.k]?.id||0)||a.name.localeCompare(b.name));
  const out=document.createElement('div');
  // Архив: строка сверху в общем списке; внутри архива — «назад»
  const arch=all.filter(it=>isArchived(it.k));
  if(folder==='archive'){const b=el('button','crow arch-row');b.append(svgI('i-back'),el('b',null,'Архив · '+arch.length));b.onclick=()=>{folder='all';renderChats()};out.append(b)}
  else if(arch.length&&!q){const b=el('button','crow arch-row');const ic=el('span','arch-ic');ic.append(svgI('i-download'));b.append(ic,el('b',null,'Архив'),el('small',null,String(arch.length)));b.onclick=()=>{folder='archive';renderChats()};out.append(b)}
  items.forEach(it=>out.append(chatRow(it)));
  // Отправленные заявки — внизу, бледно
  if(folder==='all'||folder==='dm'){
    fr.filter(f=>f.status==='pending'&&f.a===me).map(f=>f.b).filter(id=>!q||nameOf(id).toLowerCase().includes(q)).forEach(id=>{
      const r=el('div','crow dim');r.append(avatar(id,52));const b=el('div','crow-b');
      const t=el('div','crow-t');t.append(el('b',null,nameOf(id)));const s=el('div','crow-s');s.append(el('span','crow-p','заявка отправлена — ждём ответа'));
      b.append(t,s);r.append(b);r.onclick=()=>showProfile(id);out.append(r);
    });
  }
  if(!out.children.length){
    const e=el('div','list-empty');e.append(svgI('i-chats'));
    e.append(el('b',null,q?'Ничего не нашлось':folder==='unread'?'Всё прочитано':folder==='groups'?'Групп пока нет':'Чатов пока нет'));
    if(q)e.append(el('span',null,'Попробуйте другое имя или ник'));else{const hs=el('span');hs.append('Нажмите ',ico('i-pencil'),', чтобы добавить друга или создать группу');e.append(hs)}
    out.append(e);
  }
  // Заменяем содержимое, только если оно изменилось: иначе при любом событии список «мигал» и дёргался
  if(out.innerHTML!==list._html||list.querySelector('.sk-row')){const keep=list.scrollTop;list._html=out.innerHTML;list.replaceChildren(...out.childNodes);list.scrollTop=keep}
  $('csx')?.classList.toggle('hide',!q);
}

// ---------- Поиск и «новый чат» ----------
$('csearch').addEventListener('input',scheduleChats);
$('csx').onclick=e=>{e.preventDefault();$('csearch').value='';scheduleChats();$('csearch').focus()};
// «Добавить друга» и «Новая группа» открываются в отдельном окне. Блок #newbox остаётся тем же
// (кнопки и обработчики привязаны к его элементам), его только переносят в окно и обратно.
let newHome=null,newNext=null;
function stashNew(){ // вернуть блок на место до того, как окно очистится
  const b=$('newbox');if(!newHome||b.parentNode===newHome)return;
  newHome.insertBefore(b,newNext&&newNext.parentNode===newHome?newNext:null);b.classList.add('hide');
}
// ✎ и плавающая кнопка открывают окно «Новый чат» (newchat.js); toggleNew(false) — закрыть его
function toggleNew(on){
  const open=!$('modal').classList.contains('hide')&&$('sheet').classList.contains('nc-sheet');
  if(on===false||(on==null&&open)){if(open)closeModal();return}
  openNewChat();
}
$('find').addEventListener('keydown',e=>{if(e.key==='Enter')$('add').click()});
$('newchat').onclick=()=>toggleNew();
$('fab').onclick=()=>toggleNew();

// ---------- Поле ввода: микрофон ↔ отправить ----------
let lastVal=null;
function syncComposer(){
  const v=$('msg').value.trim().length>0||!!editing;
  if(v===lastVal)return;lastVal=v;
  $('send').classList.toggle('typing',v);
}
$('msg').addEventListener('input',syncComposer);
setInterval(syncComposer,300);
