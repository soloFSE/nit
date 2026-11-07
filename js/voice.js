// Голосовые сообщения как в Telegram: запись с «живыми» волнами, пауза, прослушивание перед отправкой,
// удаление; в чате — свой плеер с волнами, перемоткой и скоростью.
// Файл лежит в хранилище 'photos' в поле image_path (как фото), только с аудио-расширением.
// В имя файла вшиты длительность и волна: <id>/<uuid>_v<секунды>_<40 шестнадцатеричных уровней>.<ext>
const VOICE_MAX_SEC=600;
const AUDIO_EXT=/\.(webm|ogg|mp4|m4a)$/i;
const isAudio=p=>AUDIO_EXT.test(p||'');
let rec=null,recChunks=[],recStream=null,recCtx=null,recAn=null,recLevels=[],recPaused=false,recElapsed=0,recResumeAt=0,recTimer=null,recTo=null,recPrev=null;

function pickAudioType(){
  // Chrome/Firefox пишут webm/ogg, Safari — mp4
  const t=[['audio/webm;codecs=opus','webm'],['audio/ogg;codecs=opus','ogg'],['audio/mp4','mp4'],['audio/webm','webm']];
  for(const [mime,ext] of t)if(window.MediaRecorder&&MediaRecorder.isTypeSupported(mime))return {mime,ext};
  return {mime:'',ext:'webm'};
}
const recSecs=()=>recElapsed+(recPaused||!recResumeAt?0:(Date.now()-recResumeAt)/1000);
const mmss=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};

// ---------- Полоска записи ----------
function voiceUI(on){
  $('send').classList.toggle('voice',on);$('vbar').classList.toggle('hide',!on);
  if(!on){clearInterval(recTimer);$('vwave').innerHTML='';previewStop()}
}
function drawLive(){
  // последние уровни бегут справа налево
  const w=$('vwave'),n=Math.max(20,Math.floor(w.clientWidth/5)),lv=norm(recLevels).slice(-n);
  if(w.children.length!==n){w.innerHTML='';for(let i=0;i<n;i++)w.append(el('i'))}
  [...w.children].forEach((b,i)=>{const v=lv[i-(n-lv.length)];b.style.height=(v==null?3:Math.max(3,v*28))+'px';b.classList.toggle('on',v!=null)});
}
function recTick(){
  if(!rec)return;
  if(!recPaused&&recAn){
    const buf=new Uint8Array(recAn.fftSize);recAn.getByteTimeDomainData(buf);
    let s=0;for(const v of buf)s+=(v-128)**2;recLevels.push(Math.sqrt(s/buf.length));drawLive();
  }
  $('vtime').textContent=mmss(recSecs());
  if(recSecs()>=VOICE_MAX_SEC&&!recPaused)pauseRec();
}
async function startRec(){
  if(!cur||rec)return;
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){alert('Этот браузер не умеет записывать звук.');return}
  try{recStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}})}
  catch(e){alert(e.name==='NotAllowedError'?'Нет доступа к микрофону. Разрешите его в настройках сайта.':'Микрофон недоступен: '+e.message);return}
  const {mime,ext}=pickAudioType();recTo=cur;
  rec=new MediaRecorder(recStream,mime?{mimeType:mime}:undefined);rec._ext=ext;rec._mime=mime||'audio/webm';
  recChunks=[];recLevels=[];recPaused=false;recElapsed=0;recResumeAt=Date.now();
  rec.ondataavailable=e=>{if(e.data.size)recChunks.push(e.data)};
  try{recCtx=new (window.AudioContext||window.webkitAudioContext)();recAn=recCtx.createAnalyser();recAn.fftSize=512;recCtx.createMediaStreamSource(recStream).connect(recAn)}catch{recAn=null}
  rec.start(250);voiceUI(true);$('vpause').classList.remove('paused');$('vbar').classList.remove('paused');
  recTimer=setInterval(recTick,80);navigator.vibrate?.(20);
}
// Пауза: запись приостановлена, можно прослушать то, что уже есть, и продолжить
function pauseRec(){
  if(!rec||recPaused)return;
  rec.pause();rec.requestData?.();recPaused=true;recElapsed+=(Date.now()-recResumeAt)/1000;
  $('vpause').classList.add('paused');$('vbar').classList.add('paused');
  setTimeout(()=>{if(rec&&recPaused){showPreview()}},150);
}
function resumeRec(){
  if(!rec||!recPaused)return;previewStop();
  rec.resume();recPaused=false;recResumeAt=Date.now();$('vpause').classList.remove('paused');$('vbar').classList.remove('paused');
}
function showPreview(){
  const w=$('vwave');w.innerHTML='';const lv=squeeze(norm(recLevels),40);
  lv.forEach(v=>{const b=el('i');b.style.height=Math.max(3,v*28)+'px';w.append(b)});
  $('vtime').textContent=mmss(recElapsed);
}
function previewStop(){if(recPrev){recPrev.pause();URL.revokeObjectURL(recPrev.src);recPrev=null}$('vplay').classList.remove('on')}
$('vplay').onclick=e=>{
  e.stopPropagation();if(!recPaused)return;
  if(recPrev){previewStop();return}
  const a=recPrev=new Audio(URL.createObjectURL(new Blob(recChunks,{type:rec._mime})));
  $('vplay').classList.add('on');
  const bars=[...$('vwave').children];
  a.ontimeupdate=()=>{const p=a.currentTime/Math.max(.1,recElapsed);bars.forEach((b,i)=>b.classList.toggle('on',i/bars.length<=p));$('vtime').textContent=mmss(a.currentTime)};
  a.onended=()=>{previewStop();bars.forEach(b=>b.classList.remove('on'));$('vtime').textContent=mmss(recElapsed)};
  a.play().catch(()=>previewStop());
};
// Громкость → 0..1 относительно самого громкого места (иначе тихая речь даёт ровную полосу)
function norm(a){
  if(!a.length)return a;const sorted=[...a].sort((x,y)=>x-y),floor=sorted[Math.floor(a.length*.1)]||0,top=Math.max(sorted[Math.floor(a.length*.97)]||0,floor+2);
  return a.map(v=>Math.min(1,Math.max(0,(v-floor)/(top-floor)))**.8);
}
// Сжать уровни до n столбиков (среднее с упором на пики)
function squeeze(a,n){if(!a.length)return Array(n).fill(.15);const o=[];for(let i=0;i<n;i++){const s=Math.floor(i*a.length/n),e=Math.max(s+1,Math.floor((i+1)*a.length/n));let m=0,sum=0,c=0;for(let j=s;j<e;j++){const v=a[Math.min(j,a.length-1)]||0;m=Math.max(m,v);sum+=v;c++}o.push(m*.6+(sum/c)*.4)}return o}
function finishRec(send){
  if(!rec)return;const r=rec,to=recTo,levels=recLevels.slice();
  const dur=recPaused?recElapsed:recSecs();
  r.onstop=()=>{
    recStream?.getTracks().forEach(t=>t.stop());recCtx?.close().catch(()=>{});recStream=recCtx=recAn=null;
    if(send&&dur>=0.7&&recChunks.length)sendVoice(new Blob(recChunks,{type:r._mime}),r._ext,to,dur,levels);
  };
  rec=null;voiceUI(false);
  try{r.state!=='inactive'?r.stop():r.onstop()}catch{r.onstop()}
}
const stopRec=c=>finishRec(!c); // для совместимости

async function sendVoice(blob,ext,to,dur,levels){
  const hex=squeeze(norm(levels),40).map(v=>Math.round(v*15).toString(16)).join('');
  try{
    const path=me+'/'+crypto.randomUUID()+'_v'+Math.max(1,Math.round(dur))+'_'+hex+'.'+ext;
    const up=await sb.storage.from('photos').upload(path,blob,{contentType:blob.type.split(';')[0]});
    if(up.error)throw up.error;
    await sendMsg(to,{image_path:path});
  }catch(err){alert('Не удалось отправить голосовое: '+(err.message||err))}
}

$('bv').onclick=()=>rec?finishRec(true):startRec();
$('vdel').onclick=()=>{finishRec(false);toast('Голосовое удалено')};
$('vpause').onclick=()=>recPaused?resumeRec():pauseRec();
// «Отправить» во время записи отправляет голосовое
{const prev=$('bs').onclick;$('bs').onclick=e=>{if(rec)return finishRec(true);prev?.(e)}}

// ---------- Плеер голосового в чате ----------
let vNow=null; // сейчас играющее — одновременно только одно
function voiceMeta(path){
  const m=/_v(\d+)_([0-9a-f]{10,80})\.\w+$/.exec(path||'');
  if(m)return {dur:+m[1],lv:[...m[2]].map(c=>parseInt(c,16)/15)};
  // старые голосовые — волна «по отпечатку» имени файла
  let h=2166136261;const lv=[];for(let i=0;i<40;i++){h=Math.imul(h^(path.charCodeAt(i%path.length)+i),16777619);const env=Math.sin(Math.PI*(i+1)/41)**.6;lv.push(Math.max(.08,env*(.2+((h>>>0)%80)/100)))}
  return {dur:0,lv};
}
function voiceEl(path){
  const {dur,lv}=voiceMeta(path);
  imgUrl(path).catch(()=>{}); // ссылка готова заранее: iPhone разрешает play() только сразу после нажатия
  const w=el('div','vmsg'),play=el('button','vplay-b'),bars=el('div','vbars'),t=el('span','vtime-m',dur?mmss(dur):'0:00'),sp=el('button','vspeed','1×');
  play.append(svgI('i-play'));play.title='Слушать';sp.title='Скорость';
  lv.forEach(v=>{const b=el('i');b.style.height=Math.max(3,Math.round(v*24))+'px';bars.append(b)});
  w.append(play,bars,t,sp);
  let a=null,speed=1;
  const paint=()=>{if(!a)return;const total=isFinite(a.duration)&&a.duration>0?a.duration:dur||1,p=a.currentTime/total;
    [...bars.children].forEach((b,i)=>b.classList.toggle('on',(i+.5)/lv.length<=p));t.textContent=mmss(a.paused&&!a.currentTime?total:a.currentTime)};
  const stop=()=>{if(!a)return;a.pause();w.classList.remove('playing');play.innerHTML='';play.append(svgI('i-play'))};
  const ensure=async()=>{if(a)return a;const u=await imgUrl(path);if(!u)return null;a=new Audio(u);a.preload='auto';a.playbackRate=speed;
    a.ontimeupdate=paint;a.onended=()=>{stop();a.currentTime=0;paint();[...bars.children].forEach(b=>b.classList.remove('on'));t.textContent=mmss(dur||a.duration)};
    a.onloadedmetadata=()=>{if(!dur&&isFinite(a.duration))t.textContent=mmss(a.duration)};return a};
  play.onclick=async e=>{e.stopPropagation();
    if(/\.webm$/i.test(path)&&!document.createElement('audio').canPlayType('audio/webm')){toast('Это голосовое записано в webm — ваш телефон его не проигрывает (нужен iOS 18.4 или новее)');return}
    const au=await ensure();if(!au)return;
    if(!au.paused){stop();return}
    if(vNow&&vNow!==stop)vNow();vNow=stop;
    au.play().then(()=>{w.classList.add('playing');play.innerHTML='';play.append(svgI('i-pause'))}).catch(()=>toast('Нажмите ещё раз, чтобы воспроизвести'))};
  bars.onclick=async e=>{e.stopPropagation();const au=await ensure();if(!au)return;const r=bars.getBoundingClientRect(),p=(e.clientX-r.left)/r.width;
    const total=isFinite(au.duration)&&au.duration>0?au.duration:dur;if(!total)return;au.currentTime=Math.max(0,Math.min(total-.05,p*total));paint();if(au.paused)play.click()};
  sp.onclick=e=>{e.stopPropagation();speed=speed===1?1.5:speed===1.5?2:1;sp.textContent=speed+'×';if(a)a.playbackRate=speed};
  return w;
}
