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
// Дизайн v5.6: карточки с отступами, вкладки-«таблетки» с иконками, цветной блок уровня, плитки действий, журнал-лента.
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
  const tt=el('div','am-tt');tt.append(el('b',null,'Админ-панель'),el('small',null,'Управление «Нитью»'));
  top.append(back,tt);const rb=admBadge(adminRole);rb.classList.add('adm-me');top.append(rb);w.append(top);
  const tabs=el('div','am-tabs');
  [['over','i-eye','Обзор'],['people','i-users','Люди'],['team','i-shield','Команда'],...(adminRole>=2?[['log','i-hourglass','Журнал']]:[])].forEach(([k,ic,n])=>{
    const b=el('button','am-tab'+(admTab===k?' on':''));b.append(svgI(ic),el('span',null,n));b.onclick=()=>{admTab=k;renderAdmin()};tabs.append(b)});
  w.append(tabs);
  const sc=el('div','gi-scroll am-sc');w.append(sc);
  ({over:admOver,people:admPeople,team:admTeam,log:admLog})[admTab](sc);
}
const admLoading=sc=>{const l=el('div','am-load');l.append(el('i'),el('span',null,'Загружаю…'));sc.append(l)};
const admEmpty=(ic,t,d)=>{const e=el('div','am-empty');e.append(svgI(ic),el('b',null,t));if(d)e.append(el('small',null,d));return e};
const admCard=(title,right)=>{const c=el('section','am-card');if(title){const h=el('div','am-h');h.append(el('span',null,title));if(right!=null)h.append(el('em',null,String(right)));c.append(h)}return c};
const admAgo=t=>{const d=new Date(t),n=new Date(),same=d.toDateString()===n.toDateString(),y=new Date(n-864e5).toDateString()===d.toDateString(),hm=d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
  return same?'сегодня, '+hm:y?'вчера, '+hm:d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})+', '+hm};
const admLeft=u=>{if(!u)return 'навсегда';const m=Math.max(0,Math.round((new Date(u)-Date.now())/6e4));return 'ещё '+(m<60?m+' мин':m<1440?Math.round(m/60)+' ч':Math.round(m/1440)+' дн')};
function admPerson(id,sub,badges){ // строка человека: аватар, имя, подпись
  const r=el('button','am-row');r.append(avatar(id,42));const t=el('div','am-rt');const n=el('b',null,nameOf(id));if(badges)n.append(...badges);t.append(n);if(sub)t.append(el('small',null,sub));r.append(t);return r;
}

async function admOver(sc){
  admLoading(sc);const {data,error}=await sb.rpc('admin_overview');sc.innerHTML='';
  if(error){sc.append(el('p','err',admErr(error)));return}
  const a=ADM_ROLES[adminRole],hero=el('section','am-hero');hero.style.setProperty('--rc',a[1]);
  const hi=el('div','am-hero-ic');hi.append(svgI(adminRole>=4?'i-crown':'i-shield'));
  const ht=el('div','am-hero-t');ht.append(el('small',null,'Ваш уровень'),el('b',null,a[0]),el('span',null,a[2]));hero.append(hi,ht);sc.append(hero);
  const stats=el('div','am-stats');
  [['i-users','Людей',data.users,'#3b82f6'],['i-plus','Новых за сутки',data.new_day,'#10b981'],['i-chats','Сообщений за сутки',data.msgs_day,'#a855f7'],['i-thread','Узелков у всех',data.knots,'#f59e0b'],['i-gift','Подарков',data.gifts,'#ec4899']].forEach(([ic,l,v,c],i)=>{
    const t=el('div','am-stat');t.style.setProperty('--c',c);t.style.animationDelay=i*45+'ms';const ico=el('span','am-sic');ico.append(svgI(ic));
    const tx=el('div');tx.append(el('b',null,Number(v).toLocaleString('ru-RU')),el('small',null,l));t.append(ico,tx);stats.append(t)});
  sc.append(stats);
  await loadProfiles([...data.restr.map(r=>r.user_id),...data.team.map(r=>r.user_id)]);
  const c=admCard('Сейчас ограничены',data.restr.length);
  if(!data.restr.length)c.append(admEmpty('i-check','Всё спокойно','Нарушителей сейчас нет'));
  data.restr.forEach(r=>{const ban=r.kind==='ban',row=admPerson(r.user_id,(r.reason?r.reason+' · ':'')+admLeft(r.until));
    const tag=el('span','am-tag '+(ban?'bad':'warn'),ban?'Бан':'Мьют');row.append(tag);
    row.onclick=()=>admUser({id:r.user_id,username:people[r.user_id],display_name:prof[r.user_id]?.display_name});c.append(row)});
  sc.append(c);
}

// ---------- Люди ----------
function admPeople(sc){
  const box=el('div','am-search');const inp=document.createElement('input');inp.placeholder='Найти человека по нику или имени';inp.autocomplete='off';
  box.append(svgI('i-search'),inp);sc.append(box);const out=el('div','am-list');sc.append(out);
  const hint=()=>{out.innerHTML='';out.append(admEmpty('i-search','Введите ник','Покажу человека и действия: мьют, бан, узелки, уровень'))};hint();
  let t=0;inp.oninput=()=>{clearTimeout(t);t=setTimeout(async()=>{
    const q=inp.value.trim();if(q.length<2){hint();return}
    out.innerHTML='';admLoading(out);const {data,error}=await sb.rpc('admin_find',{q});out.innerHTML='';
    if(error){out.append(el('p','err',admErr(error)));return}
    if(!(data||[]).length){out.append(admEmpty('i-x','Никого не нашли','Проверьте ник'));return}
    (data||[]).forEach((u,i)=>{people[u.id]=u.username;if(!prof[u.id])prof[u.id]={id:u.id,username:u.username,display_name:u.display_name};
      const bd=admBadge(u.role),r=admPerson(u.id,'@'+u.username,bd?[bd]:null);r.style.animationDelay=i*35+'ms';
      if(u.banned)r.append(el('span','am-tag bad','Бан'));else if(u.muted)r.append(el('span','am-tag warn','Мьют'));
      else if(u.farm_gifts>=3)r.append(el('span','am-tag warn','⚠ подарки'));
      r.onclick=()=>admUser(u);out.append(r)})},350)};
  inp.focus();
}
async function admUser(u){
  let d=u;if(u.role===undefined||u.balance===undefined){const {data}=await sb.rpc('admin_find',{q:u.username||''});d=(data||[]).find(x=>x.id===u.id)||u}
  openModal(s=>{
    s.classList.add('gf-sheet','adm-sheet');
    const x=el('button','icon gf-x');x.append(svgI('i-x'));x.onclick=closeModal;s.append(x);
    const hero=el('div','am-uhero');const rc=ADM_ROLES[d.role]?.[1]||'var(--acc)';hero.style.setProperty('--rc',rc);
    hero.append(avatar(d.id,76));const nm=el('b',null,d.display_name||d.username||'?');hero.append(nm);
    const sub=el('div','am-usub');sub.append(el('span',null,'@'+(d.username||'?')));const bd=admBadge(d.role);if(bd)sub.append(bd);hero.append(sub);
    if(d.created)hero.append(el('small',null,'В «Нити» с '+new Date(d.created).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})));
    s.append(hero);
    const st=el('div','am-ustats');
    [['Узелки',d.role===4?'∞':String(d.balance??0)],['Подарков',String(d.gifts??0)],['От новых акк.',String(d.farm_gifts??0)]].forEach(([l,v])=>{const c=el('div');c.append(el('b',null,v),el('small',null,l));st.append(c)});
    s.append(st);
    if(d.banned||d.muted){const al=el('div','am-alert');al.append(svgI('i-lock'),el('span',null,d.banned?'Человек забанен':'Человек в муте'));s.append(al)}
    const err=el('p','err');
    const canAct=d.id!==me&&(d.role||0)<adminRole;
    if(!canAct){s.append(el('p','gf-how',d.id===me?'Это вы':'Это админ вашего уровня или выше — действий нет'))}
    else{
      const g=el('div','am-acts');
      const tile=(ic,t,sub,f,cls)=>{const b=el('button','am-act'+(cls?' '+cls:''));const i=el('span','am-aic');i.append(svgI(ic));const tx=el('div');tx.append(el('b',null,t),el('small',null,sub));b.append(i,tx);b.onclick=f;g.append(b)};
      tile('i-mic-off','Мьют','Не сможет писать',()=>admPick(d,'mute'));
      if(adminRole>=2)tile('i-lock','Бан','Закрыть аккаунт',()=>admPick(d,'ban'),'bad');
      if(adminRole>=3)tile('i-thread','Узелки','Начислить / списать',()=>admKnots(d));
      if(adminRole>=4)tile('i-shield','Уровень','Назначить админа',()=>admRole(d));
      s.append(g);
      if(d.muted||d.banned){const b=el('button','primary wide','Снять ограничения');b.onclick=async()=>{
        for(const k of [d.banned?'ban':'',d.muted?'mute':''].filter(Boolean)){const {error}=await sb.rpc('admin_unrestrict',{target:d.id,k});if(error){err.textContent=admErr(error);return}}
        closeModal();toast('Ограничения сняты');renderAdmin()};s.append(b)}
    }
    s.append(err);
  });
}
function admSheetTop(s,title){const top=el('div','sheet-top');top.append(el('h3',null,title));const x=el('button','icon');x.append(svgI('i-x'));x.onclick=closeModal;top.append(x);s.append(top)}
function admPick(d,kind){
  openModal(s=>{
    s.classList.add('gf-sheet','adm-sheet');admSheetTop(s,(kind==='ban'?'Бан: ':'Мьют: ')+(d.display_name||d.username));
    s.append(el('div','am-lab','На сколько'));
    const lim=adminRole===1?60:adminRole===2?(kind==='ban'?4320:10080):adminRole===3?43200:Infinity;
    const opts=[10,60,360,1440,4320,10080,43200,0].filter(m=>m===0?adminRole>=4:m<=lim);
    let pick=opts[0];const g=el('div','adm-chips');
    opts.forEach(m=>{const b=el('button','adm-chip'+(m===pick?' on':''),admDur(m));b.onclick=()=>{pick=m;[...g.children].forEach(c=>c.classList.toggle('on',c===b))};g.append(b)});s.append(g);
    s.append(el('div','am-lab','Причина'));
    const why=document.createElement('input');why.placeholder='Её увидит человек';why.maxLength=200;s.append(why);
    const err=el('p','err');const go=el('button','primary wide',kind==='ban'?'Забанить':'Замутить');
    go.onclick=async()=>{go.disabled=true;const {error}=await sb.rpc('admin_restrict',{target:d.id,k:kind,minutes:pick,why:why.value.trim()});
      if(error){err.textContent=admErr(error);go.disabled=false;return}closeModal();toast((kind==='ban'?'Бан':'Мьют')+' выдан: '+admDur(pick));if($('adm')&&!$('adm').classList.contains('hide'))renderAdmin()};
    s.append(err,go);
  });
}
function admKnots(d){
  openModal(s=>{
    s.classList.add('gf-sheet','adm-sheet');admSheetTop(s,'Узелки: '+(d.display_name||d.username));
    const cur=el('div','am-bal');cur.append(svgI('i-thread'),el('b',null,d.role===4?'∞':String(d.balance??0)),el('small',null,'сейчас на счёте'));s.append(cur);
    s.append(el('div','am-lab','Сколько (минус — списать)'+(adminRole<4?' · до 1000 за раз':'')));
    const n=document.createElement('input');n.type='number';n.placeholder='Например 100 или -50';s.append(n);
    const q=el('div','adm-chips');[50,100,500,1000].forEach(v=>{const b=el('button','adm-chip','+'+v);b.onclick=()=>{n.value=v};q.append(b)});s.append(q);
    s.append(el('div','am-lab','Причина'));
    const why=document.createElement('input');why.placeholder='Для журнала';why.maxLength=100;s.append(why);
    const err=el('p','err');const go=el('button','primary wide','Применить');
    go.onclick=async()=>{const a=parseInt(n.value,10);if(!a){err.textContent='Введите число';return}go.disabled=true;
      const {data,error}=await sb.rpc('admin_give',{target:d.id,amount:a,why:why.value.trim()});
      if(error){err.textContent=admErr(error);go.disabled=false;return}closeModal();toast('Готово. Теперь у человека '+data+' узелков')};
    s.append(err,go);
  });
}
function admRole(d){
  openModal(s=>{
    s.classList.add('gf-sheet','adm-sheet');admSheetTop(s,'Уровень: '+(d.display_name||d.username));
    const err=el('p','err'),list=el('div','am-levels');
    [1,2,3].forEach(r=>{const a=ADM_ROLES[r],row=el('button','am-level'+(d.role===r?' on':''));row.style.setProperty('--rc',a[1]);
      const tx=el('div');tx.append(el('b',null,a[0]+(d.role===r?' · сейчас':'')),el('small',null,a[2]));row.append(el('i'),tx);
      row.onclick=async()=>{const {error}=await sb.rpc('admin_set_role',{target:d.id,newrole:r});if(error){err.textContent=admErr(error);return}closeModal();toast('Назначен уровень «'+a[0]+'»');renderAdmin()};list.append(row)});
    s.append(list);
    if(d.role>0){const r=el('button','ghost wide danger','Снять с должности');r.onclick=async()=>{const {error}=await sb.rpc('admin_set_role',{target:d.id,newrole:0});if(error){err.textContent=admErr(error);return}closeModal();toast('Снят');renderAdmin()};s.append(r)}
    s.append(err);
  });
}

// ---------- Команда ----------
async function admTeam(sc){
  const info=admCard('Уровни доступа');
  [4,3,2,1].forEach(r=>{const a=ADM_ROLES[r],row=el('div','am-lvl');row.style.setProperty('--rc',a[1]);
    const tx=el('div');tx.append(el('b',null,a[0]),el('small',null,a[2]+(r===1?' · можно купить за 2500 узелков':r===4?' · выдают только разработчики':'')));row.append(el('i'),tx);info.append(row)});
  sc.append(info);
  admLoading(sc);const {data,error}=await sb.rpc('admin_overview');sc.lastChild.remove();
  if(error){sc.append(el('p','err',admErr(error)));return}
  await loadProfiles(data.team.map(t=>t.user_id));
  const c=admCard('Команда',data.team.length);
  data.team.forEach(t=>{const bd=admBadge(t.role),row=admPerson(t.user_id,'@'+(people[t.user_id]||'?')+(t.bought?' · куплен':''),bd?[bd]:null);
    if(adminRole>=4&&t.role<4){const ch=el('span','chev');ch.append(svgI('i-back'));row.append(ch);row.onclick=()=>admRole({id:t.user_id,username:people[t.user_id],display_name:prof[t.user_id]?.display_name,role:t.role})}
    c.append(row)});
  sc.append(c);
  if(adminRole>=4)sc.append(el('p','am-note','Чтобы назначить уровень, откройте человека во вкладке «Люди» → «Уровень».'));
}
// ---------- Журнал ----------
const ADM_LOG={mute:['i-mic-off','#f59e0b','выдал мьют'],ban:['i-lock','#ef4444','забанил'],unmute:['i-check','#10b981','снял мьют'],unban:['i-check','#10b981','снял бан'],give:['i-thread','#f59e0b','изменил узелки'],role:['i-shield','#a855f7','назначил уровень'],buy_helper:['i-gem','#10b981','купил уровень «Помощник»']};
function admLogText(l){
  const d=l.details||'';
  if(l.action==='give'){const m=d.match(/^(-?\d+)\s*(.*)$/);return m?((+m[1]>0?'+':'')+m[1]+' узелков'+(m[2]?' · '+m[2]:'')):d}
  if(l.action==='role'){const r=ADM_ROLES[+d];return r?'«'+r[0]+'»':(d==='0'?'снят с должности':d)}
  if(l.action==='mute'||l.action==='ban'){const m=d.match(/^(\d+)\s*мин\.\s*(.*)$/);return m?(admDur(+m[1])+(m[2]?' · '+m[2]:'')):d}
  return d;
}
async function admLog(sc){
  admLoading(sc);const {data,error}=await sb.rpc('admin_audit');sc.innerHTML='';
  if(error){sc.append(el('p','err',admErr(error)));return}
  await loadProfiles([...data.log.flatMap(l=>[l.admin_id,l.target]),...data.farm.map(f=>f.user_id)].filter(Boolean));
  const f=admCard('Подозрительные подарки',data.farm.length||null);
  f.append(el('small','am-sub','Много подарков от аккаунтов младше 14 дней — их нельзя обменять на узелки'));
  if(!data.farm.length)f.append(admEmpty('i-check','Ничего подозрительного'));
  data.farm.forEach(x=>{const r=admPerson(x.user_id,x.n+' подарков от новых аккаунтов');r.append(el('span','am-tag warn','⚠'));r.onclick=()=>admUser({id:x.user_id,username:people[x.user_id]});f.append(r)});sc.append(f);
  const c=admCard('Последние действия',data.log.length||null);
  if(!data.log.length)c.append(admEmpty('i-hourglass','Журнал пуст'));
  const tl=el('div','am-tl');
  data.log.forEach(l=>{const [ic,col,verb]=ADM_LOG[l.action]||['i-gear','#94a3b8',l.action];
    const it=el('div','am-ev');it.style.setProperty('--c',col);const dot=el('span','am-dot');dot.append(svgI(ic));
    const tx=el('div','am-evt');const who=nameOf(l.admin_id),tg=l.target&&l.target!==l.admin_id?nameOf(l.target):'';
    const line=el('b',null,who+' '+verb);if(tg)line.append(el('span',null,' → '+tg));tx.append(line);
    const sub=[admLogText(l),admAgo(l.created_at)].filter(Boolean).join(' · ');tx.append(el('small',null,sub));it.append(dot,tx);tl.append(it)});
  c.append(tl);sc.append(c);
}
// Запись в настройках
function adminCard(){
  if(adminRole<1)return null;
  const c=el('section','gi-card');const r=giRow('i-shield','Админ-панель',ADM_ROLES[adminRole][0],'gi-accent');r.onclick=()=>openAdmin();
  const ch=el('span','chev');ch.append(svgI('i-back'));r.append(ch);c.append(r);return c;
}
