// Редактирование, пересылка, закреплённое сообщение, поиск по чату
let editing=null,pinnedId=null;

// ---------- Редактирование ----------
function startEdit(m){
  cancelReply();editing=m;
  $('rbWho').textContent='Редактирование';$('rbText').textContent=m.body;
  $('replybar').classList.remove('hide');$('replybar').classList.add('edit');
  $('msg').value=m.body;$('msg').focus();
}
function cancelEdit(){
  if(!editing)return;editing=null;$('replybar').classList.add('hide');$('replybar').classList.remove('edit');
  $('msg').value='';loadDraft(cur);
}
async function finishEdit(){
  const m=editing,t=$('msg').value.trim();if(!m)return;
  if(!t||t===m.body){cancelEdit();return}
  const {error}=await sb.rpc('edit_message',{mid:m.id,new_body:t});
  if(error){alert('Не удалось изменить: '+(/function|schema cache/i.test(error.message)?'запустите supabase/more.sql':error.message));return}
  editing=null;$('replybar').classList.add('hide');$('replybar').classList.remove('edit');$('msg').value='';saveDraft();
  line({...m,body:t,edited_at:new Date().toISOString()});
}
// Отмена прежнего замыкания rbX: крестик закрывает и ответ, и редактирование
$('rbX').onclick=()=>{cancelReply();cancelEdit()};

// ---------- Пересылка ----------
function forwardMsg(m){
  openModal(s=>{
    const top=el('div','sheet-top');top.append(el('h3',null,'Переслать'));const x=el('button','icon');x.append(svgI('i-x'));x.onclick=closeModal;top.append(x);s.append(top);
    s.append(fillRich(el('div','fwd-prev'),preview(m)));
    const q=document.createElement('input');q.placeholder='Найти чат';s.append(q);
    const list=el('div','pick');s.append(list);
    const chats=[
      ...fr.filter(f=>f.status==='accepted').map(f=>f.a===me?f.b:f.a).filter(id=>!isBlocked(id)).map(id=>({k:id,name:nameOf(id),ava:()=>avatar(id,36)})),
      ...Object.values(groups).map(g=>({k:'g:'+g.id,name:g.name,ava:()=>groupAvatar(g,36)}))];
    const draw=()=>{list.innerHTML='';const f=q.value.trim().toLowerCase();
      chats.filter(c=>!f||c.name.toLowerCase().includes(f)).forEach(c=>{
        const r=row(c.ava(),c.name,isGroupKey(c.k)?'группа':'@'+(people[c.k]||''));
        r.onclick=async()=>{
          closeModal();
          const fields={body:m.body||'',image_path:m.image_path||null,forwarded_from:m.forwarded_from||m.sender};
          try{await sendMsg(c.k,fields,{noReply:true});if(cur!==c.k)toast('Переслано: '+c.name)}
          catch(e){alert('Не удалось переслать: '+(/forwarded_from/.test(e.message)?'запустите supabase/more.sql':e.message))}
        };list.append(r);
      });
      if(!list.children.length)list.append(el('p','hint','Ничего не найдено'));
    };
    q.oninput=draw;draw();setTimeout(()=>q.focus(),50);
  });
}
// Короткое всплывающее сообщение внизу
function toast(t){const e=el('div','toast',t);document.body.append(e);setTimeout(()=>e.classList.add('out'),1800);setTimeout(()=>e.remove(),2200)}

// ---------- Закреп ----------
async function loadPin(k){
  pinnedId=null;$('pinbar').classList.add('hide');
  const {data,error}=await sb.from('pins').select('message_id').eq('chat',readKey(k)).maybeSingle();
  if(error||cur!==k||!data)return;
  pinnedId=data.message_id;
  let m=msgs[pinnedId];
  if(!m){const r=await sb.from('messages').select('*').eq('id',pinnedId).maybeSingle();m=r.data;if(m)msgs[m.id]=m}
  if(cur!==k)return;
  if(!m){pinnedId=null;return}
  fillRich($('pinText'),preview(m));$('pinbar').classList.remove('hide');
  redrawMenus();
}
async function pinMsg(m){
  const {error}=await sb.from('pins').upsert({chat:readKey(cur),message_id:m.id,pinned_by:me,pinned_at:new Date().toISOString()});
  if(error){alert('Не удалось закрепить: '+(/relation|schema cache/i.test(error.message)?'запустите supabase/more.sql':error.message));return}
  loadPin(cur);
}
async function unpin(){
  await sb.from('pins').delete().eq('chat',readKey(cur));
  pinnedId=null;$('pinbar').classList.add('hide');redrawMenus();
}
// Меню строятся при открытии — достаточно убрать уже открытые, чтобы надпись «Закрепить/Открепить» обновилась
function redrawMenus(){document.querySelectorAll('#log .acts').forEach(a=>{const d=a.closest('.m');a.remove();d?.classList.remove('open')})}
$('pinText').onclick=()=>pinnedId&&jumpTo(pinnedId);
$('pinX').onclick=e=>{e.stopPropagation();unpin()};

// ---------- Поиск по чату ----------
function openSearch(){$('search').classList.remove('hide');$('sq').value='';$('sres').innerHTML='';$('sq').focus()}
function closeSearch(){$('search').classList.add('hide');$('sres').innerHTML=''}
$('bsearch').onclick=()=>$('search').classList.contains('hide')?openSearch():closeSearch();
$('sx').onclick=closeSearch;
let sTimer=0;
$('sq').oninput=()=>{clearTimeout(sTimer);sTimer=setTimeout(runSearch,300)};
$('sq').onkeydown=e=>{if(e.key==='Escape')closeSearch()};
async function runSearch(){
  const q=$('sq').value.trim(),k=cur,box=$('sres');
  if(q.length<2){box.innerHTML='';return}
  const safe=q.replace(/[%_\\,()]/g,' ');
  const {data}=await chatQuery(k).ilike('body','%'+safe+'%').not('body','like','::%').is('deleted_at',null).order('id',{ascending:false}).limit(50);
  if(cur!==k)return;
  box.innerHTML='';
  if(!data?.length){box.append(el('p','hint','Ничего не найдено'));return}
  box.append(el('h2',null,'Найдено · '+data.length+(data.length===50?'+':'')));
  data.forEach(m=>{
    const r=el('div','sr');
    const t=el('div','sr-t');t.append(el('b',null,m.sender===me?'Вы':nameOf(m.sender)),el('small',null,timeStr(m.created_at)));
    const body=el('div','sr-b');
    // Подсвечиваем совпадение
    const i=m.body.toLowerCase().indexOf(q.toLowerCase()),st=Math.max(0,i-30);
    const pre=(st?'…':'')+m.body.slice(st,i),hit=m.body.slice(i,i+q.length),post=m.body.slice(i+q.length,i+q.length+60);
    body.append(document.createTextNode(pre),el('mark',null,hit),document.createTextNode(post));
    r.append(t,body);r.onclick=()=>{closeSearch();jumpTo(m.id)};box.append(r);
  });
}
