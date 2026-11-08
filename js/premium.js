// Премиум-эмодзи: свои наборы картинок/видео, которые вставляются в текст как :код: (например :rb7:)
// и показываются в сообщении картинкой, как премиум-эмодзи в Telegram. Если в сообщении только они — крупно.
// Наборы: встроенный «Роботы» (рисуется кодом) + любые из emoji/packs.json (скачиваются скриптом tools/tg-pack.js).
const PREM_BUILTIN=[{id:'rb',name:'Роботы',n:24,kind:'svg'}];
let PREM_PACKS=[...PREM_BUILTIN];
let premRe=/:(rb)(\d{1,3}):/g;
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
function premEl(id,n,cls){
  const p=PREM_PACKS.find(x=>x.id===id);const w=document.createElement('span');w.className='pem'+(cls?' '+cls:'');w.dataset.code=':'+id+n+':';
  if(!p){w.textContent=':'+id+n+':';return w}
  if(p.kind==='svg'){w.innerHTML=robotSvg(n%p.n)}
  else if(p.ext==='webm'){const v=document.createElement('video');v.src='emoji/'+id+'/'+n+'.webm';v.autoplay=v.loop=v.muted=v.playsInline=true;w.append(v)}
  else{const i=document.createElement('img');i.src='emoji/'+id+'/'+n+'.'+p.ext;i.alt='';i.loading='lazy';w.append(i)}
  return w;
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

// Вкладка «Премиум» в панели эмодзи
function buildPremium(force){
  const box=$('premTab');if(box.children.length&&!force)return;box.innerHTML='';
  const tabs=el('div','prem-tabs');const grid=el('div','prem-grid');box.append(tabs,grid);
  let cur=PREM_PACKS[0].id;
  const show=id=>{cur=id;[...tabs.children].forEach(b=>b.classList.toggle('on',b.dataset.id===id));grid.innerHTML='';
    const p=PREM_PACKS.find(x=>x.id===id);
    for(let i=0;i<p.n;i++){const b=el('button','prem-it');b.append(premEl(id,i));b.onclick=()=>{insertAtCursor(':'+id+i+': ')};grid.append(b)}};
  PREM_PACKS.forEach(p=>{const b=el('button','prem-pk',p.name);b.dataset.id=p.id;b.onclick=()=>show(p.id);tabs.append(b)});
  show(cur);
}
loadPremPacks();
