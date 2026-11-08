// «Танки» — онлайн-арена на canvas для 1–8 игроков (друг, группа, боты). Своя игра, без внешних библиотек.
// Сеть: канал Supabase Realtime `tanks-<код>` (presence = кто в комнате, broadcast = состояние и выстрелы).
// Игра идёт у каждого на своём устройстве; попадание по себе засчитывает сам пострадавший (так проще и без задержек).
// Карта одинаковая у всех: строится из кода комнаты. Победа — первым набрать TK.WIN убийств.
// Управление: компьютер — WASD/стрелки + мышь (прицел) + клик/пробел; телефон — левый стик (ехать), правый (целиться и стрелять).
const TK={W:1200,H:800,R:17,SPD:215,BSPD:560,BLIFE:1.3,RELOAD:.42,HP:3,RESPAWN:2.6,WIN:7};
const TK_SP=[[90,90],[1110,710],[1110,90],[90,710],[600,70],[600,730],[70,400],[1130,400]];
let tk=null;
const tkCode=()=>Math.random().toString(36).replace(/[^a-z0-9]/g,'').slice(2,7).toUpperCase().padEnd(5,'X');
function tkRng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}}
const tkHash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0};
function tkMap(code){
  const r=tkRng(tkHash(code)),W=TK.W,H=TK.H,out=[];
  for(let i=0;i<4;i++){const w=70+r()*110,h=50+r()*100,x=170+r()*(W/2-170-w-24),y=110+r()*(H/2-110-h-34),b={x,y,w,h};
    out.push(b,{x:W-x-w,y,w,h},{x,y:H-y-h,w,h},{x:W-x-w,y:H-y-h,w,h})}
  out.push({x:W/2-36,y:H/2-36,w:72,h:72});return out;
}
const tkHue=id=>typeof hue==='function'?hue(id):(tkHash(String(id))%360);
const tkCol=(h,l=55)=>'hsl('+h+',72%,'+l+'%)';

// ---------- запуск ----------
function openTanks(code,opt={}){
  if(tk){return}
  code=(code||tkCode()).toUpperCase();
  tk={code,phase:'lobby',players:{},bullets:[],walls:tkMap(code),me:null,keys:{},st:{l:null,r:null},roster:[{id:me,name:nameOf(me),t:Date.now()}],botN:opt.bots||0,host:true,hostId:me,
    firing:false,aim:0,mouse:null,t0:0,count:0,sendT:0,last:0,raf:0,ch:null,over:null};
  tkUI();tkJoin();
}
function tkJoin(){
  const ch=tk.ch=sb.channel('tanks-'+tk.code,{config:{presence:{key:me},broadcast:{self:false}}});
  ch.on('presence',{event:'sync'},()=>tkRoster()).on('broadcast',{event:'tk'},({payload})=>tkNet(payload))
    .subscribe(async st=>{if(st==='SUBSCRIBED'){try{await ch.track({id:me,name:nameOf(me),t:Date.now()})}catch{}tkRoster()}});
  tkRoster();
}
function tkRoster(){
  if(!tk)return;let list=[];
  try{list=Object.values(tk.ch?.presenceState?.()||{}).flat().filter(x=>x&&x.id)}catch{}
  if(!list.some(x=>x.id===me))list.push({id:me,name:nameOf(me),t:tk.myT||(tk.myT=Date.now())});
  list.sort((a,b)=>(a.t-b.t)||String(a.id).localeCompare(String(b.id)));
  const seen=new Set();list=list.filter(x=>!seen.has(x.id)&&seen.add(x.id));
  tk.roster=list;tk.hostId=list[0].id;tk.host=tk.hostId===me;
  if(tk.phase==='lobby')tkLobby();
}
function tkSend(p){try{tk.ch?.send({type:'broadcast',event:'tk',payload:p})}catch{}}

// ---------- сеть ----------
function tkNet(p){
  if(!tk||!p)return;
  if(p.t==='start'){tkStart(p.seed,p.list);return}
  if(p.t==='bots'){tk.botN=p.n|0;if(tk.phase==='lobby')tkLobby();return}
  if(tk.phase==='lobby')return;
  const pl=tk.players[p.id];
  if(p.t==='s'&&pl&&p.id!==me){pl.tx=p.x;pl.ty=p.y;pl.a=p.a;pl.hp=p.hp;pl.al=!!p.al;if(p.al)pl.dead=false;if(pl.x==null){pl.x=p.x;pl.y=p.y}}
  else if(p.t==='f'&&pl&&p.id!==me)tkBullet(p.id,p.x,p.y,p.a);
  else if(p.t==='h'&&tk.players[p.v])tk.players[p.v].hp=p.hp;
  else if(p.t==='k')tkKill(p.v,p.by,true);
}
function tkBullet(o,x,y,a){tk.bullets.push({o,x,y,vx:Math.cos(a)*TK.BSPD,vy:Math.sin(a)*TK.BSPD,life:TK.BLIFE,b:1})}

// ---------- раунд ----------
function tkBegin(){ // нажал «Начать» хост
  const ids=tk.roster.map(x=>({id:x.id,name:x.name}));for(let i=0;i<tk.botN;i++)ids.push({id:'bot'+(i+1),name:'Бот '+(i+1),bot:1});
  const seed=Date.now();tkSend({t:'start',seed,list:ids});tkStart(seed,ids);
}
function tkStart(seed,list){
  tk.phase='play';tk.players={};tk.bullets=[];tk.over=null;
  list.slice(0,8).forEach((e,i)=>{const [x,y]=TK_SP[i%8];tk.players[e.id]={id:e.id,name:e.name,hue:tkHue(e.id),x,y,tx:x,ty:y,a:Math.atan2(TK.H/2-y,TK.W/2-x),hp:TK.HP,al:true,sc:0,bot:!!e.bot,reload:0,respawn:0,spawn:i%8,ai:{t:0,dx:0,dy:0}}});
  tk.me=tk.players[me]||null;tk.count=3;tk.t0=performance.now();tk.last=performance.now();
  $('tkLobby')?.classList.add('hide');$('tkOver')?.classList.add('hide');$('tkHud')?.classList.remove('hide');
  cancelAnimationFrame(tk.raf);tk.raf=requestAnimationFrame(tkLoop);tkScore();
}
function tkKill(v,by,remote){
  const pv=tk.players[v],pb=tk.players[by];if(!pv)return;
  if(pv.dead)return;pv.hp=0;pv.al=false;pv.dead=true;pv.respawn=TK.RESPAWN;if(pb&&by!==v)pb.sc++;
  tk.boom.push({x:pv.x,y:pv.y,t:0});tkScore();
  if(pb&&pb.sc>=TK.WIN)tkOver(by);
}
function tkOver(win){
  if(tk.phase==='over')return;tk.phase='over';tk.over=win;
  const arr=Object.values(tk.players).sort((a,b)=>b.sc-a.sc);const box=$('tkOver');box.innerHTML='';box.classList.remove('hide');
  const c=el('div','tk-card');c.append(el('h2',null,win===me?'Победа!':(tk.players[win]?.name||'Игрок')+' победил'));
  arr.forEach((p,i)=>{const r=el('div','tk-rank'+(p.id===win?' w':''));r.append(el('i',null,String(i+1)),p.bot?el('span','tk-bav','Б'):avatar(p.id,32),el('b',null,p.name),el('span',null,String(p.sc)));c.append(r)});
  const row=el('div','tk-btns');
  if(tk.host){const b=el('button','primary','Ещё раунд');b.onclick=tkBegin;row.append(b)}else row.append(el('p','tk-wait','Ждём, пока хозяин комнаты начнёт новый раунд…'));
  const x=el('button','ghost','Выйти');x.onclick=tkClose;row.append(x);c.append(row);box.append(c);
}
function tkSpawnMe(p){
  const free=TK_SP.map((s,i)=>({s,d:Math.min(...Object.values(tk.players).filter(o=>o!==p&&o.al).map(o=>Math.hypot(o.x-s[0],o.y-s[1])),9999)})).sort((a,b)=>b.d-a.d)[0].s;
  p.x=p.tx=free[0];p.y=p.ty=free[1];p.hp=TK.HP;p.al=true;p.dead=false;p.reload=.5;
}

// ---------- физика ----------
function tkCircleWalls(p){ // вытолкнуть круг из стен и арены
  p.x=Math.max(TK.R,Math.min(TK.W-TK.R,p.x));p.y=Math.max(TK.R,Math.min(TK.H-TK.R,p.y));
  for(const w of tk.walls){const cx=Math.max(w.x,Math.min(p.x,w.x+w.w)),cy=Math.max(w.y,Math.min(p.y,w.y+w.h)),dx=p.x-cx,dy=p.y-cy,d=Math.hypot(dx,dy);
    if(d<TK.R){if(d>.001){p.x+=dx/d*(TK.R-d);p.y+=dy/d*(TK.R-d)}else p.x+=TK.R}}
}
function tkMove(p,mx,my,dt){const l=Math.hypot(mx,my);if(l>1){mx/=l;my/=l}p.x+=mx*TK.SPD*dt;p.y+=my*TK.SPD*dt;tkCircleWalls(p)}
function tkInWall(x,y){for(const w of tk.walls)if(x>w.x&&x<w.x+w.w&&y>w.y&&y<w.y+w.h)return w;return null}
function tkClear(a,b){const n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/16);for(let i=1;i<n;i++){if(tkInWall(a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n))return false}return true}
function tkFire(p){
  if(p.reload>0||!p.al)return;p.reload=TK.RELOAD;const x=p.x+Math.cos(p.a)*(TK.R+10),y=p.y+Math.sin(p.a)*(TK.R+10);
  tkBullet(p.id,x,y,p.a);tkSend({t:'f',id:p.id,x,y,a:p.a});
}
function tkHit(p,b){ // p — наш танк (или бот хоста)
  p.hp--;tkSend({t:'h',v:p.id,hp:p.hp});
  if(p.hp<=0){tkSend({t:'k',v:p.id,by:b.o});tkKill(p.id,b.o)}
}
function tkStep(dt){
  const pl=Object.values(tk.players);
  if(tk.count>0){tk.count-=dt;return}
  // мой танк
  const m=tk.me;
  if(m){
    if(m.al){
      let mx=(tk.keys.d||tk.keys.ArrowRight?1:0)-(tk.keys.a||tk.keys.ArrowLeft?1:0),my=(tk.keys.s||tk.keys.ArrowDown?1:0)-(tk.keys.w||tk.keys.ArrowUp?1:0);
      if(tk.st.l){mx+=tk.st.l.x;my+=tk.st.l.y}
      tkMove(m,mx,my,dt);
      let fire=tk.firing||tk.keys[' '];
      if(tk.st.r){m.a=tk.st.r.a;fire=fire||tk.st.r.m>.35}
      else if(tk.mouse)m.a=Math.atan2(tk.mouse.y-m.y,tk.mouse.x-m.x);
      m.reload-=dt;if(fire)tkFire(m);
    }else if(m.dead){m.respawn-=dt;if(m.respawn<=0&&tk.phase==='play'){tkSpawnMe(m);tkSend({t:'s',id:m.id,x:m.x,y:m.y,a:m.a,hp:m.hp,al:1})}}
  }
  // чужие — плавно к последней позиции; боты — считает хост
  for(const p of pl){
    if(p===m)continue;
    if(p.bot){if(tk.host)tkBot(p,dt,pl);else tkLerp(p,dt)}
    else tkLerp(p,dt);
    if(p.dead){p.respawn-=dt}
  }
  // пули
  for(let i=tk.bullets.length-1;i>=0;i--){
    const b=tk.bullets[i];b.life-=dt;const px=b.x,py=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;let dead=b.life<=0;
    if(!dead){
      const w=tkInWall(b.x,b.y);
      if(w||b.x<0||b.x>TK.W||b.y<0||b.y>TK.H){
        if(b.b--<=0)dead=true;else{ // один рикошет
          const nx=b.x,ny=b.y;b.x=px;b.y=py;
          if(w){if(px>w.x&&px<w.x+w.w)b.vy=-b.vy;else b.vx=-b.vx}else{if(nx<0||nx>TK.W)b.vx=-b.vx;if(ny<0||ny>TK.H)b.vy=-b.vy}
        }
      }
    }
    if(!dead){ // попадание: в себя и (хост) в ботов
      for(const p of pl){
        if(!p.al||p.id===b.o)continue;if(!(p===m||(p.bot&&tk.host)))continue;
        if(Math.hypot(p.x-b.x,p.y-b.y)<TK.R+3){tkHit(p,b);dead=true;break}
      }
    }
    if(dead)tk.bullets.splice(i,1);
  }
  tk.boom=tk.boom.filter(e=>(e.t+=dt)<.6);
  // отправка состояния
  tk.sendT-=dt;if(tk.sendT<=0){tk.sendT=.066;
    if(m)tkSend({t:'s',id:m.id,x:Math.round(m.x),y:Math.round(m.y),a:+m.a.toFixed(2),hp:m.hp,al:m.al?1:0});
    if(tk.host)pl.filter(p=>p.bot).forEach(p=>tkSend({t:'s',id:p.id,x:Math.round(p.x),y:Math.round(p.y),a:+p.a.toFixed(2),hp:p.hp,al:p.al?1:0}));
  }
}
function tkLerp(p,dt){const k=Math.min(1,dt*14);p.x+=(p.tx-p.x)*k;p.y+=(p.ty-p.y)*k}
// Бот: едет к ближайшему врагу, держит дистанцию, стреляет при чистой линии
function tkBot(p,dt,all){
  if(p.dead){if(p.respawn<=0&&tk.phase==='play'){tkSpawnMe(p);tkSend({t:'s',id:p.id,x:p.x,y:p.y,a:p.a,hp:p.hp,al:1})}return}
  if(!p.al)return;
  let tgt=null,best=9e9;for(const o of all){if(o===p||!o.al)continue;const d=Math.hypot(o.x-p.x,o.y-p.y);if(d<best){best=d;tgt=o}}
  p.reload-=dt;if(!tgt)return;
  const ang=Math.atan2(tgt.y-p.y,tgt.x-p.x);p.ai.t-=dt;
  if(p.ai.t<=0){p.ai.t=.5+Math.random()*.8;const side=Math.random()<.5?1:-1;p.ai.dx=Math.cos(ang+side*1.2);p.ai.dy=Math.sin(ang+side*1.2)}
  let mx=best>260?Math.cos(ang):(best<160?-Math.cos(ang):p.ai.dx*.7),my=best>260?Math.sin(ang):(best<160?-Math.sin(ang):p.ai.dy*.7);
  tkMove(p,mx*.8,my*.8,dt);
  const want=ang+(Math.random()-.5)*.12;p.a+=Math.atan2(Math.sin(want-p.a),Math.cos(want-p.a))*Math.min(1,dt*7);
  if(best<700&&tkClear(p,tgt)&&Math.abs(Math.atan2(Math.sin(ang-p.a),Math.cos(ang-p.a)))<.18)tkFire(p);
}

// ---------- отрисовка ----------
function tkLoop(t){
  if(!tk||tk.phase==='lobby')return;
  const dt=Math.min(.05,(t-tk.last)/1000);tk.last=t;
  if(tk.phase==='play'||tk.phase==='over')tkStep(tk.phase==='over'?dt*.5:dt);
  tkDraw();tk.raf=requestAnimationFrame(tkLoop);
}
function tkDraw(){
  const cv=$('tkCv'),g=cv.getContext('2d'),dpr=devicePixelRatio||1,cw=cv.clientWidth,ch=cv.clientHeight;
  if(cv.width!==Math.round(cw*dpr)||cv.height!==Math.round(ch*dpr)){cv.width=Math.round(cw*dpr);cv.height=Math.round(ch*dpr)}
  const s=Math.min(cw/TK.W,ch/TK.H),ox=(cw-TK.W*s)/2,oy=(ch-TK.H*s)/2;tk.view={s,ox,oy};
  g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,cw,ch);g.save();g.translate(ox,oy);g.scale(s,s);
  const css=getComputedStyle(document.documentElement),acc=css.getPropertyValue('--acc').trim()||'#8b5cf6';
  g.fillStyle='#14161c';g.fillRect(0,0,TK.W,TK.H);
  g.strokeStyle='rgba(255,255,255,.045)';g.lineWidth=1;for(let x=0;x<=TK.W;x+=50){g.beginPath();g.moveTo(x,0);g.lineTo(x,TK.H);g.stroke()}for(let y=0;y<=TK.H;y+=50){g.beginPath();g.moveTo(0,y);g.lineTo(TK.W,y);g.stroke()}
  g.lineWidth=6;g.strokeStyle=acc;g.globalAlpha=.55;g.strokeRect(0,0,TK.W,TK.H);g.globalAlpha=1;
  for(const w of tk.walls){g.fillStyle='#2a2f3a';g.strokeStyle='#4a5266';g.lineWidth=3;g.beginPath();g.roundRect(w.x,w.y,w.w,w.h,8);g.fill();g.stroke()}
  for(const p of Object.values(tk.players)){
    if(!p.al){ // обломки
      if(p.dead){g.globalAlpha=.35;g.fillStyle=tkCol(p.hue,30);g.beginPath();g.arc(p.x,p.y,TK.R*.8,0,7);g.fill();g.globalAlpha=1}continue}
    g.save();g.translate(p.x,p.y);
    g.fillStyle='rgba(0,0,0,.3)';g.beginPath();g.ellipse(3,5,TK.R,TK.R*.85,0,0,7);g.fill();
    g.fillStyle=tkCol(p.hue,52);g.strokeStyle=tkCol(p.hue,30);g.lineWidth=3;g.beginPath();g.arc(0,0,TK.R,0,7);g.fill();g.stroke();
    g.rotate(p.a);g.fillStyle=tkCol(p.hue,38);g.fillRect(2,-5,TK.R+12,10);g.fillStyle=tkCol(p.hue,70);g.beginPath();g.arc(0,0,9,0,7);g.fill();g.restore();
    g.fillStyle='rgba(255,255,255,.9)';g.font='700 15px Manrope,system-ui,sans-serif';g.textAlign='center';g.fillText(p.name,p.x,p.y-TK.R-18);
    for(let i=0;i<TK.HP;i++){g.fillStyle=i<p.hp?'#4ade80':'rgba(255,255,255,.2)';g.fillRect(p.x-18+i*13,p.y-TK.R-12,10,5)}
  }
  g.fillStyle='#fde68a';for(const b of tk.bullets){g.beginPath();g.arc(b.x,b.y,5,0,7);g.fill()}
  for(const e of tk.boom){g.globalAlpha=1-e.t/.6;g.strokeStyle='#fb923c';g.lineWidth=5;g.beginPath();g.arc(e.x,e.y,10+e.t*110,0,7);g.stroke();g.globalAlpha=1}
  g.restore();
  g.fillStyle='#fff';g.textAlign='center';
  if(tk.count>0){g.font='800 120px Manrope,system-ui,sans-serif';g.fillText(String(Math.ceil(tk.count)),cw/2,ch/2+40)}
  else if(tk.me&&tk.me.dead&&tk.phase==='play'){g.font='700 22px Manrope,system-ui,sans-serif';g.fillText('Вас подбили · возрождение '+Math.max(0,Math.ceil(tk.me.respawn))+' с',cw/2,60)}
  else if(!tk.me){g.font='700 20px Manrope,system-ui,sans-serif';g.fillText('Вы наблюдаете — вступите со следующего раунда',cw/2,60)}
}
function tkScore(){
  const box=$('tkScore');if(!box||!tk)return;box.innerHTML='';
  Object.values(tk.players).sort((a,b)=>b.sc-a.sc).forEach(p=>{const c=el('span','tk-chip'+(p.id===me?' me':'')+(p.al?'':' dead'));c.style.setProperty('--c',tkCol(p.hue));c.append(el('i'),el('b',null,p.name.split(' ')[0]),el('em',null,String(p.sc)));box.append(c)});
  box.append(el('small',null,'до '+TK.WIN));
}

// ---------- интерфейс ----------
function tkUI(){
  const w=el('div','tk');w.id='tk';
  const cv=document.createElement('canvas');cv.id='tkCv';cv.className='tk-cv';w.append(cv);
  const hud=el('div','tk-hud hide');hud.id='tkHud';const sc=el('div','tk-score');sc.id='tkScore';
  const x=el('button','icon tk-x');x.append(svgI('i-x'));x.title='Выйти';x.onclick=()=>{if(confirm('Выйти из игры?'))tkClose()};hud.append(sc,x);w.append(hud);
  const sl=el('div','tk-stick l');sl.append(el('i'));const sr=el('div','tk-stick r');sr.append(el('i'),el('span',null,'Огонь'));w.append(sl,sr);
  const lobby=el('div','tk-lobby');lobby.id='tkLobby';const over=el('div','tk-over hide');over.id='tkOver';w.append(lobby,over);
  document.body.append(w);requestAnimationFrame(()=>w.classList.add('in'));
  // клавиатура и мышь
  tk.onKey=(e,down)=>{if(!tk||e.target.matches?.('input,textarea'))return;const k=e.key.length===1?e.key.toLowerCase():e.key;
    if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(k)){tk.keys[k]=down;e.preventDefault()}};
  tk.kd=e=>tk.onKey(e,true);tk.ku=e=>tk.onKey(e,false);window.addEventListener('keydown',tk.kd);window.addEventListener('keyup',tk.ku);
  const world=e=>{const r=cv.getBoundingClientRect(),v=tk.view||{s:1,ox:0,oy:0};return {x:(e.clientX-r.left-v.ox)/v.s,y:(e.clientY-r.top-v.oy)/v.s}};
  cv.onmousemove=e=>{if(e.pointerType==='touch')return;tk.mouse=world(e)};
  cv.onpointerdown=e=>{if(e.pointerType==='touch')return;tk.mouse=world(e);tk.firing=true};
  window.addEventListener('pointerup',tk.pu=()=>{tk.firing=false});
  // стики (телефон)
  const stick=(el0,key)=>{let id=null,cx=0,cy=0;const th=el0.querySelector('i'),R=46;
    el0.onpointerdown=e=>{id=e.pointerId;el0.setPointerCapture(id);const r=el0.getBoundingClientRect();cx=r.left+r.width/2;cy=r.top+r.height/2;mv(e)};
    const mv=e=>{if(e.pointerId!==id)return;let dx=e.clientX-cx,dy=e.clientY-cy;const d=Math.hypot(dx,dy),k=Math.min(1,d/R);
      if(d>R){dx*=R/d;dy*=R/d}th.style.transform='translate('+dx+'px,'+dy+'px)';
      tk.st[key]=key==='l'?{x:dx/R,y:dy/R}:{a:Math.atan2(dy,dx),m:k}};
    el0.onpointermove=mv;const up=e=>{if(e.pointerId!==id)return;id=null;tk.st[key]=null;th.style.transform=''};el0.onpointerup=el0.onpointercancel=up};
  stick(sl,'l');stick(sr,'r');
  tk.boom=[];tkLobby();
}
function tkLobby(){
  const box=$('tkLobby');if(!box||!tk)return;box.innerHTML='';
  const c=el('div','tk-card');
  const ic=el('div','tk-ic');ic.append(svgI('i-tank'));
  c.append(ic,el('h2',null,'Танки'),el('p','tk-sub','Арена: кто первым набьёт '+TK.WIN+' побед. Комната '),);
  const code=el('button','tk-code',tk.code);code.title='Скопировать код';code.onclick=()=>{navigator.clipboard?.writeText(tk.code);toast('Код комнаты скопирован')};c.querySelector('.tk-sub').append(code);
  const list=el('div','tk-players');
  tk.roster.forEach(p=>{const r=el('div','tk-pl');r.append(avatar(p.id,34),el('b',null,p.name+(p.id===me?' (вы)':'')));if(p.id===tk.hostId)r.append(el('small',null,'хозяин'));list.append(r)});
  for(let i=0;i<tk.botN;i++){const r=el('div','tk-pl');r.append(el('span','tk-bav','Б'),el('b',null,'Бот '+(i+1)));list.append(r)}
  c.append(list);
  const row=el('div','tk-btns');
  const inv=el('button','ghost');inv.append(svgI('i-forward'),document.createTextNode('Позвать в чат'));inv.onclick=tkInvite;row.append(inv);
  if(tk.host){
    const bm=el('div','tk-bots');const m=el('button','icon');m.textContent='−';m.onclick=()=>{tk.botN=Math.max(0,tk.botN-1);tkSend({t:'bots',n:tk.botN});tkLobby()};
    const p=el('button','icon');p.textContent='+';p.onclick=()=>{if(tk.roster.length+tk.botN<8){tk.botN++;tkSend({t:'bots',n:tk.botN});tkLobby()}};
    bm.append(el('span',null,'Боты'),m,el('b',null,String(tk.botN)),p);c.append(bm);
    const go=el('button','primary','Начать игру');go.disabled=tk.roster.length+tk.botN<2;go.onclick=tkBegin;row.append(go);
    if(go.disabled)c.append(el('p','tk-hint','Нужен ещё игрок — позовите друга или добавьте бота'));
  }else c.append(el('p','tk-hint','Ждём, пока хозяин комнаты начнёт игру…'));
  const ex=el('button','ghost','Выйти');ex.onclick=tkClose;row.append(ex);c.append(row);box.append(c);
}
function tkInvite(){
  openModal(s=>{
    const top=el('div','sheet-top');top.append(el('h3',null,'Позвать играть'));const x=el('button','icon');x.append(svgI('i-x'));x.onclick=closeModal;top.append(x);s.append(top);
    const l=el('div','nc-list');
    chatItems().forEach(it=>{const r=giRow(it.group?groupAvatar(it.g,40):avatar(it.k,40),it.name,it.group?'Группа':'Личный чат','gi-mem');
      r.onclick=async()=>{closeModal();try{await sendMsg(it.k,{body:'::game:tk:'+tk.code+'::'},{noReply:true});toast('Приглашение отправлено: '+it.name)}catch(e){toast('Не отправилось: '+e.message)}};l.append(r)});
    s.append(l);
  });
}
function tkClose(){
  if(!tk)return;cancelAnimationFrame(tk.raf);window.removeEventListener('keydown',tk.kd);window.removeEventListener('keyup',tk.ku);window.removeEventListener('pointerup',tk.pu);
  try{tk.ch?.unsubscribe?.();sb.removeChannel?.(tk.ch)}catch{}
  const w=$('tk');w?.classList.remove('in');setTimeout(()=>w?.remove(),220);tk=null;
}
// Из чата: комната + приглашение в этот чат
async function startTanksInvite(){
  if(!cur){toast('Откройте чат, куда позвать играть');return}
  const code=tkCode();openTanks(code);
  try{await sendMsg(cur,{body:'::game:tk:'+code+'::'},{noReply:true})}catch(e){toast('Приглашение не отправилось: '+e.message)}
}
// Карточка приглашения в чате
SPECIAL.push({re:/^::game:tk:([A-Za-z0-9]{3,8})::$/,cls:'tkcard-m',forward:false,preview:()=>PI('i-tank')+'Приглашение в «Танки»',
  render:(m,d,x)=>{const w=el('div','tkcard');const ic=el('div','tkcard-ic');ic.append(svgI('i-tank'));
    const t=el('div','tkcard-t');t.append(el('b',null,'Танки'),el('small',null,(m.sender===me?'Вы зовёте':nameOf(m.sender)+' зовёт')+' играть · комната '+x[1].toUpperCase()));
    const b=el('button','primary sm-btn','Играть');b.onclick=e=>{e.stopPropagation();openTanks(x[1])};w.append(ic,t,b);d.append(w)}});
