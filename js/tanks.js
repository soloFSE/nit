// «Танки» — онлайн-арена на canvas для 1–8 игроков (друг, группа, боты). Своя игра, без внешних библиотек.
// Сеть: канал Supabase Realtime `tanks-<код>` (presence = кто в комнате, broadcast = состояние, выстрелы, попадания).
// Как сделано «по-честному» при пинге:
//  • чужие танки показываются с задержкой 100 мс по буферу снимков (интерполяция) — движение плавное, без рывков;
//  • пуля, пришедшая по сети, «догоняется» на половину измеренного пинга (RTT/2) — она там, где её видит стрелок;
//  • попадание фиксирует стрелок по тому, что видит на экране (поэтому попал — значит попал), а пострадавший проверяет
//    правдоподобие (допуск на пинг) и сам применяет урон — читерить «убийством издалека» нельзя.
// Карта: 2400×1600, камера следует за танком, миникарта. Способности: щит (Q), рывок (E/Shift), мина (F), веер (R).
// Управление: компьютер — WASD/стрелки + мышь + клик/пробел; телефон — левый стик (ехать), правый (целиться и стрелять) + кнопки способностей.
const TK={W:2400,H:1600,R:18,SPD:235,BSPD:640,BLIFE:1.5,RELOAD:.36,HP:4,RESPAWN:3,WIN:10,SEND:.05,INTERP:.1};
const TK_SP=[[200,200],[2200,1400],[2200,200],[200,1400],[1200,170],[1200,1430],[170,800],[2230,800]];
const TK_AB={shield:{k:'q',cd:12,dur:2.6,name:'Щит',ic:'i-shield'},dash:{k:'e',cd:6,dur:.22,name:'Рывок',ic:'i-rocket'},mine:{k:'f',cd:10,name:'Мина',ic:'i-flame'},fan:{k:'r',cd:8,name:'Веер',ic:'i-star'}};
let tk=null;
const tkCode=()=>Math.random().toString(36).replace(/[^a-z0-9]/g,'').slice(2,7).toUpperCase().padEnd(5,'X');
function tkRng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}}
const tkHash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0};
const tkHue=id=>typeof hue==='function'?hue(id):(tkHash(String(id))%360);
const tkCol=(h,l=55,s=72)=>'hsl('+h+','+s+'%,'+l+'%)';
const tkAng=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a)); // кратчайшая разница углов
// Карта из кода комнаты: стены 4-кратно симметричны (честно для всех), плюс декор
function tkMap(code){
  const r=tkRng(tkHash(code)),W=TK.W,H=TK.H,walls=[],base=[];
  for(let i=0,tries=0;i<11&&tries<200;tries++){
    const w=90+r()*170,h=70+r()*150,x=300+r()*(W/2-300-w-60),y=240+r()*(H/2-240-h-60);
    if(base.some(b=>x<b.x+b.w+90&&x+w>b.x-90&&y<b.y+b.h+90&&y+h>b.y-90))continue;base.push({x,y,w,h});i++;
  }
  base.forEach(b=>{walls.push(b,{x:W-b.x-b.w,y:b.y,w:b.w,h:b.h},{x:b.x,y:H-b.y-b.h,w:b.w,h:b.h},{x:W-b.x-b.w,y:H-b.y-b.h,w:b.w,h:b.h})});
  walls.push({x:W/2-80,y:H/2-24,w:160,h:48},{x:W/2-24,y:H/2-110,w:48,h:220}); // крест в центре
  const ok=walls.filter(w=>!TK_SP.some(([sx,sy])=>sx>w.x-120&&sx<w.x+w.w+120&&sy>w.y-120&&sy<w.y+w.h+120));
  const decor=[];for(let i=0;i<150;i++){const x=r()*W,y=r()*H;if(ok.some(w=>x>w.x-20&&x<w.x+w.w+20&&y>w.y-20&&y<w.y+w.h+20))continue;decor.push({x,y,k:r()<.7?0:1,s:.6+r()*.8,a:r()*6})}
  return {walls:ok,decor};
}

// ---------- запуск ----------
function openTanks(code,opt={}){
  if(tk)return;code=(code||tkCode()).toUpperCase();
  const m=tkMap(code);
  tk={code,phase:'lobby',players:{},bullets:[],mines:[],parts:[],boom:[],walls:m.walls,decor:m.decor,me:null,keys:{},st:{l:null,r:null},
    roster:[{id:me,name:nameOf(me),t:Date.now()}],botN:opt.bots||0,host:true,hostId:me,firing:false,mouse:null,count:0,sendT:0,last:0,raf:0,ch:null,over:null,
    cam:{x:TK.W/2,y:TK.H/2},shake:0,rtt:{},seen:new Set(),pingT:0,ping:0,time:0};
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
const tkOwd=id=>Math.min(.4,(tk.rtt[id]||100)/2000); // односторонняя задержка, сек

// ---------- сеть ----------
function tkNet(p){
  if(!tk||!p)return;
  if(p.t==='start'){tkStart(p.seed,p.list);return}
  if(p.t==='bots'){tk.botN=p.n|0;if(tk.phase==='lobby')tkLobby();return}
  if(p.t==='pg'){if(p.id!==me)tkSend({t:'pn',to:p.id,from:me,ts:p.ts});return}
  if(p.t==='pn'){if(p.to===me){const r=performance.now()-p.ts;tk.rtt[p.from]=tk.rtt[p.from]?tk.rtt[p.from]*.6+r*.4:r;tk.ping=Math.round(Math.max(0,...Object.values(tk.rtt)));tkPing()}return}
  if(tk.phase==='lobby')return;
  const pl=tk.players[p.id];
  if(p.t==='s'&&pl&&p.id!==me&&!(pl.bot&&tk.host)){
    const b=pl.buf;b.push({t:performance.now(),x:p.x,y:p.y,a:p.a,ba:p.ba,vx:p.vx||0,vy:p.vy||0});if(b.length>24)b.shift();
    pl.hp=p.hp;pl.al=!!p.al;pl.sh=p.sh?1:0;pl.shT=p.sh?1:0;if(p.al)pl.dead=false;if(pl.x==null){pl.x=p.x;pl.y=p.y}
  }else if(p.t==='f'&&pl&&p.id!==me&&!(pl.bot&&tk.host))tkBullet(p.id,p.bid,p.x,p.y,p.a,tkOwd(p.id));
  else if(p.t==='x')tk.bullets=tk.bullets.filter(b=>!(b.o===p.id&&b.bid===p.bid));
  else if(p.t==='m'&&p.id!==me)tk.mines.push({id:p.id,mid:p.mid,x:p.x,y:p.y,life:12,arm:.6});
  else if(p.t==='mx'){tk.mines=tk.mines.filter(m=>!(m.id===p.id&&m.mid===p.mid));tkBang(p.x,p.y,1.3)}
  else if(p.t==='hit')tkClaim(p);
  else if(p.t==='h'&&tk.players[p.v]){tk.players[p.v].hp=p.hp;if(p.v===me)tk.shake=.25}
  else if(p.t==='k')tkKill(p.v,p.by);
}
let tkSeq=0;
function tkBullet(o,bid,x,y,a,adv){
  const b={o,bid,x,y,vx:Math.cos(a)*TK.BSPD,vy:Math.sin(a)*TK.BSPD,life:TK.BLIFE,b:1,px:x,py:y};
  if(adv>0)for(let i=0;i<4;i++){b.x+=b.vx*adv/4;b.y+=b.vy*adv/4;if(tkInWall(b.x,b.y)){b.x=x;b.y=y;break}}
  tk.bullets.push(b);
}

// ---------- раунд ----------
function tkBegin(){
  const ids=tk.roster.map(x=>({id:x.id,name:x.name}));for(let i=0;i<tk.botN;i++)ids.push({id:'bot'+(i+1),name:'Бот '+(i+1),bot:1});
  const seed=Date.now();tkSend({t:'start',seed,list:ids});tkStart(seed,ids);
}
function tkStart(seed,list){
  tk.phase='play';tk.players={};tk.bullets=[];tk.mines=[];tk.parts=[];tk.over=null;
  list.slice(0,8).forEach((e,i)=>{const [x,y]=TK_SP[i%8];tk.players[e.id]={id:e.id,name:e.name,hue:tkHue(e.id),x,y,vx:0,vy:0,a:Math.atan2(TK.H/2-y,TK.W/2-x),ba:0,hp:TK.HP,al:true,sc:0,bot:!!e.bot,reload:0,respawn:0,sh:0,shT:0,dashT:0,cd:{shield:0,dash:0,mine:0,fan:0},buf:[],ai:{t:0,dx:0,dy:0,stuck:0,lx:x,ly:y},trav:0,dm:0}});
  tk.me=tk.players[me]||null;tk.count=3;tk.last=performance.now();
  $('tkLobby')?.classList.add('hide');$('tkOver')?.classList.add('hide');$('tkHud')?.classList.remove('hide');$('tkAbs')?.classList.toggle('hide',!tk.me);
  tkCamSnap();cancelAnimationFrame(tk.raf);tk.raf=requestAnimationFrame(tkLoop);tkScore();
}
function tkKill(v,by){
  const pv=tk.players[v],pb=tk.players[by];if(!pv||pv.dead)return;
  pv.hp=0;pv.al=false;pv.dead=true;pv.respawn=TK.RESPAWN;if(pb&&by!==v)pb.sc++;
  tkBang(pv.x,pv.y,1.6);tkSfx('boom');tkScore();
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
  const free=TK_SP.map(s=>({s,d:Math.min(...Object.values(tk.players).filter(o=>o!==p&&o.al).map(o=>Math.hypot(o.x-s[0],o.y-s[1])),9999)})).sort((a,b)=>b.d-a.d)[0].s;
  p.x=free[0];p.y=free[1];p.vx=p.vy=0;p.hp=TK.HP;p.al=true;p.dead=false;p.reload=.5;p.shT=1.2;p.sh=1; // после возрождения — 1,2 с неуязвимости
  if(p===tk.me)tkCamSnap();
}

// ---------- физика ----------
function tkCircleWalls(p){
  p.x=Math.max(TK.R,Math.min(TK.W-TK.R,p.x));p.y=Math.max(TK.R,Math.min(TK.H-TK.R,p.y));
  for(const w of tk.walls){const cx=Math.max(w.x,Math.min(p.x,w.x+w.w)),cy=Math.max(w.y,Math.min(p.y,w.y+w.h)),dx=p.x-cx,dy=p.y-cy,d=Math.hypot(dx,dy);
    if(d<TK.R){if(d>.001){p.x+=dx/d*(TK.R-d);p.y+=dy/d*(TK.R-d)}else p.x+=TK.R}}
}
function tkMove(p,mx,my,dt){
  const l=Math.hypot(mx,my);if(l>1){mx/=l;my/=l}
  let sp=TK.SPD;if(p.dashT>0){sp*=3;if(l<.1){mx=Math.cos(p.ba);my=Math.sin(p.ba)}}
  const ox=p.x,oy=p.y;p.x+=mx*sp*dt;p.y+=my*sp*dt;tkCircleWalls(p);
  p.vx=(p.x-ox)/dt;p.vy=(p.y-oy)/dt;const mv=Math.hypot(p.x-ox,p.y-oy);p.trav+=mv;
  if(mv>.5){const want=Math.atan2(p.y-oy,p.x-ox);p.ba+=tkAng(p.ba,want)*Math.min(1,dt*12);if(Math.random()<dt*14)tkPart(p.x-Math.cos(p.ba)*14,p.y-Math.sin(p.ba)*14,'dust')}
}
function tkInWall(x,y){for(const w of tk.walls)if(x>w.x&&x<w.x+w.w&&y>w.y&&y<w.y+w.h)return w;return null}
function tkClear(a,b){const n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/18);for(let i=1;i<n;i++){if(tkInWall(a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n))return false}return true}
function tkOwns(p){return p.id===me||(p.bot&&tk.host)} // за чьё состояние отвечает этот клиент

// ---------- способности ----------
function tkAbility(p,k){
  if(!p.al||p.cd[k]>0||tk.phase!=='play'||tk.count>0)return false;p.cd[k]=TK_AB[k].cd;
  if(k==='shield'){p.shT=TK_AB.shield.dur;p.sh=1;tkSfx('shield')}
  else if(k==='dash'){p.dashT=TK_AB.dash.dur;tkSfx('dash');for(let i=0;i<10;i++)tkPart(p.x,p.y,'dust')}
  else if(k==='mine'){const mid=++p.dm;tk.mines.push({id:p.id,mid,x:p.x,y:p.y,life:12,arm:.6});tkSend({t:'m',id:p.id,mid,x:Math.round(p.x),y:Math.round(p.y)});tkSfx('mine')}
  else if(k==='fan'){for(const d of [-.24,0,.24])tkShoot(p,p.a+d);p.reload=TK.RELOAD}
  return true;
}
function tkShoot(p,a){
  const x=p.x+Math.cos(a)*(TK.R+12),y=p.y+Math.sin(a)*(TK.R+12),bid=++tkSeq;
  tkBullet(p.id,bid,x,y,a,0);tkSend({t:'f',id:p.id,bid,x:Math.round(x),y:Math.round(y),a:+a.toFixed(3)});
  for(let i=0;i<5;i++)tkPart(x,y,'flash',a);tkSfx('shot');
}
function tkFire(p){if(p.reload>0||!p.al)return;p.reload=TK.RELOAD;tkShoot(p,p.a)}

// ---------- урон: стрелок фиксирует попадание, жертва проверяет ----------
function tkClaim(c){
  const p=tk.players[c.v];if(!p||!tkOwns(p)||!p.al)return;
  const key=c.by+':'+c.bid;if(tk.seen.has(key))return;tk.seen.add(key);if(tk.seen.size>400)tk.seen.clear();
  const tol=TK.R+14+TK.SPD*(tkOwd(c.by)+.15);if(Math.hypot(p.x-c.x,p.y-c.y)>tol)return; // слишком далеко от моего танка — не засчитываем
  tkDamage(p,c.d||1,c.by);
}
function tkDamage(p,d,by){
  if(!p.al)return;if(p.sh&&p.shT>0){tkSfx('shield');return}
  p.hp-=d;if(p===tk.me)tk.shake=.3;tkSfx('hit');for(let i=0;i<8;i++)tkPart(p.x,p.y,'spark');
  tkSend({t:'h',v:p.id,hp:Math.max(0,p.hp)});
  if(p.hp<=0){tkSend({t:'k',v:p.id,by});tkKill(p.id,by)}
}
function tkHitEnemy(v,by,bid,x,y,d){ // выстрел попал по v на моём экране
  const p=tk.players[v];if(!p)return;
  if(tkOwns(p))tkClaim({v,by,bid,x:p.x,y:p.y,d});else tkSend({t:'hit',v,by,bid,x:Math.round(x),y:Math.round(y),d});
}

// ---------- шаг игры ----------
function tkStep(dt){
  const pl=Object.values(tk.players),m=tk.me;tk.time+=dt;
  for(const p of pl){for(const k in p.cd)if(p.cd[k]>0)p.cd[k]-=dt;if(p.shT>0&&tkOwns(p)){p.shT-=dt;if(p.shT<=0)p.sh=0}if(p.dashT>0)p.dashT-=dt;if(p.reload>0)p.reload-=dt}
  if(tk.count>0){tk.count-=dt;return}
  if(m){
    if(m.al){
      let mx=(tk.keys.d||tk.keys.ArrowRight?1:0)-(tk.keys.a||tk.keys.ArrowLeft?1:0),my=(tk.keys.s||tk.keys.ArrowDown?1:0)-(tk.keys.w||tk.keys.ArrowUp?1:0);
      if(tk.st.l){mx+=tk.st.l.x;my+=tk.st.l.y}
      tkMove(m,mx,my,dt);
      let fire=tk.firing||tk.keys[' '];
      if(tk.st.r){m.a=tk.st.r.a;fire=fire||tk.st.r.m>.35}else if(tk.mouse)m.a=Math.atan2(tk.mouse.y-m.y,tk.mouse.x-m.x);
      if(fire)tkFire(m);
    }else if(m.dead){m.respawn-=dt;if(m.respawn<=0&&tk.phase==='play'){tkSpawnMe(m);tkSendState(m)}}
  }
  for(const p of pl){
    if(p===m)continue;
    if(p.bot&&tk.host)tkBot(p,dt,pl);else tkInterp(p);
    if(p.dead&&!(p.bot&&tk.host))p.respawn-=dt;
  }
  // мины: хозяин мины проверяет врагов (по тому, что видит), взрыв — область
  for(let i=tk.mines.length-1;i>=0;i--){
    const mn=tk.mines[i];mn.life-=dt;mn.arm-=dt;const own=tk.players[mn.id];
    if(mn.life<=0){tk.mines.splice(i,1);continue}
    if(mn.arm<=0&&own&&tkOwns(own)){
      let boom=false;for(const p of pl){if(p===own||!p.al)continue;if(Math.hypot(p.x-mn.x,p.y-mn.y)<TK.R+26){boom=true;break}}
      if(boom){tkSend({t:'mx',id:mn.id,mid:mn.mid,x:Math.round(mn.x),y:Math.round(mn.y)});tkBang(mn.x,mn.y,1.3);
        for(const p of pl){if(p===own||!p.al)continue;if(Math.hypot(p.x-mn.x,p.y-mn.y)<TK.R+70)tkHitEnemy(p.id,mn.id,'m'+mn.mid+p.id,p.x,p.y,2)}
        tk.mines.splice(i,1)}
    }
  }
  // пули
  for(let i=tk.bullets.length-1;i>=0;i--){
    const b=tk.bullets[i];b.life-=dt;b.px=b.x;b.py=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;let dead=b.life<=0;
    if(Math.random()<dt*40)tkPart(b.x,b.y,'trail');
    if(!dead){
      const w=tkInWall(b.x,b.y);
      if(w||b.x<0||b.x>TK.W||b.y<0||b.y>TK.H){
        for(let k=0;k<4;k++)tkPart(b.px,b.py,'spark');
        if(b.b--<=0)dead=true;else{const nx=b.x,ny=b.y;b.x=b.px;b.y=b.py;
          if(w){if(b.px>w.x&&b.px<w.x+w.w)b.vy=-b.vy;else b.vx=-b.vx}else{if(nx<0||nx>TK.W)b.vx=-b.vx;if(ny<0||ny>TK.H)b.vy=-b.vy}}
      }
    }
    const shooter=tk.players[b.o];
    if(!dead&&shooter&&tkOwns(shooter)){ // попадание считает стрелок (я и мои боты) по тому, что на экране
      for(const p of pl){if(!p.al||p.id===b.o)continue;
        if(Math.hypot(p.x-b.x,p.y-b.y)<TK.R+5){tkHitEnemy(p.id,b.o,b.bid,b.x,b.y,1);tkSend({t:'x',id:b.o,bid:b.bid});for(let k=0;k<6;k++)tkPart(b.x,b.y,'spark');dead=true;break}}
    }
    if(dead)tk.bullets.splice(i,1);
  }
  for(let i=tk.parts.length-1;i>=0;i--){const q=tk.parts[i];q.l-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=.96;q.vy*=.96;if(q.l<=0)tk.parts.splice(i,1)}
  tk.boom=tk.boom.filter(e=>(e.t+=dt)<.7);
  tk.shake=Math.max(0,tk.shake-dt);
  tk.sendT-=dt;if(tk.sendT<=0){tk.sendT=TK.SEND;if(m)tkSendState(m);if(tk.host)pl.filter(p=>p.bot).forEach(tkSendState)}
  tk.pingT-=dt;if(tk.pingT<=0){tk.pingT=2;tkSend({t:'pg',id:me,ts:performance.now()})}
}
function tkSendState(p){tkSend({t:'s',id:p.id,x:Math.round(p.x),y:Math.round(p.y),a:+p.a.toFixed(2),ba:+p.ba.toFixed(2),vx:Math.round(p.vx),vy:Math.round(p.vy),hp:p.hp,al:p.al?1:0,sh:p.sh&&p.shT>0?1:0})}
// Чужой танк: рисуем на 100 мс в прошлом между двумя снимками; если новых нет — продолжаем по скорости (до 150 мс)
function tkInterp(p){
  const b=p.buf;if(!b.length)return;const rt=performance.now()-TK.INTERP*1000;
  let i=b.length-1;while(i>0&&b[i-1].t>rt)i--;
  const a=b[Math.max(0,i-1)],c=b[i];
  if(rt<=c.t&&a!==c&&c.t>a.t){const k=Math.max(0,Math.min(1,(rt-a.t)/(c.t-a.t)));p.x=a.x+(c.x-a.x)*k;p.y=a.y+(c.y-a.y)*k;p.a=a.a+tkAng(a.a,c.a)*k;p.ba=a.ba+tkAng(a.ba,c.ba)*k}
  else{const e=Math.min(.15,Math.max(0,(rt-c.t)/1000));p.x=c.x+c.vx*e;p.y=c.y+c.vy*e;p.a=c.a;p.ba=c.ba}
  p.vx=c.vx;p.vy=c.vy;p.trav+=Math.hypot(c.vx,c.vy)*.016;
  if(Math.hypot(c.vx,c.vy)>10&&Math.random()<.2)tkPart(p.x,p.y,'dust');
}
// Бот: едет к врагу, обходит стены, держит дистанцию, стреляет при чистой линии, использует щит/мину/веер/рывок
function tkBot(p,dt,all){
  if(p.dead){p.respawn-=dt;if(p.respawn<=0&&tk.phase==='play'){tkSpawnMe(p);tkSendState(p)}return}
  if(!p.al)return;
  let tgt=null,best=9e9;for(const o of all){if(o===p||!o.al)continue;const d=Math.hypot(o.x-p.x,o.y-p.y);if(d<best){best=d;tgt=o}}
  if(!tgt)return;
  const ang=Math.atan2(tgt.y-p.y,tgt.x-p.x),ai=p.ai;ai.t-=dt;
  if(ai.t<=0){ai.t=.5+Math.random()*.9;const side=Math.random()<.5?1:-1;ai.dx=Math.cos(ang+side*1.3);ai.dy=Math.sin(ang+side*1.3)}
  ai.stuck=Math.hypot(p.x-ai.lx,p.y-ai.ly)<dt*TK.SPD*.25?ai.stuck+dt:0;ai.lx=p.x;ai.ly=p.y;
  let mx,my;
  if(ai.stuck>.3){const s=Math.sin(tk.time*3)>0?1:-1;mx=Math.cos(ang+s*1.6);my=Math.sin(ang+s*1.6)}
  else if(best>420){mx=Math.cos(ang);my=Math.sin(ang)}else if(best<220){mx=-Math.cos(ang);my=-Math.sin(ang)}else{mx=ai.dx*.8;my=ai.dy*.8}
  tkMove(p,mx*.85,my*.85,dt);
  const want=ang+(Math.random()-.5)*.1;p.a+=tkAng(p.a,want)*Math.min(1,dt*7);
  const clear=tkClear(p,tgt),aligned=Math.abs(tkAng(p.a,ang))<.16;
  if(best<900&&clear&&aligned)tkFire(p);
  if(p.hp<=2&&best<500&&p.cd.shield<=0&&Math.random()<dt*2)tkAbility(p,'shield');
  if(best<300&&p.cd.mine<=0&&Math.random()<dt*.6)tkAbility(p,'mine');
  if(best<450&&clear&&aligned&&p.cd.fan<=0&&Math.random()<dt*.8)tkAbility(p,'fan');
  if(best>700&&p.cd.dash<=0&&Math.random()<dt*.3)tkAbility(p,'dash');
}

// ---------- эффекты ----------
function tkPart(x,y,k,a){
  const r=Math.random;
  if(k==='dust')tk.parts.push({x,y,vx:(r()-.5)*40,vy:(r()-.5)*40,l:.5,m:.5,k,s:5+r()*5,c:'rgba(200,185,150,.35)'});
  else if(k==='spark')tk.parts.push({x,y,vx:(r()-.5)*380,vy:(r()-.5)*380,l:.35,m:.35,k,s:2.5,c:'#fde68a'});
  else if(k==='trail')tk.parts.push({x,y,vx:0,vy:0,l:.18,m:.18,k,s:4,c:'rgba(253,230,138,.7)'});
  else if(k==='flash'){const d=a+(r()-.5)*.6,s=120+r()*220;tk.parts.push({x,y,vx:Math.cos(d)*s,vy:Math.sin(d)*s,l:.2,m:.2,k,s:4,c:'#fff7ae'})}
  else if(k==='fire')tk.parts.push({x,y,vx:(r()-.5)*420,vy:(r()-.5)*420,l:.6,m:.6,k,s:7+r()*8,c:r()<.5?'#fb923c':'#fde047'});
  else if(k==='smoke')tk.parts.push({x,y,vx:(r()-.5)*20,vy:-20-r()*20,l:.9,m:.9,k,s:6+r()*6,c:'rgba(70,70,80,.45)'});
}
function tkBang(x,y,sz){tk.boom.push({x,y,t:0,sz});for(let i=0;i<26;i++)tkPart(x,y,'fire');for(let i=0;i<10;i++)tkPart(x,y,'smoke');if(tk.me&&Math.hypot(tk.me.x-x,tk.me.y-y)<500)tk.shake=Math.max(tk.shake,.25)}
let tkAu=null;
function tkSfx(t){
  try{if(!soundOn())return;tkAu=tkAu||new (window.AudioContext||window.webkitAudioContext)();const c=tkAu,o=c.createOscillator(),g=c.createGain(),n=c.currentTime;
    const P={shot:[520,160,.07,'square',.05],hit:[220,90,.12,'sawtooth',.07],boom:[120,30,.35,'sawtooth',.12],shield:[500,900,.18,'sine',.06],dash:[200,600,.14,'triangle',.05],mine:[300,200,.1,'square',.04]}[t];if(!P)return;
    o.type=P[3];o.frequency.setValueAtTime(P[0],n);o.frequency.exponentialRampToValueAtTime(Math.max(20,P[1]),n+P[2]);g.gain.setValueAtTime(P[4],n);g.gain.exponentialRampToValueAtTime(.0001,n+P[2]);o.connect(g);g.connect(c.destination);o.start(n);o.stop(n+P[2]+.02)}catch{}
}

// ---------- камера и отрисовка ----------
function tkCamSnap(){const f=tk.me||Object.values(tk.players)[0];if(f)tk.cam={x:f.x,y:f.y}}
function tkLoop(t){
  if(!tk||tk.phase==='lobby')return;
  const dt=Math.min(.05,(t-tk.last)/1000);tk.last=t;
  tkStep(tk.phase==='over'?dt*.5:dt);tkDraw();tk.raf=requestAnimationFrame(tkLoop);
}
const tkZoom=(cw,ch)=>Math.max(.32,Math.min(cw/1050,ch/640));
function tkDraw(){
  const cv=$('tkCv'),g=cv.getContext('2d'),dpr=devicePixelRatio||1,cw=cv.clientWidth,ch=cv.clientHeight;
  if(cv.width!==Math.round(cw*dpr)||cv.height!==Math.round(ch*dpr)){cv.width=Math.round(cw*dpr);cv.height=Math.round(ch*dpr)}
  const z=tkZoom(cw,ch),f=tk.me&&tk.me.al?tk.me:(Object.values(tk.players).find(p=>p.al)||tk.me||{x:TK.W/2,y:TK.H/2});
  tk.cam.x+=(f.x-tk.cam.x)*.18;tk.cam.y+=(f.y-tk.cam.y)*.18;
  const vw=cw/z,vh=ch/z;tk.cam.x=Math.max(vw/2,Math.min(TK.W-vw/2,tk.cam.x));tk.cam.y=Math.max(vh/2,Math.min(TK.H-vh/2,tk.cam.y));
  if(vw>TK.W)tk.cam.x=TK.W/2;if(vh>TK.H)tk.cam.y=TK.H/2;
  const sh=tk.shake>0?tk.shake*14:0,sx=(Math.random()-.5)*sh,sy=(Math.random()-.5)*sh;
  const ox=cw/2-tk.cam.x*z+sx,oy=ch/2-tk.cam.y*z+sy;tk.view={z,ox,oy,cw,ch};
  g.setTransform(dpr,0,0,dpr,0,0);g.fillStyle='#0d0f14';g.fillRect(0,0,cw,ch);
  g.save();g.translate(ox,oy);g.scale(z,z);
  const x0=tk.cam.x-vw/2-60,x1=tk.cam.x+vw/2+60,y0=tk.cam.y-vh/2-60,y1=tk.cam.y+vh/2+60;
  const css=getComputedStyle(document.documentElement),acc=css.getPropertyValue('--acc').trim()||'#8b5cf6';
  const gr=g.createLinearGradient(0,0,TK.W,TK.H);gr.addColorStop(0,'#2c3a2a');gr.addColorStop(.5,'#34452f');gr.addColorStop(1,'#2a3828');g.fillStyle=gr;g.fillRect(0,0,TK.W,TK.H);
  g.strokeStyle='rgba(255,255,255,.04)';g.lineWidth=2;
  for(let x=Math.floor(Math.max(0,x0)/100)*100;x<=Math.min(TK.W,x1);x+=100){g.beginPath();g.moveTo(x,Math.max(0,y0));g.lineTo(x,Math.min(TK.H,y1));g.stroke()}
  for(let y=Math.floor(Math.max(0,y0)/100)*100;y<=Math.min(TK.H,y1);y+=100){g.beginPath();g.moveTo(Math.max(0,x0),y);g.lineTo(Math.min(TK.W,x1),y);g.stroke()}
  for(const d of tk.decor){if(d.x<x0||d.x>x1||d.y<y0||d.y>y1)continue;
    if(d.k===0){g.strokeStyle='rgba(120,160,90,.55)';g.lineWidth=2;g.beginPath();for(let i=-1;i<=1;i++){g.moveTo(d.x+i*5*d.s,d.y);g.lineTo(d.x+i*8*d.s,d.y-12*d.s)}g.stroke()}
    else{g.fillStyle='rgba(0,0,0,.18)';g.beginPath();g.ellipse(d.x+2,d.y+3,10*d.s,6*d.s,0,0,7);g.fill();g.fillStyle='#6b7280';g.beginPath();g.ellipse(d.x,d.y,9*d.s,6*d.s,d.a,0,7);g.fill()}}
  g.lineWidth=14;g.strokeStyle=acc;g.globalAlpha=.55;g.strokeRect(-7,-7,TK.W+14,TK.H+14);g.globalAlpha=1;
  for(const w of tk.walls){if(w.x>x1||w.x+w.w<x0||w.y>y1||w.y+w.h<y0)continue;
    g.fillStyle='rgba(0,0,0,.3)';g.beginPath();g.roundRect(w.x+8,w.y+10,w.w,w.h,10);g.fill();
    g.fillStyle='#4b5563';g.beginPath();g.roundRect(w.x,w.y,w.w,w.h,10);g.fill();
    g.fillStyle='#6b7280';g.beginPath();g.roundRect(w.x+4,w.y+4,w.w-8,w.h-12,8);g.fill();
    g.strokeStyle='rgba(255,255,255,.12)';g.lineWidth=2;g.beginPath();g.moveTo(w.x+12,w.y+10);g.lineTo(w.x+w.w-12,w.y+10);g.stroke();
    g.fillStyle='rgba(0,0,0,.14)';for(let i=0;i<Math.floor(w.w/40);i++)g.fillRect(w.x+16+i*40,w.y+w.h*.45,22,4)}
  for(const mn of tk.mines){const own=tk.players[mn.id],blink=mn.arm<=0&&Math.sin(tk.time*10)>0;
    g.fillStyle='rgba(0,0,0,.35)';g.beginPath();g.arc(mn.x+2,mn.y+3,13,0,7);g.fill();g.fillStyle='#374151';g.beginPath();g.arc(mn.x,mn.y,12,0,7);g.fill();
    g.strokeStyle='#9ca3af';g.lineWidth=2;for(let i=0;i<8;i++){const a=i*Math.PI/4;g.beginPath();g.moveTo(mn.x+Math.cos(a)*11,mn.y+Math.sin(a)*11);g.lineTo(mn.x+Math.cos(a)*17,mn.y+Math.sin(a)*17);g.stroke()}
    g.fillStyle=blink?'#ef4444':(own?tkCol(own.hue):'#999');g.beginPath();g.arc(mn.x,mn.y,4,0,7);g.fill()}
  for(const p of Object.values(tk.players)){
    if(p.x==null||p.x<x0||p.x>x1||p.y<y0||p.y>y1)continue;
    if(!p.al){if(p.dead){g.globalAlpha=.5;tkTank(g,p,true);g.globalAlpha=1}continue}
    tkTank(g,p,false);
  }
  for(const b of tk.bullets){const sp=Math.hypot(b.vx,b.vy)||1,tx=b.x-b.vx/sp*22,ty=b.y-b.vy/sp*22;
    const o=tk.players[b.o];const gl=g.createLinearGradient(tx,ty,b.x,b.y);gl.addColorStop(0,'rgba(253,224,71,0)');gl.addColorStop(1,'rgba(253,224,71,.9)');
    g.strokeStyle=gl;g.lineWidth=5;g.lineCap='round';g.beginPath();g.moveTo(tx,ty);g.lineTo(b.x,b.y);g.stroke();
    g.fillStyle='#fff7ae';g.beginPath();g.arc(b.x,b.y,4.5,0,7);g.fill();g.fillStyle=o?tkCol(o.hue,60):'#fde047';g.globalAlpha=.5;g.beginPath();g.arc(b.x,b.y,8,0,7);g.fill();g.globalAlpha=1}
  for(const e of tk.boom){const k=e.t/.7;g.globalAlpha=Math.max(0,1-k);g.strokeStyle='#fb923c';g.lineWidth=8*(1-k)+2;g.beginPath();g.arc(e.x,e.y,(20+k*110)*e.sz,0,7);g.stroke();
    g.fillStyle='rgba(255,230,150,'+(.5*(1-k))+')';g.beginPath();g.arc(e.x,e.y,(14+k*50)*e.sz,0,7);g.fill();g.globalAlpha=1}
  for(const q of tk.parts){const k=q.l/q.m;g.globalAlpha=Math.max(0,k);g.fillStyle=q.c;const s=q.k==='smoke'||q.k==='dust'?q.s*(2-k):q.s*k;g.beginPath();g.arc(q.x,q.y,Math.max(.5,s),0,7);g.fill()}g.globalAlpha=1;
  g.restore();
  tkOverlay(g,cw,ch,z);
}
function tkTank(g,p,wreck){
  const R=TK.R,c=wreck?tkCol(p.hue,22,18):tkCol(p.hue,52),dk=wreck?'#222':tkCol(p.hue,30),lt=tkCol(p.hue,68);
  g.save();g.translate(p.x,p.y);
  g.fillStyle='rgba(0,0,0,.35)';g.beginPath();g.ellipse(5,8,R*1.25,R,p.ba,0,7);g.fill();
  g.rotate(p.ba);
  g.fillStyle='#1f2229';for(const sy of [-1,1]){g.beginPath();g.roundRect(-R*1.15,sy*R*.62-R*.32,R*2.3,R*.64,5);g.fill()}
  g.strokeStyle='rgba(255,255,255,.18)';g.lineWidth=2;const off=(p.trav*.6)%8;
  for(const sy of [-1,1])for(let x=-R*1.1-off+8;x<R*1.1;x+=8){if(x>-R*1.1){g.beginPath();g.moveTo(x,sy*R*.62-R*.28);g.lineTo(x,sy*R*.62+R*.28);g.stroke()}}
  g.fillStyle=c;g.strokeStyle=dk;g.lineWidth=3;g.beginPath();g.roundRect(-R*.95,-R*.62,R*1.9,R*1.24,6);g.fill();g.stroke();
  g.fillStyle=lt;g.globalAlpha=.35;g.beginPath();g.roundRect(-R*.85,-R*.55,R*1.1,R*.4,5);g.fill();g.globalAlpha=1;
  g.fillStyle=dk;g.fillRect(-R*.95,-R*.2,5,R*.4);
  g.rotate(-p.ba);g.rotate(p.a);
  g.fillStyle=dk;g.beginPath();g.roundRect(R*.2,-R*.17,R*1.25,R*.34,3);g.fill();g.fillStyle=lt;g.fillRect(R*1.3,-R*.22,R*.2,R*.44);
  g.fillStyle=c;g.strokeStyle=dk;g.lineWidth=3;g.beginPath();g.arc(0,0,R*.58,0,7);g.fill();g.stroke();
  g.fillStyle=lt;g.beginPath();g.arc(-R*.12,-R*.12,R*.2,0,7);g.fill();
  g.rotate(-p.a);
  if(!wreck&&p.sh&&p.shT>0){const k=.5+.5*Math.sin(tk.time*9);g.strokeStyle='rgba(125,211,252,'+(.55+.3*k)+')';g.lineWidth=4;g.fillStyle='rgba(56,189,248,.18)';g.beginPath();g.arc(0,0,R*1.65,0,7);g.fill();g.stroke()}
  g.restore();
  if(wreck){if(Math.random()<.2)tkPart(p.x+(Math.random()-.5)*20,p.y,'smoke');return}
  if(p.hp<=1&&Math.random()<.25)tkPart(p.x,p.y-4,'smoke');
  g.textAlign='center';g.font='700 15px Manrope,system-ui,sans-serif';g.lineWidth=3;g.strokeStyle='rgba(0,0,0,.6)';g.strokeText(p.name,p.x,p.y-R-20);g.fillStyle='#fff';g.fillText(p.name,p.x,p.y-R-20);
  const bw=34,bx=p.x-bw/2,by=p.y-R-14;g.fillStyle='rgba(0,0,0,.55)';g.beginPath();g.roundRect(bx-2,by-2,bw+4,9,4);g.fill();
  const k=Math.max(0,p.hp)/TK.HP;g.fillStyle=k>.5?'#4ade80':k>.25?'#facc15':'#ef4444';g.beginPath();g.roundRect(bx,by,bw*k,5,3);g.fill();
}
function tkOverlay(g,cw,ch,z){
  const mw=Math.min(150,cw*.28),mh=mw*TK.H/TK.W,mx=cw-mw-10,my=ch-mh-(matchMedia('(pointer:coarse)').matches?200:10),k=mw/TK.W;
  g.save();g.globalAlpha=.88;g.fillStyle='rgba(10,12,16,.7)';g.beginPath();g.roundRect(mx-3,my-3,mw+6,mh+6,8);g.fill();g.fillStyle='#2f3d2c';g.fillRect(mx,my,mw,mh);
  g.fillStyle='#6b7280';for(const w of tk.walls)g.fillRect(mx+w.x*k,my+w.y*k,Math.max(1.5,w.w*k),Math.max(1.5,w.h*k));
  for(const p of Object.values(tk.players)){if(!p.al||p.x==null)continue;g.fillStyle=tkCol(p.hue,60);g.beginPath();g.arc(mx+p.x*k,my+p.y*k,p.id===me?3.6:2.6,0,7);g.fill();if(p.id===me){g.strokeStyle='#fff';g.lineWidth=1.2;g.stroke()}}
  const vw=cw/z*k,vh=ch/z*k;g.strokeStyle='rgba(255,255,255,.5)';g.lineWidth=1;g.strokeRect(mx+tk.cam.x*k-vw/2,my+tk.cam.y*k-vh/2,vw,vh);g.restore();
  g.fillStyle='#fff';g.textAlign='center';
  if(tk.count>0){g.font='800 130px Manrope,system-ui,sans-serif';g.fillText(String(Math.ceil(tk.count)),cw/2,ch/2+44)}
  else if(tk.me&&tk.me.dead&&tk.phase==='play'){g.font='700 22px Manrope,system-ui,sans-serif';g.fillText('Вас подбили · возрождение через '+Math.max(0,Math.ceil(tk.me.respawn))+' с',cw/2,70)}
  else if(!tk.me){g.font='700 20px Manrope,system-ui,sans-serif';g.fillText('Вы наблюдаете — вступите со следующего раунда',cw/2,70)}
  if(tk.me){for(const k2 in TK_AB){const b=$('tkAb-'+k2);if(!b)continue;const cd=tk.me.cd[k2],f=Math.max(0,cd/TK_AB[k2].cd);b.style.setProperty('--p',(f*100).toFixed(0)+'%');b.classList.toggle('rdy',cd<=0&&tk.me.al)}}
}
function tkScore(){
  const box=$('tkScore');if(!box||!tk)return;box.innerHTML='';
  Object.values(tk.players).sort((a,b)=>b.sc-a.sc).forEach(p=>{const c=el('span','tk-chip'+(p.id===me?' me':'')+(p.al?'':' dead'));c.style.setProperty('--c',tkCol(p.hue));c.append(el('i'),el('b',null,p.name.split(' ')[0]),el('em',null,String(p.sc)));box.append(c)});
  box.append(el('small',null,'до '+TK.WIN));
}
function tkPing(){const e=$('tkPing');if(!e||!tk)return;e.textContent=tk.ping?tk.ping+' мс':'';e.className='tk-ping'+(tk.ping>220?' bad':tk.ping>110?' mid':'')}

// ---------- интерфейс ----------
function tkUI(){
  const w=el('div','tk');w.id='tk';
  const cv=document.createElement('canvas');cv.id='tkCv';cv.className='tk-cv';w.append(cv);
  const hud=el('div','tk-hud hide');hud.id='tkHud';const sc=el('div','tk-score');sc.id='tkScore';
  const pg=el('span','tk-ping');pg.id='tkPing';
  const x=el('button','icon tk-x');x.append(svgI('i-x'));x.title='Выйти';x.onclick=()=>{if(confirm('Выйти из игры?'))tkClose()};hud.append(sc,pg,x);w.append(hud);
  const sl=el('div','tk-stick l');sl.append(el('i'));const sr=el('div','tk-stick r');sr.append(el('i'),el('span',null,'Огонь'));w.append(sl,sr);
  const abs=el('div','tk-abs hide');abs.id='tkAbs';
  Object.entries(TK_AB).forEach(([k,a])=>{const b=el('button','tk-ab');b.id='tkAb-'+k;b.title=a.name+' ('+a.k.toUpperCase()+')';b.append(svgI(a.ic),el('small',null,a.name),el('kbd',null,a.k.toUpperCase()));
    b.onpointerdown=e=>{e.preventDefault();e.stopPropagation();if(tk.me)tkAbility(tk.me,k)};abs.append(b)});
  w.append(abs);
  const lobby=el('div','tk-lobby');lobby.id='tkLobby';const over=el('div','tk-over hide');over.id='tkOver';w.append(lobby,over);
  document.body.append(w);requestAnimationFrame(()=>w.classList.add('in'));
  const abKey={q:'shield',e:'dash',shift:'dash',f:'mine',r:'fan'};
  tk.onKey=(e,down)=>{if(!tk||e.target.matches?.('input,textarea'))return;const k=e.key.length===1?e.key.toLowerCase():e.key;
    if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(k)){tk.keys[k]=down;e.preventDefault()}
    else if(down&&!e.repeat&&abKey[k.toLowerCase()]&&tk.me){tkAbility(tk.me,abKey[k.toLowerCase()]);e.preventDefault()}};
  tk.kd=e=>tk.onKey(e,true);tk.ku=e=>tk.onKey(e,false);window.addEventListener('keydown',tk.kd);window.addEventListener('keyup',tk.ku);
  const world=e=>{const r=cv.getBoundingClientRect(),v=tk.view;return v?{x:(e.clientX-r.left-v.ox)/v.z,y:(e.clientY-r.top-v.oy)/v.z}:{x:0,y:0}};
  cv.onmousemove=e=>{if(e.pointerType==='touch')return;tk.mouse=world(e)};
  cv.onpointerdown=e=>{if(e.pointerType==='touch')return;tk.mouse=world(e);tk.firing=true};
  window.addEventListener('pointerup',tk.pu=()=>{tk.firing=false});
  const stick=(el0,key)=>{let id=null,cx=0,cy=0;const th=el0.querySelector('i'),R=46;
    const mv=e=>{if(e.pointerId!==id)return;let dx=e.clientX-cx,dy=e.clientY-cy;const d=Math.hypot(dx,dy),k=Math.min(1,d/R);
      if(d>R){dx*=R/d;dy*=R/d}th.style.transform='translate('+dx+'px,'+dy+'px)';tk.st[key]=key==='l'?{x:dx/R,y:dy/R}:{a:Math.atan2(dy,dx),m:k}};
    el0.onpointerdown=e=>{id=e.pointerId;el0.setPointerCapture(id);const r=el0.getBoundingClientRect();cx=r.left+r.width/2;cy=r.top+r.height/2;mv(e)};
    el0.onpointermove=mv;const up=e=>{if(e.pointerId!==id)return;id=null;tk.st[key]=null;th.style.transform=''};el0.onpointerup=el0.onpointercancel=up};
  stick(sl,'l');stick(sr,'r');
  tkLobby();
}
function tkLobby(){
  const box=$('tkLobby');if(!box||!tk)return;box.innerHTML='';
  const c=el('div','tk-card');
  const ic=el('div','tk-ic');ic.append(svgI('i-tank'));
  c.append(ic,el('h2',null,'Танки'),el('p','tk-sub','Большая арена, 4 способности: щит, рывок, мина, веер. До '+TK.WIN+' побед. Комната '));
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
async function startTanksInvite(){
  if(!cur){toast('Откройте чат, куда позвать играть');return}
  const code=tkCode();openTanks(code);
  try{await sendMsg(cur,{body:'::game:tk:'+code+'::'},{noReply:true})}catch(e){toast('Приглашение не отправилось: '+e.message)}
}
SPECIAL.push({re:/^::game:tk:([A-Za-z0-9]{3,8})::$/,cls:'tkcard-m',forward:false,preview:()=>PI('i-tank')+'Приглашение в «Танки»',
  render:(m,d,x)=>{const w=el('div','tkcard');const ic=el('div','tkcard-ic');ic.append(svgI('i-tank'));
    const t=el('div','tkcard-t');t.append(el('b',null,'Танки'),el('small',null,(m.sender===me?'Вы зовёте':nameOf(m.sender)+' зовёт')+' играть · комната '+x[1].toUpperCase()));
    const b=el('button','primary sm-btn','Играть');b.onclick=e=>{e.stopPropagation();openTanks(x[1])};w.append(ic,t,b);d.append(w)}});
