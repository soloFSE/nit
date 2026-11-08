// Точка входа: следим за сессией и запускаем приложение.
// Вход сохраняется в браузере. Экран входа показываем ТОЛЬКО если сохранённого входа нет
// или человек сам нажал «Выйти». Нет интернета при запуске — ждём и повторяем, а не выкидываем на вход.
let byUser=false,retryT=0;
const hasSaved=()=>{try{return Object.keys(localStorage).some(k=>/^sb-.+-auth-token$/.test(k))}catch{return false}};
function showSplash(text,stuck){
  $('splashT').textContent=text;$('splashB').classList.toggle('hide',!stuck);
  $('splash').classList.remove('hide');$('auth').classList.add('hide');
}
function hideSplash(){clearTimeout(retryT);$('splash').classList.add('hide')}
if(sb){
  // Вернулись из Google/GitHub или по ссылке из письма — вход лежит в адресе, ждём его
  if(hasSaved()||/access_token=/.test(location.hash))showSplash('Подключаюсь…');
  // setTimeout — рекомендация Supabase: запросы к базе прямо внутри этого
  // обработчика могут подвисать, пока библиотека держит блокировку сессии.
  sb.auth.onAuthStateChange((e,s)=>{ if(s&&typeof rememberAccount==='function')rememberAccount(s); setTimeout(()=>{
    // Перешли по ссылке «сбросить пароль» — сначала новый пароль, потом всё остальное
    if(s?.user&&(e==='PASSWORD_RECOVERY'||recovering)){recovering=true;hideSplash();$('app').classList.add('hide');$('auth').classList.remove('hide');showAuth('newpass');return}
    if(s?.user){safeBoot(s.user);return}
    if(!byUser&&hasSaved()){waitSession();return}   // вход сохранён — просто пока нет связи
    byUser=false;hideSplash();unboot();
  },0) });
}
// Пытаемся продлить сохранённый вход, пока не получится
function waitSession(delay){
  if(me)return;
  showSplash(navigator.onLine?'Подключаюсь…':'Нет интернета. Жду подключения…',true);
  clearTimeout(retryT);
  retryT=setTimeout(async()=>{
    const r=await sb.auth.refreshSession().catch(e=>({error:e}));
    if(r?.data?.session||me)return;               // получилось — дальше сработает onAuthStateChange
    if(!hasSaved()){hideSplash();unboot();return}  // сервер сказал, что вход больше не действует
    waitSession(Math.min((delay||2000)*1.5,15000));
  },delay??600);
}
window.addEventListener('online',()=>{if(!me&&!$('splash').classList.contains('hide'))waitSession(0)});

async function safeBoot(u){
  clearTimeout(retryT);
  try{
    await boot(u);hideSplash();
    if(typeof rememberProfile==='function')rememberProfile();
    checkUsername().catch(()=>{});
    navigator.storage?.persist?.().catch(()=>{}); // просим браузер не чистить данные сайта (и сохранённый вход)
  }catch(e){
    console.error(e);me=null;
    $('app').classList.add('hide');
    showSplash('Не получилось загрузить данные: '+authErr(e).replace(/^Ошибка: /,'')+' Пробую снова…',true);
    retryT=setTimeout(()=>safeBoot(u),5000);
  }
}
$('splashR').onclick=async()=>{const {data}=await sb.auth.getSession().catch(()=>({}));data?.session?.user?safeBoot(data.session.user):waitSession(0)};
$('splashOut').onclick=()=>{byUser=true;hideSplash();sb.auth.signOut().catch(()=>{});
  try{Object.keys(localStorage).filter(k=>/^sb-.+-auth-token$/.test(k)).forEach(k=>localStorage.removeItem(k))}catch{}unboot()};

// Если на GitHub обновили не все файлы, части кода не будет — предупреждаем сразу
(function(){
  const need={'js/files.js':'isFile','js/reads.js':'markRead','js/msgtools.js':'startEdit','js/fun.js':'pollOf','js/appearance.js':'applyWall',
    'js/calls.js':'startCall','js/gcall.js':'joinGroupCall','js/ux.js':'layoutNode','js/bg.js':'sysNotify','js/ginfo.js':'openGroupInfo','js/account.js':'openAccount','js/inbox.js':'renderChats','js/media.js':'openMediaPicker','js/crop.js':'cropImage','js/mention.js':'linkMentions','js/settings.js':'openSettings','js/accounts.js':'switchAccount','js/peer.js':'showProfile','js/newchat.js':'openNewChat','js/stories.js':'loadStories','js/titles.js':'loadTitles','js/logo.js':'logoSVG','js/jumps.js':'placeUnread','js/msginfo.js':'showMsgInfo','js/photoedit.js':'editPhoto','js/social.js':'loadBlocks','js/emoji.js':'closeEmoji','js/reactions.js':'loadReactions','js/circle.js':'circleEl',
    'js/voice.js':'startRec','js/groups.js':'loadGroups','js/friends.js':'loadFriends','js/profile.js':'loadProfiles','js/compose.js':'sendMsg','js/pwa.js':'installEvt'};
  const miss=Object.entries(need).filter(([,fn])=>{try{return typeof eval(fn)==='undefined'}catch{return true}}).map(([f])=>f);
  if(miss.length){const b=document.createElement('div');b.className='filewarn';
    b.textContent='Сайт загружен не полностью: не найдены '+miss.join(', ')+'. Загрузите на GitHub все файлы из папки проекта и обновите страницу.';
    document.body.prepend(b)}
})();
