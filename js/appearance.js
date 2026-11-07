// Оформление: палитра (два цвета для градиентов), обои, размер текста, скругление, анимации.
// Всё хранится на этом устройстве (localStorage).
// Цвета приложения берутся из выбранного логотипа (js/logo.js): [id, название, акцент, акцент2]
const PALETTES=LOGOS.map(l=>[l[0],l[1],l[9],l[10]]);
const ACCENTS=PALETTES.map(p=>[p[2],p[1]]); // для старого кода
const WALLS=[
  ['dots','Точки',''],
  ['none','Без узора','var(--bg)'],
  ['sunset','Закат','linear-gradient(160deg,#ff9a8b 0%,#ff6a88 45%,#ff99ac 100%)'],
  ['ocean','Океан','linear-gradient(160deg,#2193b0 0%,#6dd5ed 100%)'],
  ['aurora','Сияние','linear-gradient(140deg,#0f2027 0%,#203a43 45%,#2c5364 100%)'],
  ['mint','Мята','linear-gradient(160deg,#d4fc79 0%,#96e6a1 100%)'],
  ['night','Ночь','radial-gradient(circle at 20% 20%,#3b1d60 0,transparent 45%),radial-gradient(circle at 80% 70%,#5b1530 0,transparent 45%),#0d0b14'],
  ['grid','Клетка','linear-gradient(var(--line) 1px,transparent 1px) 0 0/24px 24px,linear-gradient(90deg,var(--line) 1px,transparent 1px) 0 0/24px 24px,var(--bg)'],
];
const ls={get:k=>{try{return localStorage.getItem(k)}catch{return null}},set:(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch{}}};

function curPalette(){
  const id=ls.get('nit-pal');return PALETTES.find(x=>x[0]===id)||PALETTES.find(x=>x[0]===LOGO_DEFAULT);
}
function applyAccent(){
  const [,,c,c2]=curPalette(),r=document.documentElement.style;
  r.setProperty('--acc',c);r.setProperty('--me',c);r.setProperty('--acc2',c2);
  r.setProperty('--acc-hover','color-mix(in srgb,'+c+' 85%,#000)');
  r.setProperty('--acc-soft','color-mix(in srgb,'+c+' 15%,var(--surface))');
  applyLogo(curPalette()[0]);
}
// Логотип везде: в приложении (символ #i-logo), вкладка браузера, иконка для экрана «Домой»
function applyLogo(id){
  const L=logoById(id),svg=logoSVG(L[0],'round','cur');
  const sym=document.getElementById('i-logo');if(sym)sym.innerHTML=svg.slice(svg.indexOf('>')+1,svg.lastIndexOf('</svg>'));
  document.querySelector('meta[name=theme-color]')?.setAttribute('content',L[3]);
  const abs=f=>new URL(f,location.href).href;
  const link=(rel,href)=>{let l=document.querySelector('link[rel="'+rel+'"]');if(!l){l=document.createElement('link');l.rel=rel;document.head.append(l)}l.href=href};
  if(typeof updateBadge==='function')updateBadge();else link('icon',abs('icons/logo/'+L[0]+'-192.png'));
  link('apple-touch-icon',abs('icons/logo/'+L[0]+'-180.png'));
  // Манифест с иконками выбранного цвета — Android/Chrome возьмут их при установке на экран
  if(location.protocol.startsWith('http')){
    const mf={name:'Нить',short_name:'Нить',lang:'ru',start_url:abs('./'),scope:abs('./'),display:'standalone',background_color:L[3],theme_color:L[3],
      icons:[{src:abs('icons/logo/'+L[0]+'-192.png'),sizes:'192x192',type:'image/png',purpose:'any'},{src:abs('icons/logo/'+L[0]+'-512.png'),sizes:'512x512',type:'image/png',purpose:'any'},{src:abs('icons/logo/'+L[0]+'-mask.png'),sizes:'512x512',type:'image/png',purpose:'maskable'}]};
    const old=document.querySelector('link[rel="manifest"]');
    if(old&&L[0]!==LOGO_DEFAULT){if(old.dataset.blob)URL.revokeObjectURL(old.href);old.href=URL.createObjectURL(new Blob([JSON.stringify(mf)],{type:'application/manifest+json'}));old.dataset.blob=1}
    else if(old&&L[0]===LOGO_DEFAULT&&old.dataset.blob){URL.revokeObjectURL(old.href);old.href='manifest.webmanifest';delete old.dataset.blob}
  }
}
// Размер текста, скругление сообщений, анимации
function applyLook(){
  const r=document.documentElement;
  r.style.setProperty('--msg-fs',(+ls.get('nit-fs')||15)+'px');
  r.style.setProperty('--rb',(+ls.get('nit-rb')||20)+'px');
  r.classList.toggle('less-motion',ls.get('nit-motion')==='less');
}
applyLook();
function applyWall(){
  const w=ls.get('nit-wall')||'dots',p=$('pane');
  if(w==='custom'){const img=ls.get('nit-wall-img');p.style.background=img?'center/cover no-repeat url('+img+')':'';p.classList.toggle('walled',!!img);return}
  const def=WALLS.find(x=>x[0]===w);
  p.style.background=def&&def[2]?def[2]:'';
  p.classList.toggle('walled',!!(def&&def[2]&&w!=='none'&&w!=='grid'));
}
applyAccent();applyWall();

function appearanceSection(s){
  const ac=el('div','fld');ac.append(el('span',null,'Логотип и цвета'));
  const row1=el('div','logos');const curP=curPalette()[0];
  LOGOS.forEach(([id,t],i)=>{const b=el('button','lgo'+(id===curP?' on':''));
    const ic=el('span','lgo-ic');ic.innerHTML=logoSVG(id,'round','pick'+i);b.append(ic,el('span',null,t));
    b.onclick=e=>{e.preventDefault();withFade(()=>{ls.set('nit-pal',id);applyAccent()});[...row1.children].forEach(x=>x.classList.remove('on'));b.classList.add('on');
      if(id!==LOGO_DEFAULT||ls.get('nit-pal-tip')!=='1'){ls.set('nit-pal-tip','1');toast('Логотип и цвета «'+t+'» включены')}};row1.append(b)});
  ac.append(row1);
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent);
  ac.append(el('p','sm lgo-note',ios?'Иконка на экране «Домой»: iPhone запоминает её при добавлении. Чтобы она сменилась — удалите «Нить» с экрана «Домой» и добавьте снова через «Поделиться» → «На экран „Домой“».'
    :'Иконка на экране телефона обновится при следующей установке «Нити» на главный экран (Android иногда меняет её сам через какое-то время).'));
  s.append(ac);

  const wl=el('div','fld');wl.append(el('span',null,'Обои чата'));
  const row2=el('div','walls');const curW=ls.get('nit-wall')||'dots';
  const pick=(b,v)=>{[...row2.children].forEach(x=>x.classList.remove('on'));b.classList.add('on');ls.set('nit-wall',v);applyWall()};
  WALLS.forEach(([v,t,bg])=>{const b=el('button','wall'+(v===curW?' on':''));b.title=t;
    b.style.background=bg||'radial-gradient(circle at 1px 1px,rgba(127,127,127,.35) 1px,transparent 0) 0 0/8px 8px,var(--surface2)';
    b.onclick=e=>{e.preventDefault();pick(b,v)};row2.append(b)});
  // Своя картинка (хранится в браузере)
  const own=el('button','wall own'+(curW==='custom'?' on':''),'＋');own.title='Своя картинка';
  const img=ls.get('nit-wall-img');if(img){own.style.background='center/cover url('+img+')';own.textContent=''}
  const f=document.createElement('input');f.type='file';f.accept='image/*';f.hidden=true;
  own.onclick=e=>{e.preventDefault();f.click()};
  f.onchange=async()=>{const file=f.files[0];f.value='';if(!file)return;
    try{const b=await shrinkTo(file,1280,.72);const url=await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(b)});
      ls.set('nit-wall-img',url);own.style.background='center/cover url('+url+')';own.textContent='';pick(own,'custom')}
    catch(err){alert('Не получилось: '+err.message)}};
  row2.append(own,f);wl.append(row2);s.append(wl);
}
function shrinkTo(f,max,q){return new Promise((ok,no)=>{const i=new Image();i.onload=()=>{const k=Math.min(1,max/Math.max(i.width,i.height)),c=document.createElement('canvas');
  c.width=Math.round(i.width*k);c.height=Math.round(i.height*k);c.getContext('2d').drawImage(i,0,0,c.width,c.height);c.toBlob(b=>b?ok(b):no(new Error('ошибка')),'image/jpeg',q)};
  i.onerror=()=>no(new Error('это не картинка'));i.src=URL.createObjectURL(f)})}

// Переключатель уведомлений для настроек
function notifySection(s){
  const l=el('label','check');const c=document.createElement('input');c.type='checkbox';c.checked=notifyOn()&&('Notification' in window)&&Notification.permission==='granted';
  c.onchange=async()=>{c.checked=await setNotify(c.checked)};
  l.append(c,document.createTextNode(' Уведомления о новых сообщениях и звонках, когда приложение свёрнуто'));
  if(!('Notification' in window)){c.disabled=true}
  const l2=el('label','check');const c2=document.createElement('input');c2.type='checkbox';c2.checked=soundOn();
  c2.onchange=()=>{try{localStorage.setItem('nit-sound',c2.checked?'1':'0')}catch{}if(c2.checked)ping()};
  l2.append(c2,document.createTextNode(' Звук новых сообщений'));
  s.append(l,l2);
  if('Notification' in window&&Notification.permission==='denied')s.append(el('p','sm','Уведомления запрещены в настройках браузера для этого сайта — разрешите их там.'));
}

// Плавная смена оформления (View Transitions, где поддерживается)
function withFade(f){if(document.startViewTransition&&!document.documentElement.classList.contains('less-motion'))document.startViewTransition(f);else f()}
