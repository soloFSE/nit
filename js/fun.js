// Опросы, мини-игры (кубик, монетка, камень-ножницы-бумага, крестики-нолики), анимации на слова
// ---------- Опросы: ::poll::{"q":"...","o":["..",".."],"m":false} ----------
const POLL_RE=/^::poll::(\{.*\})$/s;
const pollOf=b=>{const x=(b||'').match(POLL_RE);if(!x)return null;try{return JSON.parse(x[1])}catch{return null}};
let votes={};

function openPollEditor(){
  if(!cur)return;
  openModal(s=>{
    const top=el('div','sheet-top');top.append(el('h3',null,'Новый опрос'));const x=el('button','icon','✕');x.onclick=closeModal;top.append(x);s.append(top);
    const ql=el('label','fld');ql.append(el('span',null,'Вопрос'));const q=document.createElement('input');q.maxLength=200;q.placeholder='Куда идём в субботу?';ql.append(q);s.append(ql);
    const ol=el('div','fld');ol.append(el('span',null,'Варианты'));const box=el('div','popts');ol.append(box);s.append(ol);
    const add=()=>{if(box.children.length>=10)return;const i=document.createElement('input');i.maxLength=100;i.placeholder='Вариант '+(box.children.length+1);
      i.oninput=()=>{if(i===box.lastElementChild&&i.value&&box.children.length<10)add()};box.append(i)};
    add();add();
    const ml=el('label','check');const mc=document.createElement('input');mc.type='checkbox';ml.append(mc,document.createTextNode(' Можно выбрать несколько'));s.append(ml);
    const err=el('p','err');s.append(err);
    const b=el('button','primary wide','Отправить опрос');s.append(b);
    b.onclick=async()=>{
      const o=[...box.children].map(i=>i.value.trim()).filter(Boolean);
      if(!q.value.trim()){err.textContent='Напишите вопрос';return}
      if(o.length<2){err.textContent='Нужно хотя бы 2 варианта';return}
      b.disabled=true;
      try{await sendMsg(cur,{body:'::poll::'+JSON.stringify({q:q.value.trim(),o,m:mc.checked})});closeModal()}
      catch(e){err.textContent=e.message;b.disabled=false}
    };
    setTimeout(()=>q.focus(),50);
  });
}
async function loadVotes(ids){
  ids=ids.filter(Boolean);if(!ids.length)return;
  const {data,error}=await sb.from('poll_votes').select('message_id,user_id,option').in('message_id',ids);
  if(error)return;
  ids.forEach(i=>votes[i]=[]);(data||[]).forEach(v=>votes[v.message_id].push(v));
  ids.forEach(i=>{if(nodes[i]&&msgs[i])draw(msgs[i])});
}
async function vote(m,i,multi){
  const mine=(votes[m.id]||[]).filter(v=>v.user_id===me),had=mine.some(v=>v.option===i);
  const q=()=>sb.from('poll_votes');
  // Сразу показываем, потом пишем в базу
  let list=(votes[m.id]||[]).filter(v=>v.user_id!==me||(multi&&v.option!==i));
  if(!had)list.push({message_id:m.id,user_id:me,option:i});
  votes[m.id]=list;draw(m);
  let error;
  if(had)({error}=await q().delete().eq('message_id',m.id).eq('user_id',me).eq('option',i));
  else{if(!multi&&mine.length)await q().delete().eq('message_id',m.id).eq('user_id',me);({error}=await q().insert({message_id:m.id,user_id:me,option:i}))}
  if(error){alert('Голос не сохранился: '+(/relation|schema cache/i.test(error.message)?'запустите supabase/more.sql':error.message));loadVotes([m.id])}
}
SPECIAL.push({re:POLL_RE,cls:'poll-m',preview:x=>{try{return '📊 '+JSON.parse(x[1]).q}catch{return '📊 Опрос'}},render:(m,d)=>{
  const p=pollOf(m.body);if(!p)return;
  const vs=votes[m.id]||[],voters=new Set(vs.map(v=>v.user_id)),mine=new Set(vs.filter(v=>v.user_id===me).map(v=>v.option));
  const w=el('div','poll');
  w.append(el('div','poll-k',p.m?'Опрос · несколько ответов':'Опрос'),el('b','poll-q',p.q));
  p.o.forEach((t,i)=>{
    const n=vs.filter(v=>v.option===i).length,pct=voters.size?Math.round(n/voters.size*100):0;
    const b=el('button','popt'+(mine.has(i)?' mine':''));
    b.style.setProperty('--p',pct+'%');
    b.append(el('span','popt-c',mine.has(i)?'✓':''),el('span','popt-t',t),el('span','popt-n',voters.size?pct+'%':''));
    b.title=vs.filter(v=>v.option===i).map(v=>nameOf(v.user_id)).join(', ');
    b.onclick=e=>{e.stopPropagation();vote(m,i,p.m)};w.append(b);
  });
  w.append(el('small','poll-f',voters.size?voters.size+' '+plural(voters.size,'голос','голоса','голосов'):'Пока никто не голосовал'));
  d.append(w);
}});

// ---------- Кубик, монетка, КНБ ----------
const rnd=n=>crypto.getRandomValues(new Uint32Array(1))[0]%n;
const DICE='⚀⚁⚂⚃⚄⚅',RPS=[['✊','Камень'],['✌️','Ножницы'],['✋','Бумага']];
async function sendGame(kind){
  if(!cur)return;
  const body=kind==='dice'?'::dice:'+(rnd(6)+1)+'::':kind==='coin'?'::coin:'+rnd(2)+'::':kind==='rps'?'::rps:'+rnd(3)+'::':
    '::ttt::'+JSON.stringify({b:'---------',t:'x',x:me,o:'',w:''});
  try{await sendMsg(cur,{body})}catch(e){alert('Не отправилось: '+e.message)}
}
const fresh=m=>Date.now()-new Date(m.created_at)<4000;
SPECIAL.push({re:/^::dice:([1-6])::$/,cls:'game-m',forward:false,preview:x=>'🎲 Кубик: '+x[1],render:(m,d,x)=>{
  const w=el('div','game');const f=el('div','die'+(fresh(m)?' roll':''),DICE[x[1]-1]);
  w.append(f,el('span',null,'Выпало '+x[1]));d.append(w);
}});
SPECIAL.push({re:/^::coin:([01])::$/,cls:'game-m',forward:false,preview:x=>'🪙 '+(x[1]==='0'?'Орёл':'Решка'),render:(m,d,x)=>{
  const w=el('div','game');w.append(el('div','coin'+(fresh(m)?' flip':''),x[1]==='0'?'🦅':'🪙'),el('span',null,x[1]==='0'?'Орёл':'Решка'));d.append(w);
}});
SPECIAL.push({re:/^::rps:([0-2])::$/,cls:'game-m',forward:false,preview:x=>RPS[x[1]][0]+' '+RPS[x[1]][1],render:(m,d,x)=>{
  const w=el('div','game');w.append(el('div','rps'+(fresh(m)?' shake':''),RPS[x[1]][0]),el('span',null,RPS[x[1]][1]));d.append(w);
}});

// ---------- Крестики-нолики: ход проверяет база (ttt_move) ----------
SPECIAL.push({re:/^::ttt::(\{.*\})$/s,cls:'ttt-m',forward:false,preview:()=>'❌⭕ Крестики-нолики',render:(m,d,x)=>{
  let st;try{st=JSON.parse(x[1])}catch{return}
  const w=el('div','ttt');
  const lbl=v=>v==='x'?'❌':v==='o'?'⭕':'';
  const who=id=>id?(id===me?'вы':nameOf(id)):'кто угодно';
  const status=st.w==='d'?'Ничья 🤝':st.w?'Победа: '+lbl(st.w)+' '+who(st.w==='x'?st.x:st.o):
    'Ход '+lbl(st.t)+' — '+(st.t==='x'?who(st.x):st.o?who(st.o):'кто угодно, кроме '+nameOf(st.x));
  w.append(el('b','ttt-h','Крестики-нолики'),el('small','ttt-s',status));
  const g=el('div','ttt-g');
  const myTurn=!st.w&&((st.t==='x'&&st.x===me)||(st.t==='o'&&(st.o?st.o===me:st.x!==me)));
  [...st.b].forEach((c,i)=>{
    const b=el('button','cell'+(c!=='-'?' '+c:''),c==='-'?'':lbl(c));
    b.disabled=c!=='-'||!myTurn;
    b.onclick=async e=>{e.stopPropagation();g.querySelectorAll('button').forEach(z=>z.disabled=true);
      const {data,error}=await sb.rpc('ttt_move',{mid:m.id,cell:i});
      if(error){alert(/function|schema cache/i.test(error.message)?'Запустите supabase/more.sql в Supabase.':error.message);draw(m);return}
      line({...m,body:'::ttt::'+data});
      const ns=JSON.parse(data);if(ns.w&&ns.w!=='d')fx('confetti');
    };g.append(b);
  });
  w.append(g);
  if(st.w&&m.sender===me||st.w&&st.o===me){const r=el('button','ghost sm-btn','Ещё партию');r.onclick=e=>{e.stopPropagation();sendGame('ttt')};w.append(r)}
  d.append(w);
}});

// ---------- Анимации на слова ----------
const FX_WORDS=[
  [/(с\s*д(нём|нем)\s*рождени|\bс\s*др\b|поздравля|\bура+\b|🎉|🥳|🎂)/i,'confetti'],
  [/(люблю|❤️|💕|💖|сердечк|обнимаю)/i,'hearts'],
  [/(снег|❄️|☃️|зим[аы]|новым\s*годом|🎄)/i,'snow'],
];
function fxFor(t){if(!t||t.startsWith('::'))return;for(const [re,k] of FX_WORDS)if(re.test(t)){fx(k);return}}
function fx(kind){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const c=document.createElement('canvas');c.className='fx';document.body.append(c);
  const W=c.width=innerWidth*devicePixelRatio,H=c.height=innerHeight*devicePixelRatio,x=c.getContext('2d'),k=devicePixelRatio;
  const cols=['#e5172b','#ffb703','#3a86ff','#8338ec','#06d6a0','#ff006e'];
  const N=kind==='confetti'?160:kind==='hearts'?40:90,P=[];
  for(let i=0;i<N;i++)P.push(kind==='confetti'
    ?{x:W/2+(Math.random()-.5)*W*.3,y:H*.7,vx:(Math.random()-.5)*14*k,vy:-(Math.random()*16+8)*k,r:Math.random()*6*k+3*k,c:cols[i%6],a:Math.random()*6,va:(Math.random()-.5)*.3}
    :kind==='hearts'?{x:Math.random()*W,y:H+Math.random()*H*.3,vx:(Math.random()-.5)*k,vy:-(Math.random()*3+2)*k,r:(Math.random()*18+14)*k,a:0}
    :{x:Math.random()*W,y:-Math.random()*H*.5,vx:(Math.random()-.5)*k,vy:(Math.random()*2+1.2)*k,r:(Math.random()*3+1.5)*k});
  const t0=performance.now();
  (function step(t){
    const e=t-t0;x.clearRect(0,0,W,H);x.globalAlpha=Math.max(0,Math.min(1,(3200-e)/600));
    P.forEach(p=>{
      if(kind==='confetti'){p.vy+=.45*k;p.vx*=.99;p.x+=p.vx;p.y+=p.vy;p.a+=p.va;x.save();x.translate(p.x,p.y);x.rotate(p.a);x.fillStyle=p.c;x.fillRect(-p.r,-p.r/2,p.r*2,p.r);x.restore()}
      else if(kind==='hearts'){p.x+=p.vx+Math.sin(e/300+p.r)*.6*k;p.y+=p.vy;x.font=p.r+'px serif';x.fillText('❤️',p.x,p.y)}
      else{p.x+=p.vx+Math.sin(e/600+p.r)*.5*k;p.y+=p.vy;x.fillStyle='rgba(255,255,255,.95)';x.beginPath();x.arc(p.x,p.y,p.r,0,7);x.fill();x.strokeStyle='rgba(120,160,220,.5)';x.stroke()}
    });
    if(e<3200)requestAnimationFrame(step);else c.remove();
  })(t0);
}
