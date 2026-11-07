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
  pc.ontrack=e=>{const st=e.streams[0]||new MediaStream([e.track]),v=$('rv');v.muted=true;
    if(v.srcObject!==st){v.srcObject=st;v.play().catch(()=>{})}else if(!st.getTracks().includes(e.track))st.addTrack(e.track);
    remoteAudio('call',st);
    e.track.onunmute=e.track.onmute=remoteVideoUI;remoteVideoUI()};
  pc.onconnectionstatechange=()=>{
    if(!call)return;const s=pc.connectionState;
    if(s==='connected'&&call.state!=='active')callActive();
    if(s==='failed')endCall('failed');
    if(s==='disconnected')setTimeout(()=>{if(call&&call.pc===pc&&pc.connectionState==='disconnected')endCall('lost')},12000);
  };
  return pc;
}
// Видео 720p 30 к/с (если камера и сеть тянут — браузер сам снизит при плохой связи)
const VIDEO_C={facingMode:'user',width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}};
async function getMedia(video){
  return navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:video?VIDEO_C:false});
}
function mediaErr(e){alert(e?.name==='NotAllowedError'?'Нет доступа к микрофону или камере. Разрешите их в настройках сайта.':'Не удалось включить микрофон/камеру: '+(e?.message||e))}

// ---------- Исходящий ----------
async function startCall(peer,video){
  if(call)return;
  if(gc){alert('Сначала выйдите из группового звонка.');return}
  if(!window.RTCPeerConnection||!navigator.mediaDevices){alert('Этот браузер не поддерживает звонки.');return}
  call={id:crypto.randomUUID(),peer,video,role:'caller',state:'calling',ice:[],camOn:!!video,remoteCam:false};
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
    call={id:p.id,peer:p.from,video:!!p.video,role:'callee',state:'ringing',offer:p.sdp,ice:[],camOn:false,remoteCam:!!p.video};
    showCall(true);setCallState(p.video?'Входящий видеозвонок':'Входящий звонок');tone('in');
    if(document.hidden)sysNotify(nameOf(p.from),{body:p.video?'📹 Входящий видеозвонок':'📞 Входящий звонок',tag:'call',call:true,chat:p.from});
    call.ring=setTimeout(()=>{if(call&&call.state==='ringing')endCall('missed',false)},45000);
    return;
  }
  if(!call||p.id!==call.id)return;
  if(p.t==='answer'){call.remoteCam=!!p.video;await call.pc.setRemoteDescription({type:'answer',sdp:p.sdp});flushIce();setCallState('Соединение…');tone(null);remoteVideoUI()}
  // Камеру включили посреди звонка — заново договариваемся о соединении
  else if(p.t==='reoffer'&&call.pc){await call.pc.setRemoteDescription({type:'offer',sdp:p.sdp});const a=await call.pc.createAnswer();await call.pc.setLocalDescription(a);csig(call.peer,{t:'reanswer',sdp:a.sdp})}
  else if(p.t==='reanswer'&&call.pc){await call.pc.setRemoteDescription({type:'answer',sdp:p.sdp})}
  else if(p.t==='cam'){call.remoteCam=!!p.on;remoteVideoUI()}
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
  call.camOn=!!withVideo;showLocal();
  call.pc=makePc();call.local.getTracks().forEach(t=>call.pc.addTrack(t,call.local));
  await call.pc.setRemoteDescription({type:'offer',sdp:call.offer});flushIce();
  const ans=await call.pc.createAnswer();await call.pc.setLocalDescription(ans);
  await csig(call.peer,{t:'answer',sdp:ans.sdp,video:!!withVideo});
}

function callActive(){
  call.state='active';call.start=Date.now();tone(null);clearTimeout(call.ring);
  const hasCam=!!call.local?.getVideoTracks().length;
  callSession(true,nameOf(call.peer),{hangup:()=>endCall('hangup'),mic:()=>$('cmute').click(),cam:hasCam?()=>$('ccam').click():null,
    pip:hasCam&&document.pictureInPictureEnabled?()=>$('rv').requestPictureInPicture().catch(()=>{}):null});
  call.timer=setInterval(()=>setCallState(fmt((Date.now()-call.start)/1000)),500);
  tuneSenders(call.pc);
}
// Чуть больше битрейта видео — картинка чётче (браузер сам снизит при слабой сети)
function tuneSenders(pc){
  pc?.getSenders().forEach(s=>{if(s.track?.kind!=='video')return;const p=s.getParameters();if(!p.encodings?.length)return;
    p.encodings[0].maxBitrate=1500000;p.degradationPreference='balanced';s.setParameters(p).catch(()=>{})});
}
// Показ видео собеседника: только если он сказал, что камера включена, и кадры идут
function remoteVideoUI(){
  if(!call)return;const v=$('rv'),t=v.srcObject?.getVideoTracks?.()[0];
  const on=!!(call.remoteCam&&t&&t.readyState==='live'&&!t.muted);
  $('call').classList.toggle('has-video',on);
  if(!on&&$('call').classList.contains('swap'))swapCall(false);
}
// ---------- Камера в звонке: включить в любой момент, выключить — у собеседника аватарка ----------
async function renegotiate(){const o=await call.pc.createOffer();await call.pc.setLocalDescription(o);csig(call.peer,{t:'reoffer',sdp:o.sdp})}
async function camToggle(){
  if(!call?.local)return;
  let t=call.local.getVideoTracks()[0];
  if(!t){ // камеры ещё не было (аудиозвонок или приняли как аудио)
    let s;try{s=await navigator.mediaDevices.getUserMedia({video:VIDEO_C})}catch(e){mediaErr(e);return}
    if(!call)return s.getTracks().forEach(x=>x.stop());
    t=s.getVideoTracks()[0];call.local.addTrack(t);
    if(call.pc){
      const tr=call.pc.getTransceivers().find(x=>x.receiver.track?.kind==='video');
      if(tr){await tr.sender.replaceTrack(t);if(tr.direction!=='sendrecv'){tr.direction='sendrecv';await renegotiate()}}
      else{call.pc.addTrack(t,call.local);await renegotiate()}
      tuneSenders(call.pc);
    }
    call.camOn=true;
  }else{t.enabled=!t.enabled;call.camOn=t.enabled}
  showLocal();
  $('ccam').classList.toggle('off',!call.camOn);setSessionCam(call.camOn);
  csig(call.peer,{t:'cam',on:call.camOn});
}

// reason: hangup | decline | noanswer | failed | lost | remote | declined | busy | missed
function endCall(reason,tell=true){
  if(!call)return;const c=call;call=null;
  if(tell)csig(c.peer,{t:c.role==='callee'&&c.state==='ringing'?'decline':'hangup',id:c.id});
  clearTimeout(c.ring);clearInterval(c.timer);tone(null);
  c.local?.getTracks().forEach(t=>t.stop());try{c.pc?.close()}catch{}
  $('rv').srcObject=null;$('lv').srcObject=null;dropAudio('call');callSession(false);
  if(document.pictureInPictureElement)document.exitPictureInPicture().catch(()=>{});
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
  $('ccam').classList.remove('hide');$('cmute').classList.remove('off');$('ccam').classList.toggle('off',!call.camOn);
  c.classList.remove('swap');['lv','rv'].forEach(i=>{$(i).style.left=$(i).style.top=''});
  $('caccv').classList.toggle('hide',!call.video);$('cflip').classList.add('hide');$('cflip').classList.remove('spun');
}
function hideCall(){if(!call)$('call').classList.add('hide')}
function setCallState(t){$('callState').textContent=t}
function showLocal(){const v=$('lv');if(v.srcObject!==call.local)v.srcObject=call.local;
  const on=!!call.camOn&&call.local.getVideoTracks().some(t=>t.enabled);v.classList.toggle('hide',!on);v.play().catch(()=>{});
  mirrorLocal(v,call.local._facing||'user');showFlip($('cflip'),on?call.local:null);
  if(!on&&$('call').classList.contains('swap'))swapCall(false)}
$('chang').onclick=()=>endCall('hangup');
$('cdec').onclick=()=>endCall('decline');
$('cacc').onclick=()=>acceptCall(false);
$('caccv').onclick=()=>acceptCall(true);
$('cmute').onclick=()=>{const t=call?.local?.getAudioTracks()[0];if(!t)return;t.enabled=!t.enabled;$('cmute').classList.toggle('off',!t.enabled);setSessionMic(t.enabled)};
$('ccam').onclick=()=>camToggle();

// ---------- Своё окошко: перетаскивается, нажатие — поменять местами с собеседником ----------
function smallVideo(){return $('call').classList.contains('swap')?$('rv'):$('lv')}
function swapCall(on){
  const c=$('call'),was=smallVideo(),pos=[was.style.left,was.style.top];
  c.classList.toggle('swap',on);was.style.left=was.style.top='';
  const now=smallVideo();now.style.left=pos[0];now.style.top=pos[1];
}
['lv','rv'].forEach(id=>{
  const v=$(id);let st=null;
  v.addEventListener('pointerdown',e=>{if(v!==smallVideo())return;const r=v.getBoundingClientRect();st={x:e.clientX,y:e.clientY,dx:e.clientX-r.left,dy:e.clientY-r.top,moved:false};try{v.setPointerCapture(e.pointerId)}catch{}});
  v.addEventListener('pointermove',e=>{if(!st)return;if(Math.abs(e.clientX-st.x)+Math.abs(e.clientY-st.y)>6)st.moved=true;if(!st.moved)return;
    const W=innerWidth,H=innerHeight,r=v.getBoundingClientRect();
    v.style.left=Math.max(6,Math.min(W-r.width-6,e.clientX-st.dx))+'px';v.style.top=Math.max(6,Math.min(H-r.height-6,e.clientY-st.dy))+'px';v.style.right='auto'});
  v.addEventListener('pointerup',()=>{if(!st)return;const m=st.moved;st=null;
    if(m){ // прилипает к ближайшему краю
      const r=v.getBoundingClientRect(),W=innerWidth;v.style.left=(r.left+r.width/2<W/2?12:W-r.width-12)+'px';return}
    if($('call').classList.contains('has-video')&&!$('lv').classList.contains('hide'))swapCall(!$('call').classList.contains('swap'))});
});
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
