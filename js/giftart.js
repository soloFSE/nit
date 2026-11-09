// Рисунки подарков (v5.0): анимированные SVG-сценки. Каждая — квадрат 100×100, рисуется поверх фона подарка.
// Развевающиеся флаги — анимация формы полотнища (SMIL), блики и искры — CSS/SMIL. Всё векторное: лёгкое и чёткое на любом экране.
// Коллекция «Кавказ» (coll='caucasus'): у неё своё «ночное/закатное» небо вместо случайного фона.
const GCOLL={caucasus:'Кавказ',classic:'Классика'};
const GSKY=[['#0b1d3a','#2563eb'],['#2a1245','#be185d'],['#7c2d12','#f59e0b']]; // ночь, закат, рассвет
// Цвета флагов
const FL={ch:{g:'#1a9b3c',w:'#fff',r:'#d62828'},dg:{g:'#1f9d55',b:'#1f6fd1',r:'#d62828'},os:{w:'#fff',r:'#c8102e',y:'#ffd100'},kb:{b:'#4aa3df',w:'#fff',g:'#2e9b4e'},in:{w:'#fff',g:'#1f9d55',r:'#d62828'}};

// Развевающийся флаг в рамке x,y,w,h. kind — какой флаг.
function giftFlag(u,kind,x,y,w,h,dur){
  const wp=a=>`M${x} ${y}C${x+w/3} ${y-a} ${x+2*w/3} ${y+a} ${x+w} ${y}L${x+w} ${y+h}C${x+2*w/3} ${y+h+a} ${x+w/3} ${y+h-a} ${x} ${y+h}Z`;
  const id=u+'f'+kind+Math.round(x+y),X=x,Y=y-8,W=w,H=h+16,r=(a,b,c,d,f)=>`<rect x="${a}" y="${b}" width="${c}" height="${d}" fill="${f}"/>`;
  let body='';
  if(kind==='ch'){const sw=w*.1,c=FL.ch,gh=H*0,top=y,hh=h;
    body=r(x+sw,Y,W-sw,top-Y+hh*.59,c.g)+r(x+sw,top+hh*.59,W-sw,hh*.09,c.w)+r(x+sw,top+hh*.68,W-sw,Y+H-(top+hh*.68),c.r)+r(x,Y,sw,H,c.w);
    for(let i=0;i<5;i++)body+=`<path d="M${x+sw/2} ${y+hh*(.1+i*.2)-hh*.07}l${sw*.38} ${hh*.07}-${sw*.38} ${hh*.07}-${sw*.38}-${hh*.07}z" fill="${i%2?c.r:c.g}"/>`}
  else if(kind==='in'){const c=FL.in,cx=x+w/2+w*.02,cy=y+h/2,R=h*.15;
    body=r(x,Y,W,H,c.w)+r(x,Y,W,y-Y+h/6,c.g)+r(x,y+h*5/6,W,Y+H-(y+h*5/6),c.g)+`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${c.r}" stroke-width="${h*.045}"/>`;
    [-90,30,150].forEach(a=>{const t=a*Math.PI/180,x1=cx+Math.cos(t)*R,y1=cy+Math.sin(t)*R,x2=cx+Math.cos(t)*(R+h*.17),y2=cy+Math.sin(t)*(R+h*.17),x3=cx+Math.cos(t)*(R+h*.23),y3=cy+Math.sin(t)*(R+h*.23);
      body+=`<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${c.r}" stroke-width="${h*.04}" fill="none"/><circle cx="${x3}" cy="${y3}" r="${h*.05}" fill="none" stroke="${c.r}" stroke-width="${h*.035}"/>`})}
  else if(kind==='dg'){const c=FL.dg;body=r(x,Y,W,y-Y+h/3,c.g)+r(x,y+h/3,W,h/3,c.b)+r(x,y+h*2/3,W,Y+H-(y+h*2/3),c.r)}
  else if(kind==='os'){const c=FL.os;body=r(x,Y,W,y-Y+h/3,c.w)+r(x,y+h/3,W,h/3,c.r)+r(x,y+h*2/3,W,Y+H-(y+h*2/3),c.y)}
  else if(kind==='kb'){const c=FL.kb,cx=x+w/2,cy=y+h/2,R=h*.2;
    body=r(x,Y,W,y-Y+h/3,c.b)+r(x,y+h/3,W,h/3,c.w)+r(x,y+h*2/3,W,Y+H-(y+h*2/3),c.g)+`<circle cx="${cx}" cy="${cy}" r="${R}" fill="${c.b}"/><path d="M${cx-R} ${cy}a${R} ${R} 0 0 0 ${2*R} 0z" fill="${c.g}"/><path d="M${cx-R*.7} ${cy+R*.05}l${R*.45}-${R*.7} ${R*.25} ${R*.3} ${R*.3}-${R*.4} ${R*.4} ${R*.8}z" fill="#fff"/>`}
  const vals=[wp(4),wp(-4),wp(4)].join(';');
  return `<clipPath id="${id}"><path d="${wp(4)}"><animate attributeName="d" dur="${dur||2.2}s" repeatCount="indefinite" values="${vals}" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1"/></path></clipPath>`
   +`<g clip-path="url(#${id})">${body}<rect x="${x}" y="${Y}" width="${w}" height="${H}" fill="url(#${u}fs)"/></g>`;
}
// Общие определения: затенение полотнища, блики
var giftDefs=u=>`<linearGradient id="${u}fs" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".25"/><stop offset=".2" stop-color="#fff" stop-opacity=".18"/><stop offset=".45" stop-color="#000" stop-opacity=".16"/><stop offset=".7" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>`
 +`<linearGradient id="${u}au" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2a8"/><stop offset=".5" stop-color="#f5b52b"/><stop offset="1" stop-color="#b8650c"/></linearGradient>`
 +`<linearGradient id="${u}st" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8dee9"/><stop offset=".5" stop-color="#8d99ae"/><stop offset="1" stop-color="#4a5568"/></linearGradient>`;
const gSpark=(x,y,s,d)=>`<path transform="translate(${x} ${y}) scale(${s})" d="M0-3L.8-.8 3 0 .8.8 0 3-.8.8-3 0-.8-.8z" fill="#fff"><animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="${d}s" repeatCount="indefinite"/></path>`;
const gSparks=`${gSpark(18,24,1.2,0)}${gSpark(82,30,1,.8)}${gSpark(74,72,1.3,1.5)}${gSpark(24,68,.9,.4)}`;
const gStars=`<g fill="#fff">${[[16,14,.8],[34,9,.6],[66,12,.7],[86,20,.9],[10,34,.6],[90,44,.6]].map(([x,y,r],i)=>`<circle cx="${x}" cy="${y}" r="${r}"><animate attributeName="opacity" values=".2;1;.2" dur="${2+i*.4}s" repeatCount="indefinite"/></circle>`).join('')}</g>`;
const gMoon=`<circle cx="80" cy="20" r="8" fill="#fef9c3" opacity=".92"/><circle cx="84" cy="18" r="7" fill="var(--gk,#0b1d3a)" opacity=".0"/>`;
const gMount=c=>`<path d="M0 84L18 58l10 12 16-24 18 30 12-14 26 22v16H0z" fill="${c}" opacity=".55"/><path d="M0 92l22-18 14 10 20-22 22 24 22-12v26H0z" fill="${c}" opacity=".85"/>`;

// Башня (вайнахская боевая башня) с флагом
function giftTower(u,kind,roof){
  const base='#c9b79c',dark='#8b7a62';let st='';
  for(let i=0;i<7;i++){const y=88-i*7.4,l=33+i*1.15,rr=67-i*1.15;st+=`<path d="M${l} ${y}H${rr}" stroke="${dark}" stroke-width=".7" opacity=".7"/>`}
  const win=[[48,70],[50,56],[49,44]].map(([x,y])=>`<rect x="${x-1.5}" y="${y}" width="3" height="5" rx="1.2" fill="#3b2a1a"/>`).join('');
  const steps=roof?[[40,42,20],[42,38,16],[44,34,12],[46.5,30,7]]:[[38.5,41,23],[41,36,18],[44,31,12],[47,27,6]];
  const rf=steps.map(([x,y,w])=>`<rect x="${x}" y="${y}" width="${w}" height="4.6" fill="${base}"/><rect x="${x}" y="${y+3.6}" width="${w}" height="1" fill="${dark}"/>`).join('');
  return `${gStars}${gMoon}${gMount('#0a1226')}`
   +`<path d="M34 90L40 42H60L66 90z" fill="${base}"/><path d="M34 90L40 42H47L43 90z" fill="#fff" opacity=".18"/><path d="M58 42H60L66 90H60z" fill="#000" opacity=".22"/>${st}${win}${rf}`
   +`<rect x="49.2" y="9" width="1.6" height="22" fill="#e5e7eb"/><circle cx="50" cy="8.4" r="1.8" fill="#fde047"/>${giftFlag(u,kind,50.8,11,32,20)}`
   +`<ellipse cx="50" cy="91" rx="24" ry="3" fill="#000" opacity=".3"/>${gSparks}`;
}
const GART={
  // ---- Кавказ ----
  ch_tower:u=>giftTower(u,'ch',false),
  in_tower:u=>giftTower(u,'in',true),
  kb_elbrus:u=>`${gStars}<circle cx="50" cy="52" r="30" fill="#fff" opacity=".1"><animate attributeName="r" values="28;34;28" dur="4s" repeatCount="indefinite"/></circle>`
    +`<path d="M6 86L34 40l10 12 8-24 16 30 6-8 20 36z" fill="#243b6b"/><path d="M12 86L36 46l14 20z" fill="#35508a" opacity=".6"/>`
    +`<path d="M34 40l-7 12 5-3 4 5 4-5 2 3-8-12z" fill="#fff"/><path d="M52 28l-9 22 6-4 5 6 5-6 7 4-14-22z" fill="#fff"/>`
    +`<path d="M52 28l7 13 7-9" fill="none" stroke="#cbd5e1" stroke-width=".8"/><rect x="51.4" y="12" width="1.4" height="17" fill="#e5e7eb"/>${giftFlag(u,'kb',52.4,13,26,16)}`
    +`<path d="M0 90l24-10 16 8 22-12 38 14v10H0z" fill="#10213f"/>${gSparks}`,
  in_sun:u=>`${gStars}<g><animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="30s" repeatCount="indefinite"/><circle cx="50" cy="50" r="40" fill="none" stroke="#fff" stroke-width=".6" stroke-dasharray="2 5" opacity=".6"/></g>`
    +`<circle cx="50" cy="50" r="30" fill="#fff" opacity=".95"/><rect x="20" y="20" width="60" height="9" fill="${FL.in.g}" opacity=".0"/>`
    +`<g><animateTransform attributeName="transform" type="rotate" values="0 50 52;6 50 52;0 50 52;-6 50 52;0 50 52" dur="8s" repeatCount="indefinite"/>`
    +`<circle cx="50" cy="52" r="10" fill="none" stroke="${FL.in.r}" stroke-width="4"/>${[-90,30,150].map(a=>{const t=a*Math.PI/180,c=Math.cos(t),s=Math.sin(t);return `<path d="M${50+c*10} ${52+s*10}L${50+c*21} ${52+s*21}" stroke="${FL.in.r}" stroke-width="3.4" stroke-linecap="round"/><circle cx="${50+c*27}" cy="${52+s*27}" r="4.2" fill="none" stroke="${FL.in.r}" stroke-width="3"/>`}).join('')}</g>`
    +`<path d="M22 28h56" stroke="${FL.in.g}" stroke-width="5" opacity=".0"/>${gSparks}`,
  ch_papakha:u=>`${gStars}${gMount('#0a1226')}<ellipse cx="50" cy="86" rx="28" ry="4" fill="#000" opacity=".3"/>`
    +`<path d="M24 80C20 52 28 30 50 28s30 24 26 52c-8 6-44 6-52 0z" fill="#4a2c17"/><path d="M24 80C20 52 28 30 50 28" fill="none" stroke="#7c4a24" stroke-width="3" opacity=".7"/>`
    +`<g stroke="#2a170b" stroke-width="1.2" stroke-linecap="round" opacity=".7">${Array.from({length:22},(_,i)=>{const a=(i*37)%60,b=(i*53)%48;return `<path d="M${26+a*.85} ${34+b*.9}l1.8 4.2"/>`}).join('')}</g>`
    +`<path d="M25 74c8 7 42 7 50 0v8c-10 6-40 6-50 0z" fill="#2a170b"/><rect x="30" y="66" width="40" height="3" rx="1.5" fill="${FL.ch.g}"/><rect x="30" y="69" width="40" height="2" fill="#fff"/><rect x="30" y="71" width="40" height="2.6" rx="1.2" fill="${FL.ch.r}"/>`
    +`<path d="M44 40c4-6 14-6 18 0" fill="none" stroke="#fff" stroke-width="1.6" opacity=".25"/>${giftFlag(u,'ch',50,14,24,15,1.9)}<rect x="49" y="12" width="1.4" height="20" fill="#e5e7eb"/>${gSparks}`,
  cz_dagger:u=>`${gStars}<g transform="rotate(-38 50 50)">`
    +`<path d="M46 12h8l3 46h-14z" fill="url(#${u}st)"/><path d="M50 12v46" stroke="#fff" stroke-width="1.2" opacity=".55"/><path d="M46 12l4-6 4 6" fill="#e5e7eb"/>`
    +`<rect x="38" y="57" width="24" height="5" rx="2.5" fill="url(#${u}au)"/><path d="M44 62h12v20c0 3-2 5-6 5s-6-2-6-5z" fill="#3b2a1a"/>`
    +`<path d="M44 66h12M44 72h12M44 78h12" stroke="url(#${u}au)" stroke-width="1.6"/><circle cx="50" cy="88" r="4.2" fill="url(#${u}au)"/><circle cx="50" cy="59.5" r="2" fill="#e11d48"/>`
    +`<rect x="36" y="14" width="30" height="8" fill="#fff" opacity=".55" transform="skewX(-25)"><animate attributeName="x" values="-10;70;70" dur="3.2s" repeatCount="indefinite"/></rect></g>${gSparks}`,
  os_pie:u=>`${gStars}<ellipse cx="50" cy="82" rx="32" ry="5" fill="#000" opacity=".3"/>`
    +[[50,68,28,0],[34,56,22,1],[68,52,22,2]].map(([x,y,r,i])=>`<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -1.6;0 0" dur="${2.6+i*.5}s" repeatCount="indefinite"/><ellipse cx="${x}" cy="${y+3}" rx="${r}" ry="${r*.34}" fill="#a35a1b"/><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r*.34}" fill="#e8a54b"/><ellipse cx="${x}" cy="${y-1}" rx="${r*.8}" ry="${r*.24}" fill="#f6c878"/><path d="M${x-r*.5} ${y}l${r}0M${x-r*.35} ${y-2.4}l${r*.7} 4.8M${x-r*.35} ${y+2.4}l${r*.7}-4.8" stroke="#a35a1b" stroke-width=".8" opacity=".6"/></g>`).join('')
    +`<g opacity=".7">${[[40,36],[52,32],[62,34]].map(([x,y],i)=>`<path d="M${x} ${y}c-3-4 3-6 0-10" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"><animate attributeName="opacity" values="0;.9;0" dur="2.4s" begin="${i*.5}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 4;0 -6" dur="2.4s" begin="${i*.5}s" repeatCount="indefinite"/></path>`).join('')}</g>`
    +`<rect x="78" y="16" width="1.2" height="22" fill="#e5e7eb"/>${giftFlag(u,'os',79,17,16,10)}${gSparks}`,
  dg_eagle:u=>`${giftFlag(u,'dg',10,16,80,52,2.6)}<rect x="9" y="14" width="1.6" height="78" fill="#e5e7eb"/>`
    +`<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -2;0 0" dur="3s" repeatCount="indefinite"/>`
    +`<path d="M50 40C40 34 24 36 10 50c10-2 18 0 24 6-8 0-14 4-18 10 10-2 18 0 26 4z" fill="#2a1a0e"/><path d="M50 40C60 34 76 36 90 50c-10-2-18 0-24 6 8 0 14 4 18 10-10-2-18 0-26 4z" fill="#2a1a0e"/>`
    +`<path d="M50 40C40 34 24 36 10 50c10-2 18 0 24 6" fill="none" stroke="#f5b52b" stroke-width="1.4"/><path d="M50 40C60 34 76 36 90 50c-10-2-18 0-24 6" fill="none" stroke="#f5b52b" stroke-width="1.4"/>`
    +`<path d="M50 34c6 0 9 5 9 12v22c0 8-4 14-9 14s-9-6-9-14V46c0-7 3-12 9-12z" fill="#3b2a1a"/><circle cx="50" cy="35" r="7" fill="#4a3320"/>`
    +`<path d="M50 38l-3 5h6z" fill="url(#${u}au)"/><circle cx="47.2" cy="34.4" r="1.4" fill="#fde047"/><circle cx="52.8" cy="34.4" r="1.4" fill="#fde047"/><path d="M45 52h10M45 58h10M46 64h8" stroke="#f5b52b" stroke-width="1.2" opacity=".8"/></g>${gSparks}`,
  ch_wolf:u=>`${gStars}${gMoon}<circle cx="50" cy="52" r="34" fill="#fff" opacity=".08"><animate attributeName="r" values="32;37;32" dur="3.6s" repeatCount="indefinite"/></circle>`
    +`<path d="M22 20l10 22-4 10z" fill="#5b6472"/><path d="M78 20L68 42l4 10z" fill="#5b6472"/><path d="M25 25l6 14-3 6z" fill="#9aa4b2"/><path d="M75 25l-6 14 3 6z" fill="#9aa4b2"/>`
    +`<path d="M28 52c0-14 10-22 22-22s22 8 22 22c0 10-4 18-10 24l-12 12-12-12c-6-6-10-14-10-24z" fill="#7b8696"/><path d="M50 30c12 0 22 8 22 22 0 10-4 18-10 24L50 88V30z" fill="#566070"/>`
    +`<path d="M38 66c4 4 8 6 12 6s8-2 12-6l-5 14h-14z" fill="#d7dde6"/><path d="M46 72h8l-4 6z" fill="#111827"/>`
    +`<path d="M31 46l12 4-10 6z" fill="#111827"/><path d="M69 46L57 50l10 6z" fill="#111827"/>`
    +`<ellipse cx="38" cy="50" rx="3.2" ry="2" fill="#fde047"><animate attributeName="fill" values="#fde047;#fff7b0;#fde047" dur="2s" repeatCount="indefinite"/></ellipse><ellipse cx="62" cy="50" rx="3.2" ry="2" fill="#fde047"><animate attributeName="fill" values="#fde047;#fff7b0;#fde047" dur="2s" repeatCount="indefinite"/></ellipse>`
    +`<path d="M44 34l3 12M56 34l-3 12" stroke="${FL.ch.g}" stroke-width="2.4" stroke-linecap="round"/><path d="M50 32v14" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M41 36l2 10M59 36l-2 10" stroke="${FL.ch.r}" stroke-width="2" stroke-linecap="round"/>`
    +`<path d="M30 82c10 8 30 8 40 0" fill="none" stroke="${FL.ch.g}" stroke-width="3.2" stroke-linecap="round"/>${gSparks}`,
  // ---- Классика ----
  heart:u=>`<g class="ga-pulse"><path d="M50 82C16 60 14 34 30 27c9-4 16 1 20 9 4-8 11-13 20-9 16 7 14 33-20 55z" fill="#000" opacity=".2" transform="translate(1.5 3)"/><path d="M50 80C17 59 15 34 30 27c9-4 16 1 20 9 4-8 11-13 20-9 15 7 13 32-20 53z" fill="url(#${u}hr)"/><path d="M30 33c4-3 9-1 12 5" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".6"/></g>${gSparks}<defs><linearGradient id="${u}hr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8aa0"/><stop offset="1" stop-color="#e11d48"/></linearGradient></defs>`,
  flame:u=>`<g class="ga-flick"><path d="M50 12c8 18 26 26 24 48-1 15-11 24-24 24S26 75 26 60c0-11 7-16 11-25 4 7 7 9 9 9 3-13-2-23 4-32z" fill="url(#${u}fl)"/><path d="M50 40c5 10 15 14 14 28-1 9-6 14-14 14s-13-5-13-13c0-7 4-10 7-16 2 4 4 5 6 5 2-7-1-12 0-18z" fill="#fde047"/><path d="M50 60c3 5 7 7 6 14-1 4-3 6-6 6s-6-2-6-6c0-4 3-6 4-9 1 2 2 2 2 2z" fill="#fff7ae"/></g>${gSparks}<defs><linearGradient id="${u}fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fb923c"/><stop offset="1" stop-color="#dc2626"/></linearGradient></defs>`,
  star:u=>`<g class="ga-spin"><path d="M50 12l11.5 23.6 26 3.8-18.8 18.3 4.4 25.9L50 71.2 26.9 83.6l4.4-25.9L12.5 39.4l26-3.8z" fill="url(#${u}au)" stroke="#fff6bf" stroke-width="2" stroke-linejoin="round"/><path d="M50 22l7 15 16 2.4-11.6 11.300" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".6"/></g>${gSparks}`,
  shield:u=>`<g class="ga-float"><path d="M50 12l30 9v23c0 20-13 32-30 40C33 76 20 64 20 44V21z" fill="url(#${u}sh)" stroke="#e2e8f0" stroke-width="2.4"/><path d="M50 20l22 6.600v17.400c0 15-10 24-22 30z" fill="#fff" opacity=".18"/><path d="M36 48l10 10 20-22" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g>${gSparks}<defs><linearGradient id="${u}sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#60a5fa"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient></defs>`,
  rocket:u=>`<g class="ga-fly"><path d="M50 10c11 11 15 26 13 42H37c-2-16 2-31 13-42z" fill="url(#${u}rk)"/><path d="M37 46l-12 14 3 8 11-6zM63 46l12 14-3 8-11-6z" fill="#ef4444"/><circle cx="50" cy="34" r="6.4" fill="#1e3a8a" stroke="#e5e7eb" stroke-width="2"/><circle cx="48" cy="32" r="2" fill="#93c5fd"/>`
    +`<path d="M42 54h16l-3 8H45z" fill="#94a3b8"/><path d="M44 62c3 12 9 12 12 0z" fill="#fbbf24"><animate attributeName="d" values="M44 62c3 12 9 12 12 0z;M44 62c3 20 9 20 12 0z;M44 62c3 12 9 12 12 0z" dur=".5s" repeatCount="indefinite"/></path></g>${gSparks}<defs><linearGradient id="${u}rk" x1="0" x2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#cbd5e1"/></linearGradient></defs>`,
  bug:u=>`<g class="ga-wig"><path d="M30 46L14 38M30 56L12 58M32 66L18 78M70 46l16-8M70 56l18 2M68 66l14 12" stroke="#14532d" stroke-width="3.2" stroke-linecap="round"/><ellipse cx="50" cy="60" rx="21" ry="24" fill="url(#${u}bg)"/><path d="M50 36v48" stroke="#052e16" stroke-width="2"/><circle cx="40" cy="54" r="4" fill="#052e16"/><circle cx="60" cy="54" r="4" fill="#052e16"/><circle cx="42" cy="70" r="3.4" fill="#052e16"/><circle cx="58" cy="70" r="3.4" fill="#052e16"/>`
    +`<circle cx="50" cy="32" r="10" fill="#14532d"/><circle cx="46" cy="30" r="2.6" fill="#fff"/><circle cx="54" cy="30" r="2.6" fill="#fff"/><circle cx="46.6" cy="30.4" r="1.1" fill="#000"/><circle cx="54.6" cy="30.4" r="1.1" fill="#000"/><path d="M44 24Q38 14 32 16M56 24Q62 14 68 16" stroke="#14532d" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>${gSparks}<defs><radialGradient id="${u}bg" cx=".35" cy=".3"><stop offset="0" stop-color="#86efac"/><stop offset="1" stop-color="#16a34a"/></radialGradient></defs>`,
  crown:u=>`<g class="ga-float"><path d="M20 70L15 34l20 17 15-25 15 25 20-17-5 36z" fill="url(#${u}au)" stroke="#fff3b0" stroke-width="1.6" stroke-linejoin="round"/><rect x="20" y="70" width="60" height="9" rx="3" fill="url(#${u}au)" stroke="#fff3b0" stroke-width="1.6"/>`
    +`<circle cx="50" cy="55" r="5" fill="#e11d48"/><circle cx="32" cy="59" r="3.4" fill="#2563eb"/><circle cx="68" cy="59" r="3.4" fill="#16a34a"/><circle cx="15" cy="33" r="3.2" fill="#fde047"/><circle cx="50" cy="25" r="3.2" fill="#fde047"/><circle cx="85" cy="33" r="3.2" fill="#fde047"/>`
    +`<path d="M26 74h48" stroke="#fff" stroke-width="1.4" opacity=".6"/></g>${gSparks}`
};
const GCLASSIC=new Set(['yarn1','yarn2','gold','diamond','legend','heart','flame','bug','star','shield','rocket','crown']);
const giftColl=t=>(typeof giftCat!=='undefined'&&giftCat[t]?.coll)||(GCLASSIC.has(t)?'classic':(GART[t]?'caucasus':'classic'));
const giftIsScene=t=>GCOLL[giftColl(t)]==='Кавказ';
