// Баннеры профиля (supabase/v11.sql: profiles.banner, бакет banners). Ставить баннер можно только с подпиской «Нить Премиум» (проверяет и сервер).
// Значение profiles.banner: 'p:<id>' — готовый баннер из набора (статичный или анимированный, рисуется стилями), либо путь картинки в бакете banners
// (своя картинка, в том числе GIF и анимированный WebP). Баннер показывается в шапке профиля и в «Настройках».
const BN_LIST=[ // [id, название, анимированный?]
  ['dawn','Рассвет',0],['forest','Лес',0],['ocean','Океан',0],['violet','Фиалка',0],['graphite','Графит',0],['gold','Золото',0],
  ['aurora','Северное сияние',1],['neon','Неон',1],['flame','Пламя',1],['waves','Волны',1],['stars','Звёзды',1],['snow','Снегопад',1],['liquid','Жидкость',1],['sunset','Закат',1]
];
const bnUrl=p=>SUPABASE_URL+'/storage/v1/object/public/banners/'+p;
const bnCan=()=>(typeof isPremium==='function'&&isPremium(me))||(typeof amAppAdmin!=='undefined'&&amAppAdmin);
// Элемент баннера (или null, если баннера нет)
function bannerEl(v,cls){
  if(!v)return null;
  const d=el('div','bn'+(cls?' '+cls:''));
  if(v.startsWith('p:')){const id=v.slice(2);if(!BN_LIST.some(b=>b[0]===id))return null;d.classList.add('bn-'+id)}
  else{d.classList.add('bn-img');const i=document.createElement('img');i.alt='';i.decoding='async';i.src=bnUrl(v);i.onerror=()=>d.remove();d.append(i)}
  return d;
}
// Положить баннер в шапку (hero) человека uid; шапка получает класс has-bn
function bannerInto(hero,uid){
  const v=prof[uid]?.banner;const b=bannerEl(v);if(!b)return;
  const w=el('div','bn-wrap');w.append(b);hero.classList.add('has-bn');hero.prepend(w);
}
// Блок выбора баннера в окне «Профиль». Возвращает функции для сохранения.
function bannerEditor(s,cur){
  const st={val:cur||null,file:null,url:null,changed:false};
  const box=el('section','bn-ed');box.append(el('div','bn-h','Баннер профиля'));
  const prev=el('div','bn-prev');box.append(prev);
  const showPrev=()=>{prev.innerHTML='';
    if(st.file){const d=el('div','bn bn-img'),i=document.createElement('img');i.src=st.url;d.append(i);prev.append(d)}
    else{const b=bannerEl(st.val);if(b)prev.append(b);else{prev.append(el('span','bn-none','Баннера нет'))}}};
  showPrev();
  if(!bnCan()){
    prev.classList.add('lock');const lk=el('button','bn-lock');lk.append(svgI('i-gem'),el('b',null,'Баннеры — для подписчиков'),el('small',null,'Подключите «Нить Премиум»: готовые и анимированные баннеры, свои картинки и GIF'));
    lk.onclick=e=>{e.preventDefault();closeModal();setTimeout(()=>openPremium(),220)};box.append(lk);s.append(box);
    return {get:()=>({changed:false})};
  }
  const strip=el('div','bn-strip');
  const mk=(id,name,anim)=>{const b=el('button','bn-th');const t=bannerEl('p:'+id);b.append(t,el('span',null,(anim?'✨ ':'')+name));b.onclick=e=>{e.preventDefault();st.val='p:'+id;st.file=null;st.changed=true;showPrev();mark()};b.dataset.id='p:'+id;strip.append(b)};
  BN_LIST.forEach(([id,n,a])=>mk(id,n,a));
  const mark=()=>strip.querySelectorAll('.bn-th').forEach(b=>b.classList.toggle('on',!st.file&&st.val===b.dataset.id));mark();
  box.append(strip);
  const row=el('div','bn-btns');
  const up=el('button','ghost','Своя картинка / GIF'),del=el('button','ghost danger','Убрать баннер');
  const f=document.createElement('input');f.type='file';f.accept='image/jpeg,image/png,image/webp,image/gif';f.hidden=true;
  up.onclick=e=>{e.preventDefault();f.click()};
  f.onchange=async()=>{const file=f.files[0];f.value='';if(!file)return;
    if(!/^image\/(jpeg|png|webp|gif)$/.test(file.type)){toast('Подойдут JPG, PNG, WebP и GIF');return}
    if(file.size>4*1024*1024){toast('Файл больше 4 МБ — уменьшите картинку');return}
    let out=file;
    if(file.type==='image/jpeg'||file.type==='image/png'){try{out=await bnShrink(file)}catch{}}
    if(st.url)URL.revokeObjectURL(st.url);st.file=out;st.url=URL.createObjectURL(out);st.changed=true;showPrev();mark()};
  del.onclick=e=>{e.preventDefault();st.val=null;st.file=null;st.changed=true;showPrev();mark()};
  row.append(up,del,f);box.append(row);box.append(el('small','sm','Лучше всего — широкая картинка 3:1. Анимированные GIF и WebP до 4 МБ.'));
  s.append(box);
  return {get:()=>({changed:st.changed,val:st.val,file:st.file})};
}
// Сжимаем обычную картинку до ширины 1280 (GIF/WebP не трогаем, чтобы не потерять анимацию)
function bnShrink(file){return new Promise((ok,no)=>{
  const i=new Image(),u=URL.createObjectURL(file);
  i.onload=()=>{URL.revokeObjectURL(u);const k=Math.min(1,1280/i.width),c=document.createElement('canvas');c.width=Math.round(i.width*k);c.height=Math.round(i.height*k);
    c.getContext('2d').drawImage(i,0,0,c.width,c.height);c.toBlob(b=>b?ok(b):no(new Error('shrink')),'image/jpeg',.86)};
  i.onerror=()=>no(new Error('img'));i.src=u})}
// Загрузка выбранного баннера; возвращает значение для profiles.banner
async function bannerSave(ed,old){
  const g=ed.get();if(!g.changed)return undefined;
  if(g.file){
    const ext=g.file.type==='image/gif'?'gif':g.file.type==='image/webp'?'webp':g.file.type==='image/png'?'png':'jpg';
    const path=me+'/'+crypto.randomUUID()+'.'+ext;
    const up=await sb.storage.from('banners').upload(path,g.file,{contentType:g.file.type});
    if(up.error)throw new Error(/bucket|not found/i.test(up.error.message)?'Запустите supabase/v11.sql в Supabase':up.error.message);
    return {val:path,drop:old&&!old.startsWith('p:')?old:null};
  }
  return {val:g.val,drop:old&&!old.startsWith('p:')&&old!==g.val?old:null};
}
