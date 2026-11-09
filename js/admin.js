// Админ-панель «Нити» (supabase/v8.sql). Уровни: 1 Помощник (можно купить), 2 Модератор, 3 Администратор, 4 Главный админ (только разработчики).
// Панель открывается из Настроек. Все действия идут через защищённые функции базы (admin_*): уровень проверяет сервер, а не телефон.
// Здесь же — «ограничения как в Discord»: мьют (нельзя писать) и бан (аккаунт закрыт) на срок или навсегда, с причиной.
let adminRole=0,myRestr=[],admTab='over';
const ADM_ROLES={1:['Помощник','#10b981','Мьют до 1 часа'],2:['Модератор','#3b82f6','Мьют до 7 дней, бан до 3 дней, журнал'],3:['Администратор','#a855f7','Ограничения до 30 дней, узелки до 1000 за раз, звания и Премиум'],4:['Главный админ','#f59e0b','Всё без ограничений, бесконечные узелки']};
const admBadge=r=>{const a=ADM_ROLES[r];if(!a)return null;const b=el('span','adm-badge',a[0]);b.style.setProperty('--rc',a[1]);return b};
const admWhen=t=>t?new Date(t).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'навсегда';
const admErr=e=>/function|schema cache|does not exist/i.test(e?.message||'')?'Запустите supabase/v8.sql в Supabase':(e?.message||String(e));
const admDur=m=>!m?'навсегда':m<60?m+' мин':m<1440?Math.round(m/60)+' ч':Math.round(m/1440)+' дн';

async function loadAdminRole(){
  if(!me)return;
  let {data,error}=await sb.from('app_admins').select('user_id,role').eq('user_id',me);
  if(error)({data,error}=await sb.from('app_admins').select('user_id').eq('user_id',me)); // v8.sql ещё не запущен — прежние админы = главные
  adminRole=error||!(data||[]).length?0:(data[0].role??4);
  amAppAdmin=adminRole>=3; // звания и Премиум — с уровня «Администратор»
}
// ---------- Мои ограничения ----------
async function loadRestr(){
  if(!me)return;
  const {data,error}=await sb.from('user_restrictions').select('*').eq('user_id',me).eq('revoked',false);
  if(error)return;myRestr=(data||[]).filter(r=>!r.until||new Date(r.until)>new Date());applyRestr();
}
const restrOf=k=>myRestr.find(r=>r.kind===k&&(!r.until||new Date(r.until)>new Date()));
function applyRestr(){
  const ban=restrOf('ban'),mute=ban||restrOf('mute'),m=$('msg');
  document.body.classList.toggle('muted',!!mute);
  if(m){if(mute){m.disabled=true;m.placeholder=(ban?'Аккаунт заблокирован':'Вы в муте')+(mute.until?' до '+admWhen(mute.until):' навсегда')}
    else if(m.disabled&&m.dataset.mutedBy==='1'){m.disabled=false}
    if(mute)m.dataset.mutedBy='1'}
  let s=$('banScreen');
  if(ban){
    if(!s){s=el('div','ban-screen');s.id='banScreen';document.body.append(s)}
    s.innerHTML='';const c=el('div','ban-card');c.append(svgI('i-lock'),el('h2',null,'Аккаунт ограничен'),
      el('p',null,'Вы не можете пользоваться Нитью '+(ban.until?'до '+admWhen(ban.until):'навсегда')+'.'),ban.reason?el('p','ban-why','Причина: '+ban.reason):el('span'));
    const out=el('button','ghost','Выйти из аккаунта');out.onclick=()=>$('out').click();c.append(out);s.append(c);
  }else s?.remove();
}
setInterval(()=>{if(me&&!document.hidden)loadRestr()},120000);
setInterval(()=>{if(me&&myRestr.length)applyRestr()},15000);

// ---------- Панель ----------
function admBox(){let w=$('adm');if(!w){w=el('div','gi hide');w.id='adm';document.body.append(w)}return w}
function openAdmin(tab){
  if(adminRole<1){toast('Нет доступа');return}
  admTab=tab||admTab;if(adminRole<2&&admTab==='log')admTab='over';
  const w=admBox();w.classList.remove('hide','closing');renderAdmin();
}
function closeAdmin(){const w=$('adm');if(!w)return;w.classList.add('closing');setTimeout(()=>{w.classList.add('hide');w.classList.remove('closing');w.innerHTML=''},260)}
function renderAdmin(){
  const w=admBox();w.innerHTML='';
  const top=el('div','gi-top');const back=el('button','icon');back.append(svgI('i-back'));back.onclick=closeAdmin;
  const t=el('b',null,'Админ-панель');top.append(back,t);const rb=admBadge(adminRole);rb.classList.add('adm-me');top.append(rb);w.append(top);
  const tabs=el('div','adm-tabs');
  [['over','Обзор'],['people','Люди'],['team','Команда'],...(adminRole>=2?[['log','Журнал']]:[])].forEach(([k,n])=>{
    const b=el('button','adm-tab'+(admTab===k?' on':''),n);b.onclick=()=>{admTab=k;renderAdmin()};tabs.append(b)});
  w.append(tabs);
  const sc=el('div','gi-scroll adm-sc');w.append(sc);
  ({over:admOver,people:admPeople,team:admTeam,log:admLog})[admTab](sc);
}
const admLoading=sc=>{sc.append(el('p','gf-empty','Загружаю…'))};
function admTile(sc,items){const g=el('div','adm-stats');items.forEach(([v,l])=>{const t=el('div','adm-stat');t.append(el('b',null,String(v)),el('small',null,l));g.append(t)});sc.append(g)}

async function admOver(sc){
  admLoading(sc);const {data,error}=await sb.rpc('admin_overview');sc.innerHTML='';
  if(error){sc.append(el('p','err',admErr(error)));return}
  const me_=ADM_ROLES[adminRole],card=el('section','gi-card adm-you');
  card.append(el('b',null,'Ваш уровень: '+me_[0]),el('small',null,'Можно: '+me_[2]));sc.append(card);
  admTile(sc,[[data.users,'людей'],[data.new_day,'новых за сутки'],[data.msgs_day,'сообщений за сутки'],[data.knots,'узелков у всех'],[data.gifts,'подарков']]);
  const ids=[...data.restr.map(r=>r.user_id),...data.team.map(r=>r.user_id)];await loadProfiles(ids);
  const c=el('section','gi-card');c.append(el('div','gi-h','Сейчас ограничены · '+data.restr.length));
  if(!data.restr.length)c.append(el('p','gf-empty','Никто не ограничен'));
  data.restr.forEach(r=>{const row=giRow(avatar(r.user_id,38),nameOf(r.user_id),(r.kind==='ban'?'Бан':'Мьют')+' до '+admWhen(r.until)+(r.reason?' · '+r.reason:''),'gi-mem');
    row.onclick=()=>admUser({id:r.user_id,username:people[r.user_id],display_name:prof[r.user_id]?.display_name});c.append(row)});
  sc.append(c);
}

// ---------- Люди ----------
function admPeople(sc){
  const box=el('div','adm-search');const inp=document.createElement('input');inp.placeholder='Ник или имя…';inp.autocomplete='off';
  const ico_=svgI('i-search');box.append(ico_,inp);sc.append(box);const out=el('div','adm-res');sc.append(out);
  out.append(el('p','gf-empty','Введите ник — найду человека и покажу действия'));
  let t=0;inp.oninput=()=>{clearTimeout(t);t=setTimeout(async()=>{
    const q=inp.value.trim();if(q.length<2){out.innerHTML='';out.append(el('p','gf-empty','Введите минимум 2 буквы'));return}
    const {data,error}=await sb.rpc('admin_find',{q});out.innerHTML='';
    if(error){out.append(el('p','err',admErr(error)));return}
    if(!(data||[]).length)out.append(el('p','gf-empty','Никого не нашли'));
    (data||[]).forEach(u=>{people[u.id]=u.username;if(!prof[u.id])prof[u.id]={id:u.id,username:u.username,display_name:u.display_name};
      const st=[u.banned?'бан':u.muted?'мьют':'',u.farm_gifts>=3?'⚠ подозрительные подарки':''].filter(Boolean).join(' · ');
      const r=giRow(avatar(u.id,40),u.display_name||u.username,'@'+u.username+(st?' · '+st:''),'gi-mem'+(u.banned||u.muted?' adm-bad':''));
      const bd=admBadge(u.role);if(bd)r.querySelector('.gi-rt b').append(bd);
      r.onclick=()=>admUser(u);out.append(r)})},350)};
  inp.focus();
}
async function admUser(u){
  // свежие данные о человеке
  let d=u;if(u.role===undefined||u.balance===undefined){const {data}=await sb.rpc('admin_find',{q:u.username||''});d=(data||[]).find(x=>x.id===u.id)||u}
  openModal(s=>{
    s.classList.add('gf-sheet','adm-sheet');
    const top=el('div','sheet-top');top.append(el('h3',null,'Человек'));const x=el('button','icon');x.append(svgI('i-x'));x.onclick=closeModal;top.append(x);s.append(top);
    const hero=el('div','adm-hero');hero.append(avatar(d.id,72));const nm=el('b',null,d.display_name||d.username||'?');const bd=admBadge(d.role);if(bd)nm.append(' ',bd);
    hero.append(nm,el('small',null,'@'+(d.username||'?')+(d.created?' · с '+new Date(d.created).toLocaleDateString('ru-RU'):'')));
    const meta=el('div','adm-meta');
    meta.append(el('span',null,'Узелки: '+(d.role===4?'∞':(d.balance??0))),el('span',null,'Подарков: '+(d.gifts??0)+(d.farm_gifts?' (от новых акк.: '+d.farm_gifts+')':'')));
    if(d.banned)meta.append(el('span','adm-red','Забанен'));else if(d.muted)meta.append(el('span','adm-red','В муте'));
    hero.append(meta);s.append(hero);
    const err=el('p','err');
    const canAct=d.id!==me&&(d.role||0)<adminRole;
    if(!canAct){s.append(el('p','gf-how',d.id===me?'Это вы':'Это админ вашего уровня или выше — действий нет'))}
    else{
      const mk=(ic,t,sub,f,cls)=>{const r=giRow(ic,t,sub,cls||'gi-mem');r.onclick=f;s.append(r)};
      mk('i-mic-off','Мьют','Человек не сможет писать',()=>admPick(d,'mute'));
      if(adminRole>=2)mk('i-lock','Бан','Аккаунт закрывается',()=>admPick(d,'ban'),'gi-mem gi-danger');
      if(d.muted||d.banned)mk('i-check','Снять ограничения',null,async()=>{
        for(const k of [d.banned?'ban':'',d.muted?'mute':''].filter(Boolean)){const {error}=await sb.rpc('admin_unrestrict',{target:d.id,k});if(error){err.textContent=admErr(error);return}}
        closeModal();toast('Ограничения сняты');if(admTab)renderAdmin()});
      if(adminRole>=3)mk('i-thread','Узелки','Начислить или списать'+(adminRole<4?' (до 1000 за раз)':''),()=>admKnots(d));
      if(adminRole>=4)mk('i-shield','Уровень админа','Назначить Помощника, Модератора или Администратора',()=>admRole(d));
    }
    s.append(err);
  });
}
function admPick(d,kind){
  openModal(s=>{
    s.classList.add('gf-sheet','adm-sheet');
    const top=el('div','sheet-top');top.append(el('h3',null,(kind==='ban'?'Бан: ':'Мьют: ')+(d.display_name||d.username)));const x=el('button','icon');x.append(svgI('i-x'));x.onclick=closeModal;top.append(x);s.append(top);
    const lim=adminRole===1?60:adminRole===2?(kind==='ban'?4320:10080):adminRole===3?43200:Infinity;
    const opts=[10,60,360,1440,4320,10080,43200,0].filter(m=>m===0?adminRole>=4:m<=lim);
    let pick=opts[0];const g=el('div','adm-chips');
    opts.forEach(m=>{const b=el('button','adm-chip'+(m===pick?' on':''),admDur(m));b.onclick=()=>{pick=m;[...g.children].forEach(c=>c.classList.toggle('on',c===b))};g.append(b)});s.append(g);
    const why=document.createElement('input');why.placeholder='Причина (её увидит человек)';why.maxLength=200;s.append(why);
    const err=el('p','err');const go=el('button','primary wide',kind==='ban'?'Забанить':'Замутить');
    go.onclick=async()=>{go.disabled=true;const {error}=await sb.rpc('admin_restrict',{target:d.id,k:kind,minutes:pick,why:why.value.trim()});
      if(error){err.textContent=admErr(error);go.disabled=false;return}closeModal();toast((kind==='ban'?'Бан':'Мьют')+' выдан: '+admDur(pick));if($('adm')&&!$('adm').classList.contains('hide'))renderAdmin()};
    s.append(err,go);
  });
}
function admKnots(d){
  openModal(s=>{
    s.classList.add('gf-sheet','adm-sheet');
    const top=el('div','sheet-top');top.append(el('h3',null,'Узелки: '+(d.display_name||d.username)));const x=el('button','icon');x.append(svgI('i-x'));x.onclick=closeModal;top.append(x);s.append(top);
    s.append(el('p','gf-how','Сейчас: '+(d.role===4?'∞':(d.balance??0))+'. Чтобы списать, введите число с минусом.'));
    const n=document.createElement('input');n.type='number';n.placeholder='Сколько (например 100 или -50)';s.append(n);
    const why=document.createElement('input');why.placeholder='Причина (в журнал)';why.maxLength=100;s.append(why);
    const err=el('p','err');const go=el('button','primary wide','Применить');
    go.onclick=async()=>{const a=parseInt(n.value,10);if(!a){err.textContent='Введите число';return}go.disabled=true;
      const {data,error}=await sb.rpc('admin_give',{target:d.id,amount:a,why:why.value.trim()});
      if(error){err.textContent=admErr(error);go.disabled=false;return}closeModal();toast('Готово. Теперь у человека '+data+' узелков')};
    s.append(err,go);
  });
}
function admRole(d){
  openModal(s=>{
    s.classList.add('gf-sheet','adm-sheet');
    const top=el('div','sheet-top');top.append(el('h3',null,'Уровень: '+(d.display_name||d.username)));const x=el('button','icon');x.append(svgI('i-x'));x.onclick=closeModal;top.append(x);s.append(top);
    const err=el('p','err');
    [1,2,3].forEach(r=>{const a=ADM_ROLES[r],row=giRow('i-shield',a[0]+(d.role===r?' · сейчас':''),a[2],'gi-mem');row.onclick=async()=>{
      const {error}=await sb.rpc('admin_set_role',{target:d.id,newrole:r});if(error){err.textContent=admErr(error);return}closeModal();toast('Назначен уровень «'+a[0]+'»');renderAdmin()};s.append(row)});
    if(d.role>0){const r=giRow('i-trash','Снять с должности',null,'gi-danger');r.onclick=async()=>{const {error}=await sb.rpc('admin_set_role',{target:d.id,newrole:0});if(error){err.textContent=admErr(error);return}closeModal();toast('Снят');renderAdmin()};s.append(r)}
    s.append(err);
  });
}

// ---------- Команда ----------
async function admTeam(sc){
  const info=el('section','gi-card');info.append(el('div','gi-h','Уровни'));
  [4,3,2,1].forEach(r=>{const a=ADM_ROLES[r],row=el('div','adm-lvl');const b=admBadge(r);row.append(b,el('small',null,a[2]+(r===1?' · можно купить за 2500 узелков':r===4?' · выдают только разработчики':'')));info.append(row)});sc.append(info);
  admLoading(sc);const {data,error}=await sb.rpc('admin_overview');sc.lastChild.remove();
  if(error){sc.append(el('p','err',admErr(error)));return}
  await loadProfiles(data.team.map(t=>t.user_id));
  const c=el('section','gi-card');c.append(el('div','gi-h','Команда · '+data.team.length));
  data.team.forEach(t=>{const row=giRow(avatar(t.user_id,38),nameOf(t.user_id),'@'+(people[t.user_id]||'?')+(t.bought?' · куплен':''),'gi-mem');const b=admBadge(t.role);if(b)row.querySelector('.gi-rt b').append(b);
    if(adminRole>=4&&t.role<4)row.onclick=()=>admRole({id:t.user_id,username:people[t.user_id],display_name:prof[t.user_id]?.display_name,role:t.role});c.append(row)});
  sc.append(c);
}
// ---------- Журнал ----------
async function admLog(sc){
  admLoading(sc);const {data,error}=await sb.rpc('admin_audit');sc.innerHTML='';
  if(error){sc.append(el('p','err',admErr(error)));return}
  await loadProfiles([...data.log.flatMap(l=>[l.admin_id,l.target]),...data.farm.map(f=>f.user_id)].filter(Boolean));
  const f=el('section','gi-card');f.append(el('div','gi-h','Подозрительные подарки (от новых аккаунтов)'));
  if(!data.farm.length)f.append(el('p','gf-empty','Ничего подозрительного'));
  data.farm.forEach(x=>{const r=giRow(avatar(x.user_id,36),nameOf(x.user_id),x.n+' подарков от аккаунтов младше 14 дней — их нельзя обменять на узелки','gi-mem');r.onclick=()=>admUser({id:x.user_id,username:people[x.user_id]});f.append(r)});sc.append(f);
  const NAMES={mute:'мьют',ban:'бан',unmute:'снял мьют',unban:'снял бан',give:'узелки',role:'уровень',buy_helper:'купил Помощника'};
  const c=el('section','gi-card');c.append(el('div','gi-h','Последние действия'));
  data.log.forEach(l=>{const r=el('div','adm-log');r.append(el('b',null,nameOf(l.admin_id)+' · '+(NAMES[l.action]||l.action)+(l.target&&l.target!==l.admin_id?' → '+nameOf(l.target):'')),el('small',null,admWhen(l.created_at)+(l.details?' · '+l.details:'')));c.append(r)});
  if(!data.log.length)c.append(el('p','gf-empty','Журнал пуст'));sc.append(c);
}
// Запись в настройках
function adminCard(){
  if(adminRole<1)return null;
  const c=el('section','gi-card');const r=giRow('i-shield','Админ-панель',ADM_ROLES[adminRole][0],'gi-accent');r.onclick=()=>openAdmin();
  const ch=el('span','chev');ch.append(svgI('i-back'));r.append(ch);c.append(r);return c;
}
