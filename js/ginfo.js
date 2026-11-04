// Экран «Данные группы» — отдельное окно, как в WhatsApp: фото, описание, медиа, настройки, участники.
// Роли и действия с участниками — в groups.js.
let giGid=null;

// ---------- Системные записи в чате группы: «Аня добавила Борю» ----------
// Тело: ::gev:<что>:<id участника>::
const GEV={add:'добавил(а)',kick:'удалил(а)',admin:'назначил(а) админом',unadmin:'снял(а) с админов',owner:'передал(а) права создателя',
  left:'вышел(а) из группы',send1:'разрешил(а) писать только админам',send0:'разрешил(а) писать всем участникам',
  edit1:'разрешил(а) менять данные группы только админам',edit0:'разрешил(а) всем менять данные группы',
  add1:'разрешил(а) добавлять участников только админам',add0:'разрешил(а) всем добавлять участников'};
const whoName=u=>u===me?'Вы':nameOf(u);
function gevText(m,x){const verb=GEV[x[1]]||x[1],u=x[2];return whoName(m.sender)+' '+verb+(u?' '+(u===me?'вас':nameOf(u)):'')}
SPECIAL.push({re:/^::gev:([a-z0-9]+):?([0-9a-zA-Z-]*)::$/,cls:'gev',forward:false,
  preview:x=>'ℹ️ '+(GEV[x[1]]?'Изменения в группе':''),
  render:(m,d,x)=>{d.append(el('span','gev-t',gevText(m,x)))}});
const gevSend=(gid,kind,u)=>sendMsg('g:'+gid,{body:'::gev:'+kind+(u?':'+u:'')+'::'},{noReply:true}).catch(()=>{});

// ---------- Открыть / закрыть ----------
function openGroupInfo(gid){
  if(!groups[gid])return;giGid=gid;
  const w=$('ginfo');w.classList.remove('hide','closing');renderGroupInfo();
  w.querySelector('.gi-scroll')?.scrollTo(0,0);
}
function closeGroupInfo(){
  const w=$('ginfo');if(w.classList.contains('hide'))return;giGid=null;
  w.classList.add('closing');setTimeout(()=>{if(!giGid){w.classList.add('hide');w.classList.remove('closing');w.innerHTML=''}},260);
}
function refreshGroupInfo(){if(giGid){if(groups[giGid])renderGroupInfo();else closeGroupInfo()}}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&giGid&&$('modal').classList.contains('hide'))closeGroupInfo()});
$('gmem').onclick=()=>cur&&isGroupKey(cur)&&openGroupInfo(gidOf(cur));
$('peer').onclick=()=>{if(!cur)return;if(isGroupKey(cur))openGroupInfo(gidOf(cur));else showProfile(cur)};

// ---------- Отрисовка ----------
const svgI=id=>{const s=document.createElementNS('http://www.w3.org/2000/svg','svg');const u=document.createElementNS('http://www.w3.org/2000/svg','use');u.setAttribute('href','#'+id);s.append(u);return s};
function giRow(icon,title,sub,cls){
  const r=el('button','gi-row'+(cls?' '+cls:''));
  if(icon){const i=el('span','gi-ic');typeof icon==='string'?i.append(icon.startsWith('i-')?svgI(icon):document.createTextNode(icon)):i.append(icon);r.append(i)}
  const t=el('span','gi-rt');t.append(el('b',null,title));if(sub)t.append(el('small',null,sub));r.append(t);
  return r;
}
function renderGroupInfo(){
  const gid=giGid,g=groups[gid],w=$('ginfo');if(!g)return;
  const keep=w.querySelector('.gi-scroll')?.scrollTop||0;
  w.innerHTML='';
  const mem=gm[gid]||[],n=mem.length,admin=isAdminOf(gid),owner=g.owner===me;

  // Шапка
  const top=el('div','gi-top');
  const back=el('button','icon');back.append(svgI('i-back'));back.title='Назад';back.onclick=closeGroupInfo;
  top.append(back,el('b',null,'Данные группы'));
  if(canDo(gid,'edit')){const ed=el('button','icon gi-edit','✎');ed.title='Изменить';ed.onclick=()=>editGroup(g);top.append(ed)}
  w.append(top);
  const sc=el('div','gi-scroll');w.append(sc);

  // Фото, название, кнопки
  const hero=el('section','gi-hero');
  const av=groupAvatar(g,124);if(g.avatar_path){av.classList.add('zoom');av.onclick=()=>openViewer(avatarUrl(g.avatar_path))}
  hero.append(av,el('h2',null,g.name),el('small',null,'Группа · '+n+' '+plural(n,'участник','участника','участников')));
  const acts=el('div','gi-acts');
  const act=(icon,label,f)=>{const b=el('button','gi-act');b.append(svgI(icon),el('span',null,label));b.onclick=f;acts.append(b)};
  act('i-phone','Аудио',()=>{closeGroupInfo();startGroupCall(gid,false)});
  act('i-video','Видео',()=>{closeGroupInfo();startGroupCall(gid,true)});
  act('i-search','Поиск',()=>{closeGroupInfo();if(cur!=='g:'+gid)openChat('g:'+gid);openSearch()});
  if(canDo(gid,'add'))act('i-plus','Добавить',()=>openAddMembers(gid));
  hero.append(acts);sc.append(hero);

  // Описание
  const desc=el('section','gi-card');
  if(g.description){desc.append(el('p','gi-desc',g.description))}
  else if(canDo(gid,'edit')){const b=el('button','gi-link','Добавить описание группы');b.onclick=()=>editGroup(g);desc.append(b)}
  desc.append(el('small','gi-dim','Создана '+new Date(g.created_at).toLocaleDateString('ru',{day:'numeric',month:'long',year:'numeric'})+' · создатель '+whoName(g.owner)));
  sc.append(desc);

  // Медиа (подгружается отдельно)
  const media=el('section','gi-card gi-media hide');sc.append(media);loadGroupMedia(gid,media);

  // Настройки — только админам
  if(admin){
    const st=el('section','gi-card');
    const r=giRow('⚙️','Настройки группы',settingsSummary(g));r.onclick=()=>openGroupSettings(gid);st.append(r);
    sc.append(st);
  }else if(g.only_admins_send||g.only_admins_edit||g.only_admins_add){
    sc.append(el('section','gi-card gi-dim sm',settingsSummary(g)));
  }

  // Участники
  const ms=el('section','gi-card');
  const head=el('div','gi-h');head.append(el('span',null,n+' '+plural(n,'участник','участника','участников')));ms.append(head);
  if(canDo(gid,'add')){const r=giRow('i-plus','Добавить участников',null,'gi-accent');r.onclick=()=>openAddMembers(gid);ms.append(r)}
  const rank=u=>u===me?0:roleOf(gid,u)==='owner'?1:roleOf(gid,u)==='admin'?2:3;
  mem.slice().sort((a,b)=>rank(a)-rank(b)||nameOf(a).localeCompare(nameOf(b))).forEach(u=>{
    const role=roleOf(gid,u),p=prof[u]||{};
    const sub=online.has(u)&&u!==me?'в сети':p.status||p.bio||'@'+(people[u]||'?');
    const r=giRow(avatar(u,44),u===me?'Вы':nameOf(u),sub,'gi-mem');
    if(role!=='member')r.append(el('span','gi-role'+(role==='owner'?' own':''),role==='owner'?'Создатель':'Админ'));
    r.onclick=()=>memberActions(gid,u);
    ms.append(r);
  });
  sc.append(ms);

  // Выход и удаление
  const danger=el('section','gi-card');
  const out=giRow('i-out','Выйти из группы',null,'gi-danger');out.onclick=()=>leaveGroup(gid);danger.append(out);
  if(owner){const del=giRow('🗑','Удалить группу',null,'gi-danger');del.onclick=()=>deleteGroup(gid);danger.append(del)}
  sc.append(danger);
  sc.scrollTop=keep;
}
function settingsSummary(g){
  const on=[g.only_admins_send&&'писать',g.only_admins_edit&&'менять данные',g.only_admins_add&&'добавлять участников'].filter(Boolean);
  return on.length?'Только админы могут: '+on.join(', '):'Все участники могут писать, менять данные и добавлять';
}

// Последние фото группы
async function loadGroupMedia(gid,box){
  const {data}=await sb.from('messages').select('id,image_path').eq('group_id',gid).not('image_path','is',null).is('deleted_at',null).order('id',{ascending:false}).limit(40);
  if(giGid!==gid)return;
  const ph=(data||[]).filter(m=>!isFile(m.image_path)&&!isCircle(m.image_path)&&!isAudio(m.image_path));
  const files=(data||[]).length-ph.length;
  if(!ph.length&&!files)return;
  box.classList.remove('hide');
  const h=el('div','gi-h');h.append(el('span',null,'Медиа и файлы'),el('small',null,(data.length>=40?'40+':data.length)+''));box.append(h);
  const grid=el('div','gi-grid');box.append(grid);
  ph.slice(0,8).forEach(m=>{
    const c=el('button','gi-th');grid.append(c);
    imgUrl(m.image_path).then(u=>{if(!u)return;const i=document.createElement('img');i.loading='lazy';i.src=u;c.append(i);c.onclick=()=>openViewer(u)});
  });
  if(!ph.length)grid.append(el('small','gi-dim','Файлы и голосовые — в переписке'));
}

// ---------- Действия с участником (отдельное окошко) ----------
function memberActions(gid,u){
  if(u===me){openSettings();return}
  const role=roleOf(gid,u),admin=isAdminOf(gid),owner=groups[gid]?.owner===me;
  const isFriend=fr.some(f=>f.status==='accepted'&&(f.a===u||f.b===u));
  openModal(s=>{
    const c=el('div','gi-who');c.append(avatar(u,64));
    const t=el('div');t.append(el('b',null,nameOf(u)),el('small',null,'@'+(people[u]||'?')+(role!=='member'?' · '+(role==='owner'?'создатель':'админ'):'')));c.append(t);s.append(c);
    const opt=(label,f,cls)=>{const b=el('button','opt'+(cls?' '+cls:''),label);b.onclick=()=>{closeModal();f()};s.append(b)};
    if(isFriend)opt('💬 Написать '+nameOf(u),()=>{closeGroupInfo();openChat(u)});
    opt('👤 Профиль',()=>setTimeout(()=>showProfile(u),200));
    if(admin&&role!=='owner'){
      if(role==='admin')opt('⬇️ Снять с админов',()=>setRole(gid,u,'member'));
      else opt('⭐ Назначить админом',()=>setRole(gid,u,'admin'));
    }
    if(owner)opt('👑 Передать права создателя',()=>transferGroup(gid,u));
    if(admin&&role!=='owner')opt('🚫 Удалить из группы',()=>removeMember(gid,u),'danger');
    const x=el('button','ghost wide','Отмена');x.onclick=closeModal;s.append(x);
  });
}

// ---------- Добавить участников: выбор нескольких друзей ----------
function openAddMembers(gid){
  const inG=new Set(gm[gid]||[]);
  const list=fr.filter(f=>f.status==='accepted').map(f=>f.a===me?f.b:f.a).filter(id=>!inG.has(id)&&!isBlocked(id)).sort((a,b)=>nameOf(a).localeCompare(nameOf(b)));
  const pick=new Set();
  openModal(s=>{
    const top=el('div','sheet-top');top.append(el('h3',null,'Добавить участников'));const x=el('button','icon','✕');x.onclick=closeModal;top.append(x);s.append(top);
    if(!list.length){s.append(el('p','sm','Все ваши друзья уже в группе. Добавить можно только друзей.'));return}
    const q=document.createElement('input');q.placeholder='Поиск друзей';q.className='gi-search';s.append(q);
    const chips=el('div','gi-chips');s.append(chips);
    const box=el('div','gi-pick');s.append(box);
    const go=el('button','primary wide','Добавить');go.disabled=true;s.append(go);
    const upd=()=>{go.disabled=!pick.size;go.textContent=pick.size?'Добавить · '+pick.size:'Добавить';
      chips.innerHTML='';pick.forEach(u=>{const c=el('button','gi-chip');c.append(avatar(u,24),el('span',null,nameOf(u)),el('i',null,'✕'));c.onclick=()=>{pick.delete(u);draw();upd()};chips.append(c)})};
    const draw=()=>{
      const f=q.value.trim().toLowerCase();box.innerHTML='';
      list.filter(u=>!f||nameOf(u).toLowerCase().includes(f)||(people[u]||'').includes(f)).forEach(u=>{
        const r=giRow(avatar(u,40),nameOf(u),'@'+(people[u]||'?'),'gi-mem');
        const ck=el('span','gi-ck'+(pick.has(u)?' on':''));r.append(ck);
        r.onclick=()=>{pick.has(u)?pick.delete(u):pick.add(u);ck.classList.toggle('on',pick.has(u));upd()};
        box.append(r);
      });
    };
    q.oninput=draw;draw();
    go.onclick=async()=>{go.disabled=true;if(await addMembers(gid,[...pick]))closeModal();else go.disabled=false};
  });
}

// ---------- Настройки группы (только админы) ----------
function openGroupSettings(gid){
  openModal(s=>{
    const g=groups[gid];
    const top=el('div','sheet-top');top.append(el('h3',null,'Настройки группы'));const x=el('button','icon','✕');x.onclick=closeModal;top.append(x);s.append(top);
    s.append(el('p','sm','Выберите, что разрешено только админам. Создатель группы — всегда админ.'));
    [['send','Отправлять сообщения','Остальные смогут только читать'],
     ['edit','Менять название, фото и описание',''],
     ['add','Добавлять участников','']].forEach(([k,t,sub])=>{
      const l=el('label','gi-sw');const tx=el('span');tx.append(el('b',null,t),el('small',null,(sub?sub+'. ':'')+'Сейчас: '+(g['only_admins_'+k]?'только админы':'все участники')));
      const c=document.createElement('input');c.type='checkbox';c.checked=!!g['only_admins_'+k];
      c.onchange=async()=>{c.disabled=true;const ok=await setGroupFlag(gid,k,c.checked);if(!ok)c.checked=!c.checked;c.disabled=false;
        tx.querySelector('small').textContent=(sub?sub+'. ':'')+'Сейчас: '+(c.checked?'только админы':'все участники')};
      l.append(tx,c,el('span','gi-tg'));s.append(l);
    });
    const admins=(gm[gid]||[]).filter(u=>roleOf(gid,u)!=='member');
    s.append(el('h2',null,'Админы · '+admins.length));
    admins.forEach(u=>s.append(row(avatar(u,34),u===me?'Вы':nameOf(u),roleOf(gid,u)==='owner'?'создатель':'админ')));
    s.append(el('p','sm','Назначить админа: нажмите на участника в списке группы.'));
  });
}
