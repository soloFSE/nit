// Список друзей, заявки, добавление по нику
let frSeq=0,frSig='';
async function loadFriends(){
  // Запросы могут вернуться не по порядку (опрос + realtime + клик).
  // Применяем только самый свежий, иначе старый ответ «откатывает» принятую заявку.
  const seq=++frSeq;
  const {data,error}=await sb.from('friendships').select('*').or(`a.eq.${me},b.eq.${me}`);
  if(seq!==frSeq||error)return;
  fr=data||[];
  await loadProfiles(fr.map(f=>f.a===me?f.b:f.a));
  if(seq!==frSeq)return;
  // Не перерисовываем, если ничего не изменилось: иначе кнопка пересоздаётся
  // прямо под пальцем и нажатие теряется.
  const s=JSON.stringify(fr.map(f=>[f.id,f.status]).sort());
  if(s===frSig)return;
  frSig=s;render();
}
function setFr(list){frSeq++;fr=list;frSig=JSON.stringify(fr.map(f=>[f.id,f.status]).sort());render()}
// Строка списка: аватарка, имя, подпись, что-то справа
function row(ava,title,sub,right,on){
  const r=el('div','row'+(on?' on':''));r.append(ava);
  const t=el('div','row-txt');t.append(el('b',null,title));if(sub)t.append(el('small',null,sub));r.append(t);
  if(right)r.append(right);return r;
}
// Кружок с числом непрочитанных
function badge(k){const n=+unread[k]||0;return n?el('span','badge',n>99?'99+':String(n)):null}
function render(){
  const reqs=$('reqs');reqs.innerHTML='';
  const inc=fr.filter(f=>f.status==='pending'&&f.b===me&&!isBlocked(f.a));
  if(inc.length){
    const box=el('div','reqbox');box.append(el('div','reqbox-h','Заявки в друзья · '+inc.length));
    inc.forEach(f=>{
      const w=el('span','row-acts');
      const y=el('button','icon primary sm-btn');y.append(svgI('i-check'));y.title='Принять';
      const x=el('button','icon sm-btn');x.append(svgI('i-x'));x.title='Отклонить';
      y.onclick=e=>{e.stopPropagation();answer(f,true,y,x)};x.onclick=e=>{e.stopPropagation();answer(f,false,y,x)};
      w.append(y,x);
      const r=row(avatar(f.a,44),nameOf(f.a),'@'+(people[f.a]||'?')+' хочет дружить',w);
      r.onclick=()=>showProfile(f.a);box.append(r);
    });
    reqs.append(box);
  }
  $('tabF').classList.toggle('has',Object.keys(unread).some(k=>unread[k]&&!isGroupKey(k))||inc.length>0);
  renderGroups();
  if(typeof scheduleChats==='function')scheduleChats();
  if(typeof refreshPeer==='function')refreshPeer();
}

// Принять или отклонить заявку: сразу показываем результат, не дожидаясь опроса
async function answer(f,ok,y,x){
  y.disabled=x.disabled=true;$('ferr').textContent='';
  const q=sb.from('friendships');
  const {data,error}=ok
    ?await q.update({status:'accepted'}).eq('id',f.id).select()
    :await q.delete().eq('id',f.id).select();
  if(error||!data?.length){
    // Пустой ответ без ошибки = база не дала изменить строку (правила доступа RLS)
    $('ferr').textContent=(ok?'Не удалось принять':'Не удалось отклонить')+(error?': '+error.message:': нет прав на изменение заявки');
    y.disabled=x.disabled=false;return;
  }
  setFr(ok?fr.map(g=>g.id===f.id?{...g,status:'accepted'}:g):fr.filter(g=>g.id!==f.id));
}

$('add').onclick=async()=>{
  const u=$('find').value.trim().toLowerCase();$('ferr').textContent='';if(!u)return;
  if(u===myName){$('ferr').textContent='Это вы';return}
  const {data}=await sb.from('profiles').select('id,username').eq('username',u).maybeSingle();
  if(!data){$('ferr').textContent='Такого ника нет';return}
  const ex=fr.find(f=>f.a===data.id||f.b===data.id);
  if(ex){
    $('ferr').textContent=ex.status==='accepted'?'Уже в друзьях':ex.a===me?'Заявка уже отправлена':'Он уже прислал вам заявку — примите её выше';
    return;
  }
  const {error}=await sb.from('friendships').insert({a:me,b:data.id});
  if(error){$('ferr').textContent='Не получилось отправить';return}
  people[data.id]=data.username;$('find').value='';loadFriends();toast('Заявка отправлена @'+data.username);
  if(typeof toggleNew==='function')toggleNew(false);
};

// Вкладки «Друзья / Группы»
function showTab(g){
  $('secF').classList.toggle('hide',g);$('secG').classList.toggle('hide',!g);
  $('tabF').classList.toggle('g',g);$('tabG').classList.toggle('g',!g);
}
$('tabF').onclick=()=>showTab(false);$('tabG').onclick=()=>showTab(true);
