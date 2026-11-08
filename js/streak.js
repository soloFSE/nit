// «Нить» — серия дней общения (supabase/v6.sql): нить → моток → клубок → большой → золотой → алмазный → легендарный.
// Своя серия: день засчитывается, если вы написали кому-то. Серия с другом: оба написали друг другу в этот день.
// Дни считаются по Москве. Счётчики ведёт сервер, здесь — рисунок клубка, значки и окно «Нить».
const YARN=[[1,'Нить','Тонкая нить — вы начали'],[3,'Моток','Нить смотана в моток'],[7,'Клубок','Целый клубок за неделю'],[14,'Большой клубок','Две недели подряд'],[30,'Золотой клубок','Месяц без пропусков'],[100,'Алмазный клубок','Сто дней — алмаз'],[200,'Легендарный клубок','Легенда «Нити»']];
let strMe=null,strPairs={},strOk=true,strPrev=null,strT=0;
const yarnLevel=n=>{let l=0;YARN.forEach(([d],i)=>{if(n>=d)l=i+1});return l};
const yarnName=n=>YARN[yarnLevel(n)-1]?.[1]||'Нет нити';
const mskFmt=ms=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow'}).format(new Date(ms));
const strToday=()=>mskFmt(Date.now()),strYest=()=>mskFmt(Date.now()-864e5);
const strEff=r=>!r||!r.last_day?0:(r.last_day===strToday()||r.last_day===strYest()?r.streak:0);
const strDone=r=>!!r&&r.last_day===strToday();
const daysWord=n=>n+' '+plural(n,'день','дня','дней');

// ---------- рисунок клубка ----------
function yarnSvg(n,id){
  const lv=yarnLevel(n),u='y'+id+Math.random().toString(36).slice(2,6);
  const star=(x,y,s,d)=>'<path class="sp" style="animation-delay:'+d+'s" transform="translate('+x+' '+y+') scale('+s+')" d="M0-6C1-1 1-1 6 0C1 1 1 1 0 6C-1 1-1 1-6 0C-1-1-1-1 0-6z" fill="#fff"/>';
  if(lv===0)return '<svg viewBox="0 0 64 64"><path d="M8 40c8-16 12 10 20-2s14-14 22 0" fill="none" stroke="#94a3b8" stroke-opacity=".5" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="2 6"/></svg>';
  if(lv===1)return '<svg viewBox="0 0 64 64"><path d="M6 42c8-18 12 10 20-2s14-14 22 0 8 8 12-4" fill="none" stroke="#94a3b8" stroke-width="3.6" stroke-linecap="round"/><circle cx="6" cy="42" r="3.2" fill="#64748b"/></svg>';
  const cfg={2:[15,'#fbcfe8','#ec4899'],3:[21,'#c4b5fd','#7c3aed'],4:[25,'#fda4af','#6366f1'],5:[25,'#fff3b0','#d97706'],6:[25,'#ecfeff','#06b6d4'],7:[26,'#fdf4ff','#c026d3']}[lv],[r,c1,c2]=cfg,cx=32,cy=34;
  let defs='<radialGradient id="'+u+'g" cx=".32" cy=".28" r=".95"><stop offset="0" stop-color="'+c1+'"/><stop offset="1" stop-color="'+c2+'"/></radialGradient><clipPath id="'+u+'c"><circle cx="'+cx+'" cy="'+cy+'" r="'+r+'"/></clipPath>';
  if(lv===7)defs+='<linearGradient id="'+u+'a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f472b6"/><stop offset=".35" stop-color="#facc15"/><stop offset=".7" stop-color="#34d399"/><stop offset="1" stop-color="#60a5fa"/></linearGradient>';
  let s='<svg viewBox="0 0 64 64"><defs>'+defs+'</defs>';
  if(lv===7)s+='<circle class="aura" cx="32" cy="34" r="30" fill="none" stroke="url(#'+u+'a)" stroke-width="2.4" stroke-dasharray="5 4"/>';
  s+='<path d="M'+(cx+r*.6)+' '+(cy+r*.75)+'q9 1 11 9t9 4" fill="none" stroke="'+c2+'" stroke-width="3.2" stroke-linecap="round"/>';
  s+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="url(#'+u+'g)"/>';
  s+='<g clip-path="url(#'+u+'c)" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="2" stroke-linecap="round">';
  if(lv===6)s+='<path d="M32 9L13 28L32 59L51 28Z M13 28H51 M32 9L23 28L32 59L41 28Z" stroke-width="1.6" stroke="rgba(255,255,255,.85)"/>';
  else{s+='<path d="M'+(cx-r)+' '+(cy-r*.2)+'C'+(cx-r*.3)+' '+(cy-r*.9)+' '+(cx+r*.4)+' '+(cy+r*.7)+' '+(cx+r)+' '+(cy+r*.1)+'"/>'
    +'<path d="M'+(cx-r*.7)+' '+(cy+r*.7)+'C'+(cx-r*.2)+' '+(cy-r*.2)+' '+(cx+r*.3)+' '+(cy-r*.6)+' '+(cx+r*.9)+' '+(cy-r*.5)+'"/>'
    +'<path d="M'+(cx-r*.9)+' '+(cy+r*.3)+'C'+(cx-r*.4)+' '+(cy+r*.9)+' '+(cx+r*.4)+' '+(cy-r*.8)+' '+(cx+r*.5)+' '+(cy-r*.9)+'"/>';
    if(lv>=4)s+='<path d="M'+(cx-r*.5)+' '+(cy-r*.9)+'C'+(cx-r*.9)+' '+cy+' '+(cx-r*.2)+' '+(cy+r*.8)+' '+(cx+r*.3)+' '+(cy+r)+'"/>'}
  s+='</g><path d="M'+(cx-r*.55)+' '+(cy-r*.6)+'a'+r*.9+' '+r*.9+' 0 0 1 '+r*.5+' -'+r*.25+'" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="2.4" stroke-linecap="round"/>';
  if(lv>=5)s+=star(50,14,1,0)+star(12,22,.7,.7)+star(54,46,.6,1.4);
  if(lv>=6)s+=star(20,52,.8,.35);
  return s+'</svg>';
}
function yarnEl(n,size,cls){const s=el('span','yarn l'+yarnLevel(n)+(cls?' '+cls:''));s.style.width=s.style.height=size+'px';s.innerHTML=yarnSvg(n,size);return s}
function streakChip(n,dim){const c=el('span','sk-chip'+(dim?' dim':''));c.append(yarnEl(n,16),el('b',null,String(n)));c.title='Нить: '+daysWord(n);return c}

// ---------- данные ----------
async function loadStreaks(){
  if(!me||!strOk)return;
  const [a,b]=await Promise.all([sb.from('user_streaks').select('*').eq('user_id',me).maybeSingle(),sb.from('pair_streaks').select('*')]);
  if(a.error||b.error){if(/relation|does not exist|schema cache/i.test((a.error||b.error).message))strOk=false;return}
  strMe=a.data||null;strPairs={};(b.data||[]).forEach(r=>strPairs[r.a===me?r.b:r.a]=r);
  // новый уровень — радуемся
  const cur={me:yarnLevel(strEff(strMe))};Object.keys(strPairs).forEach(u=>cur[u]=yarnLevel(strEff(strPairs[u])));
  if(strPrev){if(cur.me>strPrev.me&&cur.me>=1)strLevelUp(null,strEff(strMe));Object.keys(strPairs).forEach(u=>{if(cur[u]>(strPrev[u]||0)&&cur[u]>=2)strLevelUp(u,strEff(strPairs[u]))})}
  strPrev=cur;strUI();
}
function strLevelUp(u,n){toast((u?'Нить с '+nameOf(u)+': ':'Ваша нить: ')+yarnName(n)+'! '+daysWord(n));if(yarnLevel(n)>=3&&typeof fx==='function')fx('confetti')}
function streakSoon(){clearTimeout(strT);strT=setTimeout(loadStreaks,2500)}
function strUI(){
  const n=strEff(strMe),b=$('skBtn');
  if(b){b.classList.toggle('hide',!n);b.innerHTML='';if(n){b.append(yarnEl(n,22),el('b',null,String(n)));b.classList.toggle('dim',!strDone(strMe))}}
  strHead();if(typeof scheduleChats==='function')scheduleChats();refreshSettings?.();
}
function strHead(){
  const h=$('cstreak');if(!h)return;h.innerHTML='';
  const n=cur&&!isGroupKey(cur)?strEff(strPairs[cur]):0;h.classList.toggle('hide',n<1);
  if(n>=1){h.append(yarnEl(n,22),el('b',null,String(n)));h.classList.toggle('dim',!strDone(strPairs[cur]));h.onclick=()=>openStreak(cur)}
}

// ---------- окно «Нить» ----------
function openStreak(uid){
  const pair=uid!=null,r=pair?strPairs[uid]:strMe,n=strEff(r),lv=yarnLevel(n);
  openModal(s=>{
    s.classList.add('sk-sheet');
    const x=el('button','icon sk-x');x.append(svgI('i-x'));x.onclick=closeModal;s.append(x);
    const hero=el('div','sk-hero l'+lv);hero.append(el('div','sk-glow'),yarnEl(n,132,'sk-big'),
      el('h2',null,pair?'Нить с '+nameOf(uid):'Ваша нить'),el('div','sk-num',n?daysWord(n):'ещё нет нити'),el('span','sk-lvl',yarnName(n)));
    s.append(hero);
    // шкала до следующего уровня
    const nx=YARN.find(([d])=>d>n),cur0=YARN[lv-1]?.[0]||0;
    if(nx){const p=el('div','sk-prog');const bar=el('div','sk-bar');const f=el('i');f.style.width=Math.max(4,Math.min(100,(n-cur0)/(nx[0]-cur0)*100))+'%';bar.append(f);
      p.append(bar,el('small',null,'До «'+nx[1]+'» — ещё '+daysWord(nx[0]-n)));s.append(p)}
    else s.append(el('p','sk-top','Вы на вершине — легендарный клубок!'));
    // статус на сегодня
    const st=el('div','sk-today');
    if(pair){
      const my=r?(r.a===me?r.last_a:r.last_b):null,their=r?(r.a===me?r.last_b:r.last_a):null,t=strToday();
      const row=(id,ok,who)=>{const d=el('div','sk-who'+(ok?' ok':''));d.append(avatar(id,38),el('b',null,who),el('i',null,ok?'написал(а) сегодня':'ещё нет'));return d};
      st.append(row(me,my===t,'Вы'),row(uid,their===t,nameOf(uid).split(' ')[0]));
      st.append(el('p','sk-msg',strDone(r)?'Сегодня нить продолжена — отличный день!':n?'Напишите друг другу сегодня до полуночи (по Москве), чтобы не потерять нить':'Начните переписку: напишите оба сегодня — и нить появится'));
    }else{
      st.append(el('p','sk-msg',strDone(r)?'Сегодня нить продолжена — отличный день!':n?'Отправьте сообщение сегодня до полуночи (по Москве), чтобы не потерять нить':'Напишите кому-нибудь — и нить начнётся'));
    }
    s.append(st);
    if(r&&r.best>n)s.append(el('div','sk-best','Лучшая серия: '+daysWord(r.best)));
    // нити с друзьями
    if(!pair){
      const ps=Object.keys(strPairs).map(u=>({u,n:strEff(strPairs[u])})).filter(x=>x.n>0).sort((a,b)=>b.n-a.n);
      s.append(el('div','sk-h','Нити с друзьями'));
      if(!ps.length)s.append(el('p','sk-empty','Пока нет общих нитей. Нить с другом появляется, когда вы оба написали друг другу в один день.'));
      ps.forEach(({u,n:k})=>{const row=giRow(avatar(u,40),nameOf(u),yarnName(k)+' · '+daysWord(k),'gi-mem');const y=yarnEl(k,34);y.classList.add('sk-row-y');row.append(y);row.onclick=()=>{closeModal();setTimeout(()=>openStreak(u),220)};s.append(row)});
    }
    // уровни
    s.append(el('div','sk-h','Уровни'));
    const g=el('div','sk-levels');YARN.forEach(([d,name],i)=>{const it=el('div','sk-lv'+(n>=d?' on':''));it.append(yarnEl(d,44),el('b',null,name),el('small',null,d+' '+plural(d,'день','дня','дней')));g.append(it)});
    s.append(g);
    const ok=el('button','primary wide','Понятно');ok.onclick=closeModal;s.append(ok);
  });
}
setInterval(()=>{if(me&&!document.hidden)loadStreaks()},240000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&me)streakSoon()});
