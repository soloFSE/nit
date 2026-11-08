// Нижняя панель на телефоне: «Чаты», «Статусы», «Игры». Статусы — отдельный экран, а не полоска над чатами.
// На компьютере панели нет, статусы остаются полоской над списком. «Игры» пока заглушка.
let sideTab='chats';
function setSideTab(t){
  sideTab=t;const app=$('app');['chats','stories','games'].forEach(x=>app.classList.toggle('tab-'+x,x===t));
  document.querySelectorAll('#botnav button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
  if(t==='stories')renderStoriesTab();
  if(t==='games')renderGamesTab();
  try{localStorage.setItem('nit-tab',t)}catch{}
}
document.querySelectorAll('#botnav button').forEach(b=>b.onclick=()=>{navigator.vibrate?.(6);setSideTab(b.dataset.t)});
// Окно «Статусы»: «Мой статус», затем друзья — непросмотренные сверху
function renderStoriesTab(){
  const box=$('tabStories');if(!box||typeof stories==='undefined')return;
  const g=byOwner(),mine=g[me]||[],un=Object.keys(g).some(u=>u!==me&&!isBlocked(u)&&g[u].some(s=>!storySeen.has(s.id)));
  $('bnStories')?.classList.toggle('hide',!un);
  if(sideTab!=='stories'&&box.dataset.ready)return;box.dataset.ready='1';
  box.innerHTML='';
  const top=el('div','tp-top');top.append(el('h2',null,'Статусы'));
  const add=el('button','icon tp-add');add.append(svgI('i-plus'));add.title='Добавить статус';add.onclick=()=>pickStory();top.append(add);box.append(top);
  if(typeof storiesOk!=='undefined'&&!storiesOk){box.append(el('p','tp-empty','Статусы появятся после запуска supabase/stories.sql'));return}
  const body=el('div','tp-body');box.append(body);
  // Мой статус
  const my=el('button','tp-row');const rg=el('span','st-ring'+(mine.length?' mine':''));rg.append(avatar(me,54));
  if(!mine.length){const pl=el('i','st-plus');pl.append(svgI('i-plus'));rg.append(pl)}
  const tx=el('span','tp-t');tx.append(el('b',null,'Мой статус'),el('small',null,mine.length?mine.length+' '+plural(mine.length,'статус','статуса','статусов')+' · '+agoStr(mine[mine.length-1].created_at):'Нажмите, чтобы добавить'));
  my.append(rg,tx);my.onclick=()=>mine.length?openStoryViewer(me):pickStory();body.append(my);
  const list=Object.keys(g).filter(u=>u!==me&&!isBlocked(u)).map(u=>({u,l:g[u],unseen:g[u].some(s=>!storySeen.has(s.id)),last:g[u][g[u].length-1].created_at}))
    .sort((a,b)=>(b.unseen-a.unseen)||(b.last>a.last?1:-1));
  const sec=(title,arr)=>{if(!arr.length)return;body.append(el('div','tp-h',title));arr.forEach(({u,l,unseen,last})=>{
    const r=el('button','tp-row');const ring=el('span','st-ring'+(unseen?'':' seen'));ring.append(avatar(u,54));
    const t=el('span','tp-t');const nm=el('b',null,nameOf(u));const pm=typeof premMark==='function'&&premMark(u);if(pm)nm.append(pm);
    t.append(nm,el('small',null,l.length+' '+plural(l.length,'статус','статуса','статусов')+' · '+agoStr(last)));
    r.append(ring,t);r.onclick=()=>openStoryViewer(u);body.append(r)})};
  sec('Новые',list.filter(x=>x.unseen));sec('Просмотренные',list.filter(x=>!x.unseen));
  if(!list.length){const e=el('div','tp-empty');e.append(svgI('i-circle'),el('b',null,'Пока нет статусов друзей'),el('span',null,'Когда друзья опубликуют статус, он появится здесь'));body.append(e)}
}
// «Игры» — заглушка, содержимое появится позже
function renderGamesTab(){
  const box=$('tabGames');if(box.dataset.ready)return;box.dataset.ready='1';
  const top=el('div','tp-top');top.append(el('h2',null,'Мини-игры'));box.append(top);
  const e=el('div','tp-empty big');const ic=el('span','tp-ic');ic.append(svgI('i-dice'));e.append(ic,el('b',null,'Скоро здесь будут игры'),el('span',null,'Мини-игры на двоих и для компании'));box.append(e);
}
try{const t=localStorage.getItem('nit-tab');if(t&&matchMedia('(max-width:760px)').matches&&t!=='games')setTimeout(()=>setSideTab(t),0)}catch{}
