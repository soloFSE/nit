// Защита входа и регистрации от ботов: капча Cloudflare Turnstile (в Supabase: Authentication → Attack Protection → CAPTCHA).
// Виджет «невидимый»: человеку показывается только если проверка не прошла сама. Токен одноразовый — после каждого запроса получаем новый.
// Если Turnstile не загрузился (заблокирован), запросы уходят без токена, и Supabase сам решает, пускать ли (понятное сообщение — в authErr).
const TURNSTILE_KEY='0x4AAAAAAF_0LyyZUwp0bkXE'; // публичный ключ сайта (секретный ключ хранится только в Supabase)
let capScript=null,capWid=null,capTok='',capFail=false; // capFail — виджет сообщил об ошибке: ждать токен бессмысленно
function capLoad(){
  return capScript||(capScript=new Promise((ok,no)=>{
    const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.async=true;
    s.onload=()=>ok(window.turnstile);s.onerror=()=>{capScript=null;no(new Error('captcha-load'))};document.head.append(s);
    setTimeout(()=>{if(!window.turnstile)no(new Error('captcha-timeout'))},12000);
  }));
}
// Кладёт виджет в конец экрана входа (вызывается при каждой перерисовке экрана)
function capMount(box){
  if(!TURNSTILE_KEY)return;
  try{if(capWid!=null)window.turnstile?.remove(capWid)}catch{}
  capWid=null;capTok='';capFail=false;
  const host=el('div','cap');box.append(host);
  capLoad().then(t=>{
    if(!t||!host.isConnected)return;
    capWid=t.render(host,{sitekey:TURNSTILE_KEY,theme:'auto',language:'ru',appearance:'interaction-only',
      callback:tok=>{capTok=tok;capFail=false},'error-callback':()=>{capTok='';capFail=true},'expired-callback':()=>{capTok=''},'timeout-callback':()=>{capTok=''}});
  }).catch(()=>{});
}
// Токен для одного запроса. Ждём не дольше 20 секунд; нет виджета — возвращаем undefined (запрос уйдёт без токена)
async function capToken(){
  if(!TURNSTILE_KEY)return undefined;
  const t0=Date.now();
  while(!capTok&&!capFail&&Date.now()-t0<20000){
    if(capScript==null&&capWid==null&&Date.now()-t0>1500)break; // скрипт не загрузился — не ждём напрасно
    await new Promise(r=>setTimeout(r,150));
  }
  const tok=capTok;capTok='';
  try{if(capWid!=null)window.turnstile?.reset(capWid)}catch{}
  return tok||undefined;
}
// Экран входа мог нарисоваться раньше, чем загрузился этот файл — дорисовываем виджет капчи
try{if(typeof renderAuth==='function'&&document.getElementById('authBody')&&document.getElementById('authBody').children.length)renderAuth()}catch(e){}
