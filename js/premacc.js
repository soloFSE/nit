// Премиум-аккаунты «Нити» (supabase/v5.sql: таблица premium_users). Выдаёт администрация приложения (app_admins),
// как звания. Фишки: премиум-эмодзи в сообщениях, золотая звезда или статус-эмодзи рядом с именем, цвет профиля,
// до 10 закреплённых чатов, ранний доступ. Если таблицы в базе ещё нет — ограничений нет (premOk=false).
let premMap={},premOk=true;
const PREM_COLORS=['#f59e0b','#f97316','#ef4444','#ec4899','#d946ef','#a855f7','#6366f1','#3b82f6','#06b6d4','#14b8a6','#22c55e','#84cc16','#eab308','#94a3b8'];
// Цвет ника (подписка): красим имя человека там, где оно показано. Цвет выбирается в «Нить Премиум» → «Цвет ника»
function premPaint(node,uid){const c=premMap[uid]?.color;if(c&&isPremium(uid)&&/^#[0-9a-fA-F]{6}$/.test(c)){node.style.color=c;node.classList.add('pnick')}return node}
const premActive=r=>!!r&&(!r.until||new Date(r.until)>new Date());
const isPremium=uid=>premOk&&premActive(premMap[uid]);
const canUsePremEmoji=()=>!premOk||isPremium(me)||amAppAdmin; // админы приложения тоже могут
const hasPremTokens=b=>{if(!b||typeof premRe==='undefined')return false;premRe.lastIndex=0;const r=premRe.test(b);premRe.lastIndex=0;return r};
const premBlocked=b=>premOk&&!isPremium(me)&&!amAppAdmin&&hasPremTokens(b);
async function loadPremium(){
  if(!me)return;
  const {data,error}=await sb.from('premium_users').select('user_id,until,emoji_status,color');
  if(error){premOk=!/relation|does not exist|schema cache/i.test(error.message)?premOk:false;return}
  premOk=true;premMap={};(data||[]).forEach(r=>premMap[r.user_id]=r);
  if(typeof renderChats==='function')scheduleChats();refreshPeer?.();
}
// Значок рядом с именем: статус-эмодзи или золотая звезда (только у активного Премиума)
function premMark(uid){
  if(!isPremium(uid))return null;const r=premMap[uid],s=el('span','pmark');s.title='Премиум';
  const m=r.emoji_status&&/^:([a-z]{2,6})(\d{1,3}):$/.exec(r.emoji_status);
  if(m&&typeof premEl==='function')s.append(premEl(m[1],+m[2]));else s.append(ico('i-star'));
  return s;
}
function premHue(uid){const c=premMap[uid]?.color;if(!isPremium(uid)||!c)return null;
  const n=parseInt(c.slice(1),16),r=(n>>16&255)/255,g=(n>>8&255)/255,b=(n&255)/255,mx=Math.max(r,g,b),d=mx-Math.min(r,g,b);
  let h=d===0?0:mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;return Math.round(((h*60)+360)%360)}
const untilText=r=>!r?'':!r.until?'навсегда':'до '+new Date(r.until).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});

// ---------- Экран «Премиум» ----------
const PREM_FEATURES=[['i-gem','Премиум-эмодзи','Отправляйте анимированные эмодзи из наборов в сообщениях'],['i-star','Золотая звезда','Значок рядом с именем в чатах и профиле'],['i-smile','Статус-эмодзи','Своя эмодзи вместо звезды рядом с именем'],['i-brush','Цвет профиля','Профиль в вашем цвете для всех, кто его открывает'],['i-pin','10 закреплённых чатов','Вместо 5 обычных'],['i-rocket','Ранний доступ','Новые функции «Нити» раньше всех']];
function openPremium(){
  const r=premMap[me],act=isPremium(me);
  openModal(s=>{
    s.classList.add('pr-sheet');
    const x=el('button','icon pr-x');x.append(svgI('i-x'));x.onclick=closeModal;s.append(x);
    const hero=el('div','pr-hero');const st=el('div','pr-stars');for(let i=0;i<7;i++){const i2=el('i');i2.style.setProperty('--i',i);st.append(i2)}
    const big=el('div','pr-big');big.append(svgI('i-gem'));hero.append(st,big,el('h2',null,'Нить Премиум'),el('p',null,act?'Подключён '+untilText(r):'Ещё не подключён'));s.append(hero);
    const l=el('div','pr-list');PREM_FEATURES.forEach(([ic,t,d],i)=>{const row=giRow(ic,t,d,'gi-mem pr-row');row.style.animationDelay=i*45+'ms';l.append(row)});s.append(l);
    if(act){
      const c=el('div','gi-card pr-card');c.append(el('div','gi-h','Ваши настройки'));
      const st1=giRow('i-smile','Статус-эмодзи',r.emoji_status?'Выбрано':'Не выбрано');const cur=r.emoji_status&&/^:([a-z]{2,6})(\d{1,3}):$/.exec(r.emoji_status);
      if(cur&&typeof premEl==='function'){const p=el('span','pr-cur');p.append(premEl(cur[1],+cur[2]));st1.append(p)}
      st1.onclick=()=>pickStatusEmoji();c.append(st1);
      const cw=el('div','pr-colors');const pv=el('b','pr-nickprev',nameOf(me));premPaint(pv,me);cw.append(el('span',null,'Цвет ника и профиля'),pv);const sw=el('div');
      [null,...PREM_COLORS].forEach(col=>{const b=el('button','pr-col'+((r.color||null)===col?' on':''));if(col)b.style.background=col;else b.append(svgI('i-x'));b.onclick=async()=>{await savePremPrefs(r.emoji_status,col);openPremium()};sw.append(b)});
      {const cust=document.createElement('input');cust.type='color';cust.className='pr-custom';cust.title='Свой цвет';cust.value=/^#[0-9a-fA-F]{6}$/.test(r.color||'')?r.color:'#a855f7';
        cust.onchange=async()=>{await savePremPrefs(r.emoji_status,cust.value);openPremium()};sw.append(cust)}
      cw.append(sw);cw.append(el('small','pr-hint','Цвет ника виден в чатах, группах и профиле. Подойдёт и свой цвет — кружок с палитрой.'));c.append(cw);s.append(c);
    }else{
      s.append(el('p','pr-how','Премиум выдаёт администрация «Нити» — например за помощь с тестированием и идеи. Если хотите, напишите им.'));
    }
    const ok=el('button','primary wide',act?'Готово':'Понятно');ok.onclick=closeModal;s.append(ok);
  });
}
async function savePremPrefs(e,c){
  const {error}=await sb.rpc('set_premium_prefs',{e:e||'',c:c||''});
  if(error){toast('Не удалось сохранить: '+error.message);return false}
  if(premMap[me]){premMap[me].emoji_status=e||null;premMap[me].color=c||null}refreshPeer?.();renderMe?.();return true;
}
function pickStatusEmoji(){
  openModal(s=>{
    s.classList.add('emo-sheet');
    const top=el('div','sheet-top');top.append(el('h3',null,'Статус-эмодзи'));const x=el('button','icon');x.append(svgI('i-x'));x.onclick=()=>openPremium();top.append(x);s.append(top);
    const box=el('div','pr-pick');
    const none=el('button','ghost wide','Убрать (показывать звезду)');none.onclick=async()=>{if(await savePremPrefs('',premMap[me]?.color))openPremium()};box.append(none);
    PREM_PACKS.forEach(p=>{box.append(el('div','prem-h',p.name));const g=el('div','prem-grid');
      for(let i=0;i<p.n;i++){const b=el('button','prem-it');b.append(premEl(p.id,i,'',true));b.onclick=async()=>{if(await savePremPrefs(':'+p.id+i+':',premMap[me]?.color))openPremium()};g.append(b)}
      box.append(g)});
    s.append(box);
  });
}

// ---------- Выдача Премиума (только админам приложения) ----------
function premiumCard(uid){
  if(!amAppAdmin||uid===me)return null;
  const c=el('section','gi-card');const act=isPremium(uid);
  const r=giRow('i-gem',act?'Премиум: '+untilText(premMap[uid]):'Выдать Премиум','Эмодзи, звезда, цвет профиля и другие фишки','gi-accent');
  r.onclick=()=>grantPremium(uid);c.append(r);return c;
}
function grantPremium(uid){
  openModal(s=>{
    const top=el('div','sheet-top');top.append(el('h3',null,'Премиум для '+nameOf(uid)));const x=el('button','icon');x.append(svgI('i-x'));x.onclick=closeModal;top.append(x);s.append(top);
    const opt=(t,d,days)=>{const r=giRow('i-gem',t,d,'gi-mem');r.onclick=async()=>{
      const until=days?new Date(Date.now()+days*864e5).toISOString():null;
      const {error}=await sb.from('premium_users').upsert({user_id:uid,until,granted_by:me},{onConflict:'user_id'});
      if(error){toast(/relation|schema cache/i.test(error.message)?'Запустите supabase/v5.sql в Supabase':'Не удалось: '+error.message);return}
      closeModal();await loadPremium();toast('Премиум выдан');sendMsg(uid,{body:'::pgift:'+days+'::'},{noReply:true}).catch(()=>{})};s.append(r)};
    opt('7 дней','Пробный период',7);opt('30 дней',null,30);opt('90 дней',null,90);opt('Навсегда','Без срока',0);
    if(isPremium(uid)){const d=giRow('i-trash','Забрать Премиум',null,'gi-danger');d.onclick=async()=>{
      if(!confirm('Забрать Премиум у '+nameOf(uid)+'?'))return;
      const {error}=await sb.from('premium_users').delete().eq('user_id',uid);if(error){toast('Не удалось: '+error.message);return}
      closeModal();await loadPremium();toast('Премиум забран')};s.append(d)}
  });
}
// Подарок-сообщение
SPECIAL.push({re:/^::pgift:(\d+)::$/,cls:'pgift-m',forward:false,preview:()=>PI('i-gem')+'Подарок: Премиум',
  render:(m,d,x)=>{if(typeof admIds!=='undefined'&&admIds.size&&!admIds.has(m.sender)){d.append(el('small',null,'Подделка: Премиум дарит только администрация'));return}
    const days=+x[1],w=el('div','pgift');const ic=el('div','pgift-ic');ic.append(svgI('i-gem'));
    w.append(ic,el('small',null,m.sender===me?'Вы подарили Премиум':'Вам подарен Премиум'),el('b',null,'Нить Премиум'),el('span',null,days?days+' '+plural(days,'день','дня','дней'):'Навсегда'));
    d.append(w);
    if(m.sender!==me&&Date.now()-new Date(m.created_at)<8000&&typeof fx==='function')setTimeout(()=>fx('confetti'),300)}});
setInterval(()=>{if(me&&!document.hidden)loadPremium()},180000);
