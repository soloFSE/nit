// Выбор фото/видео и просмотр перед отправкой с подписью (как в Telegram/WhatsApp).
// «Фото и видео» открывает галерею телефона; выбранное показывается сеткой — можно убрать лишнее,
// добавить ещё и написать подпись. Подпись уходит вместе с первым фото.
const VIDEO_EXT=/\.(mp4|webm|mov|m4v|3gp)$/i;
const isMediaFile=f=>/^image\//.test(f.type)||/^video\//.test(f.type)||VIDEO_EXT.test(f.name||'');
let pick=null; // {to, items:[{file,url}], caption}

function openMediaPicker(files,to=cur){
  files=[...files].filter(isMediaFile);if(!files.length||!to)return;
  if(pick&&pick.to===to&&!$('modal').classList.contains('hide')){addPicked(files);return}
  pick={to,items:[],caption:$('msg').value.trim()};
  addPicked(files,true);
}
function addPicked(files,open){
  files.forEach(f=>{if(pick.items.length<20)pick.items.push({file:f,url:URL.createObjectURL(f),video:/^video\//.test(f.type)||VIDEO_EXT.test(f.name)})});
  if(open)openModal(buildPicker);else{const s=$('sheet');s.innerHTML='';buildPicker(s)}
}
function closePicker(){if(!pick)return;pick.items.forEach(i=>URL.revokeObjectURL(i.url));pick=null;closeModal()}
function buildPicker(s){
  s.classList.add('mp-sheet');
  const n=pick.items.length;
  const top=el('div','sheet-top');top.append(el('h3',null,n===1?(pick.items[0].video?'Видео':'Фото'):'Выбрано: '+n));
  const x=el('button','icon');x.append(svgI('i-x'));x.title='Отмена';x.onclick=closePicker;top.append(x);s.append(top);
  const grid=el('div','mp-grid'+(n===1?' one':''));s.append(grid);
  pick.items.forEach((it,i)=>{
    const c=el('div','mp-it');
    if(it.video){const v=document.createElement('video');v.src=it.url;v.muted=true;v.playsInline=true;v.loop=true;v.autoplay=true;c.append(v,el('span','mp-v','▶'))}
    else{const im=document.createElement('img');im.src=it.url;im.alt='';c.append(im)}
    const del=el('button','mp-del');del.append(svgI('i-x'));del.title='Убрать';
    del.onclick=()=>{URL.revokeObjectURL(it.url);pick.items.splice(i,1);if(!pick.items.length){closePicker();return}const sh=$('sheet');sh.innerHTML='';buildPicker(sh)};
    c.append(del);grid.append(c);
  });
  if(n<20){const add=el('button','mp-add');add.append(svgI('i-plus'),el('span',null,'Ещё'));add.onclick=()=>$('gfile').click();grid.append(add)}
  const row=el('div','mp-row');
  const cap=document.createElement('input');cap.placeholder='Добавить подпись…';cap.maxLength=1000;cap.value=pick.caption||'';
  cap.oninput=()=>pick.caption=cap.value;
  const go=el('button','icon primary round mp-send');go.append(svgI('i-send'));go.title='Отправить';
  const cnt=el('span','mp-n',n>1?String(n):'');go.append(cnt);
  cap.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();go.click()}};
  go.onclick=()=>sendPicked();
  row.append(cap,go);s.append(row);
  setTimeout(()=>cap.focus({preventScroll:true}),80);
}
async function sendPicked(){
  if(!pick)return;const {to,items}=pick,caption=(pick.caption||'').trim();
  pick.items=[];closePicker();
  if(caption&&$('msg').value.trim()===caption){$('msg').value='';saveDraft?.()}
  for(let i=0;i<items.length;i++){
    const it=items[i],body=i===0?caption:'';
    const pend=uploadStub(to,it.video?'Видео':'Фото');
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
