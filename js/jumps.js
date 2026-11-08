// Непрочитанные и упоминания, как в Telegram:
// — при открытии чата плашка «Непрочитанные сообщения» над первым непрочитанным, и чат открывается с этого места;
// — кнопка «@» над стрелкой «вниз»: переход к сообщениям, где упомянули вас (по очереди), со счётчиком.
let mentionQ=[];

// Вызывается из openChat после отрисовки. before — последний прочитанный id до открытия. Возвращает true, если прокрутили к плашке.
function placeUnread(list,before){
  $('log').querySelector('.unread-sep')?.remove();
  mentionQ=list.filter(m=>m.id>before&&typeof mentionsMe==='function'&&mentionsMe(m)&&!m.deleted_at).map(m=>m.id);
  updateMentionBtn();
  if(!before)return false;
  const first=list.find(m=>m.id>before&&m.sender!==me&&!m.deleted_at&&nodes[m.id]);
  if(!first)return false;
  const n=list.filter(m=>m.id>=first.id&&m.sender!==me).length;
  const sep=el('div','unread-sep');sep.append(el('span',null,'Непрочитанные сообщения'+(n>1?' · '+n:'')));
  nodes[first.id].before(sep);
  // Открываем с плашки (если непрочитанного немного — всё равно до конца не листаем)
  const log=$('log');log.scrollTop=Math.max(0,sep.offsetTop-70);
  stick=distBottom()<120;updateDown();
  return true;
}
function noteMention(m){if(!mentionQ.includes(m.id)){mentionQ.push(m.id);updateMentionBtn()}}

function mentionBtn(){
  let b=$('tomention');if(b)return b;
  b=el('button','tobottom tomention');b.id='tomention';b.title='К упоминанию';
  b.append(el('b',null,'@'),el('span','badge hide'));
  b.onclick=()=>{const id=mentionQ.shift();updateMentionBtn();if(id)jumpTo(id)};
  $('pane').append(b);return b;
}
function updateMentionBtn(){
  const b=mentionBtn(),n=mentionQ.length;
  b.classList.toggle('show',!!(cur&&n));
  const bd=b.querySelector('.badge');bd.textContent=n>9?'9+':n||'';bd.classList.toggle('hide',n<2);
}
// Упоминание, до которого долистали сами, из очереди убираем
$('log').addEventListener('scroll',()=>{
  if(!mentionQ.length)return;const lb=$('log').getBoundingClientRect().bottom;
  const left=mentionQ.filter(id=>{const n=nodes[id];return !n||n.getBoundingClientRect().top>lb-40});
  if(left.length!==mentionQ.length){mentionQ=left;updateMentionBtn()}
},{passive:true});
