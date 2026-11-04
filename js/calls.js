// Звонки один на один: голос и видео напрямую между браузерами (WebRTC).
// Договариваются браузеры через broadcast-каналы Supabase 'call-<id>', сам звук и видео через сервер не идут.
const ICE=[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']},{urls:'stun:stun.cloudflare.com:3478'}];
let call=null,myCallCh=null;const peerChs={};

function startCalls(){
  myCallCh=sb.channel('call-'+me).on('broadcast',{event:'sig'},({payload})=>onSig(payload).catch(e=>console.warn('call',e))).subscribe();
}
async function csig(to,p){
  let ch=peerChs[to];
  if(!ch){ch=peerChs[to]=sb.channel('call-'+to);await new Promise(r=>{ch.subscribe(st=>{if(st==='SUBSCRIBED')r()});setTimeout(r,4000)})}
  ch.send({type:'broadcast',event:'sig',payload:{...p,from:me,id:p.id||call?.id}});
}
const isFriendId=id=>fr.some(f=>f.status==='accepted'&&(f.a===id||f.b===id));

function makePc(){
  const pc=new RTCPeerConnection({iceServers:ICE});
  pc.onicecandidate=e=>{if(e.candidate&&call)csig(call.peer,{t:'ice',c:e.candidate.toJSON()})};
  pc.ontrack=e=>{const v=$('rv');if(v.srcObject!==e.streams[0]){v.srcObject=e.streams[0];v.play().catch(()=>{})}
    $('call').classList.toggle('has-video',e.streams[0].getVideoTracks().length>0)};
  pc.onconnectionstatechange=()=>{
    if(!call)return;const s=pc.connectionState;
    if(s==='connected'&&call.state!=='active')callActive();
    if(s==='failed')endCall('failed');
    if(s==='disconnected')setTimeout(()=>{if(call&&call.pc===pc&&pc.connectionState==='disconnected')endCall('lost')},6000);
  };
  return pc;
}
async function getMedia(video){
  return navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:video?{facingMode:'user',width:{ideal:640},height:{ideal:480}}:false});
}
function mediaErr(e){alert(e?.name==='NotAllowedError'?'Нет доступа к микрофону или камере. Разрешите их в настройках сайта.':'Не удалось включить микрофон/камеру: '+(e?.message||e))}

// ---------- Исходящий ----------
async function startCall(peer,video){
  if(call)return;
  if(gc){alert('Сначала выйдите из группового звонка.');return}
  if(!window.RTCPeerConnection||!navigator.mediaDevices){alert('Этот браузер не поддерживает звонки.');return}
  call={id:crypto.randomUUID(),peer,video,role:'caller',state:'calling',ice:[]};
  showCall();setCallState('Вызов…');
  try{call.local=await getMedia(video)}catch(e){call=null;hideCall();mediaErr(e);return}
  if(!call)return;
  showLocal();
  call.pc=makePc();call.local.getTracks().forEach(t=>call.pc.addTrack(t,call.local));
  if(!video)call.pc.addTransceiver('video',{direction:'recvonly'});
  const offer=await call.pc.createOffer();await call.pc.setLocalDescription(offer);
  await csig(peer,{t:'offer',sdp:offer.sdp,video});
  tone('out');
  call.ring=setTimeout(()=>{if(call&&call.state!=='active')endCall('noanswer')},45000);
}

// ---------- Входящий ----------
async function onSig(p){
  if(!p||p.from===me)return;
  if(p.t==='gring'){onGroupRing(p);return}
  if(p.t==='offer'){
    if(!isFriendId(p.from)||isBlocked(p.from))return;
    if(call||gc){csig(p.from,{t:'busy',id:p.id});return}
    call={id:p.id,peer:p.from,video:!!p.video,role:'callee',state:'ringing',offer:p.sdp,ice:[]};
    showCall(true);setCallState(p.video?'Входящий видеозвонок':'Входящий звонок');tone('in');
    if(document.hidden&&'Notification' in window&&Notification.permission==='granted'){
      try{const n=new Notification(nameOf(p.from),{body:p.video?'📹 Видеозвонок':'📞 Звонок',tag:'call'});n.onclick=()=>{window.focus();n.close()}}catch{}
    }
    call.ring=setTimeout(()=>{if(call&&call.state==='ringing')endCall('missed',false)},45000);
    return;
  }
  if(!call||p.id!==call.id)return;
  if(p.t==='answer'){await call.pc.setRemoteDescription({type:'answer',sdp:p.sdp});flushIce();setCallState('Соединение…');tone(null)}
  else if(p.t==='ice'){if(call.pc?.remoteDescription)call.pc.addIceCandidate(p.c).catch(()=>{});else call.ice.push(p.c)}
  else if(p.t==='hangup')endCall('remote',false);
  else if(p.t==='decline')endCall('declined',false);
  else if(p.t==='busy')endCall('busy',false);
}
function flushIce(){const l=call.ice;call.ice=[];l.forEach(c=>call.pc.addIceCandidate(c).catch(()=>{}))}

async function acceptCall(withVideo){
  if(!call||call.state!=='ringing')return;
  tone(null);clearTimeout(call.ring);call.state='connecting';setCallState('Соединение…');showCall(false);
  try{call.local=await getMedia(withVideo)}catch(e){mediaErr(e);endCall('decline');return}
  showLocal();
  call.pc=makePc();call.local.getTracks().forEach(t=>call.pc.addTrack(t,call.local));
  await call.pc.setRemoteDescription({type:'offer',sdp:call.offer});flushIce();
  const ans=await call.pc.createAnswer();await call.pc.setLocalDescription(ans);
  await csig(call.peer,{t:'answer',sdp:ans.sdp});
}

function callActive(){
  call.state='active';call.start=Date.now();tone(null);clearTimeout(call.ring);
  call.timer=setInterval(()=>setCallState(fmt((Date.now()-call.start)/1000)),500);
}

// reason: hangup | decline | noanswer | failed | lost | remote | declined | busy | missed
function endCall(reason,tell=true){
  if(!call)return;const c=call;call=null;
  if(tell)csig(c.peer,{t:c.role==='callee'&&c.state==='ringing'?'decline':'hangup',id:c.id});
  clearTimeout(c.ring);clearInterval(c.timer);tone(null);
  c.local?.getTracks().forEach(t=>t.stop());try{c.pc?.close()}catch{}
  $('rv').srcObject=null;$('lv').srcObject=null;
  const msg={busy:'Абонент занят',declined:'Звонок отклонён',noanswer:'Нет ответа',failed:'Не удалось соединиться',lost:'Связь прервалась'}[reason];
  if(msg){setCallState(msg);setTimeout(hideCall,1600)}else hideCall();
  // Запись о звонке в чат пишет только звонивший, чтобы не было двух
  if(c.role==='caller'){const secs=c.start?Math.round((Date.now()-c.start)/1000):0;
    sendMsg(c.peer,{body:'::call:'+secs+':'+(c.video?1:0)+'::'},{noReply:true}).catch(()=>{})}
}

// ---------- Экран звонка ----------
function showCall(incoming){
  const c=$('call');c.classList.remove('hide','has-video');c.classList.toggle('incoming',!!incoming);
  $('callName').textContent=nameOf(call.peer);const a=$('callAva');a.innerHTML='';a.append(avatar(call.peer,120));
  $('ccam').classList.toggle('hide',!call.video);$('cmute').classList.remove('off');$('ccam').classList.remove('off');
  $('caccv').classList.toggle('hide',!call.video);
}
function hideCall(){if(!call)$('call').classList.add('hide')}
function setCallState(t){$('callState').textContent=t}
function showLocal(){const v=$('lv');v.srcObject=call.local;v.classList.toggle('hide',!call.local.getVideoTracks().length);v.play().catch(()=>{})}
$('chang').onclick=()=>endCall('hangup');
$('cdec').onclick=()=>endCall('decline');
$('cacc').onclick=()=>acceptCall(false);
$('caccv').onclick=()=>acceptCall(true);
$('cmute').onclick=()=>{const t=call?.local?.getAudioTracks()[0];if(!t)return;t.enabled=!t.enabled;$('cmute').classList.toggle('off',!t.enabled)};
$('ccam').onclick=()=>{const t=call?.local?.getVideoTracks()[0];if(!t)return;t.enabled=!t.enabled;$('ccam').classList.toggle('off',!t.enabled)};
$('bcall').onclick=()=>cur&&(isGroupKey(cur)?startGroupCall(gidOf(cur),false):startCall(cur,false));
$('bvcall').onclick=()=>cur&&(isGroupKey(cur)?startGroupCall(gidOf(cur),true):startCall(cur,true));
window.addEventListener('beforeunload',()=>{if(call)endCall('hangup')});

// ---------- Гудки ----------
let toneTimer=null,toneCtx=null;
function tone(kind){
  clearInterval(toneTimer);toneTimer=null;if(!kind)return;
  try{toneCtx||=new (window.AudioContext||window.webkitAudioContext)()}catch{return}
  const beep=(f,d,at)=>{const o=toneCtx.createOscillator(),g=toneCtx.createGain(),t=toneCtx.currentTime+at;o.frequency.value=f;
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.1,t+.03);g.gain.setValueAtTime(.1,t+d-.05);g.gain.exponentialRampToValueAtTime(.0001,t+d);
    o.connect(g).connect(toneCtx.destination);o.start(t);o.stop(t+d)};
  const play=kind==='out'?()=>beep(425,1,0):()=>{beep(660,.25,0);beep(880,.25,.3);beep(660,.25,.6)};
  play();toneTimer=setInterval(play,kind==='out'?4000:2000);
}

// ---------- Запись о звонке в чате ----------
SPECIAL.push({re:/^::call:(\d+):([01])::$/,cls:'call-m',forward:false,
  preview:x=>(+x[1]?(x[2]==='1'?'📹 Видеозвонок · ':'📞 Звонок · ')+fmt(+x[1]):'📞 Пропущенный звонок'),
  render:(m,d,x)=>{
    const secs=+x[1],v=x[2]==='1',mine=m.sender===me;
    const w=el('div','callrec'+(secs?'':' missed'));
    w.append(el('span','callrec-i',v?'📹':'📞'));
    const t=el('div','callrec-t');
    t.append(el('b',null,secs?(mine?'Исходящий ':'Входящий ')+(v?'видеозвонок':'звонок'):(mine?'Отменённый звонок':'Пропущенный звонок')),el('small',null,secs?fmt(secs):'—'));
    w.append(t);
    const peer=mine?m.recipient:m.sender;
    if(peer&&!m.group_id){const b=el('button','icon sm-btn','↻');b.title='Перезвонить';b.onclick=e=>{e.stopPropagation();startCall(peer,v)};w.append(b)}
    d.append(w);
  }});
