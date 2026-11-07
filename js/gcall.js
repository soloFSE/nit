// Групповые звонки: каждый участник соединён с каждым напрямую (WebRTC «сетка»).
// Подходит для небольших групп — до 8 человек. Договариваются через broadcast-канал 'gcall-<id звонка>',
// кто сейчас в звонке — через presence того же канала. Звук и видео через сервер не идут.
const GC_MAX=8;
let gc=null,gring=null;

// ---------- Начать звонок в группе ----------
async function startGroupCall(gid,video){
  if(call||gc){alert('Вы уже в звонке.');return}
  const g=groups[gid];if(!g)return;
  const callId=crypto.randomUUID();
  if(!await joinGroupCall(gid,callId,video))return;
  // Зовём всех участников группы через их личные каналы и пишем в чат приглашение
  (gm[gid]||[]).filter(u=>u!==me).forEach(u=>csig(u,{t:'gring',gid,callId,video,id:callId}));
  sendMsg('g:'+gid,{body:'::gcall:'+callId+':'+(video?1:0)+'::'},{noReply:true}).catch(()=>{});
}

// ---------- Присоединиться ----------
async function joinGroupCall(gid,callId,video){
  if(call){alert('Сначала завершите текущий звонок.');return false}
  if(gc){if(gc.callId===callId){showGc();return true}alert('Вы уже в другом звонке.');return false}
  if(!window.RTCPeerConnection||!navigator.mediaDevices){alert('Этот браузер не поддерживает звонки.');return false}
  hideGring();
  let local;
  try{local=await getMedia(video)}catch(e){mediaErr(e);return false}
  gc={gid,callId,video,local,peers:{},ice:{},start:Date.now()};
  showGc();addTile(me,local,true);showFlip($('gcflip'),local);mirrorLocal(document.querySelector('.tile.me'),'user');
  callSession(true,groups[gid]?.name||'Группа',{hangup:leaveGroupCall,mic:()=>$('gcmute').click(),cam:video?()=>$('gccam').click():null});
  const ch=gc.ch=sb.channel('gcall-'+callId,{config:{presence:{key:me},broadcast:{self:false}}});
  ch.on('broadcast',{event:'sig'},({payload:p})=>{if(gc&&p?.to===me)onGcSig(p).catch(e=>console.warn('gcall',e))})
    .on('presence',{event:'sync'},()=>syncGcPeers())
    .subscribe(async st=>{if(st==='SUBSCRIBED'&&gc?.ch===ch)await ch.track({at:Date.now(),video})});
  gc.timer=setInterval(()=>{if(gc)$('gcState').textContent=gcCount()+' · '+fmt((Date.now()-gc.start)/1000)},1000);
  return true;
}
const gcCount=()=>{const n=Object.keys(gc.peers).length+1;return n+' '+plural(n,'участник','участника','участников')};

// Кто в звонке: соединяемся с новыми, убираем ушедших
function syncGcPeers(){
  if(!gc)return;
  const st=gc.ch.presenceState(),inCall=Object.keys(st).filter(u=>u!==me&&(gm[gc.gid]||[]).includes(u));
  inCall.slice(0,GC_MAX-1).forEach(u=>{
    if(gc.peers[u])return;
    makeGcPeer(u);
    // Предложение соединения отправляет тот, чей id «меньше» — так пара не звонит друг другу одновременно
    if(me<u)gcOffer(u);
  });
  Object.keys(gc.peers).forEach(u=>{if(!inCall.includes(u))dropGcPeer(u)});
  $('gcState').textContent=gcCount()+' · '+fmt((Date.now()-gc.start)/1000);
}
function gcSend(to,p){gc?.ch.send({type:'broadcast',event:'sig',payload:{...p,from:me,to}})}
function makeGcPeer(u){
  const pc=new RTCPeerConnection({iceServers:ICE});
  gc.local.getTracks().forEach(t=>pc.addTrack(t,gc.local));
  if(!gc.video)pc.addTransceiver('video',{direction:'recvonly'});
  pc.onicecandidate=e=>{if(e.candidate)gcSend(u,{t:'ice',c:e.candidate.toJSON()})};
  pc.ontrack=e=>addTile(u,e.streams[0],false);
  pc.onconnectionstatechange=()=>{
    const t=document.querySelector('.tile[data-uid="'+u+'"]');
    t?.classList.toggle('connecting',pc.connectionState!=='connected');
    if(pc.connectionState==='failed')t?.classList.add('failed');
  };
  gc.peers[u]=pc;gc.ice[u]=gc.ice[u]||[];
  addTile(u,null,false);
  return pc;
}
async function gcOffer(u){
  const pc=gc.peers[u];const o=await pc.createOffer();await pc.setLocalDescription(o);gcSend(u,{t:'offer',sdp:o.sdp});
}
async function onGcSig(p){
  const u=p.from;if(!(gm[gc.gid]||[]).includes(u))return;
  let pc=gc.peers[u];
  if(p.t==='offer'){
    if(!pc)pc=makeGcPeer(u);
    await pc.setRemoteDescription({type:'offer',sdp:p.sdp});flushGcIce(u);
    const a=await pc.createAnswer();await pc.setLocalDescription(a);gcSend(u,{t:'answer',sdp:a.sdp});
  }else if(p.t==='answer'&&pc){await pc.setRemoteDescription({type:'answer',sdp:p.sdp});flushGcIce(u)}
  else if(p.t==='cam'){document.querySelector('.tile[data-uid="'+u+'"]')?.classList.toggle('has-video',!!p.on)}
  else if(p.t==='ice'){if(pc?.remoteDescription)pc.addIceCandidate(p.c).catch(()=>{});else (gc.ice[u]||=[]).push(p.c)}
}
function flushGcIce(u){const l=gc.ice[u]||[];gc.ice[u]=[];l.forEach(c=>gc.peers[u]?.addIceCandidate(c).catch(()=>{}))}
function dropGcPeer(u){
  try{gc.peers[u]?.close()}catch{}delete gc.peers[u];delete gc.ice[u];
  const t=document.querySelector('.tile[data-uid="'+u+'"]');if(t){t.classList.add('leaving');setTimeout(()=>{t.remove();layoutGc()},300)}
  stopTalk(u);dropAudio('gc:'+u);
}

function leaveGroupCall(){
  if(!gc)return;const g=gc;gc=null;
  clearInterval(g.timer);
  try{g.ch.untrack();sb.removeChannel(g.ch)}catch{}
  Object.values(g.peers).forEach(pc=>{try{pc.close()}catch{}});
  Object.keys(g.peers).forEach(u=>dropAudio('gc:'+u));callSession(false);
  g.local.getTracks().forEach(t=>t.stop());
  Object.keys(talk).forEach(stopTalk);
  $('gcall').classList.add('closing');
  setTimeout(()=>{$('gcall').classList.add('hide');$('gcall').classList.remove('closing');$('gcGrid').innerHTML=''},250);
}

// ---------- Экран группового звонка ----------
function showGc(){
  const g=groups[gc.gid];
  $('gcName').textContent=g?.name||'Группа';$('gcState').textContent='Подключение…';
  $('gcall').classList.remove('hide');
  $('gccam').classList.toggle('hide',!gc.video);$('gcmute').classList.remove('off');$('gccam').classList.remove('off');$('gcflip').classList.remove('spun');
}
function addTile(u,stream,isMe){
  let t=document.querySelector('.tile[data-uid="'+u+'"]');
  if(!t){
    t=el('div','tile connecting'+(isMe?' me':''));t.dataset.uid=u;
    const v=document.createElement('video');v.autoplay=true;v.playsInline=true;v.muted=true; // звук — через <audio>, см. bg.js
    const ava=el('div','tile-ava');ava.append(avatar(u,72));
    t.append(v,ava,el('span','tile-n',isMe?'Вы':nameOf(u)));
    $('gcGrid').append(t);layoutGc();
    if(isMe)t.classList.remove('connecting');
  }
  if(stream){
    const v=t.querySelector('video');if(v.srcObject!==stream){v.srcObject=stream;v.play().catch(()=>{})}
    const hasV=()=>stream.getVideoTracks().some(x=>x.enabled&&x.readyState==='live');
    t.classList.toggle('has-video',hasV());
    stream.onaddtrack=()=>t.classList.toggle('has-video',hasV());
    if(!isMe){t.classList.remove('connecting');remoteAudio('gc:'+u,stream)}
    watchTalk(u,stream);
  }
}
function layoutGc(){const n=$('gcGrid').children.length;$('gcGrid').dataset.n=Math.min(n,9)}
$('gcleave').onclick=leaveGroupCall;
$('gcmute').onclick=()=>{const t=gc?.local.getAudioTracks()[0];if(!t)return;t.enabled=!t.enabled;$('gcmute').classList.toggle('off',!t.enabled);setSessionMic(t.enabled);
  document.querySelector('.tile.me')?.classList.toggle('muted',!t.enabled)};
$('gccam').onclick=()=>{const t=gc?.local.getVideoTracks()[0];if(!t)return;t.enabled=!t.enabled;$('gccam').classList.toggle('off',!t.enabled);
  document.querySelector('.tile.me')?.classList.toggle('has-video',t.enabled);
  Object.keys(gc.peers).forEach(u=>gcSend(u,{t:'cam',on:t.enabled}))};
window.addEventListener('beforeunload',()=>{if(gc)leaveGroupCall()});

// Подсветка того, кто говорит
const talk={};let talkCtx=null;
function watchTalk(u,stream){
  if(talk[u]||!stream.getAudioTracks().length)return;
  try{
    talkCtx||=new (window.AudioContext||window.webkitAudioContext)();
    const src=talkCtx.createMediaStreamSource(stream),an=talkCtx.createAnalyser();an.fftSize=512;src.connect(an);
    const buf=new Uint8Array(an.fftSize);
    talk[u]=setInterval(()=>{
      an.getByteTimeDomainData(buf);let s=0;for(const v of buf)s+=(v-128)**2;
      const lvl=Math.sqrt(s/buf.length);
      document.querySelector('.tile[data-uid="'+u+'"]')?.classList.toggle('talk',lvl>6);
    },180);
  }catch{}
}
function stopTalk(u){clearInterval(talk[u]);delete talk[u]}

// ---------- Входящее приглашение ----------
function onGroupRing(p){
  const g=groups[p.gid];
  if(!g||!(gm[p.gid]||[]).includes(p.from)||isBlocked(p.from))return;
  if(call||gc)return;
  gring={...p};
  $('grText').textContent=nameOf(p.from)+' зовёт в '+(p.video?'видеозвонок':'звонок');
  $('grName').textContent=g.name;
  const a=$('grAva');a.innerHTML='';a.append(groupAvatar(g,44));
  $('grjoinv').classList.toggle('hide',!p.video);
  $('gring').classList.remove('hide');tone('in');
  clearTimeout(gring.t);gring.t=setTimeout(hideGring,40000);
  if(document.hidden)sysNotify(g.name,{body:nameOf(p.from)+' зовёт в '+(p.video?'видеозвонок':'звонок'),tag:'gcall',call:true,chat:'g:'+p.gid});
}
function hideGring(){if(gring){clearTimeout(gring.t);gring=null}$('gring').classList.add('hide');if(!call)tone(null)}
$('grjoin').onclick=()=>gring&&joinGroupCall(gring.gid,gring.callId,false);
$('grjoinv').onclick=()=>gring&&joinGroupCall(gring.gid,gring.callId,true);
$('grno').onclick=hideGring;

// ---------- Приглашение в чате ----------
SPECIAL.push({re:/^::gcall:([0-9a-f-]{36}):([01])::$/,cls:'call-m',forward:false,
  preview:x=>(x[2]==='1'?PI('i-video')+'Групповой видеозвонок':PI('i-phone')+'Групповой звонок'),
  render:(m,d,x)=>{
    const v=x[2]==='1',fresh=Date.now()-new Date(m.created_at)<3*3600*1000;
    const w=el('div','callrec');{const ci=el('span','callrec-i');ci.append(svgI(v?'i-video':'i-phone'));w.append(ci)}
    const t=el('div','callrec-t');t.append(el('b',null,'Групповой '+(v?'видеозвонок':'звонок')),el('small',null,(m.sender===me?'Вы начали':nameOf(m.sender)+' начал(а)')));
    w.append(t);
    if(fresh&&m.group_id){const b=el('button','primary sm-btn','Войти');b.onclick=e=>{e.stopPropagation();joinGroupCall(m.group_id,x[1],v)};w.append(b)}
    d.append(w);
  }});
