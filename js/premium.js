// Премиум-эмодзи: свои наборы картинок/видео, которые вставляются в текст как :код: (например :rb7:)
// и показываются в сообщении картинкой, как премиум-эмодзи в Telegram. Если в сообщении только они — крупно.
// Наборы: встроенный «Роботы» (рисуется кодом) + любые из emoji/packs.json (скачиваются скриптом tools/tg-pack.js).
const PREM_BUILTIN=[{id:'bot',name:'Роботы',n:24,kind:'svg'}];
let PREM_PACKS=[...PREM_BUILTIN];
let premRe=/:(bot)(\d{1,3}):/g;
async function loadPremPacks(){
  try{const r=await fetch('emoji/packs.json',{cache:'no-cache'});if(!r.ok)return;const j=await r.json();
    (j.packs||[]).forEach(p=>{if(/^[a-z]{2,6}$/.test(p.id)&&!PREM_PACKS.some(x=>x.id===p.id))PREM_PACKS.push({id:p.id,name:p.name||p.id,n:p.n|0,ext:p.ext||'webp',kind:'file'})});
    premRe=new RegExp(':('+PREM_PACKS.map(p=>p.id).join('|')+')(\\d{1,3}):','g');
    const pe=document.getElementById('premTab');if(pe&&pe.children.length)buildPremium(true);
  }catch{}
}
// Рисованный робот №n (0..23): 6 цветов × 4 выражения
const ROBO_COLORS=[['#60a5fa','#2563eb'],['#34d399','#059669'],['#fbbf24','#d97706'],['#f472b6','#db2777'],['#a78bfa','#7c3aed'],['#fb923c','#ea580c']];
function robotSvg(i){
  const [c1,c2]=ROBO_COLORS[i%6],ex=Math.floor(i/6)%4,u='r'+i;
  const eyes=[
    '<path d="M32 50q5-8 10 0M58 50q5-8 10 0" fill="none" stroke="#12303f" stroke-width="4" stroke-linecap="round"/>',
    '<circle cx="37" cy="49" r="4.6" fill="#12303f"/><circle cx="63" cy="49" r="4.6" fill="#12303f"/>',
    '<circle cx="37" cy="49" r="7" fill="#fff"/><circle cx="63" cy="49" r="7" fill="#fff"/><circle cx="37" cy="50" r="3.4" fill="#12303f"/><circle cx="63" cy="50" r="3.4" fill="#12303f"/>',
    '<path d="M37 55c-8-5-9-11-4.5-12 2.5-.6 4 1 4.5 2.3.5-1.300 2-2.900 4.500-2.300 4.500 1 3.500 7-4.500 12zM63 55c-8-5-9-11-4.500-12 2.500-.6 4 1 4.500 2.300.5-1.300 2-2.900 4.500-2.300 4.500 1 3.500 7-4.500 12z" fill="#ff4d6d"/>'][ex];
  const mouth=['<path d="M40 66q10 9 20 0" fill="none" stroke="#12303f" stroke-width="4" stroke-linecap="round"/>','<path d="M42 68h16" stroke="#12303f" stroke-width="4" stroke-linecap="round"/>','<ellipse cx="50" cy="68" rx="5" ry="6" fill="#12303f"/>','<path d="M38 65q12 12 24 0z" fill="#12303f"/>'][ex];
  return '<svg viewBox="0 0 100 100"><defs><linearGradient id="'+u+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+c1+'"/><stop offset="1" stop-color="'+c2+'"/></linearGradient></defs>'
   +'<path d="M50 12v12" stroke="#64748b" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="10" r="5" fill="#fbbf24"/>'
   +'<rect x="14" y="30" width="72" height="58" rx="22" fill="url(#'+u+')"/><rect x="6" y="48" width="9" height="20" rx="4.500" fill="'+c2+'"/><rect x="85" y="48" width="9" height="20" rx="4.500" fill="'+c2+'"/>'
   +'<rect x="22" y="38" width="56" height="40" rx="16" fill="#e8f7ff"/>'+eyes+mouth
   +'<circle cx="28" cy="64" r="4" fill="#ff8fab" fill-opacity=".6"/><circle cx="72" cy="64" r="4" fill="#ff8fab" fill-opacity=".6"/></svg>';
}
// Элемент одного эмодзи (картинка/видео/svg)
function premEl(id,n,cls,still){
  const p=PREM_PACKS.find(x=>x.id===id);const w=document.createElement('span');w.className='pem'+(cls?' '+cls:'');w.dataset.code=':'+id+n+':';
  if(!p){w.textContent=':'+id+n+':';return w}
  if(p.kind==='svg'){w.innerHTML=robotSvg(n%p.n)}
  else if(p.ext==='json'){lottieLazy(w,'emoji/'+id+'/'+n+'.json',still)}
  else if(p.ext==='webm'){const v=document.createElement('video');v.src='emoji/'+id+'/'+n+'.webm';v.autoplay=v.loop=v.muted=v.playsInline=true;w.append(v)}
  else{const i=document.createElement('img');i.src='emoji/'+id+'/'+n+'.'+p.ext;i.alt='';i.loading='lazy';w.append(i)}
  return w;
}
// Анимированные эмодзи (Lottie из .tgs). Чтобы не лагало: рисуем на canvas (легче SVG), анимируем только то, что видно,
// одновременно играет не больше 10, а в панели эмодзи (режим still) показываем первый кадр и оживляем при наведении/нажатии.
let lottieP=null;
const lottieLib=()=>lottieP||(lottieP=new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie_canvas.min.js';s.onload=()=>ok(window.lottie);s.onerror=()=>{lottieP=null;no()};document.head.append(s)}));
const lottieData={},playing=[];
const getLottieJson=src=>lottieData[src]||(lottieData[src]=fetch(src).then(r=>r.json()));
function lottiePlay(w){
  const a=w._an;if(!a)return;const i=playing.indexOf(w);if(i>=0)playing.splice(i,1);playing.push(w);
  while(playing.length>10){const o=playing.shift();o._an?.pause();if(o._still)o._an?.goToAndStop(0,true)}
  a.play();
}
function lottieStop(w){const a=w._an;if(!a)return;a.pause();if(w._still)a.goToAndStop(0,true);const i=playing.indexOf(w);if(i>=0)playing.splice(i,1)}
const lottieIO=new IntersectionObserver(es=>es.forEach(e=>{const w=e.target;
  if(!e.isIntersecting){lottieStop(w);return}
  if(w._an){if(!w._still)lottiePlay(w);return}
  if(w._loading)return;w._loading=1;
  Promise.all([lottieLib(),getLottieJson(w._src)]).then(([L,data])=>{
    w._an=L.loadAnimation({container:w,renderer:'canvas',loop:true,autoplay:false,animationData:JSON.parse(JSON.stringify(data)),rendererSettings:{clearCanvas:true,progressiveLoad:true}});
    if(w._still){w._an.addEventListener('DOMLoaded',()=>w._an.goToAndStop(0,true));w._an.goToAndStop(0,true)}else lottiePlay(w);
  }).catch(()=>{w._loading=0})}),{threshold:.1});
function lottieLazy(w,src,still){
  w._src=src;w._still=!!still;lottieIO.observe(w);
  if(still){const on=()=>lottiePlay(w),off=()=>lottieStop(w);
    w.addEventListener('pointerenter',on);w.addEventListener('pointerleave',off);w.addEventListener('touchstart',on,{passive:true});w.addEventListener('touchend',()=>setTimeout(off,1200),{passive:true})}
}
// Текст сообщения → заменяем :rb7: на картинки (frag — фрагмент с текстовыми узлами)
function premiumize(frag){
  if(!frag?.childNodes)return frag;
  [...frag.childNodes].forEach(nd=>{
    if(nd.nodeType!==3||!nd.textContent.includes(':'))return;
    const t=nd.textContent;premRe.lastIndex=0;if(!premRe.test(t))return;premRe.lastIndex=0;
    const out=document.createDocumentFragment();let last=0,m;
    while((m=premRe.exec(t))){if(m.index>last)out.append(t.slice(last,m.index));out.append(premEl(m[1],+m[2]));last=m.index+m[0].length}
    if(last<t.length)out.append(t.slice(last));nd.replaceWith(out);
  });
  return frag;
}
const isPremOnly=b=>{if(!b||b.length>40)return false;premRe.lastIndex=0;return b.replace(premRe,'').trim()===''&&/:/.test(b)};
const premPreview=b=>String(b||'').replace(premRe,()=>PI('i-gem'));

// Вкладка «Премиум» в панели эмодзи: разделы по наборам с липкими заголовками, внизу — значки наборов.
// Без Премиума эмодзи видны, но закрыты замком; нажатие открывает экран «Премиум».
function buildPremium(force){
  const box=$('premTab'),bar=$('pkbar');if(box.children.length&&!force)return;box.innerHTML='';bar.innerHTML='';
  const locked=typeof canUsePremEmoji==='function'&&!canUsePremEmoji();
  if(locked){const b=el('button','prem-lock');b.append(svgI('i-gem'),el('span',null,'Премиум-эмодзи доступны с Премиум'),el('i',null,'Подробнее'));b.onclick=()=>openPremium();box.append(b)}
  const secs={};
  PREM_PACKS.forEach(p=>{
    const sec=el('section','prem-sec');secs[p.id]=sec;
    const h=el('div','prem-h');h.append(el('b',null,p.name),el('small',null,String(p.n)));sec.append(h);
    const g=el('div','prem-grid');
    for(let i=0;i<p.n;i++){const b=el('button','prem-it'+(locked?' lk':''));b.append(premEl(p.id,i,'',true));
      b.onclick=()=>{if(locked){openPremium();return}insertAtCursor(':'+p.id+i+': ')};g.append(b)}
    sec.append(g);box.append(sec);
    const ic=el('button','pk-ic');ic.title=p.name;ic.append(premEl(p.id,0,'',true));
    ic.onclick=()=>{box.scrollTo({top:sec.offsetTop-box.offsetTop-(locked?44:0),behavior:'smooth'})};bar.append(ic);
  });
  // подсветка текущего набора по прокрутке
  box.onscroll=()=>{let cur=PREM_PACKS[0].id;PREM_PACKS.forEach(p=>{if(secs[p.id].offsetTop-box.offsetTop<=box.scrollTop+60)cur=p.id});
    [...bar.children].forEach((b,i)=>b.classList.toggle('on',PREM_PACKS[i].id===cur))};box.onscroll();
}
loadPremPacks();
