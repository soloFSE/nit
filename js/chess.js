// «Шахматы» — партии 1, 3 и 5 минут: с другом (через игровой сервер) или с ботом. Правила и бот — в chessengine.js.
// Сеть: комната `c-<код>` на игровом сервере (Cloudflare, TK_SERVER из tanks.js); если сервера нет — канал Supabase `chess-<код>`.
// Сообщения: st (старт), mv (ход + остаток времени мувера), rs (сдача), do/da/dd (ничья), fl (флажок), rm (реванш), sy/sm (сверка партии после обрыва).
// Часы идут после первых ходов обеих сторон. Время вышло — проигрыш (кроме позиции, где у соперника не хватает материала — это ничья).
let ch=null;
const CH_TC=[[60,'1 мин','Пуля'],[180,'3 мин','Блиц'],[300,'5 мин','Блиц']];
const CH_LV=[[1,'Новичок'],[2,'Любитель'],[3,'Мастер']];
const CH_TH={
  wood:{n:'Дерево',l:'#f0d9b5',d:'#b58863',f:'#5a3a22'},marble:{n:'Мрамор',l:'#e8edf3',d:'#7d94b0',f:'#2c3b52'},
  emerald:{n:'Изумруд',l:'#eeeed2',d:'#4f8a5b',f:'#1d3b26'},night:{n:'Ночь',l:'#8d97ba',d:'#3a416a',f:'#12152b'},rose:{n:'Роза',l:'#f6dfe4',d:'#c0728a',f:'#4a1f30'}
};
const CH_WHY={mate:'Мат',stalemate:'Пат',material:'Недостаточно материала',fifty:'Правило 50 ходов',repeat:'Троекратное повторение',time:'Время вышло',resign:'Сдача',agreed:'Ничья по соглашению',left:'Соперник вышел'};
const chCode=()=>Math.random().toString(36).replace(/[^a-z0-9]/g,'').slice(2,7).toUpperCase().padEnd(5,'X');
const chTcName=ms=>(CH_TC.find(x=>x[0]*1000===ms)||[0,Math.round(ms/60000)+' мин'])[1];
const chFmt=ms=>{ms=Math.max(0,ms);const s=Math.floor(ms/1000),m=Math.floor(s/60);return ms<10000?(s%60)+'.'+Math.floor(ms%1000/100):m+':'+String(s%60).padStart(2,'0')};
const chTheme=()=>{try{const t=localStorage.getItem('nit-ch-theme');return CH_TH[t]?t:'wood'}catch{return'wood'}};

// ---------- фигуры (SVG-спрайт 45×45; белые светлые, чёрные тёмные, у каждой — градиент и блик) ----------
function chSprite(){
  if(document.getElementById('chSprite'))return;
  const body={
    P:`<circle cx="22.500" cy="13" r="5.300"/><path d="M17.500 20.500c0 5-4.500 6.500-4.500 13.500h19c0-7-4.500-8.500-4.500-13.500z"/><rect x="10.500" y="33.500" width="24" height="5.500" rx="2.200"/>`,
    R:`<path d="M12 12.500V7.500h4.500v3h3.500v-3h5v3h3.500v-3H33v5z"/><path d="M13.500 12.500h18l-1.500 5h-15z"/><path d="M15.500 17.500h14v13h-14z"/><path d="M12.500 35l2.500-4.500h15l2.500 4.500z"/><rect x="10" y="34.500" width="25" height="5" rx="1.800"/>`,
    B:`<circle cx="22.500" cy="7.500" r="2.800"/><path d="M22.500 9.500c4 3.500 7.500 8 7.500 13 0 4-3 6-3.500 8h-8c-.5-2-3.500-4-3.500-8 0-5 3.500-9.500 7.500-13z"/><path d="M13 35c0-3 3.500-4.500 5-6.500h9c1.500 2 5 3.500 5 6.500z"/><rect x="10" y="34.500" width="25" height="5" rx="1.800"/>`,
    N:`<path d="M22 10c10.500 1 16.500 8 16 29H15c0-9 10-6.500 8-21"/><path d="M24 18c.4 2.900-5.600 7.400-8 9-3 2-2.800 4.300-5 4-1-1 1.400-3 0-3-1 0-.2 1.200-1.400 2-1 0-4 1-4-4 0-2 6-12 6-12s1.900-1.900 2-3.500c-.7-1-.5-2-.5-3 1-1 3 2.500 3 2.500h2s.8-2 2.500-3c1 0 1 3 1 3"/><rect x="11" y="37" width="24" height="3" rx="1.500"/>`,
    Q:`<path d="M11 36L8.500 15.500l4 10.500L15.500 12 19 25l3.500-15 3.500 15 3.500-13 3 14 4-10.500L34 36z"/><rect x="10.500" y="34" width="24" height="5.500" rx="2"/>`,
    K:`<path d="M22.500 15c-7.500 0-12.500 4.500-12.500 11.500 0 4 1.500 7 2 9.500h21c.5-2.500 2-5.500 2-9.500 0-7-5-11.500-12.500-11.500z"/><rect x="10.500" y="34" width="24" height="5.500" rx="2"/>`
  },extra={ // яркие детали поверх фигуры
    P:'',R:`<path d="M15.500 24.500h14M15.500 20h14" stroke-width="1"/>`,B:`<path d="M19.500 19.500l6 6" stroke-width="1.800"/>`,
    N:`<circle cx="15.500" cy="14.500" r="1.100" fill="CC" stroke="none"/><path d="M11 22.500l-3 5" stroke-width="1"/>`,
    Q:`<g fill="CC" stroke="none"><circle cx="8.500" cy="14" r="2.200"/><circle cx="15.500" cy="10.500" r="2.200"/><circle cx="22.500" cy="8.500" r="2.200"/><circle cx="29.500" cy="10.500" r="2.200"/><circle cx="36.500" cy="14" r="2.200"/></g>`,
    K:`<path d="M22.500 3.500v10M18 7.500h9" stroke-width="3" stroke-linecap="round"/><path d="M14.500 24h16M13.500 29h18" stroke-width="1"/>`
  };
  let s='<svg id="chSprite" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'
   +'<linearGradient id="chgW" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#f1e8cf"/><stop offset="1" stop-color="#c9b98f"/></linearGradient>'
   +'<linearGradient id="chgB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6a6a78"/><stop offset=".5" stop-color="#2a2a33"/><stop offset="1" stop-color="#0d0d12"/></linearGradient></defs>';
  for(const k of 'PRBNQK')for(const w of [1,0]){
    const g=w?'url(#chgW)':'url(#chgB)',st=w?'#3a2e18':'#05050a',hi=w?'#3a2e18':'#d9d9e6';
    s+=`<symbol id="chp-${w?'w':'b'}${k}" viewBox="0 0 45 45"><g fill="${g}" stroke="${st}" stroke-width="1.500" stroke-linejoin="round" stroke-linecap="round">${body[k]}</g>`
      +`<g fill="none" stroke="${hi}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity=".7">${extra[k].replace(/CC/g,hi)}</g>`
      +`<path d="M14 33.500c1.500-1 4-1.400 8.500-1.400" stroke="${w?'#fff':'#9a9ab0'}" stroke-width="1.200" fill="none" opacity=".55" stroke-linecap="round"/></symbol>`;
  }
  document.body.insertAdjacentHTML('beforeend',s+'</svg>');
}
const chPiece=p=>{const w=chIsW(p),k=p.toUpperCase(),s=document.createElement('span');s.className='cp-s';s.innerHTML='<svg viewBox="0 0 45 45"><use href="#chp-'+(w?'w':'b')+k+'"/></svg>';return s};

// ---------- запуск ----------
function openChess(code,opt={}){
  if(ch)return;chSprite();
  ch={code:(code||chCode()).toUpperCase(),bot:opt.bot||0,tc:(opt.tc||180)*1000,pref:opt.col||'r',phase:'lobby',roster:[{id:me,name:nameOf(me),t:Date.now()}],net:null,
    s:chFen(),keys:[],moves:[],sans:[],cl:{w:0,b:0},turnT:0,over:null,sel:-1,legal:[],last:null,flip:false,col:'w',pcs:new Map(),drag:null,
    cap:{w:[],b:[]},host:true,hostId:me,rematch:{me:false,opp:false},drawFrom:null,oppGone:0,theme:chTheme(),busy:false,promo:null};
  chUI();
  if(ch.bot)chLobby();else chJoin();
}
function chClose(){
  if(!ch)return;clearInterval(ch.timer);clearTimeout(ch.botT);try{ch.net?.close()}catch{}
  const w=$('ch');w?.classList.remove('in');setTimeout(()=>w?.remove(),220);ch=null;
}
// ---------- сеть ----------
function chNetOpen(code,onMsg,onRoster){
  const room='c-'+code;let ws=null,dead=false,list=[],retry=0,ping=0,sb_ch=null;
  const api={send(p){try{if(sb_ch)sb_ch.send({type:'broadcast',event:'ch',payload:p});else if(ws&&ws.readyState===1)ws.send(JSON.stringify({t:'m',p}))}catch{}},
    close(){dead=true;clearInterval(ping);try{ws?.close()}catch{}try{sb_ch?.unsubscribe();sb.removeChannel?.(sb_ch)}catch{}},roster:()=>list};
  const fallback=()=>{
    if(dead||sb_ch)return;
    sb_ch=sb.channel('chess-'+code,{config:{presence:{key:me},broadcast:{self:false}}});
    const sync=()=>{const l=Object.values(sb_ch.presenceState()||{}).flat().filter(x=>x&&x.id);l.sort((a,b)=>(a.t-b.t)||String(a.id).localeCompare(String(b.id)));list=l;onRoster(l)};
    sb_ch.on('presence',{event:'sync'},sync).on('broadcast',{event:'ch'},({payload})=>onMsg(payload))
      .subscribe(async st=>{if(st==='SUBSCRIBED'){try{await sb_ch.track({id:me,name:nameOf(me),t:ch?.myT||(ch.myT=Date.now())})}catch{}sync()}});
  };
  const open=()=>{
    if(dead)return;
    if(typeof TK_SERVER==='undefined'||!TK_SERVER){fallback();return}
    let opened=false;
    try{ws=new WebSocket(TK_SERVER+'/ws?room='+encodeURIComponent(room))}catch{fallback();return}
    const to=setTimeout(()=>{if(!opened){try{ws.close()}catch{}fallback()}},10000);
    ws.onopen=()=>{opened=true;clearTimeout(to);retry=0;ws.send(JSON.stringify({t:'join',room,id:me,name:nameOf(me),tt:ch?.myT||(ch.myT=Date.now())}));
      clearInterval(ping);ping=setInterval(()=>{if(ws.readyState===1)ws.send('{"t":"ping"}')},15000)};
    ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}
      if(m.t==='roster'){list=[...m.list].sort((a,b)=>(a.t-b.t)||String(a.id).localeCompare(String(b.id)));onRoster(list)}else if(m.t==='m')onMsg(m.p)};
    ws.onclose=()=>{clearTimeout(to);clearInterval(ping);if(dead||sb_ch)return;if(!opened&&retry===0){fallback();return}
      if(++retry<=6)setTimeout(open,Math.min(4000,600*retry));else if(ch)toast('Связь с игровым сервером потеряна')};
  };
  open();return api;
}
function chJoin(){
  ch.net=chNetOpen(ch.code,chOnMsg,chOnRoster);chLobby();
}
const chOpp=()=>ch.roster.find(x=>x.id!==me);
function chOnRoster(list){
  if(!ch)return;
  ch.roster=list.length?list:[{id:me,name:nameOf(me),t:Date.now()}];
  if(!ch.roster.some(x=>x.id===me))ch.roster.push({id:me,name:nameOf(me),t:ch.myT||Date.now()});
  ch.hostId=ch.roster[0].id;ch.host=ch.hostId===me;
  if(ch.phase==='lobby'){chSendOpt();chLobby()}
  else{
    const opp=chOpp();
    if(opp){ch.oppGone=0;$('chGone')?.classList.add('hide');if(ch.phase==='play')chSend({t:'sy',n:ch.moves.length})}
    else if(ch.phase==='play'&&!ch.oppGone){ch.oppGone=Date.now();setTimeout(()=>{if(ch&&ch.oppGone&&ch.phase==='play'){const g=$('chGone');g?.classList.remove('hide')}},7000)}
  }
}
const chSend=p=>{try{ch.net?.send(p)}catch{}};
function chSendOpt(){if(ch&&ch.phase==='lobby'&&ch.host&&!ch.bot)chSend({t:'op',tc:ch.tc,col:ch.pref})}
function chOnMsg(p){
  if(!ch||!p)return;
  switch(p.t){
    case 'op':if(!ch.host){ch.tc=p.tc;ch.pref=p.col;if(ch.phase==='lobby')chLobby()}break;
    case 'st':chStart(p.white,p.tc);break;
    case 'mv':{
      if(ch.phase!=='play'||p.n!==ch.moves.length)break;
      const m=chLegal(ch.s).find(x=>x.f===p.f&&x.t===p.to&&x.pr===(p.pr||''));if(!m)break;
      chDo(m,{remote:true,ms:p.ms});break}
    case 'rs':if(ch.phase==='play')chEnd({res:ch.col,why:'resign'});break;
    case 'fl':if(ch.phase==='play')chEnd({res:ch.col,why:'time'});break;
    case 'do':if(ch.phase==='play'){ch.drawFrom='opp';chBanner()}break;
    case 'da':if(ch.phase==='play'&&ch.drawFrom==='me')chEnd({res:'d',why:'agreed'});break;
    case 'dd':if(ch.drawFrom==='me'){ch.drawFrom=null;toast('Соперник отклонил ничью');chBanner()}break;
    case 'rm':ch.rematch.opp=true;chOverCard();if(ch.host&&ch.rematch.me)chRematchStart();break;
    case 'sy':if(ch.phase==='play'&&p.n<ch.moves.length)chSend({t:'sm',mv:ch.moves.map(m=>[m.f,m.t,m.pr]),cl:ch.cl});break;
    case 'sm':if(ch.phase==='play'&&p.mv.length>ch.moves.length){ // догоняем партию после обрыва связи
      for(let i=ch.moves.length;i<p.mv.length;i++){const [f,t,pr]=p.mv[i],m=chLegal(ch.s).find(x=>x.f===f&&x.t===t&&x.pr===pr);if(!m)break;chDo(m,{remote:true,quiet:true})}
      ch.cl=p.cl;ch.turnT=performance.now()}break;
  }
}
// ---------- партия ----------
function chStart(white,tc){
  ch.phase='play';ch.tc=tc;ch.col=ch.bot?(ch.pref==='r'?(Math.random()<.5?'w':'b'):ch.pref):(white===me?'w':'b');
  ch.s=chFen();ch.keys=[chKey(ch.s)];ch.moves=[];ch.sans=[];ch.cl={w:tc,b:tc};ch.turnT=performance.now();ch.over=null;ch.sel=-1;ch.legal=[];ch.last=null;
  ch.cap={w:[],b:[]};ch.drawFrom=null;ch.rematch={me:false,opp:false};ch.flip=ch.col==='b';ch.oppGone=0;ch.promo=null;
  $('chLobby')?.classList.add('hide');$('chOver')?.classList.add('hide');
  chBoardBuild();chBars();chMovesList();chBanner();chSfx('start');
  clearInterval(ch.timer);ch.timer=setInterval(chTick,100);
  if(ch.bot&&ch.col==='b')chBotSoon();
}
function chStartHost(){ // хозяин комнаты начинает партию
  const pref=ch.pref==='r'?(Math.random()<.5?'w':'b'):ch.pref,opp=chOpp();if(!opp)return;
  const white=pref==='w'?me:opp.id;chSend({t:'st',white,tc:ch.tc});chStart(white,ch.tc);
}
function chRematchStart(){const white=ch.col==='w'?chOpp().id:me;ch.rematch={me:false,opp:false};chSend({t:'st',white,tc:ch.tc});chStart(white,ch.tc)}
const chTurn=()=>ch.s.w?'w':'b';
const chMyTurn=()=>ch.phase==='play'&&!ch.promo&&chTurn()===ch.col&&!(ch.bot&&ch.busy);
function chDo(m,o={}){
  const prev=ch.s,legal=chLegal(prev),mover=chTurn();
  const san=chSan(prev,m,legal),now=performance.now();
  // часы: идут после первых ходов обеих сторон
  if(ch.moves.length>=2){if(o.remote&&o.ms!=null)ch.cl[mover]=o.ms;else ch.cl[mover]=Math.max(0,ch.cl[mover]-(now-ch.turnT))}
  else if(o.remote&&o.ms!=null)ch.cl[mover]=o.ms;
  ch.turnT=now;
  ch.s=chApply(prev,m);ch.keys.push(chKey(ch.s));ch.moves.push(m);ch.sans.push(san);ch.last=[m.f,m.t];ch.sel=-1;ch.legal=[];ch.drawFrom=null;
  if(m.cap)ch.cap[mover].push(m.cap);
  if(!o.quiet)chAnimate(m,prev);else chPiecesRender();
  chBars();chMovesList();chMarks();chBanner();
  const st=chStatus(ch.s,ch.keys);
  const chk=chInCheck(ch.s);
  if(!o.quiet)chSfx(st.over&&st.why==='mate'?'end':chk?'check':m.cap?'cap':'move');
  if(st.over){chEnd(st);return}
  if(ch.bot&&chTurn()!==ch.col)chBotSoon();
}
function chBotSoon(){
  ch.busy=true;chBars();
  ch.botT=setTimeout(()=>{
    if(!ch||ch.phase!=='play')return;
    const lv=ch.bot,m=chBot(ch.s,lv,ch.keys);ch.busy=false;if(m)chDo(m,{});
  },350+Math.random()*(ch.bot>=3?900:600));
}
function chEnd(r){
  if(!ch||ch.phase==='over')return;
  ch.phase='over';ch.over=r;clearInterval(ch.timer);clearTimeout(ch.botT);ch.busy=false;chBars();
  // обновляем счёт
  try{const k='nit-ch-stats',st=JSON.parse(localStorage.getItem(k)||'{"w":0,"l":0,"d":0}');if(r.res==='d')st.d++;else if(r.res===ch.col)st.w++;else st.l++;localStorage.setItem(k,JSON.stringify(st))}catch{}
  setTimeout(()=>{if(!ch)return;chOverCard();if(r.res===ch.col&&typeof fx==='function')fx('confetti');chSfx(r.res===ch.col?'win':r.res==='d'?'move':'lose')},r.why==='mate'?700:250);
}
function chTick(){
  if(!ch||ch.phase!=='play')return;
  const running=ch.moves.length>=2,t=chTurn(),left=ch.cl[t]-(running?performance.now()-ch.turnT:0);
  chClocks(left);
  if(running&&left<=0){
    // у соперника не хватает материала, чтобы поставить мат — ничья, иначе поражение по времени
    if(t===ch.col){chSend({t:'fl'});chEnd({res:ch.col==='w'?'b':'w',why:'time'})}
    else if(ch.bot)chEnd({res:ch.col,why:'time'});
    else setTimeout(()=>{if(ch&&ch.phase==='play'&&chTurn()!==ch.col&&ch.cl[chTurn()]-(performance.now()-ch.turnT)<=0)chEnd({res:ch.col,why:'time'})},1500);
  }
}
// ---------- действия игрока ----------
function chResign(){if(ch.phase!=='play'||!confirm('Сдаться?'))return;chSend({t:'rs'});chEnd({res:ch.col==='w'?'b':'w',why:'resign'})}
function chDraw(){
  if(ch.phase!=='play')return;
  if(ch.bot){const ev=(ch.col==='w'?-1:1)*chEval(ch.s); // ev>0 — у бота лучше
    if(ev<-30&&ch.moves.length>20)chEnd({res:'d',why:'agreed'});else toast('Бот отклонил ничью');return}
  if(ch.drawFrom==='opp'){chSend({t:'da'});chEnd({res:'d',why:'agreed'});return}
  if(ch.drawFrom==='me')return;
  ch.drawFrom='me';chSend({t:'do'});chBanner();toast('Предложение ничьей отправлено');
}
function chDrawNo(){ch.drawFrom=null;chSend({t:'dd'});chBanner()}
function chRematch(){
  if(ch.bot){const keep={bot:ch.bot,tc:ch.tc/1000,col:ch.pref};chClose();setTimeout(()=>openChess(null,{...keep,bot:keep.bot}),240);return}
  ch.rematch.me=true;chSend({t:'rm'});chOverCard();if(ch.host&&ch.rematch.opp)chRematchStart();
}
// ---------- интерфейс ----------
function chUI(){
  const w=el('div','ch');w.id='ch';w.dataset.th=ch.theme;chApplyTheme(w);
  const top=el('div','ch-top');
  const x=el('button','icon ch-x');x.append(svgI('i-x'));x.title='Выйти';x.onclick=()=>{if(ch.phase!=='play'||confirm('Выйти из партии? Это будет поражение.')){if(ch.phase==='play'&&!ch.bot)chSend({t:'rs'});chClose()}};
  const ti=el('b','ch-title','Шахматы');ti.id='chTitle';
  const th=el('button','icon');th.append(svgI('i-brush'));th.title='Тема доски';th.onclick=()=>{const ks=Object.keys(CH_TH),n=ks[(ks.indexOf(ch.theme)+1)%ks.length];ch.theme=n;try{localStorage.setItem('nit-ch-theme',n)}catch{}chApplyTheme($('ch'));toast('Доска: '+CH_TH[n].n)};
  const fl=el('button','icon');fl.append(svgI('i-flip'));fl.title='Перевернуть доску';fl.onclick=()=>{ch.flip=!ch.flip;chBoardBuild()};
  top.append(x,ti,fl,th);w.append(top);
  const main=el('div','ch-main');
  const col=el('div','ch-col');
  const ob=el('div','ch-bar opp');ob.id='chOppBar';const bw=el('div','ch-bw');bw.id='chBw';
  const mb=el('div','ch-bar me');mb.id='chMeBar';
  col.append(ob,bw,mb);
  const side=el('div','ch-side');
  const mv=el('div','ch-moves');mv.id='chMoves';
  const act=el('div','ch-acts');act.id='chActs';
  const dr=el('button','ch-act');dr.append(el('b',null,'½'),el('span',null,'Ничья'));dr.onclick=chDraw;
  const rs=el('button','ch-act danger');rs.append(svgI('i-hang'),el('span',null,'Сдаться'));rs.onclick=chResign;
  act.append(dr,rs);
  const ban=el('div','ch-ban hide');ban.id='chBan';
  const gone=el('div','ch-gone hide');gone.id='chGone';gone.append(el('span',null,'Соперник отключился'));const gb=el('button','ghost sm-btn','Засчитать победу');gb.onclick=()=>chEnd({res:ch.col,why:'left'});gone.append(gb);
  side.append(ban,gone,mv,act);main.append(col,side);w.append(main);
  const lobby=el('div','ch-lobby');lobby.id='chLobby';const over=el('div','ch-over hide');over.id='chOver';w.append(lobby,over);
  document.body.append(w);requestAnimationFrame(()=>w.classList.add('in'));
  chBoardBuild();chBars();
}
function chApplyTheme(w){const t=CH_TH[ch.theme]||CH_TH.wood;w.style.setProperty('--cl',t.l);w.style.setProperty('--cd',t.d);w.style.setProperty('--cf',t.f)}
function chViewIdx(r,c){return ch.flip?[7-r,7-c]:[r,c]}
function chBoardBuild(){
  const bw=$('chBw');if(!bw)return;bw.innerHTML='';
  const b=el('div','ch-board');b.id='chBoard';
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    const [rr,cc]=chViewIdx(r,c),i=rr*8+cc,q=el('div','sq '+((rr+cc)%2?'d':'l'));q.dataset.i=i;
    if(c===0)q.append(el('i','co r',String(8-rr)));if(r===7)q.append(el('i','co f','abcdefgh'[cc]));
    b.append(q);
  }
  const L=el('div','ch-pcs');L.id='chPcs';b.append(L);bw.append(b);
  const pr=el('div','ch-promo hide');pr.id='chPromo';bw.append(pr);
  b.onpointerdown=chDown;
  chPiecesRender();chMarks();
}
function chPiecesRender(){
  const L=$('chPcs');if(!L)return;L.innerHTML='';ch.pcs=new Map();
  for(let i=0;i<64;i++){const p=ch.s.b[i];if(p)chPutPiece(L,i,p)}
}
function chPutPiece(L,i,p){
  const [vr,vc]=chViewIdx(i>>3,i&7),d=el('div','cp'+(chIsW(p)?' w':' b'));d.dataset.sq=i;d.style.setProperty('--x',vc);d.style.setProperty('--y',vr);d.append(chPiece(p));L.append(d);ch.pcs.set(i,d);return d;
}
function chPos(d,i){const [vr,vc]=chViewIdx(i>>3,i&7);d.style.setProperty('--x',vc);d.style.setProperty('--y',vr);d.dataset.sq=i}
function chAnimate(m,prev){
  const L=$('chPcs');if(!L)return;
  const mover=ch.pcs.get(m.f);
  if(!mover){chPiecesRender();return}
  const capSq=m.ep?m.t+(chIsW(prev.b[m.f])?8:-8):m.t;
  const victim=m.cap?ch.pcs.get(capSq):null;
  if(victim){victim.classList.add('gone');setTimeout(()=>victim.remove(),230);ch.pcs.delete(capSq)}
  ch.pcs.delete(m.f);mover.classList.remove('lift');chPos(mover,m.t);ch.pcs.set(m.t,mover);
  if(m.pr){const np=ch.s.b[m.t];mover.innerHTML='';mover.append(chPiece(np))}
  if(m.cs){const rf=m.cs==='K'?m.t+1:m.t-2,rt=m.cs==='K'?m.t-1:m.t+1,rk=ch.pcs.get(rf);if(rk){ch.pcs.delete(rf);chPos(rk,rt);ch.pcs.set(rt,rk)}}
}
function chMarks(){
  const b=$('chBoard');if(!b)return;
  b.querySelectorAll('.sq').forEach(q=>q.classList.remove('last','sel','chk','tgt','cap'));
  const sq=i=>b.querySelector('.sq[data-i="'+i+'"]');
  if(ch.last)ch.last.forEach(i=>sq(i)?.classList.add('last'));
  if(ch.sel>=0){sq(ch.sel)?.classList.add('sel');ch.legal.filter(m=>m.f===ch.sel).forEach(m=>sq(m.t)?.classList.add(m.cap?'cap':'tgt'))}
  if(ch.phase!=='lobby'&&chInCheck(ch.s)){const k=chKing(ch.s,ch.s.w);if(k>=0)sq(k)?.classList.add('chk')}
}
function chBars(){
  const opp=ch.bot?{id:'bot',name:'Бот · '+(CH_LV.find(x=>x[0]===ch.bot)||[0,''])[1]}:chOpp();
  const fill=(box,who,col)=>{
    box.innerHTML='';
    const a=who?.id==='bot'?el('span','ch-bot','♞'):who?avatar(who.id,38):el('span','ch-bot','?');
    const nm=el('div','ch-nm');nm.append(el('b',null,who?(who.id===me?'Вы':who.name):'Ждём соперника…'));
    // съеденные фигуры и перевес
    const eaten=ch.cap[col==='w'?'w':'b'],vals={p:1,n:3,b:3,r:5,q:9};
    const tray=el('div','ch-tray');[...eaten].sort((x,y)=>vals[y.toLowerCase()]-vals[x.toLowerCase()]).forEach(p=>{const s=chPiece(p);s.classList.add('mini');tray.append(s)});
    const mine=eaten.reduce((a,p)=>a+vals[p.toLowerCase()],0),theirs=ch.cap[col==='w'?'b':'w'].reduce((a,p)=>a+vals[p.toLowerCase()],0);
    if(mine>theirs)tray.append(el('em',null,'+'+(mine-theirs)));
    nm.append(tray);
    const clk=el('div','ch-clk');clk.dataset.col=col;clk.textContent=chFmt(ch.cl[col]||ch.tc);
    box.append(a,nm,clk);
    box.classList.toggle('turn',ch.phase==='play'&&chTurn()===col);
  };
  const oc=ch.col==='w'?'b':'w';
  fill($('chOppBar'),opp,oc);fill($('chMeBar'),{id:me,name:nameOf(me)},ch.col);
  // над доской — тот, кто сверху при текущей ориентации
  chClocks();
}
function chClocks(leftNow){
  if(!ch)return;const t=chTurn(),running=ch.phase==='play'&&ch.moves.length>=2;
  document.querySelectorAll('#ch .ch-clk').forEach(c=>{
    const col=c.dataset.col;let v=ch.cl[col]||ch.tc;
    if(running&&col===t)v=leftNow!=null?leftNow:v-(performance.now()-ch.turnT);
    c.textContent=chFmt(v);c.classList.toggle('low',ch.phase==='play'&&v<10000);c.classList.toggle('on',ch.phase==='play'&&col===t);
    if(ch.phase==='play'&&col===ch.col&&running&&col===t){const s=Math.ceil(v/1000);if(v<10000&&v>0&&s!==ch.lowS){ch.lowS=s;chSfx('low')}}
  });
  $('chMeBar')?.classList.toggle('turn',ch.phase==='play'&&t===ch.col);$('chOppBar')?.classList.toggle('turn',ch.phase==='play'&&t!==ch.col);
}
function chMovesList(){
  const box=$('chMoves');if(!box)return;box.innerHTML='';
  if(!ch.sans.length){box.append(el('span','ch-empty','Ходов пока нет'));return}
  for(let i=0;i<ch.sans.length;i+=2){
    const row=el('div','mvr');row.append(el('i',null,(i/2+1)+'.'),el('b',null,ch.sans[i]),el('b',null,ch.sans[i+1]||''));box.append(row);
  }
  box.scrollTop=box.scrollHeight;box.scrollLeft=box.scrollWidth;
}
function chBanner(){
  const b=$('chBan');if(!b)return;b.innerHTML='';
  if(ch.drawFrom==='opp'&&ch.phase==='play'){
    b.classList.remove('hide');b.append(el('span',null,'Соперник предлагает ничью'));
    const y=el('button','primary sm-btn','Принять');y.onclick=chDraw;const n=el('button','ghost sm-btn','Нет');n.onclick=chDrawNo;b.append(y,n);
  }else if(ch.drawFrom==='me'&&ch.phase==='play'){b.classList.remove('hide');b.append(el('span',null,'Вы предложили ничью — ждём ответа…'))}
  else b.classList.add('hide');
}
// ---------- нажатия и перетаскивание ----------
function chSqAt(x,y){
  const b=$('chBoard');if(!b)return -1;const r=b.getBoundingClientRect(),c=Math.floor((x-r.left)/r.width*8),rr=Math.floor((y-r.top)/r.height*8);
  if(c<0||c>7||rr<0||rr>7)return -1;const [R,C]=chViewIdx(rr,c);return R*8+C;
}
function chDown(e){
  if(!chMyTurn()||e.button>0)return;
  const i=chSqAt(e.clientX,e.clientY);if(i<0)return;
  const p=ch.s.b[i],mine=p&&chSide(p)===ch.col;
  if(ch.sel>=0&&ch.legal.some(m=>m.f===ch.sel&&m.t===i)){chTry(ch.sel,i);return}
  if(mine){
    ch.sel=i;ch.legal=chLegal(ch.s).filter(m=>m.f===i);chMarks();chSfx('tap');
    const d=ch.pcs.get(i);if(!d)return;
    const b=$('chBoard').getBoundingClientRect();ch.drag={i,d,sx:e.clientX,sy:e.clientY,moved:false,size:b.width/8};
    d.classList.add('lift');const bd=$('chBoard');bd.setPointerCapture?.(e.pointerId);
    bd.onpointermove=chMoveDrag;bd.onpointerup=bd.onpointercancel=chUp;
  }else{ch.sel=-1;ch.legal=[];chMarks()}
}
function chMoveDrag(e){
  const g=ch.drag;if(!g)return;const dx=e.clientX-g.sx,dy=e.clientY-g.sy;
  if(!g.moved&&Math.hypot(dx,dy)<6)return;g.moved=true;g.d.classList.add('drag');
  const b=$('chBoard').getBoundingClientRect(),[vr,vc]=chViewIdx(g.i>>3,g.i&7);
  g.d.style.transform='translate('+(e.clientX-b.left-g.size/2)+'px,'+(e.clientY-b.top-g.size/2)+'px)';
}
function chUp(e){
  const g=ch.drag;if(!g)return;ch.drag=null;{const bd=$('chBoard');bd.onpointermove=bd.onpointerup=bd.onpointercancel=null}
  g.d.classList.remove('drag');g.d.style.transform='';
  if(g.moved){const to=chSqAt(e.clientX,e.clientY);if(to>=0&&ch.legal.some(m=>m.f===g.i&&m.t===to))chTry(g.i,to);else{g.d.classList.remove('lift');ch.sel=g.i;chMarks()}}
  else g.d.classList.remove('lift');
}
function chTry(f,t){
  const opts=ch.legal.filter(m=>m.f===f&&m.t===t);if(!opts.length)return;
  if(opts[0].pr){ // превращение — спрашиваем, во что
    ch.promo={f,t};const box=$('chPromo');box.innerHTML='';box.classList.remove('hide');
    const w=ch.col==='w';
    for(const q of 'qrbn'){const b=el('button','pr-b');b.append(chPiece(w?q.toUpperCase():q));b.onclick=()=>{box.classList.add('hide');ch.promo=null;chCommit(opts.find(m=>m.pr===q))};box.append(b)}
    const x=el('button','pr-x');x.append(svgI('i-x'));x.onclick=()=>{box.classList.add('hide');ch.promo=null;ch.sel=-1;ch.legal=[];chMarks();chPiecesRender()};box.append(x);
    return;
  }
  chCommit(opts[0]);
}
function chCommit(m){
  const n=ch.moves.length;chDo(m,{});
  const mover=ch.col;chSend({t:'mv',f:m.f,to:m.t,pr:m.pr,n,ms:ch.cl[mover]});
}
// ---------- лобби и итог ----------
function chChips(list,cur,onPick,fmt){
  const row=el('div','ch-chips');list.forEach(it=>{const [v,n,sub]=it,b=el('button','ch-chip'+(String(cur)===String(v)?' on':''));b.append(el('b',null,n));if(sub)b.append(el('small',null,sub));b.onclick=()=>onPick(v);row.append(b)});return row;
}
function chLobby(){
  const box=$('chLobby');if(!box||!ch)return;box.innerHTML='';
  const c=el('div','ch-card');const ic=el('div','ch-ic');ic.append(svgI('i-chess'));
  c.append(ic,el('h2',null,ch.bot?'Шахматы с ботом':'Шахматы'));
  const host=ch.bot||ch.host;
  if(!ch.bot){
    const code=el('button','ch-code',ch.code);code.title='Скопировать код';code.onclick=()=>{navigator.clipboard?.writeText(ch.code);toast('Код комнаты скопирован')};
    const sub=el('p','ch-sub','Комната ');sub.append(code);c.append(sub);
    const pl=el('div','ch-pl');
    ch.roster.slice(0,2).forEach(p=>{const r=el('div','ch-p');r.append(avatar(p.id,34),el('b',null,p.id===me?'Вы':p.name));if(p.id===ch.hostId)r.append(el('small',null,'хозяин'));pl.append(r)});
    if(ch.roster.length<2){const r=el('div','ch-p wait');r.append(el('span','ch-dots'),el('b',null,'Ждём соперника…'));pl.append(r)}
    c.append(pl);
  }else c.append(chChips(CH_LV,ch.bot||2,v=>{ch.bot=v;chLobby()}));
  if(!ch.bot&&!host)c.append(el('p','ch-sub','Время: '+chTcName(ch.tc)+' · хозяин выбирает настройки'));
  else{
    c.append(el('div','ch-h','Время на партию'));
    c.append(chChips(CH_TC.map(([s,n,sub])=>[s*1000,n,sub]),ch.tc,v=>{ch.tc=v;chSendOpt();chLobby()}));
    c.append(el('div','ch-h','Играть за'));
    c.append(chChips([['w','Белых'],['r','Случайно'],['b','Чёрных']],ch.pref,v=>{ch.pref=v;chSendOpt();chLobby()}));
  }
  const row=el('div','ch-btns');
  if(!ch.bot){const inv=el('button','ghost');inv.append(svgI('i-forward'),document.createTextNode('Позвать в чат'));inv.onclick=chInvite;row.append(inv)}
  if(host){const go=el('button','primary','Начать партию');if(!ch.bot&&ch.roster.length<2)go.disabled=true;
    go.onclick=()=>{if(ch.bot)chStart(null,ch.tc);else chStartHost()};row.append(go)}
  else row.append(el('p','ch-hint','Ждём, пока хозяин начнёт партию…'));
  const ex=el('button','ghost','Выйти');ex.onclick=chClose;row.append(ex);c.append(row);
  try{const st=JSON.parse(localStorage.getItem('nit-ch-stats')||'null');if(st)c.append(el('p','ch-stat','Ваш счёт: '+st.w+' побед · '+st.d+' ничьих · '+st.l+' поражений'))}catch{}
  box.append(c);
}
function chOverCard(){
  const box=$('chOver');if(!box||!ch||!ch.over)return;box.innerHTML='';box.classList.remove('hide');
  const r=ch.over,win=r.res===ch.col,draw=r.res==='d';
  const c=el('div','ch-card over'+(win?' win':draw?' draw':' lose'));
  c.append(el('div','ch-res',win?'Победа!':draw?'Ничья':'Поражение'),el('p','ch-sub',(CH_WHY[r.why]||'')+(r.res==='d'?'':r.res==='w'?' · белые победили':' · чёрные победили')));
  const row=el('div','ch-btns');
  const rm=el('button','primary',ch.bot?'Играть ещё':(ch.rematch.me?'Ждём соперника…':ch.rematch.opp?'Принять реванш':'Реванш'));
  if(!ch.bot&&ch.rematch.me)rm.disabled=true;rm.onclick=chRematch;row.append(rm);
  const rv=el('button','ghost','Разобрать партию');rv.onclick=()=>box.classList.add('hide');row.append(rv);
  const ex=el('button','ghost','Выйти');ex.onclick=chClose;row.append(ex);c.append(row);box.append(c);
}
function chInvite(){
  openModal(s=>{
    const top=el('div','sheet-top');top.append(el('h3',null,'Позвать играть'));const x=el('button','icon');x.append(svgI('i-x'));x.onclick=closeModal;top.append(x);s.append(top);
    const l=el('div','nc-list');
    chatItems().forEach(it=>{const r=giRow(it.group?groupAvatar(it.g,40):avatar(it.k,40),it.name,it.group?'Группа':'Личный чат','gi-mem');
      r.onclick=async()=>{closeModal();try{await sendMsg(it.k,{body:'::game:ch:'+ch.code+'::'},{noReply:true});toast('Приглашение отправлено: '+it.name)}catch(e){toast('Не отправилось: '+e.message)}};l.append(r)});
    s.append(l);
  });
}
async function startChessInvite(){
  if(!cur){toast('Откройте чат, куда позвать играть');return}
  const code=chCode();openChess(code);
  try{await sendMsg(cur,{body:'::game:ch:'+code+'::'},{noReply:true})}catch(e){toast('Приглашение не отправилось: '+e.message)}
}
// ---------- звуки ----------
let chAu=null;
function chSfx(t){
  try{if(typeof soundOn==='function'&&!soundOn())return;chAu=chAu||new (window.AudioContext||window.webkitAudioContext)();const c=chAu,n=c.currentTime;
    const tone=(f1,f2,d,type,v,delay=0)=>{const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f1,n+delay);o.frequency.exponentialRampToValueAtTime(Math.max(30,f2),n+delay+d);g.gain.setValueAtTime(v,n+delay);g.gain.exponentialRampToValueAtTime(.0001,n+delay+d);o.connect(g);g.connect(c.destination);o.start(n+delay);o.stop(n+delay+d+.02)};
    if(t==='move')tone(260,110,.09,'triangle',.18);else if(t==='cap'){tone(300,90,.12,'sawtooth',.12);tone(180,70,.1,'triangle',.18)}
    else if(t==='check'){tone(660,880,.14,'square',.06);tone(880,660,.14,'square',.05,.12)}else if(t==='tap')tone(520,480,.04,'sine',.05);
    else if(t==='low')tone(900,900,.05,'square',.04);else if(t==='start'){tone(392,523,.16,'sine',.09);tone(523,784,.2,'sine',.09,.14)}
    else if(t==='win'){[523,659,784,1046].forEach((f,i)=>tone(f,f,.22,'sine',.09,i*.12))}else if(t==='lose'){[392,330,262].forEach((f,i)=>tone(f,f*.97,.24,'sine',.08,i*.16))}else if(t==='end')tone(200,60,.4,'sawtooth',.12);
  }catch{}
}
// Приглашение в чате
SPECIAL.push({re:/^::game:ch:([A-Za-z0-9]{3,8})::$/,cls:'tkcard-m',forward:false,preview:()=>PI('i-chess')+'Приглашение в «Шахматы»',
  render:(m,d,x)=>{const w=el('div','tkcard');const ic=el('div','tkcard-ic');ic.append(svgI('i-chess'));
    const t=el('div','tkcard-t');t.append(el('b',null,'Шахматы'),el('small',null,(m.sender===me?'Вы зовёте':nameOf(m.sender)+' зовёт')+' сыграть · комната '+x[1].toUpperCase()));
    const b=el('button','primary sm-btn','Играть');b.onclick=e=>{e.stopPropagation();openChess(x[1])};w.append(ic,t,b);d.append(w)}});
