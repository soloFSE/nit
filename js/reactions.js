// Реакции и ответы на сообщения
const QUICK=['❤️','😂','👍','🔥','😮','😢'];
let reacts={},replyTo=null,socialOk=true;

// Загружаем реакции для сообщений, которые сейчас на экране
async function loadReactions(ids){
  ids=ids.filter(i=>Number.isInteger(+i)&&+i>0);if(!ids.length||!socialOk)return;
  // Порциями по 150: длинный список id не влезает в адрес запроса, и раньше это выключало реакции целиком
  let data=[];
  for(let k=0;k<ids.length;k+=150){
    const r=await sb.from('reactions').select('message_id,user_id,emoji').in('message_id',ids.slice(k,k+150));
    if(r.error){if(/relation|does not exist|schema cache/i.test(r.error.message))socialOk=false;return} // таблицы нет — SQL не запущен; иначе просто сбой сети
    data=data.concat(r.data||[]);
  }
  ids.forEach(i=>reacts[i]=[]);
  data.forEach(r=>(reacts[r.message_id]||=[]).push(r));
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
  if(!socialOk){toast('Реакции недоступны: запустите supabase/social.sql');return}
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
  const close=()=>{const d=nodes[m.id];d?.classList.remove('open');d?.querySelector('.acts')?.remove()};
  QUICK.forEach(e=>{const b=el('button',null,e);b.onclick=ev=>{ev.stopPropagation();close();toggleReact(m.id,e)};w.append(b)});
  // «+» — любая эмодзи из полной панели
  const more=el('button','qplus');more.append(svgI('i-plus'));more.title='Другие эмодзи';
  more.onclick=ev=>{ev.stopPropagation();close();pickAnyEmoji(e=>toggleReact(m.id,e))};w.append(more);
  return w;
}

// ---------- Ответы ----------
// Цитата в ответе. Если исходное сообщение удалено (у всех или «у меня») — так и пишем,
// если оно старое и ещё не загружено — подгружаем и перерисовываем цитату.
function quoteEl(m){
  const q=el('div','quote');q.dataset.rid=m.reply_to;const src=msgs[m.reply_to];
  const gone=src&&(src.deleted_at||hidden.has(src.id));
  if(!src&&!quoteMiss.has(m.reply_to))needQuote(m.reply_to);
  if(gone)q.classList.add('gone');
  q.append(el('b',null,src?(src.sender===me?'Вы':nameOf(src.sender)):'Ответ'),
    fillRich(el('span'),!src?(quoteMiss.has(m.reply_to)?'Сообщение недоступно':'…'):gone?'Сообщение удалено':preview(src)));
  q.onclick=e=>{e.stopPropagation();if(!gone)jumpTo(m.reply_to)};
  return q;
}
// Перерисовать все цитаты на сообщение id (его удалили или подгрузили)
function refreshQuotes(id){
  document.querySelectorAll('.quote[data-rid="'+id+'"]').forEach(q=>{const d=q.closest('.m[data-id]'),m=d&&msgs[d.dataset.id];if(m)q.replaceWith(quoteEl(m))});
}
const quoteWait=new Set(),quoteMiss=new Set();let quoteT=0;
function needQuote(id){
  if(quoteWait.has(id))return;quoteWait.add(id);clearTimeout(quoteT);
  quoteT=setTimeout(async()=>{
    const ids=[...quoteWait];quoteWait.clear();
    const {data}=await sb.from('messages').select('*').in('id',ids);
    const got=new Set((data||[]).map(m=>m.id));
    (data||[]).forEach(m=>{if(!msgs[m.id])msgs[m.id]=m});
    ids.forEach(i=>{if(!got.has(i))quoteMiss.add(i);refreshQuotes(i)});
  },60);
}
function startReply(m){
  cancelEdit();replyTo=m.id;
  $('rbWho').textContent=m.sender===me?'Ответ себе':'Ответ: '+nameOf(m.sender);
  fillRich($('rbText'),preview(m));
  $('replybar').classList.remove('hide');$('msg').focus();
}
function cancelReply(){replyTo=null;$('replybar').classList.add('hide')}
// Поле reply_to для вставки сообщения (и сбрасываем полоску ответа)
function takeReply(){if(!replyTo)return {};const r={reply_to:replyTo};cancelReply();return r}
$('rbX').onclick=cancelReply;

// Окно с полной панелью эмодзи (для реакций): выбранная эмодзи возвращается в f
async function pickAnyEmoji(f){
  openModal(s=>{
    s.classList.add('emo-sheet');
    const top=el('div','sheet-top');top.append(el('h3',null,'Реакция'));const x=el('button','icon');x.append(svgI('i-x'));x.onclick=closeModal;top.append(x);s.append(top);
    const box=el('div','emo-box');box.append(el('div','sk-line'),el('div','sk-line short'));s.append(box);
    Promise.all([import(PICKER_JS),import(PICKER_RU).catch(()=>null)]).then(([,ru])=>{
      const p=document.createElement('emoji-picker');p.dataSource=PICKER_DATA;p.locale='ru';if(ru?.default)p.i18n=ru.default;
      p.addEventListener('emoji-click',e=>{closeModal();f(e.detail.unicode.slice(0,16))});
      box.innerHTML='';box.append(p);
    }).catch(()=>{box.innerHTML='<p class="hint">Не удалось загрузить эмодзи. Проверьте интернет.</p>'});
  });
}
