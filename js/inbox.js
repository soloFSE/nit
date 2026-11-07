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
function inFolder(it){
  if(folder==='dm')return !it.group;
  if(folder==='groups')return it.group;
  if(folder==='unread')return (+unread[it.k]||0)>0;
  return true;
}
function renderFolders(items){
  const box=$('folders');if(!box)return;box.innerHTML='';
  FOLDERS.forEach(([v,t])=>{
    const n=items.filter(it=>(v==='dm'?!it.group:v==='groups'?it.group:true)&&(+unread[it.k]||0)>0).length;
    const b=el('button','fold'+(folder===v?' on':''));b.append(el('span',null,t));if(n)b.append(el('i',null,n>99?'99+':String(n)));
    b.onclick=()=>{folder=v;try{localStorage.setItem('nit-folder',v)}catch{}renderChats();$('list').scrollIntoView?.({block:'nearest'})};
    box.append(b);
  });
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
  const top=el('div','crow-t');top.append(el('b',null,it.name));
  if(m){const tm=el('time',null,shortTime(m.created_at));top.append(tm)}
  const bot=el('div','crow-s');
  const pv=el('span','crow-p');
  const draft=cur!==k&&draftOf(k);
  if(isTyping){pv.classList.add('typing');pv.textContent=(it.group?nameOf(t.from)+' печатает':'печатает');const d=el('span','dots');d.append(el('i'),el('i'),el('i'));pv.append(d)}
  else if(draft){pv.append(el('em','draft','Черновик: '),document.createTextNode(draft))}
  else if(m){
    if(m.sender===me&&!m.deleted_at&&typeof tickEl==='function'){const tk=tickEl(m);if(tk.textContent)bot.append(tk)}
    const who=m.sender===me?'Вы: ':it.group?nameOf(m.sender)+': ':'';
    if(who)pv.append(el('em','who',who));
    pv.append(document.createTextNode(preview(m).replace(/\s+/g,' ')));
  }else pv.textContent=it.group?(gm[it.g.id]||[]).length+' '+plural((gm[it.g.id]||[]).length,'участник','участника','участников'):'@'+(people[k]||'?');
  bot.append(pv);
  if(mentionOf[k])bot.append(el('span','badge at','@'));
  if(n)bot.append(el('span','badge',n>99?'99+':String(n)));
  body.append(top,bot);r.append(body);
  r.onclick=()=>openChat(k);
  return r;
}
function renderChats(){
  const list=$('list');if(!list||!me)return;
  const q=($('csearch')?.value||'').trim().toLowerCase();
  const all=chatItems();renderFolders(all);
  let items=all.filter(inFolder);
  if(q)items=items.filter(it=>it.name.toLowerCase().includes(q)||(!it.group&&(people[it.k]||'').includes(q)));
  items.sort((a,b)=>(lastOf[b.k]?.id||0)-(lastOf[a.k]?.id||0)||a.name.localeCompare(b.name));
  const keep=list.scrollTop;list.innerHTML='';
  items.forEach(it=>list.append(chatRow(it)));
  // Отправленные заявки — внизу, бледно
  if(folder==='all'||folder==='dm'){
    fr.filter(f=>f.status==='pending'&&f.a===me).map(f=>f.b).filter(id=>!q||nameOf(id).toLowerCase().includes(q)).forEach(id=>{
      const r=el('div','crow dim');r.append(avatar(id,52));const b=el('div','crow-b');
      const t=el('div','crow-t');t.append(el('b',null,nameOf(id)));const s=el('div','crow-s');s.append(el('span','crow-p','заявка отправлена — ждём ответа'));
      b.append(t,s);r.append(b);r.onclick=()=>showProfile(id);list.append(r);
    });
  }
  if(!list.children.length){
    const e=el('div','list-empty');e.append(svgI('i-chats'));
    e.append(el('b',null,q?'Ничего не нашлось':folder==='unread'?'Всё прочитано':folder==='groups'?'Групп пока нет':'Чатов пока нет'));
    e.append(el('span',null,q?'Попробуйте другое имя или ник':'Нажмите ✎, чтобы добавить друга или создать группу'));
    list.append(e);
  }
  list.scrollTop=keep;
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
function toggleNew(on){
  const b=$('newbox'),m=$('modal');
  if(!newHome){newHome=b.parentNode;newNext=b.nextSibling}
  const open=b.parentNode!==newHome&&!m.classList.contains('hide')&&!m.classList.contains('closing');
  on=on??!open;
  if(!on){if(open)closeModal();return}
  openModal(s=>{
    const top=el('div','sheet-top'),x=el('button','icon','✕');x.onclick=closeModal;
    top.append(el('h3',null,'Новый чат'),x);
    b.classList.remove('hide');s.append(top,b);
  });
  if(!matchMedia('(pointer:coarse)').matches)setTimeout(()=>$('find').focus(),80);
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
