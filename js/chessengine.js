// Шахматный движок «Нити»: полные правила (рокировка, взятие на проходе, превращение, шах/мат/пат, ничьи) и простой бот.
// Доска — массив из 64 клеток: 0 = a8, 7 = h8, 56 = a1, 63 = h1 (как в FEN). Белые — заглавные буквы, чёрные — строчные.
// Состояние неизменяемое: chApply() возвращает новое состояние (так проще откатывать ходы и искать лучший ход ботом).
const CH_START='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const CH_KN=[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]],CH_DG=[[-1,-1],[-1,1],[1,-1],[1,1]],CH_OR=[[-1,0],[1,0],[0,-1],[0,1]];
const chIsW=p=>p>='A'&&p<='Z',chSide=p=>chIsW(p)?'w':'b';
const chSq=i=>'abcdefgh'[i&7]+(8-(i>>3));
const chIdx=s=>(8-+s[1])*8+'abcdefgh'.indexOf(s[0]);

function chFen(fen){
  const [pl,tn,ca,ep,hm,fm]=(fen||CH_START).split(' '),b=[];
  for(const ch of pl){if(ch==='/')continue;if(ch>='1'&&ch<='8')for(let k=0;k<+ch;k++)b.push(null);else b.push(ch)}
  return {b,w:tn!=='b',c:{K:ca.includes('K'),Q:ca.includes('Q'),k:ca.includes('k'),q:ca.includes('q')},ep:ep&&ep!=='-'?chIdx(ep):-1,hm:+hm||0,fm:+fm||1};
}
function chToFen(s){
  let o='';for(let r=0;r<8;r++){let e=0;for(let c=0;c<8;c++){const p=s.b[r*8+c];if(!p)e++;else{if(e){o+=e;e=0}o+=p}}if(e)o+=e;if(r<7)o+='/'}
  const ca=(s.c.K?'K':'')+(s.c.Q?'Q':'')+(s.c.k?'k':'')+(s.c.q?'q':'')||'-';
  return o+' '+(s.w?'w':'b')+' '+ca+' '+(s.ep>=0?chSq(s.ep):'-')+' '+s.hm+' '+s.fm;
}
const chKey=s=>chToFen(s).split(' ').slice(0,4).join(' '); // позиция без счётчиков — для троекратного повторения

// Атакована ли клетка idx фигурами стороны byW
function chAttacked(s,idx,byW){
  const b=s.b,r=idx>>3,c=idx&7;
  const pr=byW?r+1:r-1,pp=byW?'P':'p';
  if(pr>=0&&pr<8){for(const dc of [-1,1]){const cc=c+dc;if(cc>=0&&cc<8&&b[pr*8+cc]===pp)return true}}
  const kn=byW?'N':'n';for(const [dr,dc] of CH_KN){const rr=r+dr,cc=c+dc;if(rr>=0&&rr<8&&cc>=0&&cc<8&&b[rr*8+cc]===kn)return true}
  const kg=byW?'K':'k';for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const rr=r+dr,cc=c+dc;if(rr>=0&&rr<8&&cc>=0&&cc<8&&b[rr*8+cc]===kg)return true}
  const bq=byW?'BQ':'bq',rq=byW?'RQ':'rq';
  for(const [dr,dc] of CH_DG){let rr=r+dr,cc=c+dc;while(rr>=0&&rr<8&&cc>=0&&cc<8){const p=b[rr*8+cc];if(p){if(bq.includes(p))return true;break}rr+=dr;cc+=dc}}
  for(const [dr,dc] of CH_OR){let rr=r+dr,cc=c+dc;while(rr>=0&&rr<8&&cc>=0&&cc<8){const p=b[rr*8+cc];if(p){if(rq.includes(p))return true;break}rr+=dr;cc+=dc}}
  return false;
}
const chKing=(s,w)=>s.b.indexOf(w?'K':'k');
const chInCheck=(s,w=s.w)=>{const k=chKing(s,w);return k>=0&&chAttacked(s,k,!w)};

// Псевдо-ходы (без проверки шаха своему королю)
function chPseudo(s,capsOnly){
  const b=s.b,w=s.w,out=[];
  const add=(f,t,x)=>out.push({f,t,pr:'',ep:false,cs:'',cap:b[t]||null,...x});
  for(let i=0;i<64;i++){
    const p=b[i];if(!p||chIsW(p)!==w)continue;const r=i>>3,c=i&7,P=p.toUpperCase();
    if(P==='P'){
      const dir=w?-1:1,start=w?6:1,last=w?0:7,r1=r+dir;
      if(r1>=0&&r1<8){
        if(!b[r1*8+c]&&!capsOnly){
          if(r1===last)for(const q of 'qrbn')add(i,r1*8+c,{pr:q});else{add(i,r1*8+c);if(r===start&&!b[(r+2*dir)*8+c])add(i,(r+2*dir)*8+c)}
        }else if(!b[r1*8+c]&&capsOnly&&r1===last)add(i,r1*8+c,{pr:'q'});
        for(const dc of [-1,1]){const cc=c+dc;if(cc<0||cc>7)continue;const t=r1*8+cc,tp=b[t];
          if(tp&&chIsW(tp)!==w){if(r1===last)for(const q of 'qrbn')add(i,t,{pr:q});else add(i,t)}
          else if(t===s.ep)add(i,t,{ep:true,cap:w?'p':'P'})}
      }
    }else if(P==='N'){
      for(const [dr,dc] of CH_KN){const rr=r+dr,cc=c+dc;if(rr<0||rr>7||cc<0||cc>7)continue;const t=rr*8+cc,tp=b[t];if(!tp?!capsOnly:chIsW(tp)!==w)add(i,t)}
    }else if(P==='K'){
      for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const rr=r+dr,cc=c+dc;if(rr<0||rr>7||cc<0||cc>7)continue;const t=rr*8+cc,tp=b[t];if(!tp?!capsOnly:chIsW(tp)!==w)add(i,t)}
      if(!capsOnly){
        const home=w?60:4;
        if(i===home&&!chAttacked(s,home,!w)){
          if((w?s.c.K:s.c.k)&&!b[home+1]&&!b[home+2]&&b[home+3]===(w?'R':'r')&&!chAttacked(s,home+1,!w)&&!chAttacked(s,home+2,!w))add(i,home+2,{cs:'K'});
          if((w?s.c.Q:s.c.q)&&!b[home-1]&&!b[home-2]&&!b[home-3]&&b[home-4]===(w?'R':'r')&&!chAttacked(s,home-1,!w)&&!chAttacked(s,home-2,!w))add(i,home-2,{cs:'Q'});
        }
      }
    }else{
      const dirs=P==='B'?CH_DG:P==='R'?CH_OR:[...CH_DG,...CH_OR];
      for(const [dr,dc] of dirs){let rr=r+dr,cc=c+dc;while(rr>=0&&rr<8&&cc>=0&&cc<8){const t=rr*8+cc,tp=b[t];
        if(!tp){if(!capsOnly)add(i,t)}else{if(chIsW(tp)!==w)add(i,t);break}rr+=dr;cc+=dc}}
    }
  }
  return out;
}
// Сделать ход → новое состояние
function chApply(s,m){
  const b=s.b.slice(),p=b[m.f],w=chIsW(p),c={...s.c};
  b[m.t]=m.pr?(w?m.pr.toUpperCase():m.pr):p;b[m.f]=null;
  if(m.ep)b[m.t+(w?8:-8)]=null;
  if(m.cs==='K'){b[m.t-1]=b[m.t+1];b[m.t+1]=null}else if(m.cs==='Q'){b[m.t+1]=b[m.t-2];b[m.t-2]=null}
  if(p==='K'){c.K=c.Q=false}else if(p==='k'){c.k=c.q=false}
  if(m.f===63||m.t===63)c.K=false;if(m.f===56||m.t===56)c.Q=false;if(m.f===7||m.t===7)c.k=false;if(m.f===0||m.t===0)c.q=false;
  const pawn=p.toUpperCase()==='P';
  return {b,w:!s.w,c,ep:pawn&&Math.abs(m.t-m.f)===16?(m.f+m.t)>>1:-1,hm:pawn||m.cap?0:s.hm+1,fm:s.fm+(s.w?0:1)};
}
function chLegal(s){
  const out=[];for(const m of chPseudo(s)){const n=chApply(s,m);if(!chInCheck(n,s.w))out.push(m)}return out;
}
// Запись хода (SAN): «Nf3», «exd5», «O-O», «e8=Q+»
function chSan(s,m,legal){
  const p=s.b[m.f],P=p.toUpperCase();let o;
  if(m.cs)o=m.cs==='K'?'O-O':'O-O-O';
  else{
    o=P==='P'?'':P;
    if(P!=='P'){const same=(legal||chLegal(s)).filter(x=>x.t===m.t&&x.f!==m.f&&s.b[x.f]===p);
      if(same.length){const fl=chSq(m.f);if(!same.some(x=>(x.f&7)===(m.f&7)))o+=fl[0];else if(!same.some(x=>(x.f>>3)===(m.f>>3)))o+=fl[1];else o+=fl}}
    if(m.cap)o+=(P==='P'?chSq(m.f)[0]:'')+'x';
    o+=chSq(m.t);if(m.pr)o+='='+m.pr.toUpperCase();
  }
  const n=chApply(s,m);if(chInCheck(n)){o+=chLegal(n).length?'+':'#'}
  return o;
}
function chInsufficient(s){
  const left=s.b.filter(p=>p&&p.toUpperCase()!=='K');
  if(!left.length)return true;
  if(left.length===1&&'NBnb'.includes(left[0]))return true;
  if(left.length===2&&left.every(p=>'Bb'.includes(p))){const sq=s.b.map((p,i)=>p&&'Bb'.includes(p)?((i>>3)+(i&7))%2:-1).filter(x=>x>=0);return sq[0]===sq[1]}
  return false;
}
// Итог позиции: {over:false} или {over:true,res:'w'|'b'|'d',why:'mate'|'stalemate'|...}
function chStatus(s,keys){
  const legal=chLegal(s);
  if(!legal.length)return chInCheck(s)?{over:true,res:s.w?'b':'w',why:'mate'}:{over:true,res:'d',why:'stalemate'};
  if(chInsufficient(s))return {over:true,res:'d',why:'material'};
  if(s.hm>=100)return {over:true,res:'d',why:'fifty'};
  if(keys){const k=chKey(s);if(keys.filter(x=>x===k).length>=3)return {over:true,res:'d',why:'repeat'}}
  return {over:false,legal};
}

// ---------- Бот ----------
const CH_V={p:100,n:320,b:335,r:500,q:900,k:0};
// Таблицы «где фигуре лучше стоять» (для белых, сверху вниз от 8-й линии)
const CH_PST={
  p:[0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  n:[-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  b:[-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  r:[0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  q:[-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  k:[-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20]
};
function chEval(s){ // оценка с точки зрения белых
  let v=0;for(let i=0;i<64;i++){const p=s.b[i];if(!p)continue;const k=p.toLowerCase(),w=chIsW(p);
    v+=(w?1:-1)*(CH_V[k]+CH_PST[k][w?i:(7-(i>>3))*8+(i&7)])}
  return v;
}
function chOrder(s,ms){ // сначала взятия самыми дешёвыми фигурами и превращения
  return ms.map(m=>({m,k:(m.cap?10*CH_V[m.cap.toLowerCase()]-CH_V[s.b[m.f].toLowerCase()]/10:0)+(m.pr?800:0)})).sort((a,b)=>b.k-a.k).map(x=>x.m);
}
function chQuiesce(s,alpha,beta,deadline,depth){
  const stand=(s.w?1:-1)*chEval(s);if(stand>=beta)return beta;if(stand>alpha)alpha=stand;
  if(depth<=0||performance.now()>deadline)return alpha;
  for(const m of chOrder(s,chPseudo(s,true))){
    const n=chApply(s,m);if(chInCheck(n,s.w))continue;
    const v=-chQuiesce(n,-beta,-alpha,deadline,depth-1);if(v>=beta)return beta;if(v>alpha)alpha=v;
  }
  return alpha;
}
function chSearch(s,depth,alpha,beta,deadline,q){
  if(depth<=0)return q?chQuiesce(s,alpha,beta,deadline,3):(s.w?1:-1)*chEval(s);
  const ms=chOrder(s,chLegal(s));
  if(!ms.length)return chInCheck(s)?-99999-depth:0;
  for(const m of ms){
    const v=-chSearch(chApply(s,m),depth-1,-beta,-alpha,deadline,q);
    if(v>=beta)return beta;if(v>alpha)alpha=v;
    if(performance.now()>deadline)break;
  }
  return alpha;
}
// level: 1 «Новичок» (смотрит на 1 ход, иногда ошибается), 2 «Любитель» (2 хода), 3 «Мастер» (3 хода + размен до конца)
function chBot(s,level,keys){
  const legal=chLegal(s);if(!legal.length)return null;
  if(level<=1){
    const scored=legal.map(m=>({m,v:chEvalAfter(s,m)})).sort((a,b)=>b.v-a.v);
    const top=scored.slice(0,Math.min(4,scored.length));
    return Math.random()<.35?legal[Math.floor(Math.random()*legal.length)]:top[Math.floor(Math.random()*Math.min(2,top.length))].m;
  }
  const deadline=performance.now()+(level>=3?1500:600),maxD=level>=3?4:2;
  const shuf=legal.map(m=>({m,r:Math.random()})).sort((a,b)=>a.r-b.r).map(x=>x.m); // случайный порядок: равные по силе ходы выбираются по-разному
  let best=chOrder(s,shuf)[0];
  for(let d=1;d<=maxD;d++){
    let bv=-Infinity,bm=null,done=true;
    for(const m of chOrder(s,shuf)){
      const v=-chSearch(chApply(s,m),d-1,-Infinity,-bv,d===1?Infinity:deadline,level>=3);
      if(v>bv){bv=v;bm=m}
      if(d>1&&performance.now()>deadline){done=false;break}
    }
    if(done&&bm)best=bm;   // неполную итерацию (не успели просмотреть все ходы) не берём
    if(!done||performance.now()>deadline)break;
  }
  return best;
}
function chEvalAfter(s,m){return (s.w?1:-1)*chEval(chApply(s,m))+Math.random()*15}
