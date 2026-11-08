// Запуск после входа, опрос сервера и realtime-подписки
async function boot(u){
  if(me===u.id)return;
  me=u.id;
  await loadProfiles([me],true);
  myName=people[me]||'я';renderMe();
  $('auth').classList.add('hide');$('app').classList.remove('hide');
  chatsReady=false;$('list').innerHTML='';$('list').append(chatSkeleton());
  await loadBlocks();
  await loadFriends();
  await loadGroups();
  const {data:l}=await sb.from('messages').select('id').order('id',{ascending:false}).limit(1);
  lastId=l?.[0]?.id||0;
  const {data:h}=await sb.from('message_hides').select('message_id');hidden=new Set((h||[]).map(x=>x.message_id));
  const {data:dl}=await sb.from('messages').select('deleted_at').not('deleted_at','is',null).order('deleted_at',{ascending:false}).limit(1);
  lastDel=dl?.[0]?.deleted_at||lastDel;
  await loadUnread();
  chatsReady=true;renderChats();$('list').classList.add('appear');setTimeout(()=>$('list').classList.remove('appear'),700);
  loadLast();loadStories();loadTitles();loadPrefs();
  try{
    const last=localStorage.getItem('nit-last');
    const ok=last&&(isGroupKey(last)?groups[gidOf(last)]:fr.some(f=>f.status==='accepted'&&(f.a===last||f.b===last)));
    if(ok&&!matchMedia('(max-width:760px)').matches)openChat(last);
  }catch{}
  schedule();
  sb.channel('nit').on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},p=>onMsg(p.new))
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'messages'},p=>onMsg(p.new))
    .on('postgres_changes',{event:'*',schema:'public',table:'friendships'},()=>loadFriends())
    .on('postgres_changes',{event:'*',schema:'public',table:'group_members'},()=>loadGroups())
    .on('postgres_changes',{event:'*',schema:'public',table:'groups'},()=>loadGroups()).subscribe(st=>{rtOk=st==='SUBSCRIBED';setNet(rtOk);if(rtOk)schedule()});
  // Реакции — отдельным каналом: если SQL ещё не запущен, это не сломает остальное
  sb.channel('nit-reacts').on('postgres_changes',{event:'*',schema:'public',table:'reactions'},p=>{
    const id=p.new?.message_id||p.old?.message_id;if(id&&nodes[id])loadReactions([id]);
  }).subscribe();
  // Прочитано, закреп, голоса — тоже отдельно
  sb.channel('nit-more').on('postgres_changes',{event:'*',schema:'public',table:'reads'},p=>onReadEvent(p.new))
    .on('postgres_changes',{event:'*',schema:'public',table:'pins'},p=>{const c=p.new?.chat||p.old?.chat;if(cur&&c===readKey(cur))loadPin(cur)})
    .on('postgres_changes',{event:'*',schema:'public',table:'poll_votes'},p=>{const id=p.new?.message_id||p.old?.message_id;if(id&&nodes[id])loadVotes([id])})
    .subscribe();
  startCalls();
  startLive();
}
function unboot(){clearTimeout(poll);lastOf={};stories=[];storySeen=new Set();titlesOf={};titleById={};amAppAdmin=false;poll=null;me=null;cur=null;fr=[];frSig="";groups={};gm={};grSig="";prof={};unread={};blocked=new Set();online=new Set();reacts={};liveCh=null;socialOk=true;myReads={};peerReads={};votes={};seen=new Set();sb.removeAllChannels();$('app').classList.add('hide');$('auth').classList.remove('hide')}

// Пока работают мгновенные обновления (realtime), сервер почти не опрашиваем — это только подстраховка.
// Если realtime отвалился — опрашиваем чаще. Свёрнутая вкладка опрашивает в 4 раза реже.
let rtOk=false,lastFull=0,lastProf=Date.now(),ticking=false;
function schedule(){
  clearTimeout(poll);if(!me)return;
  const base=rtOk?20000:5000;
  poll=setTimeout(tick,document.hidden?base*4:base);
}
document.addEventListener('visibilitychange',()=>{if(me&&!document.hidden){tick()}});
window.addEventListener('online',()=>{if(me)tick()});
async function tick(){
  if(!me||ticking)return;ticking=true;
  try{
    tc++;
    // Новые и удалённые сообщения — одним запросом
    const {data,error}=await sb.from('messages').select('*').or(`id.gt.${lastId},deleted_at.gt."${lastDel}"`).order('id').limit(200);
    setNet(!error);
    (data||[]).forEach(m=>{if(m.deleted_at&&m.deleted_at>lastDel)lastDel=m.deleted_at;onMsg(m)});
    const now=Date.now();
    // Раз в минуту (или раз в 20 с без realtime) сверяем друзей, группы и открытый чат
    if(now-lastFull>(rtOk?60000:20000)){
      lastFull=now;loadFriends();loadGroups();
      if(cur){const ids=Object.keys(nodes).map(Number).slice(-60);loadReactions(ids);loadPeerReads(cur);
        loadVotes(ids.filter(i=>pollOf(msgs[i]?.body)));if(!rtOk)refreshRecent(cur)}
    }
    // Раз в 5 минут — новые аватарки и имена
    if(now-lastProf>300000){lastProf=now;loadProfiles(Object.keys(prof),true).then(()=>{renderMe();render();if(cur)setHead(cur)})}
  }finally{ticking=false;schedule()}
}
// Значок «нет связи» над списком
function setNet(ok){$('net').classList.toggle('hide',!!ok)}
function onMsg(m){
  if(m.id>lastId)lastId=m.id;
  const other=chatKey(m),isNew=!seen.has(m.id);seen.add(m.id);noteLast(m);noteTtl(m);
  if(m.group_id&&!groups[m.group_id])loadGroups(); // нас только что добавили в группу
  if(hidden.has(m.id)||(m.deleted_at&&!nodes[m.id]))return;
  if(m.expires_at&&new Date(m.expires_at)<=new Date())return;
  if(other===cur){const e=$('log').querySelector('.empty');if(e)e.remove();line(m);if(document.hidden&&isNew&&m.sender!==me){unread[other]=(+unread[other]||0)+1;updateBadge()}markRead()}
  else if(isNew&&m.sender!==me&&!m.deleted_at){unread[other]=(+unread[other]||0)+1;render();updateBadge()}
  if(isNew&&m.sender!==me&&!m.deleted_at){if(other!==cur&&mentionsMe(m)){mentionOf[other]=true;scheduleChats()}else if(other===cur&&!stick&&mentionsMe(m)&&typeof noteMention==='function')noteMention(m);notify(m);fxFor(m.body)}
}
// Обновить последние сообщения открытого чата (правки, ходы в игре) — запасной путь, если realtime не дошёл
async function refreshRecent(k){
  const {data}=await chatQuery(k).order('id',{ascending:false}).limit(30);
  if(cur!==k)return;
  (data||[]).forEach(m=>{const o=msgs[m.id];if(nodes[m.id]&&o&&(o.body!==m.body||o.edited_at!==m.edited_at||o.deleted_at!==m.deleted_at))draw(m)});
}
