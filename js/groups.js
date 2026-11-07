// Группы: список, создание, участники, роли (создатель / админ / участник)
// Ключ чата группы в cur/unread — 'g:'+id, у личного чата — id друга.
let groups={},gm={},grole={},grSeq=0,grSig='',roleCols=true;
const isGroupKey=k=>typeof k==='string'&&k.startsWith('g:');
const gidOf=k=>k.slice(2);
// Ключ чата, к которому относится сообщение
const chatKey=m=>m.group_id?'g:'+m.group_id:(m.sender===me?m.recipient:m.sender);
// Поля «кому» для вставки сообщения
const target=k=>isGroupKey(k)?{group_id:gidOf(k)}:{recipient:k};
const chatName=k=>isGroupKey(k)?(groups[gidOf(k)]?.name||'Группа'):nameOf(k);

// ---------- Роли и права ----------
// owner — создатель (всегда админ), admin — назначенный админ, member — обычный участник
const roleOf=(gid,u)=>groups[gid]?.owner===u?'owner':grole[gid]?.[u]==='admin'?'admin':'member';
const isAdminOf=(gid,u=me)=>roleOf(gid,u)!=='member';
// what: 'edit' — менять данные группы, 'send' — писать, 'add' — добавлять участников
const canDo=(gid,what)=>isAdminOf(gid)||!groups[gid]?.['only_admins_'+what];

async function loadGroups(){
  const seq=++grSeq;
  const {data:mine,error}=await sb.from('group_members').select('group_id').eq('user_id',me);
  if(seq!==grSeq||error)return;
  const ids=(mine||[]).map(x=>x.group_id);
  let gs=[],ms=[];
  if(ids.length){
    // Колонки role может ещё не быть (не запущен admins.sql) — тогда без неё
    const mq=()=>sb.from('group_members').select(roleCols?'group_id,user_id,role':'group_id,user_id').in('group_id',ids);
    let [a,b]=await Promise.all([sb.from('groups').select('*').in('id',ids),mq()]);
    if(b.error&&roleCols&&/role/i.test(b.error.message)){roleCols=false;b=await mq()}
    if(seq!==grSeq||a.error||b.error)return;
    gs=a.data||[];ms=b.data||[];
  }
  await loadProfiles(ms.map(x=>x.user_id));
  if(seq!==grSeq)return;
  const s=JSON.stringify([gs.map(g=>JSON.stringify(g)).sort(),ms.map(x=>x.group_id+x.user_id+(x.role||'')).sort()]);
  if(s===grSig)return;
  grSig=s;groups={};gm={};grole={};
  gs.forEach(g=>{groups[g.id]=g;gm[g.id]=[];grole[g.id]={}});
  ms.forEach(x=>{gm[x.group_id]?.push(x.user_id);if(grole[x.group_id])grole[x.group_id][x.user_id]=x.role||'member'});
  // Меня убрали из открытой группы — закрываем её
  if(isGroupKey(cur)&&!groups[gidOf(cur)]){closeGroupInfo();closeChat()}
  else if(isGroupKey(cur)){setHead(cur);applyBlockUI()}
  refreshGroupInfo();
  renderGroups();
}

function renderGroups(){
  const list=$('glist');list.innerHTML='';
  const gs=Object.values(groups).sort((a,b)=>a.name.localeCompare(b.name));
  if(gs.length)list.append(el('h2',null,'Группы · '+gs.length));
  gs.forEach(g=>{
    const k='g:'+g.id,n=(gm[g.id]||[]).length;
    const sub=hasDraft(k)&&cur!==k?'✏️ черновик':g.description||n+' '+plural(n,'участник','участника','участников');
    const r=row(groupAvatar(g,40),g.name,sub,badge(k),cur===k);
    r.onclick=()=>openChat(k);list.append(r);
  });
  if(!gs.length)list.innerHTML='<div class="hint">Групп пока нет.<br>Придумайте название и нажмите +.</div>';
  $('tabG').classList.toggle('has',Object.keys(unread).some(k=>unread[k]&&isGroupKey(k)));
  if(typeof scheduleChats==='function')scheduleChats();
}
const plural=(n,a,b,c)=>{const m=n%10,h=n%100;return m===1&&h!==11?a:m>=2&&m<=4&&(h<12||h>14)?b:c};

$('gnew').onclick=async()=>{
  const name=$('gname').value.trim();$('gerr').textContent='';
  if(!name){$('gerr').textContent='Введите название';return}
  if(name.length>40){$('gerr').textContent='Не длиннее 40 символов';return}
  $('gnew').disabled=true;
  const {data,error}=await sb.from('groups').insert({name,owner:me}).select().single();
  $('gnew').disabled=false;
  if(error){$('gerr').textContent='Не удалось создать: '+error.message;return}
  $('gname').value='';
  groups[data.id]=data;gm[data.id]=[me];grole[data.id]={[me]:'member'};grSig='';renderGroups();
  toggleNew(false);await openChat('g:'+data.id);openGroupInfo(data.id);openAddMembers(data.id);loadGroups();
};
$('gname').onkeydown=e=>{if(e.key==='Enter')$('gnew').click()};

// Аватарка группы: фото или первая буква
function groupAvatar(g,size){
  const v=avatar(g?.id||'g',size,g?.name||'#');v.classList.add('sq');
  if(g?.avatar_path){v.textContent='';const i=document.createElement('img');i.alt='';i.src=avatarUrl(g.avatar_path);v.append(i)}
  return v;
}

// ---------- Действия с участниками ----------
const sqlHint=e=>/function|schema cache|column|role/i.test(e?.message||'')?'запустите supabase/admins.sql':(e?.message||e);
async function addMembers(gid,ids){
  if(!ids.length)return true;
  const {error}=await sb.from('group_members').insert(ids.map(u=>({group_id:gid,user_id:u})));
  if(error){toast('Не удалось добавить: '+error.message);return false}
  ids.forEach(u=>{if(!gm[gid].includes(u))gm[gid].push(u);grole[gid][u]='member'});
  grSig='';renderGroups();refreshGroupInfo();
  for(const u of ids)await gevSend(gid,'add',u);
  loadGroups();return true;
}
async function removeMember(gid,uid){
  if(!confirm('Удалить '+nameOf(uid)+' из группы?'))return;
  const {data,error}=await sb.from('group_members').delete().eq('group_id',gid).eq('user_id',uid).select();
  if(error||!data?.length){toast('Не удалось удалить'+(error?': '+error.message:''));return}
  gm[gid]=gm[gid].filter(x=>x!==uid);grSig='';renderGroups();refreshGroupInfo();gevSend(gid,'kick',uid);
}
async function setRole(gid,uid,role){
  const {error}=await sb.rpc('set_group_role',{gid,uid,new_role:role});
  if(error){toast('Не удалось: '+sqlHint(error));return}
  grole[gid][uid]=role;grSig='';refreshGroupInfo();gevSend(gid,role==='admin'?'admin':'unadmin',uid);
  toast(role==='admin'?nameOf(uid)+' теперь админ':nameOf(uid)+' больше не админ');
}
async function transferGroup(gid,uid){
  if(!confirm('Передать права создателя участнику '+nameOf(uid)+'? Вы останетесь админом.'))return;
  const {error}=await sb.rpc('transfer_group',{gid,uid});
  if(error){toast('Не удалось: '+sqlHint(error));return}
  groups[gid].owner=uid;grole[gid][me]='admin';grSig='';refreshGroupInfo();gevSend(gid,'owner',uid);loadGroups();toast('Права переданы');
}
async function leaveGroup(gid){
  const g=groups[gid],last=(gm[gid]||[]).length<=1;
  if(!confirm(last?'Вы последний участник. Группа и вся её переписка удалятся. Выйти?':'Выйти из группы «'+g.name+'»?'))return;
  if(!last)await gevSend(gid,'left');
  // Последний участник-создатель удаляет группу целиком, чтобы не оставалось пустых групп
  const q=last&&g.owner===me
    ?sb.from('groups').delete().eq('id',gid).select()
    :sb.from('group_members').delete().eq('group_id',gid).eq('user_id',me).select();
  const {data,error}=await q;
  if(error||!data?.length){toast('Не удалось выйти'+(error?': '+error.message:''));return}
  delete groups[gid];delete gm[gid];grSig='';closeGroupInfo();closeChat();renderGroups();
}
async function deleteGroup(gid){
  const g=groups[gid];
  if(!confirm('Удалить группу «'+g.name+'» у всех участников вместе со всей перепиской? Это нельзя отменить.'))return;
  const {data,error}=await sb.from('groups').delete().eq('id',gid).select();
  if(error||!data?.length){toast('Не удалось удалить группу'+(error?': '+error.message:''));return}
  delete groups[gid];delete gm[gid];grSig='';closeGroupInfo();closeChat();renderGroups();toast('Группа удалена');
}
// Настройки группы: что разрешено только админам
async function setGroupFlag(gid,what,on){
  const {data,error}=await sb.from('groups').update({['only_admins_'+what]:on}).eq('id',gid).select().single();
  if(error){toast('Не удалось: '+sqlHint(error));return false}
  groups[gid]=data;grSig='';refreshGroupInfo();if(cur==='g:'+gid)applyBlockUI();
  gevSend(gid,what+(on?1:0));return true;
}

function editGroup(g){
  let newAva=null;
  openModal(s=>{
    const top=el('div','sheet-top');top.append(el('h3',null,'Группа'));const x=el('button','icon','✕');x.onclick=closeModal;top.append(x);s.append(top);
    const ava=el('div','ava-edit');const holder=el('div');holder.append(groupAvatar(g,96));ava.append(holder);
    const pick=el('button','ghost','Сменить фото');const f=document.createElement('input');f.type='file';f.accept='image/*';f.hidden=true;
    pick.onclick=()=>f.click();
    f.onchange=async()=>{const file=f.files[0];f.value='';if(!file)return;newAva=await squareJpeg(file,320);
      const sp=el('span','ava sq');sp.style.setProperty('--s','96px');const i=document.createElement('img');i.src=URL.createObjectURL(newAva);sp.append(i);holder.innerHTML='';holder.append(sp)};
    const bt=el('div','ava-btns');bt.append(pick,f);ava.append(bt);s.append(ava);
    const nl=el('label','fld');nl.append(el('span',null,'Название'));const ni=document.createElement('input');ni.maxLength=40;ni.value=g.name;nl.append(ni);s.append(nl);
    const dl=el('label','fld');dl.append(el('span',null,'Описание'));const di=document.createElement('textarea');di.maxLength=200;di.rows=3;di.value=g.description||'';di.placeholder='О чём эта группа';dl.append(di);s.append(dl);
    const err=el('p','err');s.append(err);
    const sv=el('button','primary wide','Сохранить');s.append(sv);
    sv.onclick=async()=>{
      const name=ni.value.trim();if(!name){err.textContent='Введите название';return}
      sv.disabled=true;err.textContent='';
      try{
        const patch={name};
        if('description' in g||di.value.trim())patch.description=di.value.trim()||null;
        if(newAva){const path=me+'/g_'+crypto.randomUUID()+'.jpg';const up=await sb.storage.from('avatars').upload(path,newAva,{contentType:'image/jpeg'});if(up.error)throw up.error;patch.avatar_path=path}
        const {data,error}=await sb.from('groups').update(patch).eq('id',g.id).select().single();
        if(error)throw error;
        groups[g.id]=data;grSig='';renderGroups();if(cur==='g:'+g.id)setHead(cur);refreshGroupInfo();closeModal();
      }catch(e){err.textContent='Не удалось: '+(/column/i.test(e.message)?'запустите supabase/more.sql':e.message);sv.disabled=false}
    };
  });
}
