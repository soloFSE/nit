// Группы: список, создание, участники
// Ключ чата группы в cur/unread — 'g:'+id, у личного чата — id друга.
let groups={},gm={},grSeq=0,grSig='';
const isGroupKey=k=>typeof k==='string'&&k.startsWith('g:');
const gidOf=k=>k.slice(2);
// Ключ чата, к которому относится сообщение
const chatKey=m=>m.group_id?'g:'+m.group_id:(m.sender===me?m.recipient:m.sender);
// Поля «кому» для вставки сообщения
const target=k=>isGroupKey(k)?{group_id:gidOf(k)}:{recipient:k};
const chatName=k=>isGroupKey(k)?(groups[gidOf(k)]?.name||'Группа'):nameOf(k);

async function loadGroups(){
  const seq=++grSeq;
  const {data:mine,error}=await sb.from('group_members').select('group_id').eq('user_id',me);
  if(seq!==grSeq||error)return;
  const ids=(mine||[]).map(x=>x.group_id);
  let gs=[],ms=[];
  if(ids.length){
    const [a,b]=await Promise.all([
      sb.from('groups').select('*').in('id',ids),
      sb.from('group_members').select('group_id,user_id').in('group_id',ids)
    ]);
    if(seq!==grSeq||a.error||b.error)return;
    gs=a.data||[];ms=b.data||[];
  }
  await loadProfiles(ms.map(x=>x.user_id));
  if(seq!==grSeq)return;
  const s=JSON.stringify([gs.map(g=>[g.id,g.name]).sort(),ms.map(x=>x.group_id+x.user_id).sort()]);
  if(s===grSig)return;
  grSig=s;groups={};gm={};
  gs.forEach(g=>{groups[g.id]=g;gm[g.id]=[]});
  ms.forEach(x=>gm[x.group_id]?.push(x.user_id));
  // Меня убрали из открытой группы — закрываем её
  if(isGroupKey(cur)&&!groups[gidOf(cur)])closeChat();
  else if(isGroupKey(cur)){setHead(cur);if(!$('gpanel').classList.contains('hide'))renderPanel()}
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
  groups[data.id]=data;gm[data.id]=[me];grSig='';renderGroups();
  showTab(true);await openChat('g:'+data.id);showPanel(true);loadGroups();
};
$('gname').onkeydown=e=>{if(e.key==='Enter')$('gnew').click()};

// Панель участников открытой группы
function showPanel(on){$('gpanel').classList.toggle('hide',!on);if(on)renderPanel()}
$('gmem').onclick=()=>showPanel($('gpanel').classList.contains('hide'));

// Аватарка группы: фото или первая буква
function groupAvatar(g,size){
  const v=avatar(g?.id||'g',size,g?.name||'#');v.classList.add('sq');
  if(g?.avatar_path){v.textContent='';const i=document.createElement('img');i.alt='';i.src=avatarUrl(g.avatar_path);v.append(i)}
  return v;
}
// Панель группы: фото, название, описание, участники
function renderPanel(){
  if(!isGroupKey(cur))return;
  const gid=gidOf(cur),g=groups[gid];if(!g)return;
  const owner=g.owner===me,box=$('gpanel');box.innerHTML='';
  const info=el('div','ginfo');
  const av=el('div','ginfo-ava');av.append(groupAvatar(g,72));info.append(av);
  const txt=el('div','ginfo-t');txt.append(el('b',null,g.name));
  if(g.description)txt.append(el('p','sm',g.description));
  info.append(txt);box.append(info);
  if(owner){
    const ed=el('button','ghost sm-btn','Изменить группу');ed.onclick=()=>editGroup(g);info.append(ed);
  }
  const h=el('h2',null,'Участники · '+(gm[gid]||[]).length);box.append(h);
  (gm[gid]||[]).slice().sort((a,b)=>(b===g.owner)-(a===g.owner)||nameOf(a).localeCompare(nameOf(b))).forEach(id=>{
    let x=null;
    if(owner&&id!==me){
      x=el('span','row-acts');
      const t=el('button','ghost sm-btn','★');t.title='Сделать создателем';t.onclick=e=>{e.stopPropagation();transferGroup(gid,id)};
      const r=el('button','ghost sm-btn','убрать');r.onclick=e=>{e.stopPropagation();removeMember(gid,id,r)};x.append(t,r);
    }
    const r=row(avatar(id,34),nameOf(id)+(id===me?' (вы)':''),id===g.owner?'★ создатель':online.has(id)?'в сети':'@'+(people[id]||'?'),x);
    r.onclick=()=>id!==me&&showProfile(id);box.append(r);
  });
  // Добавить можно только друзей, которых ещё нет в группе
  const friends=fr.filter(f=>f.status==='accepted').map(f=>f.a===me?f.b:f.a).filter(id=>!(gm[gid]||[]).includes(id));
  const add=el('div','field');add.style.marginTop='8px';
  if(friends.length){
    const sel=document.createElement('select');sel.id='gsel';
    friends.forEach(id=>{const o=document.createElement('option');o.value=id;o.textContent=nameOf(id);sel.append(o)});
    const b=el('button','primary','Добавить');
    b.onclick=()=>addMember(gid,sel.value,b);
    add.append(sel,b);
  }else add.append(el('p','sm','Все ваши друзья уже в группе.'));
  box.append(add);
  const e=el('p','err');e.id='gperr';box.append(e);
  const out=el('button','ghost danger wide','Выйти из группы');out.style.marginTop='6px';
  out.onclick=()=>leaveGroup(gid,out);box.append(out);
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
        groups[g.id]=data;grSig='';renderGroups();setHead(cur);renderPanel();closeModal();
      }catch(e){err.textContent='Не удалось: '+(/column/i.test(e.message)?'запустите supabase/more.sql':e.message);sv.disabled=false}
    };
  });
}
async function transferGroup(gid,uid){
  if(!confirm('Передать права создателя участнику '+nameOf(uid)+'? Вы останетесь обычным участником.'))return;
  const {error}=await sb.rpc('transfer_group',{gid,uid});
  if(error){alert('Не удалось: '+(/function|schema cache/i.test(error.message)?'запустите supabase/more.sql':error.message));return}
  groups[gid].owner=uid;grSig='';renderPanel();loadGroups();toast('Права переданы');
}

async function addMember(gid,uid,b){
  if(!uid)return;b.disabled=true;$('gperr').textContent='';
  const {error}=await sb.from('group_members').insert({group_id:gid,user_id:uid});
  b.disabled=false;
  if(error){$('gperr').textContent='Не удалось добавить: '+error.message;return}
  gm[gid].push(uid);grSig='';renderPanel();renderGroups();loadGroups();
}
async function removeMember(gid,uid,b){
  if(!confirm('Убрать '+nameOf(uid)+' из группы?'))return;
  b.disabled=true;
  const {data,error}=await sb.from('group_members').delete().eq('group_id',gid).eq('user_id',uid).select();
  if(error||!data?.length){b.disabled=false;$('gperr').textContent='Не удалось убрать'+(error?': '+error.message:'');return}
  gm[gid]=gm[gid].filter(x=>x!==uid);grSig='';renderPanel();renderGroups();
}
async function leaveGroup(gid,b){
  const g=groups[gid],last=(gm[gid]||[]).length<=1;
  if(!confirm(last?'Вы последний участник. Группа и вся её переписка удалятся. Выйти?':'Выйти из группы «'+g.name+'»?'))return;
  b.disabled=true;
  // Последний участник-создатель удаляет группу целиком, чтобы не оставалось пустых групп
  const q=last&&g.owner===me
    ?sb.from('groups').delete().eq('id',gid).select()
    :sb.from('group_members').delete().eq('group_id',gid).eq('user_id',me).select();
  const {data,error}=await q;
  if(error||!data?.length){b.disabled=false;$('gperr').textContent='Не удалось выйти'+(error?': '+error.message:'');return}
  delete groups[gid];delete gm[gid];grSig='';closeChat();renderGroups();
}
