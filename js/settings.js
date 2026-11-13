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

const SET_TITLES={main:'Настройки',look:'Оформление',notify:'Уведомления и звук',privacy:'Конфиденциальность',sec:'Безопасность'};
function renderSettings(anim){
  const w=setBox(),p=setPage;if(!p)return;
  w.innerHTML='';
  const top=el('div','gi-top');
  const back=el('button','icon');back.append(svgI('i-back'));back.title='Назад';back.onclick=()=>p==='main'?closeSettings():goSet('main');
  top.append(back,el('b',null,SET_TITLES[p]));w.append(top);
  const sc=el('div','gi-scroll'+(anim&&p!=='main'?' set-in':''));w.append(sc);
  ({main:setMain,look:setLook,notify:setNotifyPage,privacy:setPrivacy,sec:setSecurity})[p](sc);
}
function setRow(icon,title,sub,f,cls){const r=giRow(icon,title,sub,cls);r.onclick=f;const ch=el('span','chev');ch.append(svgI('i-back'));r.append(ch);return r}

const FEEDBACK_URL='https://docs.google.com/document/d/1tv4pkKcjnsUK6MeOT2Gdkgzi2F8Y976j104CjGdnFKk/edit?usp=sharing';
function setMain(sc){
  const p=prof[me]||{};
  // Шапка: цветной фон под выбранную тему, аватар, имя, ник и быстрые плитки
  const hero=el('section','gi-hero set-hero');
  if(typeof bannerInto==='function')bannerInto(hero,me);
  const av=avatar(me,104);if(p.avatar_path){av.classList.add('zoom');av.onclick=()=>openViewer(avatarUrl(p.avatar_path))}else av.onclick=()=>openProfileEdit();
  const h2=el('h2',null,nameOf(me));if(typeof premPaint==='function')premPaint(h2,me);const pm=typeof premMark==='function'&&premMark(me);if(pm)h2.append(pm);hero.append(av,h2);
  const sub=el('div','set-sub');const nk=el('button','set-nick','@'+myName);nk.title='Скопировать ник';nk.onclick=()=>{navigator.clipboard?.writeText('@'+myName);toast('Ник скопирован')};sub.append(nk);
  if(p.status)sub.append(el('span','set-status',p.status));hero.append(sub);
  const mt=typeof mainTitle==='function'&&mainTitle(me);if(mt)hero.append(titleBadge(mt,'big'));
  const tiles=el('div','set-tiles');
  const tile=(ic,t,f)=>{const b=el('button','set-tile');b.append(svgI(ic),el('span',null,t));b.onclick=f;tiles.append(b)};
  tile('i-pencil','Профиль',()=>openProfileEdit());
  tile('i-forward','Пригласить',()=>inviteFriend());
  tile('i-gear','Оформление',()=>goSet('look'));
  hero.append(tiles);sc.append(hero);
  // v6.2: настройки сгруппированы по разделам, сверху — поиск. Каждая строка помечена data-q для поиска.
  const find=el('div','set-find');find.append(svgI('i-search'));
  const fi=document.createElement('input');fi.type='search';fi.placeholder='Найти настройку';fi.autocomplete='off';find.append(fi);sc.append(find);
  const groups=[];
  const grp=(title)=>{const c=el('section','gi-card set-group');if(title)c.append(el('div','gi-h',title));groups.push(c);sc.append(c);return c};
  const item=(c,r,q)=>{r.classList.add('set-item');r.dataset.q=(q||r.innerText||'').toLowerCase();c.append(r);return r};
  const chev=r=>{const ch=el('span','chev');ch.append(svgI('i-back'));r.append(ch);return r};
  // — Моё
  {const c=grp('Моё');
   const n=typeof strEff==='function'?strEff(strMe):0;
   const th=giRow(yarnEl(n,34),'Моя нить',n?daysWord(n)+' · '+yarnName(n):'Напишите кому-нибудь — и нить начнётся','sk-set');th.onclick=()=>openStreak(null);item(c,chev(th),'моя нить серия');
   if(typeof giftOk!=='undefined'&&giftOk){const w=giRow('i-gift','Узелки и подарки',(wallet?wallet.balance:0)+' узелков'+(canClaim()?' · бонус ждёт':''),'sk-set');w.onclick=()=>openWallet();item(c,chev(w),'узелки подарки бонус кошелёк')}
   item(c,setRow('i-gem','Нить Премиум',isPremium(me)?'Подключён '+untilText(premMap[me]):'Эмодзи, баннер, цвет ника и другое',()=>openPremium(),'pr-set'),'премиум подписка цвет ника баннер');
   const ac=typeof adminCard==='function'&&adminCard();if(ac){const r=ac.firstChild;if(r){r.classList.remove('gi-accent');item(c,r,'админ панель администратор')}}}
  // — Настройки
  {const c=grp('Настройки');
   item(c,setRow('i-gear','Оформление','Тема, логотип, обои, размер текста',()=>goSet('look')),'оформление тема цвет логотип обои шрифт размер текста');
   item(c,setRow('i-bell','Уведомления и звук','Сообщения, звонки, звуки',()=>goSet('notify')),'уведомления звук звонки тишина');
   item(c,setRow('i-shield','Безопасность','Двойная защита, код-пароль',()=>goSet('sec')),'безопасность защита 2fa двойная код пароль пин приватность');
   item(c,setRow('i-lock','Аккаунт и вход','Почта, пароль, Google и GitHub',()=>openAccount()),'аккаунт почта пароль google github вход удалить аккаунт');
   item(c,setRow('i-user','Конфиденциальность','Заблокированные',()=>goSet('privacy')),'конфиденциальность заблокированные блок')}
  // — Аккаунты на этом устройстве
  {const c=grp('Аккаунты на устройстве');accountsSection(c);c.querySelectorAll('.gi-h').forEach((h,i)=>{if(i>0)h.remove()});groups.at(-1).classList.add('set-acc')}
  // — О «Нити»
  {const c=grp('О «Нити»');
   item(c,setRow('i-star','Что нового','v'+NIT_VERSION,()=>openWhatsNew()),'что нового обновления версия');
   item(c,setRow('i-chats','Идеи и баги','Общий документ — пишите, что улучшить',()=>window.open(FEEDBACK_URL,'_blank','noopener')),'идеи баги обратная связь');
   item(c,setRow('i-redial','Обновить приложение','Если что-то глючит',()=>refreshApp()),'обновить приложение кэш');
   if(typeof installEvt!=='undefined'&&installEvt)item(c,setRow('i-download','Установить приложение',null,()=>$('install').click()),'установить приложение')}
  {const c=el('section','gi-card set-group');const out=giRow('i-out','Выйти из аккаунта',null,'gi-danger');
   out.onclick=()=>{if(confirm('Выйти из аккаунта @'+myName+'?')){closeSettings();$('out').click()}};item(c,out,'выйти');sc.append(c);groups.push(c)}
  const none=el('p','set-none hide','Ничего не нашлось');sc.append(none);
  fi.oninput=()=>{const q=fi.value.trim().toLowerCase();let any=false;
    groups.forEach(g=>{let v=0;g.querySelectorAll('.set-item').forEach(r=>{const ok=!q||r.dataset.q.includes(q);r.classList.toggle('hide',!ok);if(ok)v++});
      const acc=g.classList.contains('set-acc');g.classList.toggle('hide',!!q&&!v&&!acc||!!q&&acc);if(!g.classList.contains('hide'))any=true});
    none.classList.toggle('hide',any||!q)};
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
