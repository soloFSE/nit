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

function setMain(sc){
  const p=prof[me]||{};
  const hero=el('section','gi-hero set-hero');
  const av=avatar(me,104);av.classList.add('zoom');av.onclick=()=>openProfileEdit();
  hero.append(av,el('h2',null,nameOf(me)),el('small',null,'@'+myName+(p.status?' · '+p.status:'')));
  const ed=el('button','ghost sm-btn','Изменить профиль');ed.onclick=()=>openProfileEdit();hero.append(ed);
  sc.append(hero);
  // Аккаунты на этом устройстве
  const acc=el('section','gi-card');acc.append(el('div','gi-h','Аккаунты'));accountsSection(acc);sc.append(acc);
  const s1=el('section','gi-card');
  s1.append(setRow('i-gear','Оформление','Тема, цвета, обои, размер текста',()=>goSet('look')));
  s1.append(setRow('i-bell','Уведомления и звук',null,()=>goSet('notify')));
  s1.append(setRow('i-user','Конфиденциальность','Заблокированные',()=>goSet('privacy')));
  s1.append(setRow('i-lock','Аккаунт и безопасность','Почта, пароль, Google и GitHub',()=>openAccount()));
  sc.append(s1);
  if(typeof installEvt!=='undefined'&&installEvt){const s2=el('section','gi-card');s2.append(setRow('i-download','Установить приложение',null,()=>$('install').click()));sc.append(s2)}
  const s3=el('section','gi-card');const out=giRow('i-out','Выйти из аккаунта',null,'gi-danger');
  out.onclick=()=>{if(confirm('Выйти из аккаунта @'+myName+'?')){closeSettings();$('out').click()}};s3.append(out);sc.append(s3);
  {const v=el('p','set-ver','Нить · сделано с ');v.append(ico('i-heart','love'));sc.append(v)}
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
function setNotifyPage(sc){const c=el('section','gi-card set-pad');notifySection(c);sc.append(c)}
function setPrivacy(sc){const c=el('section','gi-card set-pad');blockedSection(c);sc.append(c)}
