// Выбор фото/видео и просмотр перед отправкой с подписью (как в Telegram/WhatsApp).
// «Фото и видео» открывает галерею телефона; выбранное показывается сеткой — можно убрать лишнее,
// добавить ещё и написать подпись. Подпись уходит вместе с первым фото.
const VIDEO_EXT=/\.(mp4|webm|mov|m4v|3gp)$/i;
const isMediaFile=f=>/^image\//.test(f.type)||/^video\//.test(f.type)||VIDEO_EXT.test(f.name||'');
let pick=null; // {to, items:[{file,url}], caption}

function openMediaPicker(files,to=cur){
  files=[...files].filter(isMediaFile);if(!files.length||!to)return;
  if(pick&&pick.to===to&&!$('modal').classList.contains('hide')){addPicked(files);return}
  pick={to,items:[],caption:$('msg').value.trim(),sel:0};
  addPicked(files,true);
}
function addPicked(files,open){
  files.forEach(f=>{if(pick.items.length<20)pick.items.push({file:f,url:URL.createObjectURL(f),video:/^video\//.test(f.type)||VIDEO_EXT.test(f.name)})});
  if(open)openModal(buildPicker);else{if(typeof stashNew==='function')stashNew();const s=$('sheet');s.innerHTML='';buildPicker(s)}
}
function closePicker(){if(!pick)return;pick.items.forEach(i=>URL.revokeObjectURL(i.url));pick=null;closeModal()}
function buildPicker(s){
  // Крупный предпросмотр + лента миниатюр + подпись (как в Telegram/WhatsApp); фото можно править: рисовать, текст, обрезка
  s.classList.add('mp-sheet');
  if(pick.sel==null||pick.sel>=pick.items.length)pick.sel=0;
  const it0=pick.items[pick.sel],n=pick.items.length;
  const top=el('div','mp-top');
  const x=el('button','icon mp-b');x.append(svgI('i-x'));x.title='Отмена';x.onclick=closePicker;
  top.append(x,el('span','mp-title',n>1?(pick.sel+1)+' из '+n:(it0.video?'Видео':'Фото')),el('span','mp-sp'));
  if(!it0.video){const ed=el('button','mp-edit');ed.append(svgI('i-brush'),el('span',null,'Изменить'));ed.onclick=()=>editPicked(pick.sel);top.append(ed)}
  const del=el('button','icon mp-b');del.append(svgI('i-trash'));del.title='Убрать';
  del.onclick=()=>{const it=pick.items[pick.sel];URL.revokeObjectURL(it.url);pick.items.splice(pick.sel,1);if(!pick.items.length){closePicker();return}rebuildPicker()};
  top.append(del);s.append(top);
  const stage=el('div','mp-stage');
  if(it0.video){const v=document.createElement('video');v.src=it0.url;v.muted=true;v.playsInline=true;v.loop=true;v.autoplay=true;v.controls=true;stage.append(v)}
  else{const im=document.createElement('img');im.src=it0.url;im.alt='';im.onclick=()=>editPicked(pick.sel);stage.append(im)}
  s.append(stage);
  if(n>1||n<20){
    const strip=el('div','mp-strip');
    pick.items.forEach((it,i)=>{const t=el('button','mp-th'+(i===pick.sel?' on':''));
      if(it.video){const v=document.createElement('video');v.src=it.url;v.muted=true;t.append(v,el('span','mp-v'))}else{const im=document.createElement('img');im.src=it.url;im.alt='';t.append(im)}
      t.onclick=()=>{if(pick.sel===i)return;pick.sel=i;rebuildPicker()};strip.append(t)});
    if(n<20){const add=el('button','mp-th mp-add');add.append(svgI('i-plus'));add.title='Добавить ещё';add.onclick=()=>$('gfile').click();strip.append(add)}
    s.append(strip);
  }
  const row=el('div','mp-row');
  const cap=document.createElement('input');cap.placeholder='Добавить подпись…';cap.maxLength=1000;cap.value=pick.caption||'';
  cap.oninput=()=>pick.caption=cap.value;
  const go=el('button','icon primary round mp-send');go.append(svgI('i-send'));go.title='Отправить';
  if(n>1)go.append(el('span','mp-n',String(n)));
  cap.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();go.click()}};
  go.onclick=()=>sendPicked();
  row.append(cap,go);s.append(row);
}
function rebuildPicker(){const sh=$('sheet');if(typeof stashNew==='function')stashNew();sh.innerHTML='';buildPicker(sh)}
// Редактор: после «Готово» подменяем файл и миниатюру
async function editPicked(i){
  const it=pick?.items[i];if(!it||it.video)return;
  const f=await editPhoto(it.file);if(!f||!pick)return;
  URL.revokeObjectURL(it.url);it.file=f;it.url=URL.createObjectURL(f);pick.sel=i;rebuildPicker();
}
async function sendPicked(){
  if(!pick)return;const {to,items}=pick,caption=(pick.caption||'').trim();
  pick.items=[];closePicker();
  if(caption&&$('msg').value.trim()===caption){$('msg').value='';saveDraft?.()}
  for(let i=0;i<items.length;i++){
    const it=items[i],body=i===0?caption:'';
    const pend=uploadStub(to,it.video?'Видео':'Фото',it.file);
    try{
      let path,blob=it.file,type=it.file.type||'application/octet-stream';
      if(!it.video&&/^image\/(png|jpe?g|webp|bmp|heic|heif)$/i.test(type)){blob=await shrink(it.file);type='image/jpeg';path=me+'/'+crypto.randomUUID()+'.jpg'}
      else{if(it.file.size>MAX_FILE)throw new Error('файл больше 50 МБ');path=me+'/file_'+crypto.randomUUID()+'_'+it.file.size+'__'+safeName(it.file.name||('video.'+(type.split('/')[1]||'mp4')))}
      const up=await sb.storage.from('photos').upload(path,blob,{contentType:type});if(up.error)throw up.error;
      pend?.remove();await sendMsg(to,{image_path:path,...(body?{body}:{})});
    }catch(e){pend?.remove();toast('Не удалось отправить '+(it.video?'видео':'фото')+': '+(e.message||e))}
  }
}
// Видео в ленте — прямо в пузыре, с кнопками плеера
function videoEl(path){
  const v=document.createElement('video');v.className='mvid';v.controls=true;v.playsInline=true;v.preload='metadata';
  v.onclick=e=>e.stopPropagation();imgUrl(path).then(u=>{if(u)v.src=u+'#t=0.1'});return v;
}
$('gfile').onchange=e=>{const fs=[...e.target.files];e.target.value='';if(pick&&!$('modal').classList.contains('hide'))addPicked(fs.filter(isMediaFile));else openMediaPicker(fs)};
