// Настройки Supabase и общее состояние приложения
const SUPABASE_URL='https://lojlwcsqbbthmpetmbmq.supabase.co';
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
  sb=supabase.createClient(SUPABASE_URL.trim(),SUPABASE_KEY.trim(),{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'}});
}catch(e){setupErr='Ошибка настройки: '+e.message;$('aerr').textContent=setupErr}
