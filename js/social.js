// Удаление из друзей, блокировка, «в сети» и «печатает…»
let blocked=new Set(),online=new Set(),typing={},liveCh=null,typeTimer=0;

async function loadBlocks(){
  const {data,error}=await sb.from('blocks').select('blocked').eq('blocker',me);
  if(!error)blocked=new Set((data||[]).map(x=>x.blocked));
}
const isBlocked=id=>blocked.has(id);

async function removeFriend(id){
  if(!confirm('Удалить '+nameOf(id)+' из друзей? Переписка останется, но писать друг другу вы не сможете, пока снова не станете друзьями.'))return false;
  const {data,error}=await sb.from('friendships').delete().or(`and(a.eq.${me},b.eq.${id}),and(a.eq.${id},b.eq.${me})`).select();
  if(error||!data?.length){alert('Не удалось удалить'+(error?': '+error.message:'. Запустите supabase/social.sql в Supabase.'));return false}
  setFr(fr.filter(f=>!((f.a===me&&f.b===id)||(f.a===id&&f.b===me))));
  if(cur===id)closeChat();
  return true;
}

async function blockUser(id){
  if(!confirm('Заблокировать '+nameOf(id)+'? Он пропадёт из друзей и не сможет писать вам в личку и присылать заявки.'))return false;
  const {error}=await sb.from('blocks').insert({blocker:me,blocked:id});
  if(error&&!/duplicate/i.test(error.message)){alert('Не удалось заблокировать: '+error.message);return false}
  blocked.add(id);
  await sb.from('friendships').delete().or(`and(a.eq.${me},b.eq.${id}),and(a.eq.${id},b.eq.${me})`);
  setFr(fr.filter(f=>!((f.a===me&&f.b===id)||(f.a===id&&f.b===me))));
  if(cur===id)setHead(id),applyBlockUI();
  return true;
}
async function unblockUser(id){
  const {error}=await sb.from('blocks').delete().eq('blocker',me).eq('blocked',id);
  if(error){alert('Не удалось разблокировать: '+error.message);return false}
  blocked.delete(id);if(cur===id)setHead(id),applyBlockUI();
  return true;
}

// В личке с заблокированным вместо поля ввода — плашка
function applyBlockUI(){
  const b=cur&&!isGroupKey(cur)&&isBlocked(cur);
  const ro=cur&&isGroupKey(cur)&&groups[gidOf(cur)]&&!canDo(gidOf(cur),'send');
  $('send').classList.toggle('hide',!cur||b||ro);$('blockbar').classList.toggle('hide',!b);$('robar').classList.toggle('hide',!ro);
}
$('unblockbtn').onclick=async()=>{if(cur&&await unblockUser(cur)){}};

// Список заблокированных в настройках профиля
async function blockedSection(box){
  box.append(el('span',null,'Заблокированные'));
  const list=el('div','blist');box.append(list);
  const ids=[...blocked];
  if(!ids.length){list.append(el('small','sm','Никого нет.'));return}
  await loadProfiles(ids);
  ids.forEach(id=>{
    const b=el('button','ghost sm-btn','разблокировать');
    b.onclick=async e=>{e.preventDefault();if(await unblockUser(id))r.remove()};
    const r=row(avatar(id,32),nameOf(id),'@'+(people[id]||'?'),b);r.style.cursor='default';list.append(r);
  });
}

// ---------- В сети / печатает ----------
function startLive(){
  liveCh=sb.channel('nit-live',{config:{presence:{key:me},broadcast:{self:false}}});
  liveCh.on('presence',{event:'sync'},()=>{
    online=new Set(Object.keys(liveCh.presenceState()));
    renderOnline();
  }).on('broadcast',{event:'typing'},({payload:p})=>{
    if(!p||p.from===me||isBlocked(p.from))return;
    const k=isGroupKey(p.to)?p.to:(p.to===me?p.from:null);if(!k)return;
    if(isGroupKey(k)&&!groups[gidOf(k)])return;
    typing[k]={from:p.from,until:Date.now()+4000};scheduleChats();clearTimeout(typing[k].t2);typing[k].t2=setTimeout(scheduleChats,4100);
    if(cur===k)setSub();
    setTimeout(()=>{if(cur===k)setSub()},4100);
  }).subscribe(async st=>{if(st==='SUBSCRIBED')await liveCh.track({at:Date.now()})});
}
// Зелёные точки на аватарках друзей и подпись «в сети» в шапке
function renderOnline(){
  document.querySelectorAll('[data-uid]').forEach(a=>a.classList.toggle('online',online.has(a.dataset.uid)));
  if(cur)setSub();
}
function setSub(){
  const k=cur;if(!k)return;const t=typing[k];
  if(t&&t.until>Date.now()){
    const c=$('csub');c.textContent=isGroupKey(k)?nameOf(t.from)+' печатает':'печатает';
    const dots=el('span','dots');dots.append(el('i'),el('i'),el('i'));c.append(dots);c.classList.add('typing');return;
  }
  $('csub').classList.remove('typing');
  if(isGroupKey(k)){const n=(gm[gidOf(k)]||[]).length,on=(gm[gidOf(k)]||[]).filter(i=>i!==me&&online.has(i)).length;
    $('csub').textContent=n+' '+plural(n,'участник','участника','участников')+(on?', '+on+' в сети':'');}
  else $('csub').textContent=isBlocked(k)?'заблокирован':(online.has(k)?'в сети':'@'+(people[k]||'?'))+(prof[k]?.status?' · '+prof[k].status:'');
}
// Сообщаем собеседнику, что печатаем (не чаще раза в 2 секунды)
$('msg').addEventListener('input',()=>{
  if(!cur||!liveCh||Date.now()-typeTimer<2000||!$('msg').value)return;
  typeTimer=Date.now();liveCh.send({type:'broadcast',event:'typing',payload:{from:me,to:cur}});
});
