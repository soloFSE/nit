// Окно настроек — отдельная панель (как «Данные группы»): профиль, аккаунты, оформление,
// уведомления, конфиденциальность, безопасность. Разделы открываются внутри панели со своей кнопкой «назад».
let setPage=null;
function setBox(){let w=$('sett');if(!w){w=el('div','gi hide');w.id='sett';document.body.append(w)}return w}
function openSettings(page='main'){
  const w=setBox();setPage=page;w.classList.remove('hide','closing');renderSettings(true);
}
function closeSettings(){
  const w=$('sett');if(!w||w.classList.contains('hide'))return;setPage=null;
  w.classList.add('closing');setTimeout(()=>{if(!setPage){w.classList.add('hide');w.classList.remove('closing');w.innerHTML=''}},260);
}
function refreshSettings(){if(setPage)renderSettings()}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&setPage&&$('modal').classList.contains('hide')&&!document.querySelector('.crop'))setPage==='main'?closeSettings():goSet('main')});
function goSet(p){setPage=p;renderSettings(true)}

const SET_TITLES={main:'Настройки',look:'Оформление',notify:'Уведомления и звук',privacy:'Конфиденциальность'};
function renderSettings(anim){
  const w=setBox(),p=setPage;if(!p)return;
  w.innerHTML='';
  const top=el('div','gi-top');
  const back=el('button','icon');back.append(svgI('i-back'));back.title='Назад';back.onclick=()=>p==='main'?closeSettings():goSet('main');
  top.append(back,el('b',null,SET_TITLES[p]));w.append(top);
  const sc=el('div','gi-scroll'+(anim&&p!=='main'?' set-in':''));w.append(sc);
  ({main:setMain,look:setLook,notify:setNotifyPage,privacy:setPrivacy})[p](sc);
}
function setRow(icon,title,sub,f,cls){const r=giRow(icon,title,sub,cls);r.onclick=f;const ch=el('span','chev');ch.append(svgI('i-back'));r.append(ch);return r}

const FEEDBACK_URL='https://docs.google.com/document/d/1tv4pkKcjnsUK6MeOT2Gdkgzi2F8Y976j104CjGdnFKk/edit?usp=sharing';
function setMain(sc){
  const p=prof[me]||{};
  // Шапка: цветной фон под выбранную тему, аватар, имя, ник и быстрые плитки
  const hero=el('section','gi-hero set-hero');
  const av=avatar(me,104);if(p.avatar_path){av.classList.add('zoom');av.onclick=()=>openViewer(avatarUrl(p.avatar_path))}else av.onclick=()=>openProfileEdit();
  const h2=el('h2',null,nameOf(me));const pm=typeof premMark==='function'&&premMark(me);if(pm)h2.append(pm);hero.append(av,h2);
  const sub=el('div','set-sub');const nk=el('button','set-nick','@'+myName);nk.title='Скопировать ник';nk.onclick=()=>{navigator.clipboard?.writeText('@'+myName);toast('Ник скопирован')};sub.append(nk);
  if(p.status)sub.append(el('span','set-status',p.status));hero.append(sub);
  const mt=typeof mainTitle==='function'&&mainTitle(me);if(mt)hero.append(titleBadge(mt,'big'));
  const tiles=el('div','set-tiles');
  const tile=(ic,t,f)=>{const b=el('button','set-tile');b.append(svgI(ic),el('span',null,t));b.onclick=f;tiles.append(b)};
  tile('i-pencil','Профиль',()=>openProfileEdit());
  tile('i-forward','Пригласить',()=>inviteFriend());
  tile('i-gear','Оформление',()=>goSet('look'));
  hero.append(tiles);sc.append(hero);
  // Моя нить
  {const n=typeof strEff==='function'?strEff(strMe):0,card=el('section','gi-card sk-card');
   const row=giRow(yarnEl(n,38),'Моя нить',n?daysWord(n)+' · '+yarnName(n):'Напишите кому-нибудь — и нить начнётся','sk-set');
   row.onclick=()=>openStreak(null);const ch=el('span','chev');ch.append(svgI('i-back'));row.append(ch);card.append(row);sc.append(card)}
  // Узелки и подарки
  if(typeof giftOk!=='undefined'&&giftOk){const card=el('section','gi-card');
    const row=giRow('i-gift','Узелки и подарки',(wallet?wallet.balance:0)+' узелков'+(canClaim()?' · бонус ждёт':''),'sk-set');row.onclick=()=>openWallet();
    const ch=el('span','chev');ch.append(svgI('i-back'));row.append(ch);card.append(row);sc.append(card)}
  // Аккаунты на этом устройстве
  const acc=el('section','gi-card');acc.append(el('div','gi-h','Аккаунты'));accountsSection(acc);sc.append(acc);
  {const ac=typeof adminCard==='function'&&adminCard();if(ac)sc.append(ac)}
  const sp=el('section','gi-card prem-card');const pr=setRow('i-gem','Нить Премиум',isPremium(me)?'Подключён '+untilText(premMap[me]):'Эмодзи, звезда у имени, цвет профиля и другое',()=>openPremium(),'pr-set');sp.append(pr);sc.append(sp);
  const s1=el('section','gi-card');
  s1.append(setRow('i-gear','Оформление','Тема, логотип и цвета, обои, размер текста',()=>goSet('look')));
  s1.append(setRow('i-bell','Уведомления и звук','Сообщения, звонки, звуки',()=>goSet('notify')));
  s1.append(setRow('i-user','Конфиденциальность','Заблокированные',()=>goSet('privacy')));
  s1.append(setRow('i-lock','Аккаунт и безопасность','Почта, пароль, Google и GitHub',()=>openAccount()));
  sc.append(s1);
  // О Нити: что нового, идеи, обновление
  const s4=el('section','gi-card');s4.append(el('div','gi-h','О «Нити»'));
  s4.append(setRow('i-star','Что нового','v'+NIT_VERSION,()=>openWhatsNew()));
  s4.append(setRow('i-chats','Идеи и баги','Общий документ — пишите сюда, что улучшить',()=>window.open(FEEDBACK_URL,'_blank','noopener')));
  s4.append(setRow('i-redial','Обновить приложение','Загрузить свежую версию, если что-то глючит',()=>refreshApp()));
  sc.append(s4);
  if(typeof installEvt!=='undefined'&&installEvt){const s2=el('section','gi-card');s2.append(setRow('i-download','Установить приложение',null,()=>$('install').click()));sc.append(s2)}
  const s3=el('section','gi-card');const out=giRow('i-out','Выйти из аккаунта',null,'gi-danger');
  out.onclick=()=>{if(confirm('Выйти из аккаунта @'+myName+'?')){closeSettings();$('out').click()}};s3.append(out);sc.append(s3);
  // Слоган
  const sl=el('section','set-slogan');const lg=el('div','set-logo');lg.append(svgI('i-logo'));
  sl.append(lg,el('p','sl-a','Мессенджеров много'),el('p','sl-b','Нить — одна'));
  const team=el('div','sl-team');['Клод','Эльдар','Исрафил','Победа'].forEach(n=>team.append(el('span',null,n)));
  sl.append(el('small','sl-c','Сделали'),team);sc.append(sl);
  {const v=el('p','set-ver','Нить '+NIT_VERSION+' · сделано с ');v.append(ico('i-heart','love'));sc.append(v)}
}
function openWhatsNew(){
  openModal(s=>{
    s.classList.add('wn-sheet');
    const top=el('div','sheet-top');top.append(el('h3',null,'История обновлений'));const x=el('button','icon');x.append(svgI('i-x'));x.onclick=closeModal;top.append(x);s.append(top);
    const l=el('div','wn-list');let i=0;
    CHANGELOG.forEach((c,ci)=>{
      const h=el('div','wn-head');h.append(el('b',null,'v'+c.v),el('span',null,c.title),el('small',null,new Date(c.date).toLocaleDateString('ru-RU',{day:'numeric',month:'long'})));if(ci===0)h.append(el('i','wn-new','новое'));l.append(h);
      c.items.forEach(([ic,t,d])=>{const r=giRow(ic,t,d,'gi-mem wn-row');r.style.animationDelay=(i++)*35+'ms';l.append(r)});
    });
    s.append(l);
  });
}
// Сбросить кэш сайта и перезагрузить — так подтягивается свежая версия
async function refreshApp(){
  if(!confirm('Обновить приложение? Страница перезагрузится.'))return;
  try{(await navigator.serviceWorker?.getRegistrations?.()||[]).forEach(r=>r.unregister());(await caches?.keys?.()||[]).forEach(k=>caches.delete(k))}catch{}
  setTimeout(()=>location.reload(),150);
}

function setLook(sc){
  // Тема — карточки-превью
  const c1=el('section','gi-card set-pad');c1.append(el('div','gi-h','Тема'));
  const th=el('div','themes');const cur=getTheme();
  [['auto','Как в системе'],['light','Светлая'],['dark','Тёмная']].forEach(([v,t])=>{
    const b=el('button','theme-c '+v+(v===cur?' on':''));b.append(el('i'),el('span',null,t));
    b.onclick=()=>{withFade(()=>setTheme(v));[...th.children].forEach(x=>x.classList.toggle('on',x===b))};th.append(b)});
  c1.append(th);sc.append(c1);
  // Палитра и обои
  const c2=el('section','gi-card set-pad');appearanceSection(c2);sc.append(c2);
  // Размер текста и скругление — с живым примером
  const c3=el('section','gi-card set-pad');c3.append(el('div','gi-h','Сообщения'));
  const demo=el('div','set-demo');
  const mk=(cls,t)=>{const d=el('div','m '+cls);d.append(document.createTextNode(t));const s=el('small','meta','12:00');d.append(s);return d};
  demo.append(mk('them','Привет! Как тебе новый вид?'),mk('me','Огонь!'));c3.append(demo);
  const slider=(label,key,min,max,def,apply)=>{
    const l=el('label','set-sl');const v=el('b',null,'');const i=document.createElement('input');i.type='range';i.min=min;i.max=max;i.value=+ls.get(key)||def;
    const upd=()=>{v.textContent=i.value+' px';ls.set(key,i.value);apply()};i.oninput=upd;v.textContent=i.value+' px';
    const h=el('span');h.append(el('span',null,label),v);l.append(h,i);return l};
  c3.append(slider('Размер текста','nit-fs',13,20,15,applyLook),slider('Скругление','nit-rb',8,26,20,applyLook));
  sc.append(c3);
  // Анимации
  const c4=el('section','gi-card set-pad');c4.append(el('div','gi-h','Анимации'));
  const seg=el('div','seg');const mo=ls.get('nit-motion')||'full';
  [['full','Плавные'],['less','Минимум']].forEach(([v,t])=>{const b=el('button',v===mo?'':'g',t);b.onclick=()=>{ls.set('nit-motion',v);applyLook();[...seg.children].forEach(x=>x.className='g');b.className=''};seg.append(b)});
  c4.append(seg);sc.append(c4);
}
function setNotifyPage(sc){notifySection(sc)}
function setPrivacy(sc){const c=el('section','gi-card set-pad');blockedSection(c);sc.append(c)}
