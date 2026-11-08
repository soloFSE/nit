// Сведения о сообщении (пункт меню у своих сообщений): кто прочитал, кто открыл фото/файл,
// кто прослушал голосовое или посмотрел кружок — с временем. События пишутся в message_events (supabase/v3.sql).
const msgByPath=p=>Object.values(msgs).find(m=>m.image_path===p);
const evSent=new Set();
function logMsgEvent(m,kind){
  if(!m||m.sender===me||m.deleted_at)return;
  const k=m.id+':'+kind;if(evSent.has(k))return;evSent.add(k);
  sb.from('message_events').upsert({message_id:m.id,user_id:me,kind},{onConflict:'message_id,user_id,kind',ignoreDuplicates:true}).then(()=>{});
}
const chatKeyOf=m=>m.group_id?'g:'+m.group_id:dmKey(m.sender===me?m.recipient:m.sender);
const whenStr=t=>{const d=new Date(t);if(isNaN(d))return '';const today=new Date().toDateString()===d.toDateString();
  return (today?'сегодня':d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'}))+' в '+d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})};

function showMsgInfo(m){
  openModal(s=>{
    s.classList.add('mi-sheet');
    const top=el('div','sheet-top');top.append(el('h3',null,'Сведения'));const x=el('button','icon');x.append(svgI('i-x'));x.onclick=closeModal;top.append(x);s.append(top);
    const card=el('div','mi-card');card.append(fillRich(el('div','mi-prev'),preview(m)));
    const meta=el('div','mi-meta');meta.append(icoText('i-send','Отправлено '+whenStr(m.created_at)));
    if(m.edited_at)meta.append(icoText('i-pencil','Изменено '+whenStr(m.edited_at)));
    card.append(meta);s.append(card);
    const body=el('div','mi-body');body.append(el('div','sk-line'),el('div','sk-line short'));s.append(body);
    fillMsgInfo(m,body);
  });
}
async function fillMsgInfo(m,body){
  const k=chatKeyOf(m),gid=m.group_id;
  const others=(gid?(gm[gid]||[]):[m.recipient]).filter(u=>u&&u!==me);
  const [rd,ev]=await Promise.all([
    sb.from('reads').select('user_id,last_id,updated_at').eq('chat',k),
    sb.from('message_events').select('user_id,kind,at').eq('message_id',m.id)]);
  body.innerHTML='';
  const reads=(rd.data||[]).filter(r=>r.user_id!==me&&r.last_id>=m.id);
  const evs=ev.error?[]:(ev.data||[]);
  await loadProfiles([...others,...reads.map(r=>r.user_id),...evs.map(e=>e.user_id)]);
  const kindName=isAudio(m.image_path)?'Прослушали':isCircle(m.image_path)?'Посмотрели':m.image_path?'Открыли':null;
  const sec=(title,icon,rows,empty)=>{const c=el('section','mi-sec');const h=el('div','gi-h');h.append(el('span',null,title),el('small',null,String(rows.length)));c.append(h);
    if(!rows.length)c.append(el('p','sm',empty));
    rows.forEach(([u,sub])=>{const r=giRow(avatar(u,38),nameOf(u),sub,'gi-mem');const i=el('span','mi-ic');i.append(svgI(icon));r.append(i);r.onclick=()=>{closeModal();setTimeout(()=>showProfile(u),200)};c.append(r)});
    body.append(c)};
  if(kindName){const list=evs.filter(e=>e.kind!=='read').sort((a,b)=>new Date(b.at)-new Date(a.at));
    sec(kindName,isAudio(m.image_path)?'i-mic':'i-eye',list.map(e=>[e.user_id,whenStr(e.at)]),ev.error?'Появится после обновления базы (supabase/v3.sql)':'Пока никто')}
  const readIds=new Set(reads.map(r=>r.user_id));
  sec('Прочитали','i-check2',reads.map(r=>[r.user_id,r.updated_at?'был(а) в чате '+whenStr(r.updated_at):'прочитано']),'Пока никто не прочитал');
  if(gid){const un=others.filter(u=>!readIds.has(u));if(un.length)sec('Ещё не прочитали','i-check',un.map(u=>[u,'@'+(people[u]||'?')]),'')}
}
