// Отрисовка сообщений и открытие чата
// Временные ссылки на файлы. Раньше — по запросу на каждый файл, теперь пачкой до 100 за раз.
const URL_TTL=3600,urlQ=[],urlWait={};let urlT=0;
const urlFresh=k=>sig[k]&&sig[k].t>Date.now()-(URL_TTL-300)*1000?sig[k].u:null;
function imgUrl(path,download){
  const key=path+(download?'|d':'');const f=urlFresh(key);if(f)return Promise.resolve(f);
  if(download)return sb.storage.from('photos').createSignedUrl(path,URL_TTL,{download}).then(({data})=>{if(data?.signedUrl)sig[key]={u:data.signedUrl,t:Date.now()};return data?.signedUrl});
  if(urlWait[key])return urlWait[key];
  return urlWait[key]=new Promise(res=>{urlQ.push([path,res]);clearTimeout(urlT);urlT=setTimeout(flushUrls,25)});
}
async function flushUrls(){
  const q=urlQ.splice(0),paths=[...new Set(q.map(x=>x[0]))];
  for(let i=0;i<paths.length;i+=100){
    const {data}=await sb.storage.from('photos').createSignedUrls(paths.slice(i,i+100),URL_TTL);
    (data||[]).forEach(d=>{if(d.signedUrl&&d.path)sig[d.path]={u:d.signedUrl,t:Date.now()}});
  }
  q.forEach(([p,res])=>{delete urlWait[p];res(urlFresh(p))});
}

// «Особые» сообщения (стикеры, опросы, игры, звонки) хранятся в тексте как ::тип...::
// Каждый модуль регистрирует себя: SPECIAL.push({re, render(m,d,match), preview(match), cls, forward})
const SPECIAL=[];
const specialOf=b=>{if(!b||!b.startsWith('::'))return null;for(const s of SPECIAL){const x=b.match(s.re);if(x)return {s,x}}return null};

function preview(m){
  if(!m)return 'Сообщение';
  if(m.deleted_at)return 'Сообщение удалено';
  const sp=specialOf(m.body);if(sp)return sp.s.preview(sp.x,m);
  const cut=t=>t.length>80?t.slice(0,80)+'…':t;
  if(m.body&&m.image_path&&!isAudio(m.image_path)&&!isCircle(m.image_path))return (isFile(m.image_path)&&!VIDEO_EXT.test(m.image_path)?PI('i-file'):VIDEO_EXT.test(m.image_path)?PI('i-film'):PI('i-image'))+cut(m.body);
  if(m.body)return cut(m.body);
  if(isFile(m.image_path))return VIDEO_EXT.test(m.image_path)?PI('i-film')+'Видео':PI('i-file')+fileName(m.image_path);
  if(isCircle(m.image_path))return PI('i-circle')+'Кружок';
  if(isAudio(m.image_path))return PI('i-mic')+'Голосовое сообщение';
  if(m.image_path)return PI('i-image')+'Фото';
  return 'Сообщение';
}
const timeStr=t=>new Date(t).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const clockStr=t=>new Date(t).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'}); // в пузыре — только время, дата в разделителе дня

function draw(m){
  const was=msgs[m.id];msgs[m.id]=m;
  if(was&&(!!was.deleted_at!==!!m.deleted_at||was.body!==m.body))refreshQuotes(m.id);
  const d=nodes[m.id];if(!d)return;
  const sp=!m.deleted_at&&specialOf(m.body);
  const keep=['open','cont','more','new'].filter(c=>d.classList.contains(c)).join(' ');
  d.innerHTML='';d.className='m '+(m.sender===me?'me':'them')+(keep?' '+keep:'');
  if(m.deleted_at)d.classList.add('del');
  if(sp&&sp.s.cls)d.classList.add(sp.s.cls);
  if(!m.deleted_at&&!isFile(m.image_path)&&isCircle(m.image_path))d.classList.add('circle');
  if(!m.deleted_at&&!sp&&!m.image_path&&isBigEmoji(m.body))d.classList.add('big');

  // В группе над чужим сообщением — имя отправителя
  if(m.group_id&&m.sender!==me){const w=el('b','who',nameOf(m.sender));w.style.setProperty('--h',hue(m.sender));const tm=typeof titleMini==='function'&&titleMini(m.sender);if(tm)w.append(tm);d.append(w);
    const av=avatar(m.sender,30);av.classList.add('mava');av.onclick=e=>{e.stopPropagation();showProfile(m.sender)};d.append(av);d.classList.add('g')}
  if(m.forwarded_from&&!m.deleted_at)d.append(el('div','fwd','Переслано от '+nameOf(m.forwarded_from)));

  if(m.deleted_at)d.append(document.createTextNode('Сообщение удалено'));
  else{
    if(m.reply_to)d.append(quoteEl(m));
    if(sp)sp.s.render(m,d,sp.x);
    // Фото/видео — сверху, подпись — под ними (как в Telegram)
    if(m.image_path)d.append(mediaEl(m.image_path));
    if(!sp&&m.body){const tx=richText(m.body);if(m.image_path){const c=el('div','caption');c.append(tx);d.append(c)}else d.append(tx)}
    // Фото и видео во весь пузырь; без подписи время лежит прямо на картинке
    const pic=m.image_path&&!sp&&!isAudio(m.image_path)&&!isCircle(m.image_path)&&(!isFile(m.image_path)||VIDEO_EXT.test(m.image_path));
    d.classList.toggle('media',!!pic);d.classList.toggle('cap',!!(pic&&m.body));
    d.classList.toggle('mentioned',mentionsMe(m));
    if(!sp&&m.body)linkPreviews(m.body).forEach(p=>d.append(p));
  }

  // Время, «изменено», таймер исчезновения, галочки
  const s=el('small','meta');
  if(m.expires_at&&!m.deleted_at){const t=el('span','ttl');t.dataset.exp=m.expires_at;fillRich(t,PI('i-timer')+ttlLeft(m.expires_at));s.append(t)}
  if(m.edited_at&&!m.deleted_at)s.append(el('span','edited','изменено'));
  s.append(document.createTextNode(clockStr(m.created_at)));
  if(m.sender===me&&!m.deleted_at)s.append(tickEl(m));
  d.append(s);
  if(d.classList.contains('open'))d.append(menuEl(m,sp));
  drawReacts(m.id);
}

// Фото, голосовое, кружок или файл
function mediaEl(path){
  if(isFile(path))return VIDEO_EXT.test(fileName(path))?videoEl(path):fileEl(path);
  if(isCircle(path))return circleEl(path);
  if(isAudio(path))return voiceEl(path);
  const i=document.createElement('img');i.alt='фото';i.className='photo';i.loading='lazy';i.decoding='async';i.onload=()=>i.classList.add('loaded');
  imgUrl(path).then(u=>{if(u){i.src=u;i.onclick=e=>{e.stopPropagation();openViewer(u);logMsgEvent?.(msgByPath(path),'open')}}});return i;
}

// Меню сообщения: реакции и действия
const MENU_IC={'Сведения':'i-eye','Сохранить стикер':'i-heart','Ответить':'i-reply','Изменить':'i-pencil','Переслать':'i-forward','Закрепить':'i-pin','Открепить':'i-pin','Копировать':'i-copy'};
function menuEl(m,sp){
  const a=el('div','acts'),d=nodes[m.id];
  const btn=(t,f,cls)=>{const b=el('button',cls||'g');const ic=MENU_IC[t.replace(/ \(.*\)$/,'')]||(/^Удалить/.test(t)?'i-trash':null);if(ic)b.append(svgI(ic));b.append(el('span',null,t));b.onclick=e=>{e.stopPropagation();d.classList.remove('open');a.remove();f()};a.append(b);return b};
  if(!m.deleted_at){
    a.append(reactPicker(m));
    btn('Ответить',()=>startReply(m));
    if(m.sender===me&&!sp&&m.body)btn('Изменить',()=>startEdit(m));
    if(!sp||sp.s.forward!==false)btn('Переслать',()=>forwardMsg(m));
    if(sp?.s.menu)sp.s.menu(m,btn,sp.x);
    btn(pinnedId===m.id?'Открепить':'Закрепить',()=>pinnedId===m.id?unpin():pinMsg(m));
    if(m.body&&!sp)btn('Копировать',()=>navigator.clipboard?.writeText(m.body));
    if(m.sender===me&&(!sp||m.image_path)&&typeof showMsgInfo==='function')btn('Сведения',()=>showMsgInfo(m));
  }
  btn('Удалить у меня',async()=>{
    const {error}=await sb.from('message_hides').insert({message_id:m.id});
    if(!error){hidden.add(m.id);d.remove();delete nodes[m.id];refreshQuotes(m.id)}});
  if(m.sender===me&&!m.deleted_at)btn('Удалить у всех',async()=>{
    const {error}=await sb.rpc('delete_for_all',{mid:m.id});
    if(error){toast('Не удалось удалить: '+error.message);return}
    line({...m,body:'',image_path:null,deleted_at:new Date().toISOString()});
    // Файл стираем, только если на него больше никто не ссылается (пересланные копии сохраняют фото).
    // Нет функции file_in_use (не запущен supabase/fix_forward_delete.sql) — файл просто остаётся.
    if(m.image_path){const {data:used,error:e2}=await sb.rpc('file_in_use',{p:m.image_path,except_id:m.id});
      if(!e2&&used===false)sb.storage.from('photos').remove([m.image_path])}
  },'danger-soft');
  // Админ группы может удалить чужое сообщение
  if(m.group_id&&m.sender!==me&&!m.deleted_at&&isAdminOf(m.group_id))btn('Удалить у всех (админ)',async()=>{
    if(!confirm('Удалить сообщение '+nameOf(m.sender)+' у всех участников?'))return;
    const {error}=await sb.rpc('admin_delete_message',{mid:m.id});
    if(error){toast('Не удалось: '+sqlHint(error));return}
    line({...m,body:'',image_path:null,deleted_at:new Date().toISOString()});
  },'danger-soft');
  return a;
}

// Создаёт пузырь сообщения; prepend — для подгрузки старых сверху
function line(m,prepend,quiet){
  if(hidden.has(m.id))return;
  if(nodes[m.id]){try{draw(m)}catch(err){console.error('draw',m.id,err)}return}
  if(m.expires_at&&new Date(m.expires_at)<=new Date())return;
  const d=document.createElement('div');d.className='m';d.dataset.id=m.id;d.dataset.t=m.created_at;d.dataset.s=m.sender;
  // Нажатие — только реакции; зажатие (или правая кнопка мыши) — всё меню. См. openMenu в ux.js
  d.onclick=e=>{if(e.target.closest('a,button,video,audio,input,.acts'))return;
    if(longFired){longFired=false;return}
    clearTimeout(tapTimer);
    tapTimer=setTimeout(()=>openMenu(d,'quick'),e.detail>1?0:190);
  };
  d.oncontextmenu=e=>{if(e.target.closest('a,video,audio,input,.acts'))return;e.preventDefault();clearTimeout(tapTimer);openMenu(d,'full',longFired||!!lpXY)};
  nodes[m.id]=d;
  const log=$('log'),near=bulk||prepend||distBottom()<120;
  if(prepend)log.insertBefore(d,log.querySelector('.m'));else log.append(d);
  try{draw(m)}catch(err){console.error('draw',m.id,err);d.className='m '+(m.sender===me?'me':'them');fillRich(d,m.body&&!m.body.startsWith('::')?m.body:preview(m))}
  placed(d,m,prepend,quiet,near);
}

// ---------- Открытие чата и подгрузка истории ----------
let oldestId=null,hasMore=false,loadingOld=false;
const chatQuery=k=>{let q=sb.from('messages').select('*');
  return isGroupKey(k)?q.eq('group_id',gidOf(k)):q.or(`and(sender.eq.${me},recipient.eq.${k}),and(sender.eq.${k},recipient.eq.${me})`)};
const PAGE=100;

async function openChat(id){
  saveDraft();mentionOf[id]=false;hideMentions?.();
  cur=id;nodes={};cancelReply();cancelEdit();closeEmoji();closeSearch();closeAttach();
  setHead(id);$('head').classList.remove('hide');applyBlockUI();
  $('gmem').classList.toggle('hide',!isGroupKey(id));$('gpanel').classList.add('hide');
  if(giGid&&'g:'+giGid!==id)closeGroupInfo();
  $('app').classList.add('open');$('log').innerHTML='';$('log').append(skeleton());$('log').classList.remove('enter');render();
  newBelow=0;stick=true;updateDown();
  loadDraft(id);updateTtlChip();loadChatTtl(id).catch(()=>{});
  let data,error;
  for(let attempt=0;attempt<3;attempt++){
    ({data,error}=await chatQuery(id).order('id',{ascending:false}).limit(PAGE));
    if(!error||cur!==id)break;
    await new Promise(r=>setTimeout(r,800*(attempt+1)));
  }
  if(cur!==id)return;
  if(error){
    console.error('history',error);
    $('log').innerHTML='';
    const e=el('div','empty load-err');
    e.append(el('b',null,'Не удалось загрузить историю'),el('small',null,authErr(error).replace(/^Ошибка: /,'')));
    const b=el('button','primary sm-btn','Повторить');b.onclick=()=>openChat(id);e.append(b);
    $('log').append(e);return;
  }
  try{localStorage.setItem('nit-last',id)}catch{}
  $('log').innerHTML='';
  const list=(data||[]).reverse();
  oldestId=list[0]?.id??null;hasMore=list.length===PAGE;
  if(hasMore)$('log').append(el('div','older','Листайте вверх, чтобы загрузить ещё'));
  bulk=true;try{list.forEach(m=>line(m))}finally{bulk=false}
  if(!list.length)$('log').innerHTML='<div class="empty"><svg class="logo big"><use href="#i-logo"/></svg>Сообщений пока нет.<br>Напишите первым.</div>';
  const before=readsOk?(myReads[readKey(id)]||0):0;
  if(!(typeof placeUnread==='function'&&placeUnread(list,before)))toBottom(false);
  void $('log').offsetWidth;$('log').classList.add('enter');
  afterRender(list);
  loadPeerReads(id);loadPin(id);markRead();
  if(!matchMedia('(max-width:760px)').matches)$('msg').focus();
}
function afterRender(list){const ids=list.map(m=>m.id);loadReactions(ids);loadVotes(list.filter(m=>pollOf(m.body)).map(m=>m.id))}

async function loadOlder(){
  if(!cur||!hasMore||loadingOld||oldestId==null)return;
  loadingOld=true;const k=cur,log=$('log'),h=log.scrollHeight;
  const {data}=await chatQuery(k).lt('id',oldestId).order('id',{ascending:false}).limit(PAGE);
  loadingOld=false;if(cur!==k)return;
  const list=(data||[]);// уже по убыванию — вставляем по одному наверх
  bulk=true;try{list.forEach(m=>line(m,true))}finally{bulk=false}
  layoutAll();
  oldestId=list.length?list[list.length-1].id:oldestId;hasMore=list.length===PAGE;
  const o=log.querySelector('.older');if(o){o.remove();if(hasMore)log.prepend(o)}
  log.scrollTop=log.scrollHeight-h;
  afterRender(list);
}
$('log').addEventListener('scroll',()=>{if($('log').scrollTop<80)loadOlder()});

// Загрузить историю начиная с нужного сообщения (для поиска и закрепа)
async function jumpTo(id){
  if(nodes[id])return flash(id);
  const k=cur;
  const {data}=await chatQuery(k).gte('id',id).order('id',{ascending:true}).limit(1000);
  if(cur!==k)return;
  $('log').innerHTML='';nodes={};
  bulk=true;try{(data||[]).forEach(m=>line(m))}finally{bulk=false}
  oldestId=data?.[0]?.id??null;hasMore=true;
  $('log').prepend(el('div','older','Листайте вверх, чтобы загрузить ещё'));
  afterRender(data||[]);flash(id);
}
function flash(id){const t=nodes[id];if(!t)return;t.scrollIntoView({block:'center',behavior:'smooth'});t.classList.add('flash');setTimeout(()=>t.classList.remove('flash'),1400)}

function closeChat(){
  saveDraft();try{localStorage.removeItem('nit-last')}catch{}
  cur=null;nodes={};$('app').classList.remove('open');closeGroupInfo();
  ['head','send','gpanel','blockbar','pinbar'].forEach(i=>$(i).classList.add('hide'));
  cancelReply();cancelEdit();closeEmoji();closeSearch();closeAttach();
  $('log').innerHTML='<div class="empty"><svg class="logo big"><use href="#i-logo"/></svg>Выберите чат слева</div>';render();
}
// Шапка чата: аватарка, имя, подпись
function setHead(k){
  const a=$('cava');a.innerHTML='';
  if(isGroupKey(k)){const g=groups[gidOf(k)];a.append(groupAvatar(g,40));$('cname').textContent=chatName(k)}
  else{a.append(avatar(k,40));$('cname').textContent=nameOf(k)}
  const dm=!isGroupKey(k)&&!isBlocked(k)&&fr.some(f=>f.status==='accepted'&&(f.a===k||f.b===k));
  const can=dm||isGroupKey(k);
  $('bcall').classList.toggle('hide',!can);$('bvcall').classList.toggle('hide',!can);
  $('bcall').title=isGroupKey(k)?'Групповой звонок':'Позвонить';$('bvcall').title=isGroupKey(k)?'Групповой видеозвонок':'Видеозвонок';
  setSub();
}

// Просмотр фото на весь экран: плавно открывается, нажатие или ✕ закрывает, «Скачать» сохраняет файл
function openViewer(u){
  const v=$('viewer');v.dataset.url=u;v.querySelector('img').src=u;v.classList.remove('hide','out');
}
function closeViewer(){const v=$('viewer');if(v.classList.contains('hide'))return;v.classList.add('out');setTimeout(()=>{v.classList.add('hide');v.classList.remove('out');v.querySelector('img').removeAttribute('src')},200)}
$('viewer').onclick=e=>{if(!e.target.closest('button'))closeViewer()};
$('vwx').onclick=closeViewer;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('viewer').classList.contains('hide'))closeViewer()});
$('vwdl').onclick=async e=>{
  e.stopPropagation();const u=$('viewer').dataset.url;if(!u)return;
  const b=$('vwdl');b.classList.add('busy');
  try{
    const blob=await (await fetch(u)).blob(),ext=(blob.type.split('/')[1]||'jpg').replace('jpeg','jpg'),name='nit-'+Date.now()+'.'+ext;
    const file=new File([blob],name,{type:blob.type});
    if(/iPhone|iPad|iPod/.test(navigator.userAgent)&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file]})} // на iPhone — «Сохранить изображение»
    else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);toast('Фото сохранено')}
  }catch(err){if(err?.name!=='AbortError'){window.open(u,'_blank');toast('Не удалось скачать напрямую — открыто в новой вкладке')}}
  b.classList.remove('busy');
};
