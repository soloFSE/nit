// Профиль собеседника — отдельный экран (как «Данные группы»): шапка с цветным фоном, кнопки действий,
// «О себе», общие группы, фото из переписки; внизу — аккуратные строки «Удалить из друзей», «Заблокировать».
// Здесь же общая функция заявки в друзья — её используют и профиль, и окно «Новый чат».
let peerId=null;

// ---------- Дружба: состояние и заявка ----------
function friendState(id){
  const f=fr.find(x=>(x.a===id&&x.b===me)||(x.a===me&&x.b===id));
  if(!f)return {s:'none'};
  if(f.status==='accepted')return {s:'friend',f};
  return f.a===me?{s:'sent',f}:{s:'incoming',f};
}
async function requestFriend(id,nick){
  if(id===me){toast('Это вы');return false}
  const st=friendState(id).s;
  if(st==='friend'){toast('Уже в друзьях');return false}
  if(st==='sent'){toast('Заявка уже отправлена');return false}
  if(st==='incoming'){return acceptFriend(id)}
  if(isBlocked(id)){toast('Сначала разблокируйте этого человека');return false}
  const {error}=await sb.from('friendships').insert({a:me,b:id});
  if(error){toast('Не получилось отправить заявку');return false}
  if(nick)people[id]=nick;loadFriends();toast('Заявка отправлена'+(nick?' @'+nick:''));navigator.vibrate?.(10);
  return true;
}
async function acceptFriend(id){
  const f=friendState(id).f;if(!f)return false;
  await answer(f,true,el('button'),el('button'));toast('Теперь вы друзья с '+nameOf(id));return true;
}

// ---------- Экран профиля ----------
function peerBox(){let w=$('peerv');if(!w){w=el('div','gi hide');w.id='peerv';document.body.append(w)}return w}
async function showProfile(id){
  if(id===me){openProfileEdit();return}
  peerId=id;const w=peerBox();w.classList.remove('hide','closing');renderPeer();
  await loadProfiles([id],true);if(peerId===id)renderPeer();
}
function closePeer(){
  const w=$('peerv');if(!w||w.classList.contains('hide'))return;peerId=null;
  w.classList.add('closing');setTimeout(()=>{if(!peerId){w.classList.add('hide');w.classList.remove('closing');w.innerHTML=''}},260);
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&peerId&&$('modal').classList.contains('hide'))closePeer()});
function refreshPeer(){if(peerId)renderPeer()}

function renderPeer(){
  const id=peerId,w=peerBox();if(!id)return;
  const p=prof[id]||{},st=friendState(id).s,blockedNow=isBlocked(id),nick=p.username||people[id]||'?';
  const keep=w.querySelector('.gi-scroll')?.scrollTop||0;w.innerHTML='';
  const top=el('div','gi-top pv-top');const back=el('button','icon');back.append(svgI('i-back'));back.onclick=closePeer;
  top.append(back,el('b',null,'Профиль'));w.append(top);
  const sc=el('div','gi-scroll');w.append(sc);

  // Шапка: фон под цвет аватарки
  const hero=el('section','pv-hero');hero.style.setProperty('--h',hue(id));
  const av=avatar(id,120);if(p.avatar_path){av.classList.add('zoom');av.onclick=()=>openViewer(avatarUrl(p.avatar_path))}
  const h2=el('h2',null,nameOf(id));const pm=typeof premMark==='function'&&premMark(id);if(pm)h2.append(pm);
  const ph=typeof premHue==='function'&&premHue(id);if(ph!=null)hero.style.setProperty('--h',ph);
  hero.append(av,h2);
  if(typeof bannerInto==='function')bannerInto(hero,id);
  const nk=el('button','pv-nick','@'+nick);nk.title='Скопировать ник';nk.onclick=()=>{navigator.clipboard?.writeText('@'+nick);toast('Ник скопирован')};hero.append(nk);
  const mt=mainTitle(id);if(mt)hero.append(titleBadge(mt,'big'));
  const line=el('div','pv-line');
  if(blockedNow)line.append(el('span','pv-badge bad','Заблокирован'));
  else if(isBlockedBy(id))line.append(el('span','pv-badge bad','Ограничил(а) общение с вами'));
  else if(online.has(id))line.append(el('span','pv-badge on','в сети'));
  if(p.status)line.append(el('span','pv-badge',p.status));
  if(line.children.length)hero.append(line);
  // Кнопки действий
  const acts=el('div','gi-acts pv-acts');
  const act=(icon,label,f,cls)=>{const b=el('button','gi-act'+(cls?' '+cls:''));b.append(svgI(icon),el('span',null,label));b.onclick=f;acts.append(b);return b};
  if(st==='friend'&&!blockedNow){
    act('i-chats','Написать',()=>{closePeer();closeGroupInfo?.();openChat(id)});
    act('i-phone','Аудио',()=>{closePeer();startCall(id,false)});
    act('i-video','Видео',()=>{closePeer();startCall(id,true)});
  }else if(!blockedNow){
    if(st==='none')act('i-plus','В друзья',async()=>{if(await requestFriend(id,nick))renderPeer()},'main');
    else if(st==='sent')act('i-check','Заявка отправлена',()=>toast('Ждём, пока @'+nick+' примет заявку'),'muted');
    else if(st==='incoming')act('i-check','Принять заявку',async()=>{await acceptFriend(id);renderPeer()},'main');
  }
  if(acts.children.length)hero.append(acts);
  sc.append(hero);

  // О себе
  if(p.bio){const c=el('section','gi-card');c.append(el('div','gi-h','О себе'),el('p','gi-desc',p.bio));sc.append(c)}
  // Звания и Премиум
  const pc=typeof premiumCard==='function'&&premiumCard(id);if(pc)sc.append(pc);
  const gc=typeof giftsCard==='function'&&giftsCard(id);if(gc)sc.append(gc);
  const tc=titlesCard(id);if(tc)sc.append(tc);
  // Ник и общие группы
  const info=el('section','gi-card');
  const r1=giRow('i-user','@'+nick,'Ник — по нему вас находят друзья');r1.onclick=()=>{navigator.clipboard?.writeText('@'+nick);toast('Ник скопирован')};info.append(r1);
  const common=Object.values(groups).filter(g=>(gm[g.id]||[]).includes(id));
  if(common.length){
    info.append(el('div','gi-h','Общие группы · '+common.length));
    common.forEach(g=>{const n=(gm[g.id]||[]).length;const r=giRow(groupAvatar(g,40),g.name,n+' '+plural(n,'участник','участника','участников'),'gi-mem');r.onclick=()=>{closePeer();openChat('g:'+g.id)};info.append(r)});
  }
  sc.append(info);
  // Фото из переписки
  if(st==='friend'){const media=el('section','gi-card gi-media hide');sc.append(media);loadPeerMedia(id,media)}
  // Опасные действия — аккуратными строками
  const danger=el('section','gi-card');
  {const cl=giRow('i-trash','Очистить переписку','У себя или свои сообщения у всех','gi-danger');cl.onclick=()=>openClearMenu(id);danger.append(cl)}
  if(st==='friend'){const r=giRow('i-user','Удалить из друзей',null,'gi-danger');r.onclick=async()=>{if(await removeFriend(id))renderPeer()};danger.append(r)}
  if(st==='sent'){const r=giRow('i-x','Отменить заявку',null,'gi-danger');r.onclick=async()=>{const f=friendState(id).f;const {error}=await sb.from('friendships').delete().eq('id',f.id);if(!error){setFr(fr.filter(x=>x.id!==f.id));renderPeer()}};danger.append(r)}
  const b=giRow(blockedNow?'i-check':'i-x',blockedNow?'Разблокировать':'Заблокировать',blockedNow?null:'Не сможет писать вам и присылать заявки','gi-danger');
  b.onclick=async()=>{if(await(blockedNow?unblockUser(id):blockUser(id)))renderPeer()};danger.append(b);
  sc.append(danger);
  sc.scrollTop=keep;
}
async function loadPeerMedia(id,box){
  const {data}=await sb.from('messages').select('id,image_path').or(`and(sender.eq.${me},recipient.eq.${id}),and(sender.eq.${id},recipient.eq.${me})`)
    .not('image_path','is',null).is('deleted_at',null).order('id',{ascending:false}).limit(40);
  if(peerId!==id)return;
  const ph=(data||[]).filter(m=>!isFile(m.image_path)&&!isCircle(m.image_path)&&!isAudio(m.image_path));
  if(!ph.length)return;box.classList.remove('hide');
  const h=el('div','gi-h');h.append(el('span',null,'Фото из переписки'),el('small',null,String(ph.length>=40?'40+':ph.length)));box.append(h);
  const grid=el('div','gi-grid');box.append(grid);
  ph.slice(0,8).forEach(m=>{const c=el('button','gi-th');grid.append(c);imgUrl(m.image_path).then(u=>{if(!u)return;const i=document.createElement('img');i.loading='lazy';i.src=u;c.append(i);c.onclick=()=>openViewer(u)})});
}
