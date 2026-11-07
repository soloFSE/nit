// Кружочки: короткие круглые видео с фронтальной камеры.
// Файл кладётся в хранилище 'photos' с окончанием .circle.webm / .circle.mp4.
const CIRCLE_MAX_SEC=60;
const circleIO=new IntersectionObserver(es=>es.forEach(e=>{const v=e.target;v._vis=e.isIntersecting;
  if(e.isIntersecting){if(!v.src&&v.dataset.src)v.src=v.dataset.src;if(v.muted&&v.src)v.play().catch(()=>{})}
  else if(v.muted)v.pause();
}),{threshold:.25});
const isCircle=p=>/\.circle\.(webm|mp4)$/i.test(p||'');
let cam={stream:null,rec:null,chunks:[],start:0,elapsed:0,timer:null,facing:'user',to:null,cancel:false,prevUrl:null};

function pickVideoType(){
  const t=[['video/webm;codecs=vp9,opus','webm'],['video/webm;codecs=vp8,opus','webm'],['video/mp4','mp4'],['video/webm','webm']];
  for(const [mime,ext] of t)if(window.MediaRecorder&&MediaRecorder.isTypeSupported(mime))return {mime,ext};
  return {mime:'',ext:'webm'};
}

async function camOpen(){
  if(!cur)return;
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){alert('Этот браузер не умеет записывать видео.');return}
  cam.to=cur;$('cam').classList.remove('hide');camState('idle');
  await camStream();
}
async function camStream(){
  cam.stream?.getTracks().forEach(t=>t.stop());
  try{
    cam.stream=await navigator.mediaDevices.getUserMedia({
      video:{facingMode:cam.facing,width:{ideal:480},height:{ideal:480},aspectRatio:1},audio:true});
  }catch(e){
    camClose();
    alert(e.name==='NotAllowedError'?'Нет доступа к камере или микрофону. Разрешите их в настройках сайта.':'Камера недоступна: '+e.message);
    return;
  }
  const v=$('camv');v.srcObject=cam.stream;v.classList.toggle('mirror',cam.facing==='user');v.play().catch(()=>{});
}
// Состояния: idle — ждём начала, rec — пишем, pause — на паузе, видно записанное (можно продолжить / отправить / удалить)
const CAM_HINT={idle:'Нажмите, чтобы начать запись. До 60 секунд.',rec:'Нажмите — пауза. ➤ — отправить.',pause:'Пауза: посмотрите, что получилось. ● — продолжить, ➤ — отправить, ✕ — удалить.'};
function camState(s){
  $('cam').dataset.s=s;
  $('camgo').title=s==='rec'?'Пауза':s==='pause'?'Продолжить запись':'Записать';
  $('camhint').textContent=CAM_HINT[s];
  if(s==='idle'){$('camt').textContent='0:00';camRing(0)}
}
const camSecs=()=>cam.elapsed+(cam.rec&&cam.rec.state==='recording'?(Date.now()-cam.start)/1000:0);
function camPause(){
  if(!cam.rec||cam.rec.state!=='recording')return;
  cam.rec.pause();cam.rec.requestData?.();cam.elapsed+=(Date.now()-cam.start)/1000;camState('pause');
  // Показываем записанное в кружке, по кругу и со звуком
  setTimeout(()=>{if(cam.rec?.state!=='paused')return;
    const v=$('camv');if(cam.prevUrl)URL.revokeObjectURL(cam.prevUrl);cam.prevUrl=URL.createObjectURL(new Blob(cam.chunks,{type:cam.mime}));
    v.srcObject=null;v.src=cam.prevUrl;v.muted=false;v.loop=true;v.play().catch(()=>{v.muted=true;v.play().catch(()=>{})})},200);
}
function camResume(){
  if(cam.rec?.state!=='paused')return;
  const v=$('camv');v.pause();v.removeAttribute('src');v.muted=true;v.loop=false;v.srcObject=cam.stream;v.play().catch(()=>{});
  cam.rec.resume();cam.start=Date.now();camState('rec');
}
function camSend(){if(cam.rec&&cam.rec.state!=='inactive'){cam.cancel=false;cam.rec.stop()}}
function camRing(p){$('camring').style.strokeDashoffset=String(100-p*100)}

function camRecStart(){
  const {mime,ext}=pickVideoType();cam.ext=ext;cam.mime=mime||'video/webm';
  cam.rec=new MediaRecorder(cam.stream,{...(mime?{mimeType:mime}:{}),videoBitsPerSecond:700000,audioBitsPerSecond:64000});
  cam.chunks=[];cam.cancel=false;
  cam.rec.ondataavailable=e=>{if(e.data.size)cam.chunks.push(e.data)};
  cam.rec.onstop=()=>{
    const dur=camSecs()+(cam.rec?.state==='inactive'&&$('cam').dataset.s==='rec'?(Date.now()-cam.start)/1000:0),blob=new Blob(cam.chunks,{type:cam.mime}),to=cam.to,cancel=cam.cancel;
    camClose();
    if(!cancel&&dur>=1&&blob.size)sendCircle(blob,cam.ext,to,Math.round(dur));
  };
  cam.elapsed=0;cam.rec.start(250);cam.start=Date.now();camState('rec');
  cam.timer=setInterval(()=>{
    if(!cam.rec)return;const s=camSecs();
    $('camt').textContent=Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
    camRing(Math.min(1,s/CIRCLE_MAX_SEC));
    if(s>=CIRCLE_MAX_SEC&&cam.rec.state==='recording')camPause();
  },100);
}
function camClose(){
  clearInterval(cam.timer);
  if(cam.rec&&cam.rec.state!=='inactive'){cam.cancel=true;cam.rec.stop();return} // onstop вызовет camClose ещё раз
  cam.rec=null;cam.stream?.getTracks().forEach(t=>t.stop());cam.stream=null;
  const v=$('camv');v.pause();v.removeAttribute('src');v.srcObject=null;v.muted=true;v.loop=false;
  if(cam.prevUrl){URL.revokeObjectURL(cam.prevUrl);cam.prevUrl=null}
  $('cam').classList.add('hide');
}

async function sendCircle(blob,ext,to,secs){
  const pend=pendingCircle(to);
  try{
    // Длительность пишем в имя файла: Chrome не сохраняет её в самом видео
    const path=me+'/'+crypto.randomUUID()+'_'+secs+'s.circle.'+ext;
    const up=await sb.storage.from('photos').upload(path,blob,{contentType:blob.type.split(';')[0]});
    if(up.error)throw up.error;
    pend?.remove();
    await sendMsg(to,{image_path:path});
  }catch(err){pend?.remove();alert('Не удалось отправить кружок: '+(err.message||err))}
}
// Пока кружок загружается, показываем заглушку с крутилкой
function pendingCircle(to){
  if(cur!==to)return null;
  const d=el('div','m me circle pending');d.append(el('span','spin'));
  const em=$('log').querySelector('.empty');if(em)em.remove();
  $('log').append(d);$('log').scrollTop=1e9;return d;
}

// Кружок в ленте: без звука крутится по кругу, по нажатию — со звуком с начала
function circleEl(path){
  const w=el('div','circ');
  const v=document.createElement('video');v.playsInline=true;v.muted=true;v.loop=true;v.preload='none';
  const ring=document.createElementNS('http://www.w3.org/2000/svg','svg');ring.setAttribute('viewBox','0 0 36 36');ring.classList.add('circ-ring');
  ring.innerHTML='<circle cx="18" cy="18" r="17" pathLength="100"/>';
  const t=el('span','circ-t');
  w.append(v,ring,t);
  // Видео грузится и играет только пока кружок виден — иначе десяток кружков разом «съедает» телефон
  circleIO.observe(v);
  imgUrl(path).then(u=>{if(u){v.dataset.src=u;if(v._vis){v.src=u;v.play().catch(()=>{})}}});
  const named=+(path.match(/_(\d+)s\.circle\./)||[])[1]||0;
  const dur=()=>isFinite(v.duration)&&v.duration>0?v.duration:named;
  const showDur=()=>{if(dur())t.textContent=fmt(dur())};showDur();
  v.onloadedmetadata=showDur;
  v.ontimeupdate=()=>{
    const d=dur();
    if(!v.muted&&d){ring.querySelector('circle').style.strokeDashoffset=String(Math.max(0,100-v.currentTime/d*100));t.textContent=fmt(Math.max(0,d-v.currentTime))}
  };
  v.onended=()=>reset();
  const reset=()=>{v.muted=true;v.loop=true;w.classList.remove('on');ring.querySelector('circle').style.strokeDashoffset='100';showDur();v.play().catch(()=>{})};
  w.onclick=e=>{
    e.stopPropagation();
    if(w.classList.contains('on')){if(v.paused)v.play();else v.pause();return}
    // Останавливаем другие кружки со звуком
    document.querySelectorAll('.circ.on video').forEach(o=>o.dispatchEvent(new Event('ended')));
    w.classList.add('on');v.muted=false;v.loop=false;v.currentTime=0;v.play().catch(()=>{});
  };
  return w;
}
const fmt=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');

$('bc').onclick=camOpen;
$('camx').onclick=camClose;
$('camgo').onclick=()=>!cam.rec?cam.stream&&camRecStart():cam.rec.state==='recording'?camPause():camResume();
$('camsend').onclick=camSend;
$('camflip').onclick=()=>{if(cam.rec)return;cam.facing=cam.facing==='user'?'environment':'user';camStream()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('cam').classList.contains('hide'))camClose()});
