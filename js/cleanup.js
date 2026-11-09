// Очистка переписки и удаление аккаунта (supabase/v10.sql).
//  • «Очистить у меня» — скрывает все сообщения чата только у вас (без SQL, через message_hides);
//  • «Удалить мои сообщения у всех» (личка) и «Очистить для всех» (группа, только админы) — через функции базы;
//  • «Удалить аккаунт» — безвозвратно: профиль, друзья, подарки, узелки и сообщения.
const clearErr=e=>/function|schema cache|does not exist/i.test(e?.message||'')?'Запустите supabase/v10.sql в Supabase':(e?.message||String(e));
const clearName=k=>isGroupKey(k)?(groups[k.slice(2)]?.name||'группа'):nameOf(k);

function openClearMenu(k){
  const grp=isGroupKey(k),gid=grp?k.slice(2):null;
  openModal(s=>{
    const top=el('div','sheet-top');top.append(el('h3',null,'Очистить: '+clearName(k)));const x=el('button','icon');x.append(svgI('i-x'));x.onclick=closeModal;top.append(x);s.append(top);
    const opt=(t,d,f,cls)=>{const r=giRow('i-trash',t,d,cls||'gi-mem');r.onclick=()=>{closeModal();f()};s.append(r)};
    opt('Очистить у меня','Сообщения исчезнут только у вас, у остальных всё останется',()=>clearChatMe(k));
    if(grp){if(typeof isAdminOf==='function'&&isAdminOf(gid))opt('Очистить для всех','Вся переписка группы удалится у всех участников (только админы)',()=>clearGroupAll(gid),'gi-danger')}
    else opt('Удалить мои сообщения у всех','Ваши сообщения исчезнут и у собеседника; его сообщения останутся',()=>clearMineAll(k),'gi-danger');
  });
}
async function clearChatMe(k){
  const name=clearName(k);
  if(!confirm('Очистить переписку «'+name+'» у себя? У остальных все сообщения останутся.'))return;
  toast('Очищаю…');
  let ids=[],from=0;
  for(;;){
    let q=sb.from('messages').select('id');
    q=isGroupKey(k)?q.eq('group_id',k.slice(2)):q.or(`and(sender.eq.${me},recipient.eq.${k}),and(sender.eq.${k},recipient.eq.${me})`);
    const {data,error}=await q.order('id').range(from,from+999);
    if(error){toast('Не удалось: '+clearErr(error));return}
    ids.push(...data.map(m=>m.id));if(data.length<1000)break;from+=1000;
  }
  ids=ids.filter(id=>!hidden.has(id));
  for(let i=0;i<ids.length;i+=400){
    const part=ids.slice(i,i+400),{error}=await sb.from('message_hides').insert(part.map(message_id=>({message_id})));
    if(error){toast('Не удалось: '+clearErr(error));return}
    part.forEach(id=>hidden.add(id));
  }
  if(cur===k){$('log').innerHTML='';nodes={};await openChat(k)}
  try{await loadLast?.()}catch{}try{renderChats?.()}catch{}
  toast('Переписка очищена у вас');
}
async function clearMineAll(peer){
  if(!confirm('Удалить все ваши сообщения в чате с «'+nameOf(peer)+'» у обоих? Это нельзя отменить.'))return;
  const {data,error}=await sb.rpc('clear_my_messages',{peer});
  if(error){toast('Не удалось: '+clearErr(error));return}
  if(cur===peer){$('log').innerHTML='';nodes={};await openChat(peer)}
  toast('Удалено ваших сообщений: '+(data||0));
}
async function clearGroupAll(gid){
  if(!confirm('Очистить всю переписку группы «'+(groups[gid]?.name||'')+'» у ВСЕХ участников? Это нельзя отменить.'))return;
  const {data,error}=await sb.rpc('clear_group',{gid});
  if(error){toast('Не удалось: '+clearErr(error));return}
  if(cur==='g:'+gid){$('log').innerHTML='';nodes={};await openChat(cur)}
  toast('Группа очищена: '+(data||0)+' сообщ.');
}

// ---------- Удаление аккаунта ----------
function openDeleteAccount(){
  openModal(s=>{
    const top=el('div','sheet-top');top.append(el('h3',null,'Удалить аккаунт'));const x=el('button','icon');x.append(svgI('i-x'));x.onclick=closeModal;top.append(x);s.append(top);
    s.append(el('p','gf-how','Аккаунт @'+myName+' удалится навсегда: профиль, друзья, подарки, узелки, Премиум и все ваши сообщения. Вернуть это нельзя. Группы, где вы создатель, перейдут другим участникам.'));
    const inp=document.createElement('input');inp.placeholder='Введите свой ник «'+myName+'» для подтверждения';inp.autocomplete='off';inp.autocapitalize='none';s.append(inp);
    const err=el('p','err');const go=el('button','primary wide danger','Удалить аккаунт навсегда');go.disabled=true;
    inp.oninput=()=>{go.disabled=inp.value.trim().replace(/^@/,'').toLowerCase()!==String(myName).toLowerCase()};
    go.onclick=async()=>{
      go.disabled=true;go.textContent='Удаляю…';
      const {error}=await sb.rpc('delete_my_account');
      if(error){err.textContent=clearErr(error);go.disabled=false;go.textContent='Удалить аккаунт навсегда';return}
      byUser=true;try{await sb.auth.signOut()}catch{}
      try{Object.keys(localStorage).filter(k=>/^sb-.+-auth-token$/.test(k)||k.startsWith('nit-')).forEach(k=>localStorage.removeItem(k))}catch{}
      closeModal();toast('Аккаунт удалён');setTimeout(()=>location.reload(),900);
    };
    s.append(err,go);
  });
}
