// Голосовые сообщения: запись с микрофона и отправка.
// Файл кладётся в то же хранилище 'photos' и в то же поле image_path, что и фото,
// только с аудио-расширением — так не нужно менять базу.
const VOICE_MAX_SEC=120;
const AUDIO_EXT=/\.(webm|ogg|mp4|m4a)$/i;
const isAudio=p=>AUDIO_EXT.test(p||'');
let rec=null,recChunks=[],recStart=0,recTimer=null,recCancel=false;

function pickAudioType(){
  // Chrome/Firefox пишут webm/ogg, Safari — mp4
  const t=[['audio/webm;codecs=opus','webm'],['audio/ogg;codecs=opus','ogg'],['audio/mp4','mp4'],['audio/webm','webm']];
  for(const [mime,ext] of t)if(window.MediaRecorder&&MediaRecorder.isTypeSupported(mime))return {mime,ext};
  return {mime:'',ext:'webm'};
}
function recUI(on){
  $('bv').classList.toggle('rec',on);$('send').classList.toggle('recording',on);
  $('vc').classList.toggle('hide',!on);
  $('msg').disabled=on;$('bp').disabled=on;$('bs').disabled=on;$('bc').disabled=on;$('be').disabled=on;
  if(!on){$('msg').placeholder='Сообщение';clearInterval(recTimer)}
}
function recTick(){
  const s=Math.floor((Date.now()-recStart)/1000);
  $('msg').placeholder='● Запись '+Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
  if(s>=VOICE_MAX_SEC)stopRec(false);
}
async function startRec(){
  if(!cur)return;
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){alert('Этот браузер не умеет записывать звук.');return}
  let stream;
  try{stream=await navigator.mediaDevices.getUserMedia({audio:true})}
  catch(e){alert(e.name==='NotAllowedError'?'Нет доступа к микрофону. Разрешите его в настройках сайта.':'Микрофон недоступен: '+e.message);return}
  const {mime,ext}=pickAudioType(),to=cur;
  rec=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
  recChunks=[];recCancel=false;
  rec.ondataavailable=e=>{if(e.data.size)recChunks.push(e.data)};
  rec.onstop=()=>{
    stream.getTracks().forEach(t=>t.stop());
    const dur=(Date.now()-recStart)/1000;rec=null;recUI(false);
    if(recCancel||dur<0.7||!recChunks.length)return; // слишком короткая — случайное нажатие
    sendVoice(new Blob(recChunks,{type:mime||'audio/webm'}),ext,to);
  };
  rec.start();recStart=Date.now();recUI(true);recTick();recTimer=setInterval(recTick,250);
}
function stopRec(cancel){if(rec&&rec.state!=='inactive'){recCancel=cancel;rec.stop()}}

async function sendVoice(blob,ext,to){
  try{
    const path=me+'/'+crypto.randomUUID()+'.'+ext;
    const up=await sb.storage.from('photos').upload(path,blob,{contentType:blob.type.split(';')[0]});
    if(up.error)throw up.error;
    await sendMsg(to,{image_path:path});
  }catch(err){alert('Не удалось отправить голосовое: '+(err.message||err))}
}

$('bv').onclick=()=>rec?stopRec(false):startRec();
$('vc').onclick=()=>stopRec(true);
