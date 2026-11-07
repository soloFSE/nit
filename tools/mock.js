// Подставной Supabase для локальной проверки интерфейса (данные в памяти)
(function(){
const now=Date.now(),t=m=>new Date(now-m*60000).toISOString();
const DB={
  profiles:[
    {id:'u1',username:'israfil',display_name:'Исрафил',bio:'Делаю Нить',avatar_path:null},
    {id:'u2',username:'ivan',display_name:'Иван',bio:'На связи после 18:00',avatar_path:null},
    {id:'u3',username:'masha',display_name:null,bio:null,avatar_path:null},
    {id:'u4',username:'petr',display_name:'Пётр',bio:null,avatar_path:null},
    {id:'u5',username:'aslan',display_name:'Аслан',bio:null,avatar_path:null},
  ],
  friendships:[
    {id:1,a:'u1',b:'u2',status:'accepted'},{id:2,a:'u3',b:'u1',status:'pending'},
    {id:3,a:'u4',b:'u1',status:'accepted'},{id:4,a:'u1',b:'u5',status:'pending'}],
  groups:[{id:'g1',name:'Пацаны',owner:'u1',created_at:t(500)}],
  group_members:[{group_id:'g1',user_id:'u1',role:'member'},{group_id:'g1',user_id:'u2',role:'admin'},{group_id:'g1',user_id:'u4',role:'member'}],
  messages:[
    {id:1,sender:'u2',recipient:'u1',group_id:null,body:'Привет! Ну как, новый дизайн готов?',image_path:null,created_at:t(30),deleted_at:null},
    {id:2,sender:'u1',recipient:'u2',group_id:null,body:'Почти, проверяю 🙂',image_path:null,created_at:t(29),deleted_at:null},
    {id:3,sender:'u2',recipient:'u1',group_id:null,body:'Скинь потом скрин',image_path:null,created_at:t(28),deleted_at:null},
    {id:4,sender:'u2',recipient:null,group_id:'g1',body:'Кто сегодня?',image_path:null,created_at:t(20),deleted_at:null},
    {id:5,sender:'u4',recipient:null,group_id:'g1',body:'Я в деле',image_path:null,created_at:t(19),deleted_at:null},
    {id:6,sender:'u1',recipient:null,group_id:'g1',body:'Тоже буду',image_path:null,created_at:t(18),deleted_at:null},
    {id:7,sender:'u4',recipient:'u1',group_id:null,body:'Ты тут?',image_path:null,created_at:t(5),deleted_at:null},
    {id:8,sender:'u4',recipient:'u1',group_id:null,body:'Глянь https://www.youtube.com/watch?v=dQw4w9WgXcQ',image_path:null,created_at:t(4),deleted_at:null},
    {id:9,sender:'u2',recipient:null,group_id:'g1',body:'::poll::{"q":"Куда идём?","o":["Кино","Футбол","Кальян"],"m":false}',image_path:null,created_at:t(3),deleted_at:null},
  ],
  message_hides:[],reads:[{user_id:'u1',chat:'dm:u1:u2',last_id:3},{user_id:'u2',chat:'dm:u1:u2',last_id:2}],pins:[],poll_votes:[],custom_stickers:[],blocks:[],reactions:[{message_id:1,user_id:'u1',emoji:'❤️'},{message_id:1,user_id:'u2',emoji:'❤️'},{message_id:3,user_id:'u2',emoji:'😂'}]
};
window.__DB=DB;let seq=100;
function cond(r,s){ // "col.op.val" или and(...)
  if(s.startsWith('and(')){return split(s.slice(4,-1)).every(x=>cond(r,x))}
  const [c,op,...v]=s.split('.');const val=v.join('.');
  const v2=val.replace(/^"|"$/g,'');if(op==='eq')return String(r[c])===v2;if(op==='gt')return r[c]!=null&&(typeof r[c]==='number'?r[c]>+v2:r[c]>v2);if(op==='ilike'||op==='like')return likeRe(v2,op==='ilike'?'i':'').test(r[c]||'');return false;
}
function split(s){const o=[];let d=0,b='';for(const ch of s){if(ch==='('){d++}if(ch===')'){d--}if(ch===','&&!d){o.push(b);b=''}else b+=ch}if(b)o.push(b);return o}
const esc=x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const likeRe=(v,f)=>new RegExp('^'+v.split('%').map(esc).join('.*')+'$',f||'');
class Q{
  constructor(tb){this.tb=tb;this.f=[];this.op='select';this.one=0;this.lim=0;this.ord=null}
  select(){if(this.op==='select')this.op='select';this.ret=1;return this}
  eq(c,v){this.f.push(r=>r[c]===v);return this}
  in(c,a){this.f.push(r=>a.includes(r[c]));return this}
  gt(c,v){this.f.push(r=>r[c]!=null&&r[c]>v);return this}
  not(c,o,v){if(o==='like'){const re=likeRe(v);this.f.push(r=>!re.test(r[c]||''))}else this.f.push(r=>r[c]!==null&&r[c]!==undefined);return this}
  ilike(c,v){const re=likeRe(v,'i');this.f.push(r=>re.test(r[c]||''));return this}
  is(c,v){this.f.push(r=>r[c]==null);return this}
  gte(c,v){this.f.push(r=>r[c]>=v);return this}
  lt(c,v){this.f.push(r=>r[c]<v);return this}
  upsert(v){this.op='upsert';this.val=v;return this}
  or(s){const p=split(s);this.f.push(r=>p.some(x=>cond(r,x)));return this}
  order(c,o){this.ord=[c,o?.ascending!==false];return this}
  limit(n){this.lim=n;return this}
  single(){this.one=1;return this}
  maybeSingle(){this.one=2;return this}
  insert(v){this.op='insert';this.val=v;return this}
  update(v){this.op='update';this.val=v;return this}
  delete(){this.op='delete';return this}
  then(ok,no){return Promise.resolve(this.run()).then(ok,no)}
  run(){
    (window.__REQ||=[]).push(this.tb+':'+this.op);
    const T=DB[this.tb]||(DB[this.tb]=[]);let rows;
    if(this.op==='upsert'){
      const list=Array.isArray(this.val)?this.val:[this.val];
      list.forEach(v=>{const keys=['chat','user_id'].filter(k=>k in v);const ex=T.find(r=>keys.every(k=>r[k]===v[k]));ex?Object.assign(ex,v):T.push({...v})});
      return {data:list,error:null};
    }
    if(this.op==='insert'){
      if(Array.isArray(this.val)){rows=this.val.map(v=>{const r={...v};if(!r.id)r.id=++seq;T.push(r);return r});return {data:rows,error:null}}
      const r={...this.val};if(this.tb==='groups'){r.id='g'+(++seq);r.created_at=new Date().toISOString();T.push(r);DB.group_members.push({group_id:r.id,user_id:r.owner})}
      else{if(!r.id)r.id=++seq;if(this.tb==='messages'){r.created_at=new Date().toISOString();r.deleted_at=null;r.image_path=r.image_path||null;r.group_id=r.group_id||null;r.recipient=r.recipient||null}T.push(r)}
      rows=[r];
    }else{
      rows=T.filter(r=>this.f.every(f=>f(r)));
      if(this.op==='update')rows.forEach(r=>Object.assign(r,this.val));
      if(this.op==='delete')rows.forEach(r=>T.splice(T.indexOf(r),1));
      if(this.ord){const [c,a]=this.ord;rows=rows.slice().sort((x,y)=>(x[c]>y[c]?1:-1)*(a?1:-1))}
      if(this.lim)rows=rows.slice(0,this.lim);
    }
    rows=rows.map(r=>({...r}));
    if(this.one)return {data:rows[0]||null,error:this.one===1&&!rows[0]?{message:'no rows'}:null};
    return {data:rows,error:null};
  }
}
let cb;const FILES={};window.__FILES=FILES;
// Подставная камера: анимированный холст + тон вместо микрофона
navigator.mediaDevices.getUserMedia=async(cn={audio:true,video:true})=>{
  const c=document.createElement('canvas');c.width=c.height=480;const x=c.getContext('2d');let t=0;
  (function draw(){t++;x.fillStyle='hsl('+(t*3%360)+' 70% 45%)';x.fillRect(0,0,480,480);x.fillStyle='#fff';x.font='bold 90px sans-serif';x.fillText(String(t),140,270);requestAnimationFrame(draw)})();
  const v=c.captureStream(30);const ac=new AudioContext();const o=ac.createOscillator();const d=ac.createMediaStreamDestination();o.connect(d);o.start();
  return new MediaStream([...(cn.video?v.getVideoTracks():[]),...(cn.audio?d.stream.getAudioTracks():[])]);
};
window.supabase={createClient(){return{
  from:t=>new Q(t),
  rpc:async(n,a)=>{(window.__REQ||=[]).push('rpc:'+n);
    if(n==='unread_counts')return {data:[{chat:'dm:u1:u4',n:2}],error:null};
    if(n==='edit_message'){const m=DB.messages.find(x=>x.id===a.mid);m.body=a.new_body;m.edited_at=new Date().toISOString();return {error:null}}
    if(n==='username_free')return {data:!['ivan','petr','israfil'].includes(a.u),error:null};
    if(n==='set_username'){DB.profiles.find(x=>x.id==='u1').username=a.u;return {error:null}}
    if(n==='set_group_role'){DB.group_members.find(x=>x.group_id===a.gid&&x.user_id===a.uid).role=a.new_role;return {error:null}}
    if(n==='admin_delete_message'){const m=DB.messages.find(x=>x.id===a.mid);Object.assign(m,{body:'',image_path:null,deleted_at:new Date().toISOString()});return {error:null}}
    if(n==='transfer_group'){DB.groups.find(g=>g.id===a.gid).owner=a.uid;return {error:null}}
    if(n==='ttt_move'){const m=DB.messages.find(x=>x.id===a.mid);const st=JSON.parse(m.body.slice(7));const me='u1';
      if(st.t==='o'&&!st.o)st.o=me;const b=[...st.b];if(b[a.cell]!=='-')return {error:{message:'Клетка занята'}};b[a.cell]=st.t;
      const L=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];let w='';L.forEach(l=>{if(l.every(i=>b[i]===st.t))w=st.t});if(!w&&!b.includes('-'))w='d';
      const ns={b:b.join(''),t:st.t==='x'?'o':'x',x:st.x,o:st.o,w};m.body='::ttt::'+JSON.stringify(ns);return {data:JSON.stringify(ns),error:null}}
    return {error:null}},
  auth:{onAuthStateChange(f){cb=f;setTimeout(()=>f('SIGNED_IN',{user:{id:'u1'}}),50)},signOut:async()=>cb('SIGNED_OUT',null),signInWithOAuth:async o=>{(window.__AUTH||=[]).push(['oauth',o.provider,o.options?.redirectTo]);return {error:null}},
    resend:async o=>{(window.__AUTH||=[]).push(['resend',o.email]);return {error:null}},
    resetPasswordForEmail:async e=>{(window.__AUTH||=[]).push(['reset',e]);return {error:null}},
    signInWithOtp:async o=>{(window.__AUTH||=[]).push(['otp',o.email]);return {error:null}},
    verifyOtp:async o=>o.token==='123456'?(cb('SIGNED_IN',{user:{id:'u1'}}),{error:null}):{error:{message:'Token has expired or is invalid'}},
    getUser:async()=>({data:{user:{id:'u1',email:'u1@nit-chat.com'}}}),
    getUserIdentities:async()=>({data:{identities:[{provider:'email',identity_data:{}}]}}),
    linkIdentity:async o=>{(window.__AUTH||=[]).push(['link',o.provider]);return {error:null}},
    unlinkIdentity:async()=>({error:null}),reauthenticate:async()=>({error:null}),
    refreshSession:async()=>(window.__refresh?.()||{data:{session:null},error:{message:'Failed to fetch'}}),getSession:async()=>({data:{session:window.__sess||null}}),setSession:async t=>{const id=(t.refresh_token||'').split(':')[1];if(!id)return {data:{},error:{message:'Invalid Refresh Token'}};const se={user:{id},access_token:t.access_token,refresh_token:t.refresh_token};window.__sess=se;cb('SIGNED_IN',se);return {data:{session:se},error:null}},updateUser:async()=>({error:null}),signInWithPassword:async()=>({error:null}),signUp:async o=>{(window.__AUTH||=[]).push(['signup',o.email,o.options?.data?.username]);return {data:{user:{identities:[{}]},session:null},error:null}}},
  channel(n){const c={on(t,f,h){if(t==='presence')c._p=h;if(t==='broadcast')c._b=h;return c},subscribe(cb){setTimeout(()=>{cb&&cb('SUBSCRIBED');c._p&&c._p()},10);if(n==='nit-live')window.__live=c;return c},track:async()=>{},send(){},presenceState:()=>({u1:[{}],u2:[{}]})};return c},removeAllChannels(){},
  storage:{from:()=>({createSignedUrl:async p=>{(window.__REQ||=[]).push('storage:sign');return {data:{signedUrl:FILES[p]||''}}},createSignedUrls:async ps=>{(window.__REQ||=[]).push('storage:signMany');return {data:ps.map(p=>({path:p,signedUrl:FILES[p]||''}))}},upload:async(p,b)=>{FILES[p]=URL.createObjectURL(b);return {error:null}},remove:async()=>({})})}
}}};
})();
