// Несколько аккаунтов на одном устройстве и быстрое переключение без выхода.
// Для каждого аккаунта храним его вход (токены Supabase) в localStorage 'nit-accounts'.
// Токены обновляются при каждом событии входа, поэтому сохранённый вход не «протухает».
// Переключение — sb.auth.setSession(); «Добавить аккаунт» — убираем текущий вход из браузера
// БЕЗ выхода на сервере (он остаётся действительным) и показываем экран входа.
const ACC_KEY='nit-accounts';
const sbKey=()=>Object.keys(localStorage).find(k=>/^sb-.+-auth-token$/.test(k))||('sb-'+new URL(SUPABASE_URL).hostname.split('.')[0]+'-auth-token');
function accList(){try{return JSON.parse(localStorage.getItem(ACC_KEY)||'{}')||{}}catch{return {}}}
function accSave(l){try{localStorage.setItem(ACC_KEY,JSON.stringify(l))}catch{}}
function rememberAccount(s){
  if(!s?.user||!s.refresh_token)return;const l=accList(),id=s.user.id;
  l[id]={...(l[id]||{}),id,at:s.access_token,rt:s.refresh_token,email:s.user.email,t:Date.now()};accSave(l);
}
function rememberProfile(){
  if(!me)return;const l=accList();if(!l[me])return;
  l[me].nick=myName;l[me].name=nameOf(me);l[me].ava=prof[me]?.avatar_path||null;accSave(l);
}
function forgetAccount(id){const l=accList();delete l[id];accSave(l)}
function accAvatar(a,size){
  const s=el('span','ava');s.style.setProperty('--s',size+'px');s.style.setProperty('--h',hue(a.id));
  if(a.ava){const i=document.createElement('img');i.src=avatarUrl(a.ava);i.alt='';s.append(i)}else s.textContent=((a.name||a.nick||'?')[0]||'?').toUpperCase();
  return s;
}

async function switchAccount(id){
  const t=accList()[id];if(!t||id===me)return;
  const {data}=await sb.auth.getSession().catch(()=>({data:{}}));rememberAccount(data?.session);
  const prev=data?.session;
  closeSettings?.();closeModal();
  if(me)unboot();showSplash('Переключаю на @'+(t.nick||'аккаунт')+'…');
  const {error}=await sb.auth.setSession({access_token:t.at,refresh_token:t.rt});
  if(error){
    forgetAccount(id);toast('Вход в @'+(t.nick||'аккаунт')+' устарел — войдите в него заново');
    if(prev)await sb.auth.setSession({access_token:prev.access_token,refresh_token:prev.refresh_token}).catch(()=>{});
    else{hideSplash();unboot();renderAuth()}
  }
}
async function addAccount(){
  const {data}=await sb.auth.getSession().catch(()=>({data:{}}));rememberAccount(data?.session);rememberProfile();
  try{localStorage.removeItem(sbKey())}catch{}
  location.reload();
}

// Раздел «Аккаунты» в настройках
function accountsSection(box){
  const l=accList();const ids=Object.keys(l).sort((a,b)=>(a===me?-1:b===me?1:(l[b].t||0)-(l[a].t||0)));
  ids.forEach(id=>{
    const a=l[id],r=el('div','acc-row'+(id===me?' on':''));
    r.append(accAvatar(a,40));const t=el('div','gi-rt');t.append(el('b',null,a.name||a.nick||'Аккаунт'),el('small',null,'@'+(a.nick||'?')+(id===me?' · сейчас':'')));r.append(t);
    if(id===me){const ck=el('span','acc-ck');ck.append(svgI('i-check'));r.append(ck)}
    else{
      const x=el('button','icon sm-btn');x.append(svgI('i-x'));x.title='Убрать с этого устройства';
      x.onclick=e=>{e.stopPropagation();if(confirm('Убрать @'+(a.nick||'аккаунт')+' с этого устройства?')){forgetAccount(id);refreshSettings()}};r.append(x);
      r.onclick=()=>switchAccount(id);
    }
    box.append(r);
  });
  const add=giRow('i-plus','Добавить аккаунт',null,'gi-accent');add.onclick=()=>{if(confirm('Откроется экран входа. Текущий аккаунт останется — переключиться обратно можно здесь же.'))addAccount()};
  box.append(add);
}
// На экране входа — «Продолжить как …» для сохранённых аккаунтов
function accountsOnAuth(box){
  const l=accList(),ids=Object.keys(l).filter(id=>l[id].rt).sort((a,b)=>(l[b].t||0)-(l[a].t||0));if(!ids.length)return;
  const w=el('div','acc-auth');w.append(el('div','acc-auth-h','Сохранённые аккаунты'));
  ids.slice(0,4).forEach(id=>{const a=l[id],b=el('button','acc-pick');b.type='button';
    b.append(accAvatar(a,36));const t=el('span','acc-pick-t');t.append(el('b',null,'Продолжить как '+(a.name||a.nick||'аккаунт')),el('small',null,'@'+(a.nick||'?')));b.append(t);
    b.onclick=()=>switchAccount(id);w.append(b)});
  box.prepend(w);
}
if(!me&&typeof renderAuth==='function')renderAuth();
