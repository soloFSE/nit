// Отправка сообщений: текст, фото, файлы, вставка, перетаскивание, исчезающие
// Единая точка отправки — все виды сообщений идут через sendMsg
async function sendMsg(to,fields,opt={}){
  if(!to)return null;
  if(typeof premBlocked==='function'&&premBlocked(fields.body)){openPremium();throw new Error('премиум-эмодзи доступны только с Премиум')}
  const row={sender:me,...target(to),body:'',...fields,...(opt.noReply?{}:takeReply()),...ttlField(to,fields.body)};
  const {data,error}=await sb.from('messages').insert(row).select().single();
  if(error){
    if(/row-level security|policy/i.test(error.message)&&row.recipient){await loadBlocks();applyBlockUI();
      throw new Error(isBlockedBy(row.recipient)?'пользователь ограничил вам сообщения':isBlocked(row.recipient)?'вы заблокировали этого пользователя':'нет доступа к этому чату')}
    throw error}
  seen.add(data.id);noteLast(data);if(typeof streakSoon==='function')streakSoon();
  if(cur===to){const e=$('log').querySelector('.empty');if(e)e.remove();opt.pending?.remove();line(data,false,!!opt.pending);markRead()}
  else opt.pending?.remove();
  if(data.body)fxFor(data.body);
  return data;
}

async function send(){
  if(editing)return finishEdit();
  const t=$('msg').value.trim();if(!t||!cur)return;
  if(t.length>4000){alert('Слишком длинное сообщение (максимум 4000 символов).');return}
  $('msg').value='';saveDraft();
  const pending=sendingBubble(t);
  try{await sendMsg(cur,{body:t},{pending})}
  catch(e){pending.classList.add('failed');pending.title='Не отправилось';setTimeout(()=>pending.remove(),2500);$('msg').value=t;saveDraft();toast('Не отправилось: '+e.message)}
}

// ---------- Фото и файлы ----------
function shrink(f){return new Promise((ok,no)=>{
  const i=new Image();
  i.onload=()=>{const k=Math.min(1,1600/Math.max(i.width,i.height)),c=document.createElement('canvas');
    c.width=Math.round(i.width*k);c.height=Math.round(i.height*k);c.getContext('2d').drawImage(i,0,0,c.width,c.height);
    c.toBlob(b=>b?ok(b):no(new Error('не удалось сжать')),'image/jpeg',.85)};
  i.onerror=()=>no(new Error('это не картинка'));i.src=URL.createObjectURL(f);
})}
const MAX_FILE=50*1024*1024;
async function sendFile(f,to=cur){
  if(!to||!f)return;
  const isImg=/^image\/(png|jpe?g|webp|bmp|heic|heif)$/i.test(f.type);
  const pend=uploadStub(to,isImg?'Фото':f.name);
  try{
    let path,blob=f,type=f.type||'application/octet-stream';
    if(isImg){blob=await shrink(f);type='image/jpeg';path=me+'/'+crypto.randomUUID()+'.jpg'}
    else{
      if(f.size>MAX_FILE)throw new Error('файл больше 50 МБ');
      path=me+'/file_'+crypto.randomUUID()+'_'+f.size+'__'+safeName(f.name);
    }
    const up=await sb.storage.from('photos').upload(path,blob,{contentType:type});
    if(up.error)throw up.error;
    pend?.remove();
    await sendMsg(to,{image_path:path});
  }catch(err){pend?.remove();alert('Не удалось отправить «'+f.name+'»: '+(err.message||err)+(/mime/i.test(err.message||'')?'\nЗапустите supabase/more.sql, чтобы разрешить файлы.':''))}
}
function uploadStub(to,label,file){
  if(cur!==to)return null;
  const d=el('div','m me pending-up'+(file?' media':''));
  if(file&&/^image\//.test(file.type)){const u=URL.createObjectURL(file),i=document.createElement('img');i.className='photo loaded';i.src=u;i.onload=()=>setTimeout(()=>URL.revokeObjectURL(u),30000);d.append(i);d.append(el('span','spin up-spin'))}
  else d.append(el('span','spin'),el('span',null,label));
  const em=$('log').querySelector('.empty');if(em)em.remove();
  $('log').append(d);$('log').scrollTop=1e9;return d;
}
const safeName=n=>(n||'file').replace(/[^\p{L}\p{N}._ -]+/gu,'_').replace(/\s+/g,' ').slice(-80)||'file';

$('file').onchange=e=>{const fs=[...e.target.files];e.target.value='';fs.forEach(f=>sendFile(f))};
// Вставка из буфера (Ctrl+V) — картинки и файлы
$('msg').addEventListener('paste',e=>{
  const fs=[...(e.clipboardData?.files||[])];if(!fs.length||!cur)return;
  e.preventDefault();routeFiles(fs);
});
// Перетаскивание файлов в окно чата
let dragN=0;
$('pane').addEventListener('dragenter',e=>{if(!cur||!e.dataTransfer?.types?.includes('Files'))return;dragN++;$('drop').classList.remove('hide')});
$('pane').addEventListener('dragleave',()=>{if(--dragN<=0){dragN=0;$('drop').classList.add('hide')}});
$('pane').addEventListener('dragover',e=>{if(cur)e.preventDefault()});
$('pane').addEventListener('drop',e=>{e.preventDefault();dragN=0;$('drop').classList.add('hide');routeFiles([...(e.dataTransfer?.files||[])])});
// Фото и видео — через просмотр с подписью, остальные файлы — сразу
function routeFiles(fs){const media=fs.filter(isMediaFile);if(media.length)openMediaPicker(media);fs.filter(f=>!isMediaFile(f)).forEach(f=>sendFile(f))}

// ---------- Меню вложений ---------
function closeAttach(){$('attach').classList.add('hide');$('bp').classList.remove('on')}
$('bp').onclick=e=>{e.stopPropagation();const h=$('attach').classList.toggle('hide');$('bp').classList.toggle('on',!h);if(!h)closeEmoji()};
document.addEventListener('click',e=>{if(!e.target.closest('#attach,#bp'))closeAttach()});
document.querySelectorAll('#attach [data-a]').forEach(b=>b.onclick=e=>{
  e.stopPropagation();closeAttach();const a=b.dataset.a;
  if(a==='file')$('file').click();
  else if(a==='gallery')$('gfile').click();
  else if(a==='poll')openPollEditor();
  else if(a==='ttl')openTtlMenu();
  else if(a==='tanks')startTanksInvite();
  else if(a==='gift')startGiftChat();
  else sendGame(a);
});

// ---------- Исчезающие сообщения (настройка на чат) ----------
const TTLS=[[0,'Выключены'],[10,'10 секунд'],[60,'1 минута'],[3600,'1 час'],[86400,'1 день'],[604800,'1 неделя']];
// Таймер — общая настройка чата: последнее служебное сообщение ::ttl:<секунды>:: в этом чате.
// Его видят и соблюдают все участники. Исчезают только обычные сообщения, служебные (звонки, ::gev::, сам ::ttl::) — нет.
let chatTtl={};
const ttlOf=k=>chatTtl[k]||0;
const TTL_SKIP=/^::(call|gcall|gev|ttl):/;
const ttlField=(k,body)=>{const s=ttlOf(k);return s&&!TTL_SKIP.test(body||'')?{expires_at:new Date(Date.now()+s*1000).toISOString()}:{}};
const ttlName=s=>(TTLS.find(t=>t[0]===s)?.[1]||'').toLowerCase();
// При открытии чата узнаём текущий таймер (последнее ::ttl:: в чате)
async function loadChatTtl(k){
  const {data}=await chatQuery(k).like('body','::ttl:%').order('id',{ascending:false}).limit(1);
  const m=(data||[])[0];chatTtl[k]=m?+(/^::ttl:(\d+)::$/.exec(m.body)||[])[1]||0:0;
  if(cur===k)updateTtlChip();
}
function noteTtl(m){const x=/^::ttl:(\d+)::$/.exec(m?.body||'');if(!x)return;const k=chatKey(m);chatTtl[k]=+x[1];if(cur===k)updateTtlChip()}
function updateTtlChip(){
  const s=cur?ttlOf(cur):0;$('ttlchip').classList.toggle('hide',!s);
  fillRich($('ttlchip'),PI('i-timer')+(TTLS.find(t=>t[0]===s)?.[1]||''));
}
$('ttlchip').onclick=()=>openTtlMenu();
function openTtlMenu(){
  if(!cur)return;
  if(isGroupKey(cur)&&!canDo(gidOf(cur),'edit')){toast('Таймер в этой группе меняют только админы');return}
  openModal(s=>{
    const top=el('div','sheet-top');top.append(el('h3',null,'Исчезающие сообщения'));const x=el('button','icon');x.append(svgI('i-x'));x.onclick=closeModal;top.append(x);s.append(top);
    s.append(el('p','sm','Новые сообщения в этом чате будут удаляться у всех через выбранное время после отправки. Настройка общая — её видят все участники. Записи о звонках и служебные сообщения не удаляются.'));
    const now=ttlOf(cur),k=cur;
    TTLS.forEach(([v,t])=>{const b=el('button','opt'+(v===now?' on':''),t);b.onclick=async()=>{
      closeModal();if(v===now)return;
      try{await sendMsg(k,{body:'::ttl:'+v+'::'},{noReply:true});chatTtl[k]=v;updateTtlChip()}catch(e){toast('Не удалось: '+e.message)}};s.append(b)});
  });
}
// Служебная строка в чате: «Вы включили исчезающие сообщения · 1 день»
SPECIAL.push({re:/^::ttl:(\d+)::$/,cls:'gev',forward:false,
  preview:x=>+x[1]?PI('i-timer')+'Исчезающие сообщения: '+ttlName(+x[1]):PI('i-timer')+'Исчезающие сообщения выключены',
  render:(m,d,x)=>{const s=+x[1],who=m.sender===me?'Вы':nameOf(m.sender);
    d.append(fillRich(el('span','gev-t'),PI('i-timer')+(s?who+' '+(m.sender===me?'включили':'включил(а)')+' исчезающие сообщения: '+ttlName(s):who+' '+(m.sender===me?'выключили':'выключил(а)')+' исчезающие сообщения')))}});
function ttlLeft(exp){
  const s=Math.max(0,Math.round((new Date(exp)-Date.now())/1000));
  return s>=86400?Math.round(s/86400)+' д':s>=3600?Math.round(s/3600)+' ч':s>=60?Math.round(s/60)+' мин':s+' с';
}
// Раз в секунду обновляем таймеры и убираем истёкшие сообщения
setInterval(()=>{
  document.querySelectorAll('.ttl[data-exp]').forEach(t=>{
    const exp=t.dataset.exp;
    if(new Date(exp)<=new Date()){const d=t.closest('.m');const id=Object.keys(nodes).find(k=>nodes[k]===d);
      if(d){d.classList.add('vanish');setTimeout(()=>d.remove(),400)}if(id)delete nodes[id];}
    else fillRich(t,PI('i-timer')+ttlLeft(exp));
  });
},1000);

$('bs').onclick=send;
// Поле ввода растёт по мере набора (до 6 строк), дальше прокручивается. Enter — отправить (на компьютере), Shift+Enter — новая строка;
// на телефоне Enter — новая строка, отправка — кнопкой.
(()=>{const ta=$('msg'),d=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value');
  const fit=()=>{ta.style.height='auto';const h=Math.min(ta.scrollHeight,150);ta.style.height=Math.max(42,h)+'px';ta.style.overflowY=ta.scrollHeight>150?'auto':'hidden'};
  Object.defineProperty(ta,'value',{get(){return d.get.call(this)},set(v){d.set.call(this,v);fit()},configurable:true});
  ta.addEventListener('input',fit);window.fitMsg=fit;fit()})();
$('msg').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&!matchMedia('(pointer:coarse)').matches){e.preventDefault();send()}if(e.key==='Escape'){cancelReply();cancelEdit()}};
$('back').onclick=closeChat;
