// Истории (сторис): фото/видео на 24 часа, видят друзья (правила — supabase/stories.sql).
// Полоска кружков над списком чатов, публикация с подписью, просмотр на весь экран
// (полоски прогресса, нажатия влево/вправо, удержание — пауза, свайп вниз — закрыть),
// у своих — «кто посмотрел» и удаление; на чужую можно ответить в личку.
let stories=[],storySeen=new Set(),storiesOk=true,stT=0;
const STORY_MS=5000;
const stUrlCache={};
async function storyUrl(p){
  const c=stUrlCache[p];if(c&&c.t>Date.now()-50*60e3)return c.u;
  const {data}=await sb.storage.from('stories').createSignedUrl(p,3600);if(data?.signedUrl)stUrlCache[p]={u:data.signedUrl,t:Date.now()};return data?.signedUrl;
}

// ---------- Загрузка ----------
async function loadStories(){
  if(!me)return;
  const {data,error}=await sb.from('stories').select('*').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:true}).limit(300);
  if(error){storiesOk=!/relation|does not exist|schema cache/i.test(error.message)?storiesOk:false;renderStories();return}
  stories=data||[];
  const ids=stories.filter(s=>s.owner!==me).map(s=>s.id);
  if(ids.length){const {data:v}=await sb.from('story_views').select('story_id').eq('viewer',me).in('story_id',ids);storySeen=new Set((v||[]).map(x=>x.story_id))}
  await loadProfiles([...new Set(stories.map(s=>s.owner))]);
  renderStories();
  // свои просроченные — убрать вместе с файлами
  sb.from('stories').select('id,media_path').eq('owner',me).lt('expires_at',new Date().toISOString()).then(({data:old})=>{
    if(!old?.length)return;sb.storage.from('stories').remove(old.map(o=>o.media_path)).catch(()=>{});sb.from('stories').delete().in('id',old.map(o=>o.id)).then(()=>{});
  });
}
const byOwner=()=>{const m={};stories.forEach(s=>(m[s.owner]||=[]).push(s));return m};

// ---------- Полоска кружков ----------
function renderStories(){
  const bar=$('stories');if(!bar)return;bar.innerHTML='';
  if(!storiesOk){bar.classList.add('hide');return}
  bar.classList.remove('hide');
  const g=byOwner();
  // Моя история
  const mine=g[me]||[];
  const my=el('button','st-it'+(mine.length?' has':' add'));
  const ring=el('span','st-ring'+(mine.length?' seen':''));ring.append(avatar(me,54));my.append(ring);
  if(!mine.length){const plus=el('i','st-plus');plus.append(svgI('i-plus'));ring.append(plus)}
  my.append(el('small',null,mine.length?'Вы':'Ваша история'));
  my.onclick=()=>mine.length?openStoryViewer(me):pickStory();
  if(mine.length){my.oncontextmenu=e=>{e.preventDefault();pickStory()}}
  bar.append(my);
  // Друзья: сначала с непросмотренными, затем свежие
  Object.keys(g).filter(u=>u!==me&&!isBlocked(u)).map(u=>({u,list:g[u],unseen:g[u].some(s=>!storySeen.has(s.id)),last:g[u][g[u].length-1].created_at}))
    .sort((a,b)=>(b.unseen-a.unseen)||(b.last>a.last?1:-1)).forEach(({u,unseen})=>{
      const b=el('button','st-it');const r=el('span','st-ring'+(unseen?'':' seen'));r.append(avatar(u,54));b.append(r,el('small',null,nameOf(u).split(' ')[0]));
      b.onclick=()=>openStoryViewer(u);bar.append(b);
    });
}

// ---------- Публикация ----------
function pickStory(){
  const f=document.createElement('input');f.type='file';f.accept='image/*,video/*';
  f.onchange=()=>{const file=f.files[0];if(file)storyEditor(file)};f.click();
}
function storyEditor(file){
  const video=/^video\//.test(file.type),url=URL.createObjectURL(file);
  if(file.size>50*1024*1024){toast('Файл больше 50 МБ');return}
  const ov=el('div','stv st-edit');
  const media=video?Object.assign(document.createElement('video'),{src:url,autoplay:true,loop:true,playsInline:true,muted:true}):Object.assign(document.createElement('img'),{src:url,alt:''});
  media.className='stv-media';
  const top=el('div','stv-top');const x=el('button','icon stv-x');x.append(svgI('i-x'));top.append(el('b',null,'Новая история'),x);
  const bot=el('div','stv-bot');const cap=document.createElement('input');cap.placeholder='Подпись…';cap.maxLength=300;
  const go=el('button','primary stv-go');go.append(svgI('i-send'),el('span',null,'Опубликовать'));bot.append(cap,go);
  ov.append(media,top,bot);document.body.append(ov);
  const close=()=>{ov.classList.add('out');setTimeout(()=>{ov.remove();URL.revokeObjectURL(url)},220)};
  x.onclick=close;
  go.onclick=async()=>{
    go.disabled=true;go.querySelector('span').textContent='Публикую…';
    try{
      let blob=file,ext=(file.name.split('.').pop()||'mp4').toLowerCase(),type=file.type;
      if(!video){blob=await shrink(file);ext='jpg';type='image/jpeg'}
      const path=me+'/'+crypto.randomUUID()+'.'+ext;
      const up=await sb.storage.from('stories').upload(path,blob,{contentType:type});if(up.error)throw up.error;
      const {error}=await sb.from('stories').insert({owner:me,media_path:path,kind:video?'video':'photo',caption:cap.value.trim()||null,expires_at:new Date(Date.now()+864e5).toISOString()});
      if(error)throw error;
      close();toast('История опубликована — её увидят друзья');loadStories();
    }catch(e){go.disabled=false;go.querySelector('span').textContent='Опубликовать';
      toast(/bucket|relation|not found|does not exist/i.test(e.message||'')?'Истории ещё не включены — нужно запустить supabase/stories.sql':'Не удалось: '+(e.message||e))}
  };
}

// ---------- Просмотр ----------
let sv=null; // {owners,oi,si,timer,paused,el,...}
function openStoryViewer(owner){
  const g=byOwner();
  const owners=owner===me?[me]:Object.keys(g).filter(u=>u!==me&&!isBlocked(u)).sort((a,b)=>{const ua=g[a].some(s=>!storySeen.has(s.id)),ub=g[b].some(s=>!storySeen.has(s.id));return ub-ua});
  const oi=Math.max(0,owners.indexOf(owner));
  const first=(g[owner]||[]).findIndex(s=>!storySeen.has(s.id));
  sv={g,owners,oi,si:owner===me?0:Math.max(0,first),el:el('div','stv')};document.body.append(sv.el);
  showStory();
}
function closeStory(){if(!sv)return;clearTimeout(sv.timer);clearInterval(sv.tick);const e=sv.el;sv=null;e.classList.add('out');setTimeout(()=>e.remove(),220);renderStories()}
function curStory(){const list=sv.g[sv.owners[sv.oi]]||[];return list[sv.si]}
async function showStory(){
  if(!sv)return;clearTimeout(sv.timer);clearInterval(sv.tick);
  const owner=sv.owners[sv.oi],list=sv.g[owner]||[],s=list[sv.si];if(!s){closeStory();return}
  const e=sv.el;e.innerHTML='';
  // Полоски прогресса
  const bars=el('div','stv-bars');list.forEach((_,i)=>{const b=el('i');const f=el('b');b.append(f);if(i<sv.si)f.style.width='100%';bars.append(b)});
  const top=el('div','stv-top');const who=el('button','stv-who');who.append(avatar(owner,36));
  const t=el('span');t.append(el('b',null,owner===me?'Ваша история':nameOf(owner)),el('small',null,agoStr(s.created_at)));who.append(t);
  who.onclick=()=>{if(owner!==me){closeStory();showProfile(owner)}};
  const x=el('button','icon stv-x');x.append(svgI('i-x'));x.onclick=closeStory;top.append(who,x);
  const media=s.kind==='video'?Object.assign(document.createElement('video'),{playsInline:true,autoplay:true}):document.createElement('img');media.className='stv-media';
  const loader=el('span','spin stv-spin');
  e.append(media,loader,bars,top);
  if(s.caption)e.append(el('div','stv-cap',s.caption));
  // Низ: свои — просмотры и удаление; чужие — ответ
  const bot=el('div','stv-bot');
  if(owner===me){
    const views=el('button','stv-views');views.append(el('span',null,'👁'),el('b',null,'…'));bot.append(views);
    sb.from('story_views').select('viewer,viewed_at').eq('story_id',s.id).then(({data})=>{views.querySelector('b').textContent=(data||[]).length+' '+plural((data||[]).length,'просмотр','просмотра','просмотров');
      views.onclick=()=>storyViewers(data||[])});
    const add=el('button','icon stv-ic');add.append(svgI('i-plus'));add.title='Ещё история';add.onclick=()=>{closeStory();pickStory()};
    const del=el('button','icon stv-ic');del.append(svgI('i-trash'));del.title='Удалить';del.onclick=async()=>{
      pauseStory(true);if(!confirm('Удалить эту историю?')){pauseStory(false);return}
      await sb.from('stories').delete().eq('id',s.id);sb.storage.from('stories').remove([s.media_path]).catch(()=>{});
      stories=stories.filter(z=>z.id!==s.id);sv.g=byOwner();if(!(sv.g[me]||[]).length){closeStory();return}sv.si=Math.min(sv.si,sv.g[me].length-1);showStory()};
    bot.append(add,del);
  }else{
    const rep=document.createElement('input');rep.placeholder='Ответить '+nameOf(owner).split(' ')[0]+'…';
    rep.onfocus=()=>pauseStory(true);rep.onblur=()=>pauseStory(false);
    const sendR=async()=>{const v=rep.value.trim();if(!v)return;rep.value='';rep.blur();
      try{await sendMsg(owner,{body:'↩ На вашу историю'+(s.caption?' «'+s.caption.slice(0,40)+'»':'')+': '+v},{noReply:true});toast('Ответ отправлен в личку')}catch(err){toast('Не удалось: '+err.message)}};
    rep.onkeydown=ev=>{if(ev.key==='Enter')sendR()};
    const go=el('button','icon stv-ic');go.append(svgI('i-send'));go.onclick=sendR;
    const heart=el('button','icon stv-ic');heart.append(svgI('i-heart'));heart.title='Нравится';heart.onclick=async()=>{heart.classList.add('liked');
      try{await sendMsg(owner,{body:'❤️ на вашу историю'},{noReply:true})}catch{}};
    bot.append(rep,heart,go);
    if(!storySeen.has(s.id)){storySeen.add(s.id);sb.from('story_views').insert({story_id:s.id,viewer:me}).then(()=>{})}
  }
  e.append(bot);
  // Зоны нажатия: слева — назад, справа — вперёд, удержание — пауза, свайп вниз — закрыть
  let downT=0,held=false,sy=0;
  e.onpointerdown=ev=>{if(ev.target.closest('button,input,.stv-bot,.stv-top'))return;downT=Date.now();sy=ev.clientY;held=false;sv.holdT=setTimeout(()=>{held=true;pauseStory(true)},220)};
  e.onpointerup=ev=>{if(!downT||!sv)return;clearTimeout(sv.holdT);const dy=ev.clientY-sy;downT=0;
    if(dy>90){closeStory();return}
    if(held){pauseStory(false);return}
    ev.clientX<innerWidth*.33?prevStory():nextStory()};
  // Загрузка и прогресс
  const u=await storyUrl(s.media_path);if(!sv||curStory()!==s)return;
  if(!u){loader.remove();e.append(el('div','stv-err','Не удалось загрузить'));return}
  const fill=bars.children[sv.si].firstChild;
  // Прогресс — на обычном таймере (requestAnimationFrame замирает, когда вкладка в фоне)
  const run=dur=>{loader.remove();sv.pausedMs=0;const start=performance.now();
    clearInterval(sv.tick);sv.tick=setInterval(()=>{
      if(!sv||curStory()!==s){clearInterval(sv?.tick);return}if(sv.paused)return;
      const p=Math.min(1,(performance.now()-start-(sv.pausedMs||0))/dur);fill.style.width=p*100+'%';
      if(p>=1){clearInterval(sv.tick);nextStory()}},50)};
  if(s.kind==='video'){media.src=u;media.onloadedmetadata=()=>run(Math.min(60000,(isFinite(media.duration)?media.duration:15)*1000));media.play().catch(()=>{media.muted=true;media.play().catch(()=>{})})}
  else{media.onload=()=>run(STORY_MS);media.src=u}
}
function pauseStory(on){
  if(!sv)return;if(on&&!sv.paused){sv.paused=true;sv.pauseAt=performance.now();sv.el.querySelector('video')?.pause();sv.el.classList.add('paused')}
  else if(!on&&sv.paused){sv.paused=false;sv.pausedMs=(sv.pausedMs||0)+(performance.now()-sv.pauseAt);sv.el.querySelector('video')?.play().catch(()=>{});sv.el.classList.remove('paused')}
}
function nextStory(){if(!sv)return;const list=sv.g[sv.owners[sv.oi]]||[];if(sv.si<list.length-1){sv.si++;showStory()}else if(sv.oi<sv.owners.length-1){sv.oi++;sv.si=0;showStory()}else closeStory()}
function prevStory(){if(!sv)return;if(sv.si>0){sv.si--;showStory()}else if(sv.oi>0){sv.oi--;sv.si=Math.max(0,(sv.g[sv.owners[sv.oi]]||[]).length-1);showStory()}else showStory()}
function storyViewers(list){
  pauseStory(true);
  openModal(s=>{
    const top=el('div','sheet-top');top.append(el('h3',null,'Просмотры · '+list.length));const x=el('button','icon','✕');x.onclick=closeModal;top.append(x);s.append(top);
    if(!list.length)s.append(el('p','sm','Пока никто не посмотрел.'));
    loadProfiles(list.map(v=>v.viewer)).then(()=>list.forEach(v=>s.append(row(avatar(v.viewer,40),nameOf(v.viewer),agoStr(v.viewed_at)))));
  });
  const iv=setInterval(()=>{if($('modal').classList.contains('hide')){clearInterval(iv);pauseStory(false)}},300);
}
const agoStr=t=>{const s=(Date.now()-new Date(t))/1000;return s<60?'только что':s<3600?Math.floor(s/60)+' мин назад':Math.floor(s/3600)+' ч назад'};
document.addEventListener('keydown',e=>{if(!sv||e.target.matches?.('input'))return;if(e.key==='Escape')closeStory();if(e.key==='ArrowRight')nextStory();if(e.key==='ArrowLeft')prevStory()});
setInterval(()=>{if(me&&!document.hidden)loadStories()},60000);
