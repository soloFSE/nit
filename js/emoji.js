// Смайлики (emoji-picker-element) и стикеры (анимированные эмодзи Google Noto)
const PICKER_JS='https://cdn.jsdelivr.net/npm/emoji-picker-element@1.29.1/index.js';
const PICKER_RU='https://cdn.jsdelivr.net/npm/emoji-picker-element@1.29.1/i18n/ru_RU.js';
const PICKER_DATA='https://cdn.jsdelivr.net/npm/emoji-picker-element-data@1.8.0/ru/cldr/data.json';
const NOTO='https://fonts.gstatic.com/s/e/notoemoji/latest/';
const STICKERS='1f602 1f923 1f60d 1f970 1f618 1f60e 1f914 1f644 1f62d 1f621 1f92f 1f631 1f973 1f97a 1f634 1f480 1f4a9 1f921 1f47b 1f916 1f648 1f44d 1f44e 1f44f 1f64f 1f4aa 1f525 2764_fe0f 1f494 1f4af 1f389 1f381 1f440 1f44b 1f680 1f608 1f911 1f920 1f92a 1f60b 1f607 1f975 1f976 1f62c 1f971 2728 1f308 1f600'.split(' ');
// Стикер хранится в тексте сообщения как ::st:<код>::
const STICKER_RE=/^::st:([0-9a-f_]{2,40})::$/;
const stickerOf=b=>(b||'').match(STICKER_RE)?.[1]||null;
const stickerUrl=(c,anim)=>NOTO+c+(anim?'/512.webp':'/emoji.svg');
// Сообщение только из 1–3 эмодзи показываем крупно
const ONLY_EMOJI=/^(?:\p{Extended_Pictographic}(?:️|‍|\p{Emoji_Modifier}|\p{Extended_Pictographic})*\s*){1,3}$/u;
const isBigEmoji=b=>!!b&&b.length<=24&&ONLY_EMOJI.test(b.trim());

let pickerReady=null;
function loadPicker(){
  return pickerReady||=(async()=>{
    const [,ru]=await Promise.all([import(PICKER_JS),import(PICKER_RU).catch(()=>null)]);
    const p=document.createElement('emoji-picker');
    p.dataSource=PICKER_DATA;p.locale='ru';if(ru?.default)p.i18n=ru.default;
    p.addEventListener('emoji-click',e=>insertAtCursor(e.detail.unicode));
    $('emojiTab').append(p);return p;
  })().catch(e=>{pickerReady=null;$('emojiTab').innerHTML='<p class="hint">Не удалось загрузить смайлики. Проверьте интернет.</p>';throw e});
}
function insertAtCursor(t){
  const m=$('msg'),s=m.selectionStart??m.value.length,e=m.selectionEnd??m.value.length;
  m.value=m.value.slice(0,s)+t+m.value.slice(e);m.selectionStart=m.selectionEnd=s+t.length;
  m.dispatchEvent(new Event('input'));
}

// Свои стикеры: у каждого свой набор (строки custom_stickers с owner = я), файлы — в хранилище 'stickers',
// сообщение ::cs:<путь>::. Удаление убирает стикер из набора, но файл остаётся — отправленные стикеры не ломаются.
const CS_RE=/^::cs:([\w\/.-]{5,200})::$/;
const csUrl=p=>SUPABASE_URL+'/storage/v1/object/public/stickers/'+p;
let customs=[],customsOk=true;
async function loadCustoms(){
  const {data,error}=await sb.from('custom_stickers').select('id,owner,path').eq('owner',me).order('created_at',{ascending:false}).limit(300);
  if(error){customsOk=false;return}customs=data||[];
}
async function buildStickers(force){
  const g=$('stickTab');if(g.children.length&&!force)return;
  await loadCustoms();g.innerHTML='';
  g.append(el('h2','st-h','Мои стикеры'+(customs.length?' · '+customs.length:'')));
  const add=el('button','stick add-st');add.title='Добавить свой стикер';add.append(el('span',null,'+'));
  const f=document.createElement('input');f.type='file';f.accept='image/png,image/webp,image/gif,image/jpeg';f.hidden=true;
  add.onclick=()=>{if(!customsOk){alert('Чтобы добавлять стикеры, запустите supabase/more.sql в Supabase.');return}f.click()};
  f.onchange=async()=>{const file=f.files[0];f.value='';if(file)await uploadSticker(file)};
  g.append(add,f);
  customs.forEach(c=>{
    const b=el('button','stick');const i=document.createElement('img');i.loading='lazy';i.alt='';i.src=csUrl(c.path);b.append(i);
    b.onclick=()=>{closeEmoji();sendMsg(cur,{body:'::cs:'+c.path+'::'}).catch(e=>alert(e.message))};
    const x=el('span','st-del');x.append(ico('i-x'));x.title='Убрать из моих стикеров';
    x.onclick=async e=>{e.stopPropagation();if(!confirm('Убрать стикер из ваших? В отправленных сообщениях он останется.'))return;
      const {error}=await sb.from('custom_stickers').delete().eq('id',c.id);if(error){toast('Не удалось: '+error.message);return}
      toast('Стикер убран');buildStickers(true)};b.append(x);
    // Долгое нажатие на телефоне — тоже убрать
    let lp=0;b.addEventListener('touchstart',()=>{lp=setTimeout(()=>{lp=-1;x.click()},600)},{passive:true});
    b.addEventListener('touchend',e=>{if(lp===-1){e.preventDefault()}clearTimeout(lp)});
    g.append(b);
  });
  g.append(el('h2','st-h','Анимированные'));
  STICKERS.forEach(c=>{
    const b=el('button','stick');b.title='Стикер';
    const i=document.createElement('img');i.loading='lazy';i.alt='';i.src=stickerUrl(c,false);
    // При наведении показываем анимацию
    b.onmouseenter=()=>i.src=stickerUrl(c,true);b.onmouseleave=()=>i.src=stickerUrl(c,false);
    b.append(i);b.onclick=()=>{closeEmoji();sendSticker(c)};g.append(b);
  });
}
// Картинка → стикер 512×512 с прозрачностью (GIF загружаем как есть, чтобы сохранить анимацию)
async function uploadSticker(file){
  try{
    let blob=file,ext='gif',type='image/gif';
    if(file.type!=='image/gif'){
      blob=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>{const k=Math.min(1,512/Math.max(i.width,i.height)),c=document.createElement('canvas');
        c.width=Math.round(i.width*k);c.height=Math.round(i.height*k);c.getContext('2d').drawImage(i,0,0,c.width,c.height);
        c.toBlob(b=>b?ok(b):no(new Error('не удалось обработать')),'image/webp',.9)};i.onerror=()=>no(new Error('это не картинка'));i.src=URL.createObjectURL(file)});
      ext=blob.type==='image/webp'?'webp':'png';type=blob.type||'image/png';
    }
    if(blob.size>1048576)throw new Error('стикер больше 1 МБ');
    const path=me+'/'+crypto.randomUUID()+'.'+ext;
    const up=await sb.storage.from('stickers').upload(path,blob,{contentType:type});if(up.error)throw up.error;
    const {error}=await sb.from('custom_stickers').insert({owner:me,path});if(error)throw error;
    toast('Стикер добавлен');buildStickers(true);
  }catch(e){alert('Не удалось добавить стикер: '+(e.message||e))}
}
// Сохранить чужой (или свой убранный) стикер из чата к себе
async function saveSticker(path){
  if(customs.some(c=>c.path===path)){toast('Этот стикер уже у вас');return}
  const {error}=await sb.from('custom_stickers').insert({owner:me,path});
  if(error){toast('Не удалось сохранить: '+error.message);return}
  toast('Стикер сохранён в «Мои стикеры»');await loadCustoms();if($('stickTab').children.length)buildStickers(true);
}
SPECIAL.push({re:CS_RE,cls:'sticker',preview:()=>'Стикер',menu:(m,btn,x)=>btn('Сохранить стикер',()=>saveSticker(x[1])),render:(m,d,x)=>{
  const i=document.createElement('img');i.className='st-img';i.alt='стикер';i.loading='lazy';i.decoding='async';i.src=csUrl(x[1]);d.append(i)}});
async function sendSticker(code){
  try{await sendMsg(cur,{body:'::st:'+code+'::'})}catch(e){alert('Не удалось отправить стикер: '+e.message)}
}
SPECIAL.push({re:STICKER_RE,cls:'sticker',preview:()=>'Стикер',render:(m,d,x)=>{
  const i=document.createElement('img');i.className='st-img';i.alt='стикер';i.loading='lazy';i.decoding='async';i.src=stickerUrl(x[1],true);d.append(i)}});

let emoMode='e';
function emojiTab(mode){
  if(mode===true)mode='s';if(mode===false||!mode)mode='e';emoMode=mode;
  $('emojiTab').classList.toggle('hide',mode!=='e');$('premTab').classList.toggle('hide',mode!=='p');$('stickTab').classList.toggle('hide',mode!=='s');
  $('pkbar').classList.toggle('hide',mode!=='p');
  $('etE').classList.toggle('on',mode==='e');$('etP').classList.toggle('on',mode==='p');$('etS').classList.toggle('on',mode==='s');
  if(mode==='s')buildStickers();else if(mode==='p')buildPremium();else loadPicker().catch(()=>{});
}
function openEmoji(){$('emoji').classList.remove('hide');$('be').classList.add('on');emojiTab(emoMode)}
function closeEmoji(){$('emoji').classList.add('hide');$('be').classList.remove('on')}
$('be').onclick=e=>{e.stopPropagation();$('emoji').classList.contains('hide')?openEmoji():closeEmoji()};
$('etE').onclick=()=>emojiTab('e');$('etP').onclick=()=>emojiTab('p');$('etS').onclick=()=>emojiTab('s');
// «Стереть»: удаляет символ перед курсором (премиум-эмодзи :rb7: стирается целиком)
$('etDel').onclick=()=>{const m=$('msg'),s=m.selectionStart??m.value.length,e=m.selectionEnd??s;let a=s;
  if(s===e){const before=m.value.slice(0,s),t=/:[a-z]{2,6}\d{1,3}: ?$/.exec(before);a=t?s-t[0].length:Math.max(0,s-[...before].slice(-1)[0]?.length||s-1)}
  m.value=m.value.slice(0,a)+m.value.slice(e);m.setSelectionRange(a,a);m.dispatchEvent(new Event('input'));m.focus()};
document.addEventListener('click',e=>{if(!$('emoji').classList.contains('hide')&&!e.target.closest('#emoji,#be'))closeEmoji()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeEmoji()});
