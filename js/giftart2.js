// Рисунки подарков v5.1 — коллекция «Кавказ» нарисована заново «в премиум-качестве» (подключается после giftart.js и заменяет его сцены).
// Слои: небо с северным сиянием → лучи → горы → герой сцены (металл, ткань, свет) → туман, искры, блики. Всё — векторный SVG с SMIL-анимацией.
// Дорого и редко: башни, волк, солярный знак, папаха — Чечня и Ингушетия; на вершине — номера регионов «95» и «06», как номерные знаки.
const GSKY_T={plate95:['#04301c','#12a15a'],plate06:['#032a33','#0e8aa0']};
delete GART.os_pie;
var giftDefs=u=>`<linearGradient id="${u}au" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c2"/><stop offset=".35" stop-color="#f7c948"/><stop offset=".7" stop-color="#d98a12"/><stop offset="1" stop-color="#8a4b06"/></linearGradient>`
 +`<linearGradient id="${u}st" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f7fb"/><stop offset=".45" stop-color="#9aa6b8"/><stop offset="1" stop-color="#4b5567"/></linearGradient>`
 +`<radialGradient id="${u}ry" cx="50" cy="50" r="62" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`
 +`<linearGradient id="${u}ar" x1="0" x2="1"><stop offset="0" stop-color="#34d399"/><stop offset=".5" stop-color="#22d3ee"/><stop offset="1" stop-color="#a78bfa"/></linearGradient>`
 +`<filter id="${u}bl" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.2"/></filter><filter id="${u}gw" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.6"/></filter>`
 +`<linearGradient id="${u}fs" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".25"/><stop offset=".2" stop-color="#fff" stop-opacity=".18"/><stop offset=".45" stop-color="#000" stop-opacity=".16"/><stop offset=".7" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>`;

// ---------- флаги ----------
function giftFlag(u,kind,x,y,w,h,dur){
  const wp=a=>`M${x} ${y}C${x+w/3} ${y-a} ${x+2*w/3} ${y+a} ${x+w} ${y}L${x+w} ${y+h}C${x+2*w/3} ${y+h+a} ${x+w/3} ${y+h-a} ${x} ${y+h}Z`;
  const id=u+'f'+kind+Math.round(x+y*7),X=x,Y=y-8,W=w,H=h+16,r=(a,b,c,d,f)=>`<rect x="${a}" y="${b}" width="${c}" height="${d}" fill="${f}"/>`;
  let body='';
  if(kind==='ch'){const sw=w*.1,c=FL.ch,hh=h;
    body=r(x+sw,Y,W-sw,y-Y+hh*.59,c.g)+r(x+sw,y+hh*.59,W-sw,hh*.09,c.w)+r(x+sw,y+hh*.68,W-sw,Y+H-(y+hh*.68),c.r)+r(x,Y,sw,H,c.w);
    for(let i=0;i<5;i++)body+=`<path d="M${x+sw/2} ${y+hh*(.1+i*.2)-hh*.07}l${sw*.38} ${hh*.07}-${sw*.38} ${hh*.07}-${sw*.38}-${hh*.07}z" fill="${i%2?c.r:c.g}"/>`}
  else if(kind==='in'){const c=FL.in,cx=x+w/2+w*.02,cy=y+h/2,R=h*.15;
    body=r(x,Y,W,H,c.w)+r(x,Y,W,y-Y+h/6,c.g)+r(x,y+h*5/6,W,Y+H-(y+h*5/6),c.g)+`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${c.r}" stroke-width="${h*.045}"/>`;
    [-90,30,150].forEach(a=>{const t=a*Math.PI/180,x1=cx+Math.cos(t)*R,y1=cy+Math.sin(t)*R,x2=cx+Math.cos(t)*(R+h*.17),y2=cy+Math.sin(t)*(R+h*.17),x3=cx+Math.cos(t)*(R+h*.23),y3=cy+Math.sin(t)*(R+h*.23);
      body+=`<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${c.r}" stroke-width="${h*.04}" fill="none"/><circle cx="${x3}" cy="${y3}" r="${h*.05}" fill="none" stroke="${c.r}" stroke-width="${h*.035}"/>`})}
  else if(kind==='dg'){const c=FL.dg;body=r(x,Y,W,y-Y+h/3,c.g)+r(x,y+h/3,W,h/3,c.b)+r(x,y+h*2/3,W,Y+H-(y+h*2/3),c.r)}
  else if(kind==='kb'){const c=FL.kb,cx=x+w/2,cy=y+h/2,R=h*.2;
    body=r(x,Y,W,y-Y+h/3,c.b)+r(x,y+h/3,W,h/3,c.w)+r(x,y+h*2/3,W,Y+H-(y+h*2/3),c.g)+`<circle cx="${cx}" cy="${cy}" r="${R}" fill="${c.b}"/><path d="M${cx-R} ${cy}a${R} ${R} 0 0 0 ${2*R} 0z" fill="${c.g}"/><path d="M${cx-R*.7} ${cy+R*.05}l${R*.45}-${R*.7} ${R*.25} ${R*.3} ${R*.3}-${R*.4} ${R*.4} ${R*.8}z" fill="#fff"/>`}
  const vals=[wp(4),wp(-4),wp(4)].join(';'),d=dur||2.2;
  return `<linearGradient id="${id}s" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".3"/><stop offset=".22" stop-color="#fff" stop-opacity=".26"/><stop offset=".5" stop-color="#000" stop-opacity=".22"/><stop offset=".78" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity=".3"/><animateTransform attributeName="gradientTransform" type="translate" values="-.28 0;.28 0;-.28 0" dur="${d}s" repeatCount="indefinite"/></linearGradient>`
   +`<clipPath id="${id}"><path d="${wp(4)}"><animate attributeName="d" dur="${d}s" repeatCount="indefinite" values="${vals}" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1"/></path></clipPath>`
   +`<g clip-path="url(#${id})">${body}<rect x="${x}" y="${Y}" width="${w}" height="${H}" fill="url(#${id}s)"/></g>`;
}
// флаг на древке с золотым навершием
const gPole=(x,y1,y2)=>`<rect x="${x-.8}" y="${y1}" width="1.6" height="${y2-y1}" fill="url(#GU_au)"/><circle cx="${x}" cy="${y1-.6}" r="2.1" fill="url(#GU_au)"/>`;

// ---------- общие слои сцены ----------
const gRays=(u,op,n,dur,cx,cy)=>{let w='';for(let i=0;i<n;i++){const a=i*2*Math.PI/n,b=a+Math.PI/n*.5;w+=`<path d="M50 50L${50+95*Math.cos(a)} ${50+95*Math.sin(a)}L${50+95*Math.cos(b)} ${50+95*Math.sin(b)}Z"/>`}
  return `<g transform="translate(${(cx||50)-50} ${(cy||50)-50})" opacity="${op}" fill="url(#${u}ry)"><g><animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="${dur}s" repeatCount="indefinite"/>${w}</g></g>`};
const gAurora=u=>`<g filter="url(#${u}bl)" opacity=".6"><path d="M-10 26C20 6 40 36 70 14S110 26 110 18" stroke="url(#${u}ar)" stroke-width="8" fill="none"><animate attributeName="d" dur="9s" repeatCount="indefinite" values="M-10 26C20 6 40 36 70 14S110 26 110 18;M-10 20C20 32 44 8 70 24S110 12 110 26;M-10 26C20 6 40 36 70 14S110 26 110 18"/></path></g>`;
const gRange=(y,c,op,sn)=>`<path d="M0 ${y+16}L12 ${y+2}L22 ${y+10}L36 ${y-10}L50 ${y+8}L63 ${y-6}L78 ${y+9}L90 ${y-3}L100 ${y+6}V100H0Z" fill="${c}" opacity="${op}"/>`+(sn?`<path d="M36 ${y-10}l-5 8 3-1.600 2.600 3 2.600-3 3 1.600zM63 ${y-6}l-4.500 7 3-1.400 2.400 2.600 2.400-2.600 2.800 1.400z" fill="#fff" opacity="${op*.9}"/>`:'');
const gMoonG=(u,x,y,r)=>`<circle cx="${x}" cy="${y}" r="${r*2.2}" fill="#fff6c2" opacity=".22" filter="url(#${u}bl)"/><circle cx="${x}" cy="${y}" r="${r}" fill="#fffbe0"/><circle cx="${x-r*.3}" cy="${y-r*.2}" r="${r*.22}" fill="#e8e1b8" opacity=".6"/><circle cx="${x+r*.35}" cy="${y+r*.3}" r="${r*.15}" fill="#e8e1b8" opacity=".5"/>`;
const gEmbers=(x,y,n)=>Array.from({length:n},(_,i)=>{const dx=(i%2?1:-1)*(3+i*2.4),t=2.2+i*.5;return `<circle cx="${x+dx*.3}" cy="${y}" r="${.8+(i%3)*.3}" fill="#ffb347"><animate attributeName="cy" values="${y};${y-24-i*3}" dur="${t}s" repeatCount="indefinite" begin="${i*.35}s"/><animate attributeName="cx" values="${x+dx*.3};${x+dx}" dur="${t}s" repeatCount="indefinite" begin="${i*.35}s"/><animate attributeName="opacity" values="0;1;0" dur="${t}s" repeatCount="indefinite" begin="${i*.35}s"/></circle>`}).join('');
const gTorch=(x,y)=>`<rect x="${x-.7}" y="${y}" width="1.4" height="7" fill="#5a3a1a"/><g><path d="M${x} ${y-7}c3 3 4 5 3 8-1 1.600-4 1.600-5 0-1-3 1-5 2-8z" fill="#ff7a1a"><animate attributeName="d" dur=".7s" repeatCount="indefinite" values="M${x} ${y-7}c3 3 4 5 3 8-1 1.600-4 1.600-5 0-1-3 1-5 2-8z;M${x} ${y-9}c2 3 5 5 3 9-1 1.600-4 1.600-5 0-1-3 0-6 2-9z;M${x} ${y-7}c3 3 4 5 3 8-1 1.600-4 1.600-5 0-1-3 1-5 2-8z"/></path><path d="M${x} ${y-3}c1.600 1.600 2 2.600 1.400 4-.6.800-2.200.8-2.800 0-.6-1.400.4-2.400 1.400-4z" fill="#ffe08a"/></g><circle cx="${x}" cy="${y-2}" r="6" fill="#ff9a3c" opacity=".25" filter="url(#GU_bl)"/>`;
const gBlink=(x,y,s,d)=>`<path transform="translate(${x} ${y}) scale(${s})" d="M0-4L1-1 4 0 1 1 0 4-1 1-4 0-1-1z" fill="#fff"><animate attributeName="opacity" values="0;1;0" dur="2.2s" begin="${d}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" additive="sum" values="0 0;0 -1;0 0" dur="2.2s" begin="${d}s" repeatCount="indefinite"/></path>`;
const gSp=`${gBlink(16,26,1.2,0)}${gBlink(84,34,1,.7)}${gBlink(78,70,1.3,1.4)}${gBlink(20,64,.9,.4)}${gBlink(50,12,.8,1)}`;
const gStarsB=`<g fill="#fff">${[[14,12,.7],[30,7,.5],[46,16,.6],[66,10,.7],[88,18,.9],[8,34,.5],[93,46,.6],[72,26,.5]].map(([x,y,r],i)=>`<circle cx="${x}" cy="${y}" r="${r}"><animate attributeName="opacity" values=".2;1;.2" dur="${2+i*.37}s" repeatCount="indefinite"/></circle>`).join('')}</g>`;
const gMist=`<g opacity=".28" fill="#fff"><ellipse cx="30" cy="86" rx="34" ry="5"><animateTransform attributeName="transform" type="translate" values="-8 0;12 0;-8 0" dur="12s" repeatCount="indefinite"/></ellipse><ellipse cx="74" cy="90" rx="36" ry="4.500"><animateTransform attributeName="transform" type="translate" values="10 0;-12 0;10 0" dur="15s" repeatCount="indefinite"/></ellipse></g>`;
const gU=(s,u)=>s.split('GU_').join(u);

// ---------- башня ----------
function gTower2(u,kind,tall,mark){
  const top=tall?44:48,w0=tall?15:17,w1=tall?9:10.5,base=92,xl=50-w0,xr=50+w0,tl=50-w1,tr=50+w1;
  let st='';for(let i=0;i<9;i++){const k=i/9,y=base-(base-top-14)*k,hw=w0-(w0-w1)*(1-(y-top-14)/(base-top-14))*.0-(w0-w1)*k*.0;st+=`<path d="M${xl+(tl-xl)*k+.4} ${y}H${xr+(tr-xr)*k-.4}" stroke="#6f5d44" stroke-width=".6" opacity=".6"/>`}
  const win=[[tall?50:54,.0],[tall?72:74,1]].map(([y,d],i)=>`<rect x="${49.1}" y="${y}" width="1.8" height="4.2" rx=".9" fill="#ffc34d"><animate attributeName="opacity" values=".75;1;.6;1" dur="${1.8+i*.4}s" repeatCount="indefinite"/></rect>`).join('');
  const steps=tall?[[40,top-2,20],[42,top-5,16],[44,top-8,12],[46,top-11,8],[48,top-14,4]]:[[39.500,top-3,21],[42,top-6.500,16],[44.500,top-10,11],[47,top-13.500,6]];
  const roof=steps.map(([x,y,w])=>`<rect x="${x}" y="${y}" width="${w}" height="3.800" fill="#d9c7a3"/><rect x="${x}" y="${y+2.800}" width="${w}" height="1" fill="#8a7757"/>`).join('');
  const ty=steps[steps.length-1][1];
  return `${gStarsB}${gAurora(u)}${gRays(u,.16,10,70,50,34)}${gMoonG(u,80,19,7)}${gRange(60,'#0a1530',.9,true)}${gRange(70,'#06101f',.95)}`
   +`<defs><linearGradient id="${u}tw" x1="0" x2="1"><stop offset="0" stop-color="#f1e4c8"/><stop offset=".55" stop-color="#c2ad88"/><stop offset="1" stop-color="#7d6a4d"/></linearGradient></defs>`
   +`<path d="M${xl} ${base}L${tl} ${top}H${tr}L${xr} ${base}Z" fill="url(#${u}tw)"/>${st}`
   +`<rect x="${tl-2.4}" y="${top-.4}" width="${tr-tl+4.8}" height="3.400" rx=".8" fill="#9b8663"/>${[0,1,2,3,4].map(i=>`<rect x="${tl-1.6+i*((tr-tl+3.2)/4)-.7}" y="${top+2.800}" width="1.400" height="2" fill="#7d6a4d"/>`).join('')}`
   +`${win}<path d="M46 ${base}v-9a4 4 0 0 1 8 0v9z" fill="#2a1a0c"/><path d="M46.800 ${base}v-8.400a3.200 3.200 0 0 1 6.400 0v8.400z" fill="#ffb347" opacity=".55"><animate attributeName="opacity" values=".4;.7;.4" dur="2s" repeatCount="indefinite"/></path>`
   +(mark?`<g transform="translate(50 ${tall?61:62})" opacity=".85"><circle r="2.600" fill="none" stroke="#d62828" stroke-width="1.100"/>${[-90,30,150].map(a=>{const t=a*Math.PI/180;return `<path d="M${Math.cos(t)*2.600} ${Math.sin(t)*2.600}L${Math.cos(t)*5.200} ${Math.sin(t)*5.200}" stroke="#d62828" stroke-width="1"/><circle cx="${Math.cos(t)*6.400}" cy="${Math.sin(t)*6.400}" r="1.100" fill="none" stroke="#d62828" stroke-width=".8"/>`}).join('')}</g>`:'')
   +roof+`<rect x="${49.2}" y="${ty-20}" width="1.600" height="${20}" fill="url(#${u}au)"/><circle cx="50" cy="${ty-20.600}" r="2" fill="url(#${u}au)"/>`
   +giftFlag(u,kind,50.8,ty-19,32,19,2)
   +gTorch(30,86)+gTorch(70,86)+gMist+gEmbers(30,80,4)+gEmbers(70,80,4)+gSp;
}
// ---------- сцены ----------
const GART2={
  ch_tower:u=>gU(gTower2(u,'ch',false,false),u),
  in_tower:u=>gU(gTower2(u,'in',true,true),u),
  kb_elbrus:u=>`${gStarsB}${gAurora(u)}${gRays(u,.28,12,80,50,36)}<circle cx="50" cy="40" r="26" fill="#ffd27a" opacity=".22" filter="url(#${u}bl)"><animate attributeName="r" values="22;30;22" dur="5s" repeatCount="indefinite"/></circle>`
    +`<defs><linearGradient id="${u}el" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eaf2ff"/><stop offset=".4" stop-color="#7f9bd6"/><stop offset="1" stop-color="#1c2f5e"/></linearGradient></defs>`
    +`<path d="M-4 88L26 44l10 12 12-30 10 22 8-10 28 50z" fill="url(#${u}el)"/><path d="M26 44l-6 11 5-2 3 4 4-4 3 3z" fill="#fff"/><path d="M48 26l-8 20 5-3.500 4 5 4.500-5.500 6 4z" fill="#fff"/><path d="M48 26l5 11 7-10" stroke="#b7c7e8" stroke-width=".8" fill="none"/>`
    +`<path d="M36 56l-10 30h14zM58 48l-6 38h18z" fill="#12244b" opacity=".5"/>`
    +`<rect x="47.200" y="9" width="1.500" height="18" fill="url(#${u}au)"/><circle cx="47.900" cy="8.400" r="1.900" fill="url(#${u}au)"/>${giftFlag(u,'kb',48.600,10,28,17,2)}`
    +`<g fill="#fff" opacity=".7"><ellipse cx="22" cy="60" rx="18" ry="2.600"><animateTransform attributeName="transform" type="translate" values="-6 0;10 0;-6 0" dur="10s" repeatCount="indefinite"/></ellipse><ellipse cx="78" cy="68" rx="20" ry="2.800"><animateTransform attributeName="transform" type="translate" values="8 0;-10 0;8 0" dur="13s" repeatCount="indefinite"/></ellipse></g>`
    +`<path d="M0 90l22-12 18 8 24-12 36 14v12H0z" fill="#0a1530"/>${gMist}${gSp}`,
  in_sun:u=>`${gStarsB}${gRays(u,.5,14,40)}<circle cx="50" cy="50" r="40" fill="#fff" opacity=".12" filter="url(#${u}bl)"><animate attributeName="r" values="36;44;36" dur="4s" repeatCount="indefinite"/></circle>`
    +`<g><animateTransform attributeName="transform" type="rotate" from="0 50 50" to="-360 50 50" dur="60s" repeatCount="indefinite"/>${Array.from({length:24},(_,i)=>{const a=i*Math.PI/12;return `<circle cx="${50+Math.cos(a)*40}" cy="${50+Math.sin(a)*40}" r="${i%2?1.300:2}" fill="url(#${u}au)"/>`}).join('')}</g>`
    +`<circle cx="50" cy="50" r="35" fill="url(#${u}au)"/><circle cx="50" cy="50" r="32" fill="#0d1b16"/><circle cx="50" cy="50" r="30" fill="#fff"/>`
    +`<clipPath id="${u}sc"><circle cx="50" cy="50" r="30"/></clipPath><g clip-path="url(#${u}sc)"><rect x="20" y="20" width="60" height="10" fill="#1f9d55"/><rect x="20" y="70" width="60" height="10" fill="#1f9d55"/><rect x="20" y="20" width="60" height="60" fill="url(#${u}fs)" opacity=".5"/></g>`
    +`<g><animateTransform attributeName="transform" type="rotate" values="0 50 50;5 50 50;0 50 50;-5 50 50;0 50 50" dur="9s" repeatCount="indefinite"/><circle cx="50" cy="50" r="7" fill="none" stroke="#d62828" stroke-width="3"/>${[-90,30,150].map(a=>{const t=a*Math.PI/180,c=Math.cos(t),s=Math.sin(t);return `<path d="M${50+c*7} ${50+s*7}L${50+c*16} ${50+s*16}" stroke="#d62828" stroke-width="2.800" stroke-linecap="round"/><circle cx="${50+c*20.500}" cy="${50+s*20.500}" r="3.400" fill="none" stroke="#d62828" stroke-width="2.600"/>`}).join('')}</g>`
    +`<path d="M26 34a30 30 0 0 1 48 0" stroke="#fff" stroke-width="2" fill="none" opacity=".5"/>${gSp}`,
  ch_papakha:u=>`${gStarsB}${gRays(u,.4,12,50,50,48)}<ellipse cx="50" cy="86" rx="34" ry="7" fill="url(#${u}au)"/><ellipse cx="50" cy="84.500" rx="30" ry="5.500" fill="#2a0f12"/><ellipse cx="50" cy="84" rx="26" ry="4" fill="#7a1220"/><ellipse cx="50" cy="86" rx="38" ry="9" fill="#ffd27a" opacity=".25" filter="url(#${u}bl)"/>`
    +`<defs><radialGradient id="${u}fr" cx=".4" cy=".25"><stop offset="0" stop-color="#8a5a2f"/><stop offset=".6" stop-color="#4a2a14"/><stop offset="1" stop-color="#1e0f06"/></radialGradient></defs>`
    +`<path d="M22 80C18 52 26 24 50 22S82 52 78 80c-8 6-48 6-56 0z" fill="url(#${u}fr)"/>`
    +`<g stroke-linecap="round" fill="none">${Array.from({length:70},(_,i)=>{const a=(i*53)%100,b=(i*37)%58,x=24+a*.52,y=26+b,l=3+(i%4);const c=i%5===0?'#c08a52':i%3===0?'#2a1508':'#6e4524';return `<path d="M${x} ${y}q${(i%2?1:-1)*1.2} ${l*.6} ${(i%2?1:-1)*.4} ${l}" stroke="${c}" stroke-width="${.9+(i%3)*.2}" opacity=".8"/>`}).join('')}</g>`
    +`<path d="M30 40c6-10 18-14 28-10" stroke="#fff" stroke-width="2.200" fill="none" opacity=".16"/>`
    +`<path d="M22 72c10 8 46 8 56 0l.6 8c-10 8-47 8-57 0z" fill="#1a0c06"/>`
    +`<clipPath id="${u}bd"><path d="M22 70c10 8 46 8 56 0v6c-10 8-46 8-56 0z"/></clipPath><g clip-path="url(#${u}bd)"><rect x="20" y="64" width="62" height="5.500" fill="#1a9b3c"/><rect x="20" y="68.500" width="62" height="2.400" fill="#fff"/><rect x="20" y="70.500" width="62" height="6.500" fill="#d62828"/><rect x="20" y="64" width="62" height="14" fill="url(#${u}fs)" opacity=".8"/></g>`
    +`<path d="M22 72c10 8 46 8 56 0" stroke="url(#${u}au)" stroke-width="1.300" fill="none"/><path d="M22 76.500c10 8 46 8 56 0" stroke="url(#${u}au)" stroke-width="1" fill="none"/>`
    +`<g><circle cx="50" cy="74" r="4.400" fill="url(#${u}au)"/><circle cx="50" cy="74" r="2.500" fill="#d62828"><animate attributeName="fill" values="#d62828;#ff7a7a;#d62828" dur="2.400s" repeatCount="indefinite"/></circle></g>${gSp}`,
  cz_dagger:u=>`${gStarsB}${gRays(u,.45,12,45)}<circle cx="50" cy="50" r="30" fill="#fff" opacity=".12" filter="url(#${u}bl)"/>`
    +`<g transform="rotate(38 50 50)"><path d="M43 18h14l-1 52c0 6-3 10-6 10s-6-4-6-10z" fill="#3a1d12"/><path d="M43 18h14M43.600 70h12.800" stroke="url(#${u}au)" stroke-width="2.200"/><path d="M45 28h10M45 38h10M45 48h10M45.400 58h9.200" stroke="url(#${u}au)" stroke-width=".9" opacity=".8"/><circle cx="50" cy="82" r="3.200" fill="url(#${u}au)"/></g>`
    +`<g transform="rotate(-34 50 50)"><path d="M45 9h10l3 48H42z" fill="url(#${u}st)"/><path d="M50 9v48M47.200 14v40M52.800 14v40" stroke="#fff" stroke-width=".7" opacity=".5"/><path d="M45 9l5-6 5 6" fill="#f4f7fb"/>`
    +`<rect x="37" y="56" width="26" height="6" rx="3" fill="url(#${u}au)"/><circle cx="37" cy="59" r="2.400" fill="url(#${u}au)"/><circle cx="63" cy="59" r="2.400" fill="url(#${u}au)"/>`
    +`<path d="M44 62h12v18c0 4-2.500 6-6 6s-6-2-6-6z" fill="#2b1810"/><path d="M44.600 66h10.800M44.600 71h10.800M44.600 76h10.800" stroke="url(#${u}au)" stroke-width="1.300"/><circle cx="50" cy="90" r="3.800" fill="url(#${u}au)"/><circle cx="50" cy="59" r="2.300" fill="#e11d48"><animate attributeName="fill" values="#e11d48;#ff8aa0;#e11d48" dur="2s" repeatCount="indefinite"/></circle>`
    +`<clipPath id="${u}bl2"><path d="M45 9h10l3 48H42z"/></clipPath><g clip-path="url(#${u}bl2)"><rect x="30" y="6" width="14" height="56" fill="#fff" opacity=".7" transform="skewX(-22)"><animate attributeName="x" values="10;80;80" dur="3.400s" repeatCount="indefinite"/></rect></g></g>${gSp}`,
  dg_eagle:u=>`${gStarsB}${gRays(u,.3,12,70)}${giftFlag(u,'dg',8,14,84,52,2.800)}<rect x="7.200" y="12" width="1.600" height="82" fill="url(#${u}au)"/><circle cx="8" cy="11.400" r="2.100" fill="url(#${u}au)"/>`
    +`<circle cx="50" cy="48" r="34" fill="#ffd27a" opacity=".2" filter="url(#${u}bl)"><animate attributeName="opacity" values=".15;.3;.15" dur="4s" repeatCount="indefinite"/></circle>`
    +`<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -1.800;0 0" dur="3.200s" repeatCount="indefinite"/>`
    +[0,1].map(m=>`<g transform="${m?'translate(100 0) scale(-1 1)':''}">${[0,1,2,3,4,5,6].map(i=>{const a=(-24+i*13)*Math.PI/180,len=44-i*2.400,x2=47-Math.cos(a)*len,y2=44+Math.sin(a)*len*.9+i*1.600;return `<path d="M46 ${40+i*2.800}Q${(46+x2)/2} ${(40+y2)/2-6} ${x2} ${y2}Q${(46+x2)/2+3} ${(40+y2)/2+3} 46 ${46+i*3.200}Z" fill="${i%2?'#3a2412':'#2a180b'}" stroke="url(#${u}au)" stroke-width=".9"/>`}).join('')}</g>`).join('')
    +`<path d="M50 30c8 0 11 7 11 15v20c0 9-5 16-11 16S39 74 39 65V45c0-8 3-15 11-15z" fill="#3b2412" stroke="url(#${u}au)" stroke-width="1.200"/>`
    +`<path d="M43 52q7 5 14 0M43 58q7 5 14 0M44 64q6 5 12 0" stroke="url(#${u}au)" stroke-width="1" fill="none"/>`
    +`<path d="M50 80l-6 8M50 80l6 8" stroke="url(#${u}au)" stroke-width="2" stroke-linecap="round"/>`
    +`<circle cx="50" cy="31" r="8.500" fill="#4a2e18" stroke="url(#${u}au)" stroke-width="1"/><path d="M50 33l-4.500 6.500h9z" fill="url(#${u}au)"/><circle cx="46.200" cy="29.400" r="1.800" fill="#ffd23d"/><circle cx="53.800" cy="29.400" r="1.800" fill="#ffd23d"/><circle cx="46.200" cy="29.400" r=".8" fill="#000"/><circle cx="53.800" cy="29.400" r=".8" fill="#000"/><path d="M44 24l6 3 6-3" stroke="#2a180b" stroke-width="1.600" fill="none"/></g>${gSp}`,
  ch_wolf:u=>`${gStarsB}${gAurora(u)}${gMoonG(u,50,40,24)}${gRays(u,.2,10,90,50,40)}`
    +`<defs><linearGradient id="${u}wf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dfe6ef"/><stop offset=".5" stop-color="#8a96a8"/><stop offset="1" stop-color="#3e4757"/></linearGradient></defs>`
    +`<path d="M0 100V78l14-4 12 6 14-8 12 4 14-6 12 4 22-6v32z" fill="#070d1c"/>`
    +`<path d="M25 60L19 26l17 17zM75 60l6-34-17 17z" fill="#566072"/><path d="M26 54l-3-20 10 11zM74 54l3-20-10 11z" fill="#d7a9a9" opacity=".5"/>`
    +`<path d="M24 58c-2-18 10-27 26-27s28 9 26 27c-1 12-8 22-16 30L50 94 38 88c-8-8-13-18-14-30z" fill="url(#${u}wf)"/>`
    +`<path d="M50 31c16 0 28 9 26 27-1 12-8 22-16 30L50 94z" fill="#2c3442" opacity=".55"/>`
    +`<path d="M34 76c5 7 10 9 16 9s11-2 16-9l-3 14H37z" fill="#eef2f7"/><path d="M45 74l5 6 5-6z" fill="#0b0f18"/><path d="M50 80v8" stroke="#0b0f18" stroke-width="1.600"/>`
    +`<path d="M30 50l14 5-12 5zM70 50L56 55l12 5z" fill="#0b0f18"/>`
    +`<ellipse cx="38" cy="53.500" rx="3.800" ry="2.200" fill="#ffd23d"><animate attributeName="fill" values="#ffd23d;#fff6b0;#ffd23d" dur="2.200s" repeatCount="indefinite"/></ellipse><ellipse cx="62" cy="53.500" rx="3.800" ry="2.200" fill="#ffd23d"><animate attributeName="fill" values="#ffd23d;#fff6b0;#ffd23d" dur="2.200s" repeatCount="indefinite"/></ellipse>`
    +`<ellipse cx="38" cy="53.500" rx="7" ry="5" fill="#ffd23d" opacity=".3" filter="url(#${u}gw)"/><ellipse cx="62" cy="53.500" rx="7" ry="5" fill="#ffd23d" opacity=".3" filter="url(#${u}gw)"/>`
    +`<path d="M46 34l-2 14M50 33v15M54 34l2 14" stroke="#1a9b3c" stroke-width="2.400" stroke-linecap="round"/><path d="M41 37l-2 11M59 37l2 11" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M36 41l-2 9M64 41l2 9" stroke="#d62828" stroke-width="2" stroke-linecap="round"/>`
    +`<path d="M26 82c8 9 40 9 48 0" fill="none" stroke="#1a9b3c" stroke-width="4.500" stroke-linecap="round"/><path d="M26 86c8 8 40 8 48 0" fill="none" stroke="#fff" stroke-width="2.200" stroke-linecap="round"/><path d="M28 90c8 6 38 6 44 0" fill="none" stroke="#d62828" stroke-width="3" stroke-linecap="round"/>${gSp}`
};
// ---------- номерные знаки 95 (Чечня) и 06 (Ингушетия) ----------
function gPlate(u,reg,kind,letters,digits,suffix){
  const plate=`<g id="${u}pl"><rect x="5.600" y="36.400" width="88.800" height="26.200" rx="4.600" fill="url(#${u}au)"/><rect x="7" y="37.800" width="86" height="23.400" rx="3.400" fill="#fff"/><rect x="8.200" y="39" width="83.600" height="21" rx="2.600" fill="none" stroke="#10131a" stroke-width="1"/>`
    +`<text x="37" y="55.200" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="15" fill="#10131a" textLength="56" lengthAdjust="spacingAndGlyphs">${letters}<tspan>${digits}</tspan>${suffix}</text>`
    +`<path d="M71.500 39v21" stroke="#10131a" stroke-width="1"/><text x="82" y="52" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="13.500" fill="#10131a">${reg}</text>`
    +`<text x="79.500" y="58" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="3.600" fill="#10131a">RUS</text><rect x="83.500" y="55.400" width="5.600" height="1.200" fill="#fff" stroke="#10131a" stroke-width=".15"/><rect x="83.500" y="56.600" width="5.600" height="1.200" fill="#1c57a5"/><rect x="83.500" y="57.800" width="5.600" height="1.200" fill="#d62828"/>`
    +`<rect x="7" y="37.800" width="86" height="11" rx="3.400" fill="#fff" opacity=".5"/></g>`;
  return `${gStarsB}${gRays(u,.5,16,40,50,50)}`
   +`<text x="50" y="84" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="74" fill="none" stroke="url(#${u}au)" stroke-width="1" opacity=".3"><animate attributeName="opacity" values=".2;.42;.2" dur="3s" repeatCount="indefinite"/>${reg}</text>`
   +`<path d="M30 0h40l24 100H6z" fill="#fff" opacity=".08"/>`
   +giftFlag(u,kind,26,9,48,25,2.400)+`<rect x="25.200" y="7.400" width="1.500" height="33" fill="url(#${u}au)"/><circle cx="26" cy="6.800" r="2" fill="url(#${u}au)"/>`
   +`<defs>${plate}</defs>`
   +`<ellipse cx="50" cy="78" rx="40" ry="6" fill="#000" opacity=".4" filter="url(#${u}bl)"/>`
   +`<g transform="translate(0 28) scale(1 -1) translate(0 -99)" opacity=".16"><use href="#${u}pl"/></g>`
   +`<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -2.400;0 0" dur="3.400s" repeatCount="indefinite"/><use href="#${u}pl"/>`
   +`<clipPath id="${u}pc"><rect x="5.600" y="36.400" width="88.800" height="26.200" rx="4.600"/></clipPath><g clip-path="url(#${u}pc)"><rect x="-30" y="30" width="16" height="40" fill="#fff" opacity=".75" transform="skewX(-24)"><animate attributeName="x" values="0;130;130" dur="3.800s" repeatCount="indefinite"/></rect></g></g>`
   +`${gBlink(10,40,1.4,0)}${gBlink(90,58,1.2,.8)}${gBlink(50,70,1,1.5)}${gBlink(84,22,1,.4)}${gBlink(14,70,.9,1.1)}`;
}
GART2.plate95=u=>gPlate(u,'95','ch','К','095','КХ');
GART2.plate06=u=>gPlate(u,'06','in','И','006','ИН');
Object.assign(GART,GART2);
