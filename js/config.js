// Настройки Supabase и общее состояние приложения
// Два пути до сервера: напрямую и через посредника (Cloudflare Worker, tools/cloudflare-worker.js) —
// для России, где адреса *.supabase.co блокируются. Работающий путь запоминается, см. probeRoute ниже.
const SUPA_DIRECT='https://lojlwcsqbbthmpetmbmq.supabase.co';
const SUPA_PROXY='https://nit-proxy.mreldar-work.workers.dev'; // посредник (tools/cloudflare-worker.js)
let ROUTE='direct';try{ROUTE=(localStorage.getItem('nit-route')==='proxy'&&SUPA_PROXY)?'proxy':'direct'}catch{}
const SUPABASE_URL=ROUTE==='proxy'?SUPA_PROXY:SUPA_DIRECT;
const FAKE_DOMAIN='nit-chat.com'; // служебный суффикс, почта не используется
const SUPABASE_KEY='sb_publishable_I6_9GkOyKCJc6WnsjY9nQg_RFuL-oUY';
const $=id=>document.getElementById(id);
// Иконка из набора <symbol> в index.html
const svgI=id=>{const s=document.createElementNS('http://www.w3.org/2000/svg','svg');const u=document.createElementNS('http://www.w3.org/2000/svg','use');u.setAttribute('href','#'+id);s.append(u);return s};
let sb,me=null,myName='',people={},fr=[],cur=null,seen=new Set(),unread={},reg=false,lastId=0,poll=null,tc=0,lastDel='1970-01-01T00:00:00Z',hidden=new Set(),nodes={},msgs={},sig={};

let setupErr='';
try{
  if(SUPABASE_URL.startsWith('ВСТАВЬТЕ')||SUPABASE_KEY.startsWith('ВСТАВЬТЕ'))throw new Error('В начале скрипта не заменены адрес проекта и ключ.');
  if(typeof supabase==='undefined')throw new Error('Не загрузилась библиотека Supabase. Проверьте интернет или отключите блокировщик рекламы.');
  // Вход хранится в браузере (localStorage) и сам продлевается — заходить заново не нужно, пока не нажмёте «Выйти»
  sb=supabase.createClient(SUPABASE_URL.trim(),SUPABASE_KEY.trim(),{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit',
    storageKey:'sb-lojlwcsqbbthmpetmbmq-auth-token'}}); // одно имя для обоих путей — при смене пути вход не теряется
}catch(e){setupErr='Ошибка настройки: '+e.message;$('aerr').textContent=setupErr}

// ---------- Какой путь до сервера работает ----------
// Если напрямую не отвечает, а посредник отвечает — переключаемся на него (и обратно, когда снова можно).
async function probeRoute(){
  if(!SUPA_PROXY)return;
  const ok=async u=>{try{const c=new AbortController(),t=setTimeout(()=>c.abort(),5000);
    const r=await fetch(u,{signal:c.signal,cache:'no-store',headers:{apikey:SUPABASE_KEY}});clearTimeout(t);return r.status<500}catch{return false}};
  const direct=await ok(SUPA_DIRECT+'/auth/v1/health');
  const want=direct?'direct':(await ok(SUPA_PROXY+'/__nit'))?'proxy':null;
  if(!want||want===ROUTE)return;
  try{
    const last=+localStorage.getItem('nit-route-t')||0;if(Date.now()-last<60000)return; // не чаще раза в минуту — без бесконечных перезагрузок
    localStorage.setItem('nit-route',want);localStorage.setItem('nit-route-t',Date.now());
  }catch{return}
  location.reload();
}
setTimeout(probeRoute,300);
