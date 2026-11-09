// Плавность и удобство ленты: даты, склейка сообщений, умная прокрутка, жесты, мгновенная отправка
let bulk=false,stick=true,newBelow=0;
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Разделители по дням и склейка подряд идущих сообщений ----------
const dayOf=t=>{const d=new Date(t);return d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate()};
function dayLabel(t){
  const d=new Date(t),n=new Date(),y=new Date(Date.now()-864e5);
  if(dayOf(d)===dayOf(n))return 'Сегодня';
  if(dayOf(d)===dayOf(y))return 'Вчера';
  return d.toLocaleDateString('ru',{day:'numeric',month:'long',...(d.getFullYear()!==n.getFullYear()?{year:'numeric'}:{})});
}
const isMsg=n=>n&&n.classList?.contains('m')&&n.dataset.t;
function prevMsg(d){let p=d.previousElementSibling;while(p&&!isMsg(p))p=p.previousElementSibling;return p}
function nextMsg(d){let p=d.nextElementSibling;while(p&&!isMsg(p))p=p.nextElementSibling;return p}
// Два сообщения «склеиваются», если от одного человека, в один день и с разницей до 5 минут
const joined=(a,b)=>a&&b&&a.dataset.s===b.dataset.s&&dayOf(a.dataset.t)===dayOf(b.dataset.t)&&Math.abs(new Date(b.dataset.t)-new Date(a.dataset.t))<5*60e3;
function ensureDay(d){
  const p=prevMsg(d),need=!p||dayOf(p.dataset.t)!==dayOf(d.dataset.t);
  let sep=d.previousElementSibling;if(sep&&!sep.classList.contains('day'))sep=null;
  if(need&&!sep){sep=el('div','day');sep.append(el('span',null,dayLabel(d.dataset.t)));d.before(sep)}
  else if(!need&&sep)sep.remove();
}
function layoutNode(d){
  if(!d?.isConnected||!isMsg(d))return;
  const p=prevMsg(d),n=nextMsg(d);
  ensureDay(d);if(n)ensureDay(n);
  d.classList.toggle('cont',joined(p,d));d.classList.toggle('more',joined(d,n));
  if(p)p.classList.toggle('more',joined(p,d));
  if(n)n.classList.toggle('cont',joined(d,n));
}
function layoutAll(){
  const log=$('log');log.querySelectorAll('.day').forEach(x=>x.remove());
  log.querySelectorAll('.m[data-t]').forEach(d=>{const p=prevMsg(d);
    if(!p||dayOf(p.dataset.t)!==dayOf(d.dataset.t)){const s=el('div','day');s.append(el('span',null,dayLabel(d.dataset.t)));d.before(s)}
    d.classList.toggle('cont',joined(p,d));if(p)p.classList.toggle('more',joined(p,d));});
}

// ---------- Прокрутка: не дёргаем вниз, если человек читает историю ----------
const log$=()=>$('log');
const distBottom=()=>{const l=log$();return l.scrollHeight-l.scrollTop-l.clientHeight};
function toBottom(smooth){const l=log$();if(smooth&&!reduceMotion)l.scrollTo({top:l.scrollHeight,behavior:'smooth'});else l.scrollTop=l.scrollHeight;stick=true;newBelow=0;updateDown()}
function updateDown(){
  const b=$('tobottom'),show=cur&&distBottom()>400;
  b.classList.toggle('show',!!show);
  $('tbN').textContent=newBelow>99?'99+':newBelow||'';$('tbN').classList.toggle('hide',!newBelow);
}
$('log').addEventListener('scroll',()=>{stick=distBottom()<120;if(stick)newBelow=0;updateDown()},{passive:true});
$('tobottom').onclick=()=>toBottom(true);
// Картинки и видео подгружаются позже и меняют высоту — держим низ, если были внизу
$('log').addEventListener('load',()=>{if(stick)log$().scrollTop=log$().scrollHeight},true);
$('log').addEventListener('loadedmetadata',()=>{if(stick)log$().scrollTop=log$().scrollHeight},true);
// Вызывается из line() для каждого нового пузыря
function placed(d,m,prepend,quiet,near){
  layoutNode(d);
  if(prepend||bulk)return;
  if(!quiet&&!reduceMotion){d.classList.add('new');setTimeout(()=>d.classList.remove('new'),400)}
  if(near||m.sender===me)toBottom(true);else{stick=false;newBelow++;updateDown()}
}

// ---------- Мгновенная отправка: пузырь появляется сразу, до ответа сервера ----------
function sendingBubble(text){
  const d=el('div','m me sending');d.append(document.createTextNode(text));
  const s=el('small','meta');s.append(el('span','clock'),document.createTextNode(clockStr(new Date())));d.append(s);
  const e=$('log').querySelector('.empty');if(e)e.remove();
  $('log').append(d);d.classList.add('new');toBottom(true);
  return d;
}

// ---------- Жесты ----------
// Двойное нажатие — ❤️, одиночное — меню (с короткой задержкой, чтобы различить)
let tapTimer=0;
$('log').addEventListener('dblclick',e=>{
  const d=e.target.closest('.m[data-id]');if(!d||e.target.closest('a,button,video,audio,input'))return;
  clearTimeout(tapTimer);d.classList.remove('open');d.querySelector('.acts')?.remove();
  const id=+d.dataset.id;if(!msgs[id]||msgs[id].deleted_at)return;
  if(!(reacts[id]||[]).some(r=>r.user_id===me&&r.emoji==='❤️'))toggleReact(id,'❤️');
  const h=el('span','burst');h.append(svgI('i-heart'));d.append(h);setTimeout(()=>h.remove(),700);
  window.getSelection?.()?.removeAllRanges();
});
// Свайп сообщения вправо — ответить (на телефоне). С самого левого края — это «назад», не ответ
let sw=null;
$('log').addEventListener('touchstart',e=>{
  if(selMode)return;const d=e.target.closest('.m[data-id]');if(!d||e.touches.length>1||e.target.closest('button,input,.ttt-g,audio,.vbars'))return;
  if(e.touches[0].clientX<30)return;
  sw={d,x:e.touches[0].clientX,y:e.touches[0].clientY,dx:0,on:false};
},{passive:true});
$('log').addEventListener('touchmove',e=>{
  if(!sw)return;const t=e.touches[0],dx=t.clientX-sw.x,dy=t.clientY-sw.y;
  if(!sw.on){if(Math.abs(dy)>12){sw=null;return}
    const mine=msgs[sw.d.dataset.id]?.sender===me;
    if(dx>10&&Math.abs(dx)>Math.abs(dy)){sw.on=true;sw.dir=1;clearTimeout(lpT)}
    else if(dx<-10&&mine&&Math.abs(dx)>Math.abs(dy)){sw.on=true;sw.dir=-1;clearTimeout(lpT)} // влево по своему — «Сведения»
    else return}
  // тянется с «резинкой»: чем дальше, тем туже
  const pull=Math.max(0,dx*sw.dir),eased=pull<70?pull:70+(pull-70)*.3;
  sw.dx=Math.min(100,eased);sw.d.style.transform='translateX('+(sw.dx*sw.dir)+'px)';sw.d.classList.add('swiping');sw.d.classList.toggle('swl',sw.dir<0);
  const k=Math.min(1,sw.dx/64);sw.d.style.setProperty('--sw',k);
  if(k>=1&&!sw.buzz){sw.buzz=true;navigator.vibrate?.(8)}else if(k<1)sw.buzz=false;
},{passive:true});
$('log').addEventListener('touchend',()=>{
  if(!sw)return;const {d,dx,on,dir}=sw;sw=null;if(!on)return;
  d.classList.remove('swiping','swl');d.style.transition='transform .35s cubic-bezier(.34,1.5,.64,1)';d.style.transform='';
  setTimeout(()=>{d.style.transition='';d.style.removeProperty('--sw')},360);
  if(dx>=64){const m=msgs[d.dataset.id];if(m&&!m.deleted_at){navigator.vibrate?.(10);dir<0?(typeof showMsgInfo==='function'&&showMsgInfo(m)):startReply(m)}}
});
// Свайп от левого края — назад к списку (на телефоне)
let back=null;
$('pane').addEventListener('touchstart',e=>{
  if(!$('app').classList.contains('open')||!matchMedia('(max-width:760px)').matches)return;
  const x=e.touches[0].clientX;if(x>28)return;back={x,dx:0};$('pane').style.transition='none';
},{passive:true});
$('pane').addEventListener('touchmove',e=>{
  if(!back)return;back.dx=Math.max(0,e.touches[0].clientX-back.x);
  $('pane').style.transform='translateX('+back.dx+'px)';$('app').style.setProperty('--back',Math.min(1,back.dx/innerWidth));
},{passive:true});
$('pane').addEventListener('touchend',()=>{
  if(!back)return;const go=back.dx>innerWidth*.28;back=null;
  const p=$('pane');p.style.transition='';p.style.transform='';$('app').style.removeProperty('--back');
  if(go)closeChat();
});

// ---------- Загрузка истории: «скелет» вместо крутилки ----------
function skeleton(){
  const f=document.createDocumentFragment();
  [['them',62],['them',38],['me',54],['them',70],['me',30],['me',46]].forEach(([s,w])=>{
    const d=el('div','m sk '+s);d.style.width=w+'%';f.append(d)});
  return f;
}

// ---------- Всплывающее меню сообщения: вверх, если внизу нет места; закрытие щелчком мимо ----------
function placeMenu(d){
  const a=d.querySelector('.acts');if(!a)return;d.classList.remove('up');
  requestAnimationFrame(()=>{
    const L=$('log').getBoundingClientRect(),r=a.getBoundingClientRect(),b=d.getBoundingClientRect();
    if(r.bottom>L.bottom-6&&b.top-L.top>r.height+16)d.classList.add('up');
    a.scrollIntoView({block:'nearest',behavior:reduceMotion?'auto':'smooth'});
  });
}
function closeMenus(){$('log').classList.remove('msg-focus');document.querySelectorAll('.m.open').forEach(o=>{o.classList.remove('open','up','quick');o.querySelector('.acts')?.remove()})}
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.m.open'))closeMenus()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenus()});

// ---------- Нажатие = реакции, зажатие = всё меню (как в Telegram) ----------
let longFired=false,lpT=0,lpXY=null,menuAt=0;
// keep=true — зажатие: меню только открывается, никогда не закрывается повторным сигналом.
// (Android после зажатия шлёт ещё и contextmenu — раньше он тут же закрывал только что открытое меню.)
function openMenu(d,mode,keep){
  if(selMode)return;
  const mm=msgs[d.dataset.id];if(!mm)return;
  if(mm.deleted_at)mode='full'; // у удалённого реакций нет
  const same=d.classList.contains('open')&&(mode==='full'?!d.classList.contains('quick'):d.classList.contains('quick'));
  if(same&&(keep||Date.now()-menuAt<900))return;
  closeMenus();if(same)return;
  menuAt=Date.now();
  d.classList.add('open');d.classList.toggle('quick',mode==='quick');$('log').classList.add('msg-focus');
  const a=menuEl(mm,!mm.deleted_at&&specialOf(mm.body));d.append(a);
  // «⋯» в строке реакций — открыть всё меню
  const qr=a.querySelector('.qreact');
  if(qr){const more=el('button','more-btn','⋯');more.title='Ещё';more.onclick=e=>{e.stopPropagation();d.classList.remove('quick');placeMenu(d)};qr.append(more)}
  placeMenu(d);
}
$('log').addEventListener('touchstart',e=>{
  if(selMode)return;const d=e.target.closest('.m[data-id]');if(!d||e.touches.length>1||e.target.closest('a,button,video,audio,input,.acts,.ttt-g'))return;
  lpXY=[e.touches[0].clientX,e.touches[0].clientY];clearTimeout(lpT);
  lpT=setTimeout(()=>{longFired=true;clearTimeout(tapTimer);navigator.vibrate?.(15);openMenu(d,'full',true)},430);
},{passive:true});
$('log').addEventListener('touchmove',e=>{if(!lpXY)return;const t=e.touches[0];if(Math.abs(t.clientX-lpXY[0])>10||Math.abs(t.clientY-lpXY[1])>10){clearTimeout(lpT);lpXY=null}},{passive:true});
$('log').addEventListener('touchend',()=>{clearTimeout(lpT);lpXY=null;setTimeout(()=>{longFired=false},400)});

// ---------- Клавиатура на телефоне: шапка не уезжает, ничего не прыгает ----------
// Пока поле ввода в фокусе, приложение = видимая область над клавиатурой (iPhone сдвигает её, а не страницу).
// Без фокуса — всегда весь экран с верха: так шапка не остаётся обрезанной после закрытия клавиатуры или меню.
// Во время выезда/ухода клавиатуры подгоняем каждый кадр (~1,2 с), а не несколькими таймерами — без рывков и пустых полос.
(function(){
  const vv=window.visualViewport,root=document.documentElement;
  let wasStick=true,full=innerHeight,lastH=-1,lastT=-1,lastKb=null,lastF=null,until=0;
  const typing=()=>!!document.activeElement?.matches?.('input:not([type=checkbox]):not([type=radio]):not([type=file]),textarea,[contenteditable=true]');
  const fit=()=>{
    const focus=typing();
    if(!focus)full=Math.max(innerHeight,vv?vv.height:0); // высота без клавиатуры
    let h,t;
    if(focus&&vv){h=vv.height;t=Math.max(0,vv.offsetTop)}
    else{h=full;t=0;if(window.scrollY||root.scrollTop||(vv&&vv.offsetTop>0))window.scrollTo(0,0)}
    h=Math.round(h);t=Math.round(t);
    const kb=focus&&full-h>120;
    if(h!==lastH||focus!==lastF){if(focus)root.style.setProperty('--app-h',h+'px');else root.style.removeProperty('--app-h')} // без клавиатуры — 100dvh, весь экран без серой полосы снизу
    if(t!==lastT)root.style.setProperty('--vv-top',t+'px');
    if(kb!==lastKb)root.classList.toggle('kb',kb);
    // Ленту держим у низа только когда реально изменилась высота, и только если она и была внизу
    if(h!==lastH&&lastH>0&&wasStick&&cur)toBottom(false);
    lastH=h;lastT=t;lastKb=kb;lastF=focus;
  };
  const loop=()=>{fit();if(performance.now()<until)requestAnimationFrame(loop)};
  const burst=()=>{const idle=performance.now()>=until;until=performance.now()+1200;if(idle)requestAnimationFrame(loop)};
  if(vv){vv.addEventListener('resize',()=>{if(performance.now()>=until)wasStick=stick;burst()});vv.addEventListener('scroll',burst)}
  window.addEventListener('resize',burst);window.addEventListener('orientationchange',()=>{full=0;burst();resetZoom()});
  // После поворота iPhone иногда остаётся приближенным — возвращаем масштаб 1 (перезапись viewport сбрасывает зум)
  function resetZoom(){const m=document.querySelector('meta[name=viewport]');if(!m)return;const c=m.content;
    m.content=c.replace(/,?\s*maximum-scale=[\d.]+/,'')+', maximum-scale=1.0001';setTimeout(()=>{m.content=c;window.scrollTo(0,0)},350)}
  if(vv)vv.addEventListener('resize',()=>{if(vv.scale>1.01&&!typing())resetZoom()});fit();
  document.addEventListener('focusin',e=>{if(e.target.matches?.('input,textarea')){wasStick=stick;burst()}});
  document.addEventListener('focusout',e=>{if(e.target.matches?.('input,textarea')){wasStick=stick;burst()}});
  // Вернулись в приложение (из фона, после звонка) — пересчитать
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)burst()});
})();
// Кнопки рядом с полем ввода не забирают фокус — клавиатура не закрывается и не открывается заново
['bs','bv'].forEach(id=>$(id).addEventListener('pointerdown',e=>{if(document.activeElement===$('msg'))e.preventDefault()}));
