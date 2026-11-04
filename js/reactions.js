// Реакции и ответы на сообщения
const QUICK=['❤️','😂','👍','🔥','😮','😢'];
let reacts={},replyTo=null,socialOk=true;

// Загружаем реакции для сообщений, которые сейчас на экране
async function loadReactions(ids){
  ids=ids.filter(Boolean);if(!ids.length||!socialOk)return;
  const {data,error}=await sb.from('reactions').select('message_id,user_id,emoji').in('message_id',ids);
  if(error){socialOk=false;return} // SQL ещё не запущен
  ids.forEach(i=>reacts[i]=[]);
  (data||[]).forEach(r=>(reacts[r.message_id]||=[]).push(r));
  ids.forEach(i=>{if(nodes[i])drawReacts(i)});
}
function drawReacts(id){
  const d=nodes[id];if(!d)return;
  d.querySelector('.reacts')?.remove();
  const list=reacts[id]||[];if(!list.length||d.classList.contains('del'))return;
  const by={};list.forEach(r=>(by[r.emoji]||=[]).push(r.user_id));
  const w=el('div','reacts');
  Object.entries(by).forEach(([e,us])=>{
    const b=el('button','react'+(us.includes(me)?' mine':''));
    b.append(el('span',null,e),el('b',null,us.length>1?String(us.length):''));
    b.title=us.map(nameOf).join(', ');
    b.onclick=ev=>{ev.stopPropagation();toggleReact(id,e)};w.append(b);
  });
  d.querySelector('small')?.before(w);
}
async function toggleReact(id,e){
  if(!socialOk){alert('Чтобы ставить реакции, запустите supabase/social.sql в Supabase.');return}
  const mine=(reacts[id]||[]).some(r=>r.user_id===me&&r.emoji===e);
  // Сразу показываем, потом отправляем
  reacts[id]=mine?(reacts[id]||[]).filter(r=>!(r.user_id===me&&r.emoji===e)):[...(reacts[id]||[]),{message_id:id,user_id:me,emoji:e}];
  drawReacts(id);
  const q=sb.from('reactions');
  const {error}=mine?await q.delete().eq('message_id',id).eq('user_id',me).eq('emoji',e):await q.insert({message_id:id,user_id:me,emoji:e});
  if(error&&!/duplicate/i.test(error.message))loadReactions([id]);
}
// Полоска быстрых реакций в меню сообщения
function reactPicker(m){
  const w=el('div','qreact');
  QUICK.forEach(e=>{const b=el('button',null,e);b.onclick=ev=>{ev.stopPropagation();const d=nodes[m.id];d?.classList.remove('open');d?.querySelector('.acts')?.remove();toggleReact(m.id,e)};w.append(b)});
  return w;
}

// ---------- Ответы ----------
function quoteEl(m){
  const q=el('div','quote');const src=msgs[m.reply_to];
  q.append(el('b',null,src?(src.sender===me?'Вы':nameOf(src.sender)):'Ответ'),el('span',null,preview(src)));
  q.onclick=e=>{e.stopPropagation();jumpTo(m.reply_to)};
  return q;
}
function startReply(m){
  cancelEdit();replyTo=m.id;
  $('rbWho').textContent=m.sender===me?'Ответ себе':'Ответ: '+nameOf(m.sender);
  $('rbText').textContent=preview(m);
  $('replybar').classList.remove('hide');$('msg').focus();
}
function cancelReply(){replyTo=null;$('replybar').classList.add('hide')}
// Поле reply_to для вставки сообщения (и сбрасываем полоску ответа)
function takeReply(){if(!replyTo)return {};const r={reply_to:replyTo};cancelReply();return r}
$('rbX').onclick=cancelReply;
