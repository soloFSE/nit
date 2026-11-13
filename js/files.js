// Файлы в чате, ссылки и превью YouTube/картинок
// Путь файла: <me>/file_<uuid>_<размер>__<имя>
const FILE_RE=/\/file_[0-9a-f-]+_(\d+)__(.+)$/i;
const isFile=p=>FILE_RE.test(p||'');
const fileName=p=>(p||'').match(FILE_RE)?.[2]||'файл';
const fileSize=p=>+((p||'').match(FILE_RE)?.[1]||0);
const fmtSize=n=>n>=1048576?(n/1048576).toFixed(1).replace('.0','')+' МБ':n>=1024?Math.round(n/1024)+' КБ':n+' Б';
const EXT_ICON={zip:'i-box',rar:'i-box','7z':'i-box',mp3:'i-music',wav:'i-music',ogg:'i-music',m4a:'i-music',mp4:'i-film',mov:'i-film',webm:'i-film',apk:'i-gear',exe:'i-gear',psd:'i-image',png:'i-image',jpg:'i-image',jpeg:'i-image',gif:'i-image',svg:'i-image',webp:'i-image'};

function fileEl(path){
  const name=fileName(path),ext=(name.split('.').pop()||'').toLowerCase();
  const a=el('a','file');a.target='_blank';a.rel='noopener';
  const ic=el('span','file-ic');ic.append(svgI(EXT_ICON[ext]||'i-file'));
  const t=el('span','file-t');t.append(el('b',null,name),el('small',null,fmtSize(fileSize(path))+(ext?' · '+ext.toUpperCase():'')));
  a.append(ic,t);
  a.onclick=async e=>{e.preventDefault();e.stopPropagation();logMsgEvent?.(msgByPath(path),'open');const u=await imgUrl(path,name);if(u)window.open(u,'_blank')};
  return a;
}

// Текст со ссылками
const URL_RE=/\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,!?;:)\]]/gi;
function richText(t){
  const f=document.createDocumentFragment();let last=0;
  for(const x of t.matchAll(URL_RE)){
    f.append(document.createTextNode(t.slice(last,x.index)));
    const a=el('a','link',x[0].replace(/^https?:\/\//,'').slice(0,60)+(x[0].length>68?'…':''));
    a.href=x[0];a.target='_blank';a.rel='noopener noreferrer';a.onclick=e=>e.stopPropagation();f.append(a);last=x.index+x[0].length;
  }
  f.append(document.createTextNode(t.slice(last)));return typeof premiumize==='function'?premiumize(typeof linkMentions==='function'?linkMentions(f):f):(typeof linkMentions==='function'?linkMentions(f):f);
}
// Превью без сторонних сервисов: YouTube (картинка с самого YouTube) и прямые ссылки на картинки
function linkPreviews(t){
  const out=[];const urls=[...t.matchAll(URL_RE)].map(x=>x[0]).slice(0,2);
  urls.forEach(u=>{
    const yt=u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/i);
    if(yt){
      const a=el('a','yt');a.href=u;a.target='_blank';a.rel='noopener noreferrer';a.onclick=e=>e.stopPropagation();
      const i=document.createElement('img');i.src='https://i.ytimg.com/vi/'+yt[1]+'/hqdefault.jpg';i.alt='YouTube';i.loading='lazy';
      a.append(i,el('span','yt-play','▶'),el('span','yt-l','YouTube'));out.push(a);return;
    }
    if(/\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(u)){
      const mk=()=>{const i=document.createElement('img');i.className='photo';i.src=u;i.loading='lazy';i.referrerPolicy='no-referrer';i.onerror=()=>i.remove();i.onclick=e=>{e.stopPropagation();openViewer(u)};return i};
      if(typeof secPref==='function'&&secPref().autoimg)out.push(mk());
      else{let host='';try{host=new URL(u).hostname}catch{}const b=el('button','ext-img');b.append(svgI('i-image'),el('span',null,'Показать картинку с '+host+' (сайт узнает ваш IP)'));b.onclick=e=>{e.stopPropagation();b.replaceWith(mk())};out.push(b)}
    }
  });
  return out;
}
