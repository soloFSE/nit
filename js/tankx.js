// «Танки» v5.0: классы танков, карты (расстановка стен), местность и погода. Подключается перед tanks.js.
//  • Класс выбирает каждый игрок в лобби: Лёгкий (быстрый, мало брони, слабый урон), Обычный, Тяжёлый (медленный, мощный и крепкий)
//    или «Свой» — 12 очков делим между скоростью, скорострельностью, бронёй и уроном.
//  • Хозяин комнаты выбирает расстановку стен (карту), местность и погоду. Туман и ночь ограничивают обзор, песчаная буря сносит пули ветром.
const TK_CL={
  normal:{n:'Обычный',spd:1,rel:1,hp:100,dmg:25,sz:1,d:'Баланс скорости и брони'},
  light:{n:'Лёгкий',spd:1.22,rel:.68,hp:70,dmg:15,sz:.88,d:'Быстрый и скорострельный, но хрупкий и слабый урон'},
  heavy:{n:'Тяжёлый',spd:.8,rel:1.5,hp:150,dmg:35,sz:1.16,d:'Медленный, зато крепкий и бьёт сильно'}
};
const TK_CUS=[['spd','Скорость'],['rel','Скорострельность'],['hp','Броня'],['dmg','Урон']],TK_CUS_MAX=12;
function tkClassOf(c){
  if(c&&c.k==='custom'&&Array.isArray(c.p)){
    let [s,r,h,d]=c.p.map(v=>Math.max(0,Math.min(6,v|0)));if(s+r+h+d>TK_CUS_MAX)s=r=h=d=3;
    return {k:'custom',n:'Свой',spd:+(.78+.07*s).toFixed(2),rel:+(1.5-.13*r).toFixed(2),hp:Math.round(70+h*13.3),dmg:Math.round(14+d*3.5),sz:+(1+(h-3)*.03).toFixed(2)};
  }
  const k=c&&TK_CL[c.k]?c.k:'normal';return {k,...TK_CL[k]};
}
function tkLoadCl(){try{const c=JSON.parse(localStorage.getItem('nit-tk-class'));if(c&&(TK_CL[c.k]||c.k==='custom'))return c}catch{}return {k:'normal'}}
function tkSaveCl(c){try{localStorage.setItem('nit-tk-class',JSON.stringify(c))}catch{}}

const TK_LAY={classic:'Классика',open:'Простор',maze:'Лабиринт',fort:'Крепость'};
// Местность: цвета земли и стен, вид украшений
const TK_TH={
  grass:{n:'Луга',bg:['#2c3a2a','#34452f','#2a3828'],wall:['#4b5563','#6b7280'],dec:'grass'},
  desert:{n:'Пустыня',bg:['#a8844a','#b9955a','#9c7a43'],wall:['#7a5c36','#9c7a4d'],dec:'dune'},
  snow:{n:'Зима',bg:['#b9c9da','#cfdcea','#b4c4d6'],wall:['#6f84a0','#93a8c0'],dec:'ice'},
  lava:{n:'Вулкан',bg:['#2a1410','#3b1b13','#26110d'],wall:['#3b2a26','#5c3f37'],dec:'ember'},
  city:{n:'Город',bg:['#2f3540','#383f4c','#2b313b'],wall:['#475569','#64748b'],dec:'crack'},
  mount:{n:'Горы',bg:['#3a4733','#455540','#37442f'],wall:['#6b6258','#8c8274'],dec:'rock'}
};
// Погода. vis — радиус обзора в пикселях карты (дальше врагов не видно); wind — снос пуль, пикс/с
const TK_WX={clear:{n:'Ясно'},rain:{n:'Дождь'},snow:{n:'Снегопад'},fog:{n:'Туман',vis:560},night:{n:'Ночь',vis:700},storm:{n:'Песчаная буря',wind:[85,0]}};

// Карта: стены 4-кратно симметричны (честно для всех); lay меняет число и размер стен
function tkMapLay(code,lay){
  const r=tkRng(tkHash(code+lay)),W=TK.W,H=TK.H,walls=[],base=[];
  const cfg={classic:[11,90,170,70,150],open:[5,110,150,90,120],maze:[17,70,140,50,110],fort:[7,80,150,70,130]}[lay]||[11,90,170,70,150];
  for(let i=0,tries=0;i<cfg[0]&&tries<300;tries++){
    const w=cfg[1]+r()*cfg[2],h=cfg[3]+r()*cfg[4],x=300+r()*(W/2-300-w-60),y=240+r()*(H/2-240-h-60);
    if(base.some(b=>x<b.x+b.w+(lay==='maze'?60:90)&&x+w>b.x-(lay==='maze'?60:90)&&y<b.y+b.h+(lay==='maze'?60:90)&&y+h>b.y-(lay==='maze'?60:90)))continue;base.push({x,y,w,h});i++;
  }
  base.forEach(b=>{walls.push(b,{x:W-b.x-b.w,y:b.y,w:b.w,h:b.h},{x:b.x,y:H-b.y-b.h,w:b.w,h:b.h},{x:W-b.x-b.w,y:H-b.y-b.h,w:b.w,h:b.h})});
  if(lay==='fort'){ // кольцо стен вокруг центра с четырьмя проходами
    const cx=W/2,cy=H/2,a=330,b=250,t=44,g=130;
    walls.push({x:cx-a,y:cy-b,w:a-g/2,h:t},{x:cx+g/2,y:cy-b,w:a-g/2,h:t},{x:cx-a,y:cy+b-t,w:a-g/2,h:t},{x:cx+g/2,y:cy+b-t,w:a-g/2,h:t},
      {x:cx-a,y:cy-b,w:t,h:b-g/2},{x:cx-a,y:cy+g/2,w:t,h:b-g/2},{x:cx+a-t,y:cy-b,w:t,h:b-g/2},{x:cx+a-t,y:cy+g/2,w:t,h:b-g/2});
  }else walls.push({x:W/2-80,y:H/2-24,w:160,h:48},{x:W/2-24,y:H/2-110,w:48,h:220});
  const ok=walls.filter(w=>!TK_SP.some(([sx,sy])=>sx>w.x-120&&sx<w.x+w.w+120&&sy>w.y-120&&sy<w.y+w.h+120));
  const decor=[];for(let i=0;i<150;i++){const x=r()*W,y=r()*H;if(ok.some(w=>x>w.x-20&&x<w.x+w.w+20&&y>w.y-20&&y<w.y+w.h+20))continue;decor.push({x,y,k:r()<.7?0:1,s:.6+r()*.8,a:r()*6})}
  return {walls:ok,decor};
}
// Украшения земли под выбранную местность
function tkDecor(g,d,TH){
  const k=TH.dec;
  if(k==='grass'||k==='mount'){
    if(d.k===0){g.strokeStyle=k==='mount'?'rgba(150,160,120,.5)':'rgba(120,160,90,.55)';g.lineWidth=2;g.beginPath();for(let i=-1;i<=1;i++){g.moveTo(d.x+i*5*d.s,d.y);g.lineTo(d.x+i*8*d.s,d.y-12*d.s)}g.stroke()}
    else{g.fillStyle='rgba(0,0,0,.18)';g.beginPath();g.ellipse(d.x+2,d.y+3,10*d.s,6*d.s,0,0,7);g.fill();g.fillStyle=k==='mount'?'#8a8074':'#6b7280';g.beginPath();g.ellipse(d.x,d.y,9*d.s,6*d.s,d.a,0,7);g.fill()}
  }else if(k==='dune'){
    g.strokeStyle='rgba(120,84,40,.35)';g.lineWidth=2;g.beginPath();g.arc(d.x,d.y,16*d.s,Math.PI*1.1,Math.PI*1.9);g.stroke();
    if(d.k){g.fillStyle='#4d7a3a';g.fillRect(d.x-2,d.y-14*d.s,4,14*d.s);g.fillRect(d.x-7*d.s,d.y-9*d.s,3,6);g.fillRect(d.x+4*d.s,d.y-11*d.s,3,6)}
  }else if(k==='ice'){
    g.fillStyle='rgba(255,255,255,.35)';g.beginPath();g.ellipse(d.x,d.y,14*d.s,8*d.s,d.a,0,7);g.fill();
    if(d.k){g.strokeStyle='rgba(120,160,200,.6)';g.lineWidth=1.5;g.beginPath();g.moveTo(d.x-9*d.s,d.y);g.lineTo(d.x+9*d.s,d.y);g.moveTo(d.x,d.y-9*d.s);g.lineTo(d.x,d.y+9*d.s);g.stroke()}
  }else if(k==='ember'){
    g.strokeStyle='rgba(251,113,60,.55)';g.lineWidth=2.2;g.beginPath();g.moveTo(d.x,d.y);g.lineTo(d.x+14*d.s,d.y+6*d.s);g.lineTo(d.x+24*d.s,d.y-4*d.s);g.stroke();
    if(d.k){const t=.5+.5*Math.sin((tk.time||0)*3+d.a);g.fillStyle='rgba(251,146,60,'+(.25+t*.4)+')';g.beginPath();g.arc(d.x,d.y,3.5*d.s,0,7);g.fill()}
  }else{ // crack — город
    g.strokeStyle='rgba(0,0,0,.28)';g.lineWidth=1.6;g.beginPath();g.moveTo(d.x,d.y);g.lineTo(d.x+9*d.s,d.y+5*d.s);g.lineTo(d.x+5*d.s,d.y+14*d.s);g.stroke();
    if(d.k){g.fillStyle='rgba(255,255,255,.07)';g.fillRect(d.x-10*d.s,d.y-3,20*d.s,6)}
  }
}
// Погода поверх игры (в координатах экрана): осадки, туман, ночь
function tkWeather(g,cw,ch,z,f){
  const wx=tk.wx;if(!wx||wx==='clear')return;const t=tk.time||0,W=TK_WX[wx];
  if(!tk.wxp)tk.wxp=Array.from({length:wx==='storm'?46:90},()=>({x:Math.random(),y:Math.random(),v:.6+Math.random()*.8}));
  const dt=Math.min(.05,t-(tk.wxT||t));tk.wxT=t;
  g.save();
  if(wx==='rain'){g.fillStyle='rgba(20,30,60,.16)';g.fillRect(0,0,cw,ch);g.strokeStyle='rgba(190,215,255,.55)';g.lineWidth=1.4;g.beginPath();
    for(const p of tk.wxp){p.y+=dt*1.7*p.v;p.x-=dt*.22*p.v;if(p.y>1){p.y=-.05;p.x=Math.random()*1.2}if(p.x<0)p.x+=1.2;const x=p.x*cw,y=p.y*ch;g.moveTo(x,y);g.lineTo(x-5,y+16)}g.stroke()}
  else if(wx==='snow'){g.fillStyle='rgba(220,235,255,.07)';g.fillRect(0,0,cw,ch);g.fillStyle='rgba(255,255,255,.85)';
    for(const p of tk.wxp){p.y+=dt*.22*p.v;p.x+=Math.sin(t*1.3+p.v*9)*dt*.05;if(p.y>1.02){p.y=-.02;p.x=Math.random()}const x=((p.x%1)+1)%1*cw,y=p.y*ch;g.beginPath();g.arc(x,y,1.4+p.v*1.4,0,7);g.fill()}}
  else if(wx==='storm'){g.fillStyle='rgba(190,140,60,.22)';g.fillRect(0,0,cw,ch);g.strokeStyle='rgba(235,200,130,.5)';g.lineWidth=1.6;g.beginPath();
    for(const p of tk.wxp){p.x+=dt*1.5*p.v;p.y+=dt*.04;if(p.x>1.1){p.x=-.1;p.y=Math.random()}if(p.y>1)p.y=0;const x=p.x*cw,y=p.y*ch;g.moveTo(x,y);g.lineTo(x+46*p.v,y+2)}g.stroke()}
  else if(wx==='fog'||wx==='night'){
    const R=(W.vis||600)*z,cx=tk.view.ox+f.x*z,cy=tk.view.oy+f.y*z,night=wx==='night';
    const gr=g.createRadialGradient(cx,cy,R*.35,cx,cy,R);gr.addColorStop(0,night?'rgba(4,8,22,0)':'rgba(205,214,224,0)');gr.addColorStop(1,night?'rgba(4,8,22,.93)':'rgba(205,214,224,.94)');
    g.fillStyle=gr;g.fillRect(0,0,cw,ch);
    // за пределами круга — сплошная заливка (градиент заканчивается на R)
    g.fillStyle=night?'rgba(4,8,22,.93)':'rgba(205,214,224,.94)';
    g.save();g.beginPath();g.rect(0,0,cw,ch);g.arc(cx,cy,R,0,Math.PI*2,true);g.clip();g.fillRect(0,0,cw,ch);g.restore();
  }
  g.restore();
}

// ---------- Лобби: выбор класса и (хозяин) карты ----------
function tkSendOpts(){
  if(!tk||tk.phase!=='lobby')return;tk.cls[me]=tk.myCl;
  tkSend({t:'cl',id:me,c:tk.myCl});
  if(tk.host)tkSend({t:'opt',th:tk.th,wx:tk.wx,lay:tk.lay});
}
const tkStatBar=(l,v,max)=>{const r=el('div','tkc-st');r.append(el('span',null,l));const b=el('i');b.style.setProperty('--w',Math.round(v/max*100)+'%');r.append(b);return r};
function tkLobbyExtra(c){
  // --- класс танка ---
  const box=el('section','tkc-box');box.append(el('div','tkc-h','Ваш танк'));
  const row=el('div','tkc-row');
  const cur=tk.myCl,setCl=n=>{tk.myCl=n;tkSaveCl(n);tk.cls[me]=n;tkSend({t:'cl',id:me,c:n});tkLobby()};
  [['light','Лёгкий'],['normal','Обычный'],['heavy','Тяжёлый'],['custom','Свой']].forEach(([k,n])=>{
    const b=el('button','tkc-chip'+(cur.k===k?' on':''),n);b.onclick=()=>setCl(k==='custom'?(cur.k==='custom'?cur:{k:'custom',p:[3,3,3,3]}):{k});row.append(b)});
  box.append(row);
  const cl=tkClassOf(cur);
  box.append(el('p','tkc-d',cur.k==='custom'?'Распределите '+TK_CUS_MAX+' очков':cl.d));
  const st=el('div','tkc-stats');
  st.append(tkStatBar('Скорость',cl.spd,1.3),tkStatBar('Скорострельность',2-cl.rel,1.4),tkStatBar('Броня',cl.hp,150),tkStatBar('Урон',cl.dmg,36));box.append(st);
  if(cur.k==='custom'){
    const p=cur.p.slice(),used=()=>p.reduce((a,b)=>a+b,0),left=el('p','tkc-d','');const upd=()=>left.textContent='Осталось очков: '+(TK_CUS_MAX-used());upd();
    TK_CUS.forEach(([k,n],i)=>{const r=el('div','tkc-cs');const m=el('button','icon','−'),pl=el('button','icon','+'),v=el('b',null,String(p[i]));
      m.onclick=()=>{if(p[i]>0){p[i]--;setCl({k:'custom',p})}};pl.onclick=()=>{if(p[i]<6&&used()<TK_CUS_MAX){p[i]++;setCl({k:'custom',p})}};r.append(el('span',null,n),m,v,pl);box.append(r)});
    box.append(left);
  }
  c.append(box);
  // --- карта, местность, погода ---
  const mb=el('section','tkc-box');mb.append(el('div','tkc-h','Карта'));
  const pick=(title,obj,key)=>{const r=el('div','tkc-row');r.append(el('span','tkc-l',title));
    Object.entries(obj).forEach(([k,v])=>{const n=v.n||v;if(tk.host){const b=el('button','tkc-chip sm'+(tk[key]===k?' on':''),n);b.onclick=()=>{tk[key]=k;tkSend({t:'opt',th:tk.th,wx:tk.wx,lay:tk.lay});tkLobby()};r.append(b)}
      else if(tk[key]===k)r.append(el('span','tkc-chip sm on',n))});mb.append(r)};
  pick('Расстановка',TK_LAY,'lay');pick('Местность',TK_TH,'th');pick('Погода',TK_WX,'wx');
  if(!tk.host)mb.append(el('p','tkc-d','Карту выбирает хозяин комнаты'));
  c.append(mb);
}
