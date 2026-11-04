// Точка входа: следим за сессией и запускаем приложение
if(sb){
  // setTimeout — рекомендация Supabase: запросы к базе прямо внутри этого
  // обработчика могут подвисать, пока библиотека держит блокировку сессии.
  sb.auth.onAuthStateChange((_e,s)=>{ setTimeout(()=>{ s?.user?safeBoot(s.user):unboot() },0) });
}

async function safeBoot(u){
  try{await boot(u)}
  catch(e){
    console.error(e);me=null;
    $('app').classList.add('hide');$('auth').classList.remove('hide');
    $('aerr').textContent='Не получилось загрузить данные: '+authErr(e).replace(/^Ошибка: /,'')+' Обновите страницу.';
  }
}

// Если на GitHub обновили не все файлы, части кода не будет — предупреждаем сразу
(function(){
  const need={'js/files.js':'isFile','js/reads.js':'markRead','js/msgtools.js':'startEdit','js/fun.js':'pollOf','js/appearance.js':'applyWall',
    'js/calls.js':'startCall','js/gcall.js':'joinGroupCall','js/ux.js':'layoutNode','js/bg.js':'sysNotify','js/social.js':'loadBlocks','js/emoji.js':'closeEmoji','js/reactions.js':'loadReactions','js/circle.js':'circleEl',
    'js/voice.js':'startRec','js/groups.js':'loadGroups','js/friends.js':'loadFriends','js/profile.js':'loadProfiles','js/compose.js':'sendMsg','js/pwa.js':'installEvt'};
  const miss=Object.entries(need).filter(([,fn])=>{try{return typeof eval(fn)==='undefined'}catch{return true}}).map(([f])=>f);
  if(miss.length){const b=document.createElement('div');b.className='filewarn';
    b.textContent='Сайт загружен не полностью: не найдены '+miss.join(', ')+'. Загрузите на GitHub все файлы из папки проекта и обновите страницу.';
    document.body.prepend(b)}
})();
