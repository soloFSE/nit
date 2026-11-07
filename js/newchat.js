// Окно «Новый чат» (кнопка ✎ / плавающая): поиск людей по нику на лету, заявки, приглашение,
// и создание группы отдельным процессом в два шага — участники → фото, название, описание (как в Telegram).
let ncT=0,ncQ='';

function openNewChat(){
  openModal(s=>{s.classList.add('nc-sheet');buildNewChat(s)});
}
function buildNewChat(s){
  s.innerHTML='';
  const top=el('div','sheet-top');top.append(el('h3',null,'Новый чат'));const x=el('button','icon');x.append(svgI('i-x'));x.onclick=closeModal;top.append(x);s.append(top);
  // Поиск по нику
  const box=el('label','csearch nc-search');box.append(svgI('i-search'));
  const q=document.createElement('input');q.placeholder='Найти по нику или имени';q.autocapitalize='none';q.autocomplete='off';q.value=ncQ;box.append(q);s.append(box);
  const res=el('div','nc-res');s.append(res);
  // Быстрые действия
  const quick=el('div','nc-quick');
  const mk=(icon,t,sub,f,cls)=>{const r=giRow(icon,t,sub,'nc-row '+(cls||''));r.onclick=f;quick.append(r);return r};
  mk('i-users','Создать группу','Друзья, фото, название — по шагам',()=>openGroupWizard(),'gi-accent');
  mk('i-forward','Пригласить друга','Поделиться ссылкой на «Нить»',inviteFriend);
  s.append(quick);
  // Входящие заявки
  const inc=fr.filter(f=>f.status==='pending'&&f.b===me&&!isBlocked(f.a));
  if(inc.length){
    s.append(el('div','nc-h','Заявки в друзья · '+inc.length));
    inc.forEach(f=>{const r=personRow(f.a,people[f.a]);s.append(r)});
  }
  // Друзья — начать чат
  const friends=fr.filter(f=>f.status==='accepted').map(f=>f.a===me?f.b:f.a).sort((a,b)=>nameOf(a).localeCompare(nameOf(b)));
  if(friends.length){s.append(el('div','nc-h','Друзья · '+friends.length));const fl=el('div','nc-list');friends.forEach(id=>fl.append(personRow(id,people[id])));s.append(fl)}
  q.oninput=()=>{ncQ=q.value;clearTimeout(ncT);ncT=setTimeout(()=>searchPeople(q.value,res),250)};
  if(ncQ)searchPeople(ncQ,res);
  if(!matchMedia('(pointer:coarse)').matches)setTimeout(()=>q.focus(),80);
}
// Строка человека с кнопкой по состоянию дружбы
function personRow(id,nick,p){
  if(p){prof[id]={...(prof[id]||{}),...p};people[id]=p.username}
  const st=friendState(id).s;
  const r=giRow(avatar(id,44),nameOf(id),'@'+(nick||people[id]||'?'),'gi-mem nc-person');
  r.onclick=()=>{closeModal();setTimeout(()=>showProfile(id),200)};
  const b=el('button','nc-btn');
  const set=(t,cls,f)=>{b.textContent=t;b.className='nc-btn '+cls;b.onclick=e=>{e.stopPropagation();f?.()}};
  const refresh=()=>{const s2=friendState(id).s;
    if(id===me)set('Это вы','muted');
    else if(s2==='friend')set('Написать','soft',()=>{closeModal();openChat(id)});
    else if(s2==='sent')set('Отправлена','muted');
    else if(s2==='incoming'){set('Принять','main',async()=>{b.disabled=true;await acceptFriend(id);setTimeout(refresh,300)});
      const no=el('button','nc-btn muted','✕');no.title='Отклонить';no.onclick=async e=>{e.stopPropagation();const f=friendState(id).f;await answer(f,false,el('button'),el('button'));r.remove()};r.append(no)}
    else set('Добавить','main',async()=>{b.disabled=true;await requestFriend(id,nick);b.disabled=false;refresh()})};
  refresh();r.append(b);return r;
}
async function searchPeople(t,box){
  t=t.trim().replace(/^@/,'').toLowerCase().replace(/[^a-z0-9_а-яё ]/gi,'').slice(0,30);box.innerHTML='';
  if(t.length<2){return}
  box.append(el('div','nc-h','Ищу…'));
  const {data,error}=await sb.from('profiles').select('id,username,display_name,avatar_path').or(`username.ilike.${t}%,display_name.ilike.%${t}%`).limit(12);
  if(ncQ.trim().replace(/^@/,'').toLowerCase().replace(/[^a-z0-9_а-яё ]/gi,'').slice(0,30)!==t)return;
  box.innerHTML='';
  const list=(data||[]).filter(p=>p.id!==me);
  if(error||!list.length){const e=el('div','nc-empty');e.append(svgI('i-search'),el('span',null,error?'Поиск не удался':'Никого не нашли по «'+t+'»'));box.append(e);return}
  box.append(el('div','nc-h','Найдено · '+list.length));
  list.forEach(p=>box.append(personRow(p.id,p.username,p)));
}
async function inviteFriend(){
  const url=location.origin+location.pathname,text='Давай общаться в «Нити»! Мой ник: @'+myName;
  if(navigator.share){try{await navigator.share({title:'Нить',text,url});return}catch{}}
  try{await navigator.clipboard.writeText(text+'\n'+url);toast('Ссылка скопирована — отправьте её другу')}catch{toast(url)}
}

// ---------- Создание группы: шаг 1 — участники, шаг 2 — фото, название, описание ----------
let gw=null;
function openGroupWizard(){gw={step:1,ids:new Set(),q:'',name:'',desc:'',ava:null,avaUrl:null};openModal(s=>{s.classList.add('nc-sheet');buildGW(s)})}
function buildGW(s){
  s=s||$('sheet');s.innerHTML='';s.classList.add('nc-sheet');
  const top=el('div','sheet-top gw-top');
  const back=el('button','icon');back.append(svgI('i-back'));back.onclick=()=>{if(gw.step===2){gw.step=1;buildGW()}else{buildNewChat($('sheet'))}};
  const tt=el('div','gw-title');tt.append(el('h3',null,gw.step===1?'Участники':'Новая группа'),el('small',null,'Шаг '+gw.step+' из 2'));
  top.append(back,tt);s.append(top);
  const body=el('div','gw-body'+(gw.dir?' '+gw.dir:''));s.append(body);
  gw.step===1?gwMembers(body,s):gwInfo(body,s);
}
function gwMembers(body,s){
  const friends=fr.filter(f=>f.status==='accepted').map(f=>f.a===me?f.b:f.a).filter(id=>!isBlocked(id)).sort((a,b)=>nameOf(a).localeCompare(nameOf(b)));
  const chips=el('div','gi-chips gw-chips');body.append(chips);
  const box=el('label','csearch nc-search');box.append(svgI('i-search'));const q=document.createElement('input');q.placeholder='Поиск друзей';q.value=gw.q;box.append(q);body.append(box);
  const list=el('div','gi-pick gw-list');body.append(list);
  const next=el('button','primary wide gw-next');s.append(next);
  const upd=()=>{
    chips.innerHTML='';gw.ids.forEach(u=>{const c=el('button','gi-chip');c.append(avatar(u,24),el('span',null,nameOf(u)),el('i',null,'✕'));c.onclick=()=>{gw.ids.delete(u);draw();upd()};chips.append(c)});
    next.textContent=gw.ids.size?'Далее · '+gw.ids.size:'Далее без участников';
  };
  const draw=()=>{
    const f=q.value.trim().toLowerCase();list.innerHTML='';
    if(!friends.length){list.append(el('p','sm','Друзей пока нет — группу можно создать и позвать людей позже.'));return}
    friends.filter(u=>!f||nameOf(u).toLowerCase().includes(f)||(people[u]||'').includes(f)).forEach(u=>{
      const r=giRow(avatar(u,40),nameOf(u),'@'+(people[u]||'?'),'gi-mem');const ck=el('span','gi-ck'+(gw.ids.has(u)?' on':''));r.append(ck);
      r.onclick=()=>{gw.ids.has(u)?gw.ids.delete(u):gw.ids.add(u);ck.classList.toggle('on',gw.ids.has(u));upd()};list.append(r)});
  };
  q.oninput=()=>{gw.q=q.value;draw()};draw();upd();
  next.onclick=()=>{gw.step=2;gw.dir='fwd';buildGW()};
}
function gwInfo(body,s){
  const head=el('div','gw-head');
  const ava=el('button','gw-ava');ava.title='Фото группы';
  const paint=()=>{ava.innerHTML='';if(gw.avaUrl){const i=document.createElement('img');i.src=gw.avaUrl;ava.append(i)}else ava.append(svgI('i-plus'),el('small',null,'Фото'))};paint();
  const f=document.createElement('input');f.type='file';f.accept='image/*';f.hidden=true;
  ava.onclick=()=>f.click();
  f.onchange=async()=>{const file=f.files[0];f.value='';if(!file)return;const b=await cropImage(file,320,false);if(!b)return;gw.ava=b;if(gw.avaUrl)URL.revokeObjectURL(gw.avaUrl);gw.avaUrl=URL.createObjectURL(b);paint()};
  const nm=document.createElement('input');nm.className='gw-name';nm.placeholder='Название группы';nm.maxLength=40;nm.value=gw.name;nm.oninput=()=>{gw.name=nm.value;go.disabled=!nm.value.trim()};
  head.append(ava,f,nm);body.append(head);
  const ds=document.createElement('textarea');ds.className='gw-desc';ds.placeholder='Описание (необязательно) — о чём эта группа';ds.maxLength=200;ds.rows=3;ds.value=gw.desc;ds.oninput=()=>gw.desc=ds.value;body.append(ds);
  if(gw.ids.size){
    body.append(el('div','nc-h','Участники · '+(gw.ids.size+1)));
    const row=el('div','gw-people');const meA=el('div','gw-p');meA.append(avatar(me,44),el('small',null,'Вы'));row.append(meA);
    gw.ids.forEach(u=>{const d=el('div','gw-p');d.append(avatar(u,44),el('small',null,nameOf(u).split(' ')[0]));row.append(d)});body.append(row);
  }
  const err=el('p','err');body.append(err);
  const go=el('button','primary wide gw-next','Создать группу');go.disabled=!gw.name.trim();s.append(go);
  go.onclick=async()=>{
    const name=gw.name.trim();if(!name){err.textContent='Введите название';return}
    go.disabled=true;go.textContent='Создаю…';err.textContent='';
    try{
      let avatar_path=null;
      if(gw.ava){const path=me+'/g_'+crypto.randomUUID()+'.jpg';const up=await sb.storage.from('avatars').upload(path,gw.ava,{contentType:'image/jpeg'});if(!up.error)avatar_path=path}
      const row={name,owner:me};const desc=gw.desc.trim();
      let {data,error}=await sb.from('groups').insert({...row,...(desc?{description:desc}:{}),...(avatar_path?{avatar_path}:{})}).select().single();
      if(error&&/column/i.test(error.message))({data,error}=await sb.from('groups').insert(row).select().single()); // старая база без описания/фото
      if(error)throw error;
      groups[data.id]=data;gm[data.id]=[me];grole[data.id]={[me]:'member'};grSig='';renderGroups();
      const ids=[...gw.ids];gw=null;closeModal();
      await openChat('g:'+data.id);
      if(ids.length)await addMembers(data.id,ids);
      loadGroups();toast('Группа «'+name+'» создана');
    }catch(e){err.textContent='Не удалось создать: '+(e.message||e);go.disabled=false;go.textContent='Создать группу'}
  };
  if(!matchMedia('(pointer:coarse)').matches)setTimeout(()=>nm.focus(),80);
}
