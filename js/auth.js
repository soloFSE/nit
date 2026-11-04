// Вход, регистрация и выход
function mode(r){reg=r;$('go').textContent=r?'Создать аккаунт':'Войти';
  $('tL').className=r?'g':'';$('tR').className=r?'':'g';$('aerr').textContent=''}
$('tL').onclick=()=>mode(false);$('tR').onclick=()=>mode(true);

$('go').onclick=async()=>{
  if(!sb){$('aerr').textContent=setupErr||'Сайт не подключён к Supabase.';return}
  if($('go').disabled)return;
  const t=$('go').textContent;$('go').disabled=true;$('go').textContent=reg?'Создаю…':'Вхожу…';
  try{await doAuth()}catch(e){$('aerr').textContent=authErr(e)}
  finally{$('go').disabled=false;$('go').textContent=t}
};
$('pass').onkeydown=e=>{if(e.key==='Enter')$('go').click()};
// Настоящая причина ошибки вместо «неверный пароль» на всё подряд
function authErr(e){
  const m=(e?.message||String(e||'')).toLowerCase(),st=e?.status;
  if(st===429||/rate limit|too many/.test(m))return 'Слишком много попыток. Подождите пару минут и попробуйте снова.';
  if(/invalid login|invalid credentials/.test(m))return 'Неверный ник или пароль';
  if(/failed to fetch|network|load failed|timeout/.test(m))return 'Нет связи с сервером. Проверьте интернет (или отключите VPN/блокировщик) и попробуйте ещё раз.';
  if(/email not confirmed/.test(m))return 'В Supabase включено подтверждение почты — отключите Confirm email.';
  return 'Ошибка: '+(e?.message||e);
}
async function doAuth(){
  const password=$('pass').value,username=$('user').value.trim().toLowerCase(),email=username+'@'+FAKE_DOMAIN;
  if(!/^[a-z0-9_]{3,20}$/.test(username)){$('aerr').textContent='Ник: 3–20 символов, латиница, цифры, _';return}
  $('aerr').textContent='';
  if(reg){
    const {data,error}=await sb.auth.signUp({email,password,options:{data:{username}}});
    if(error){$('aerr').textContent=/already|database/i.test(error.message)?'Такой ник уже занят':authErr(error);return}
    if(!data.session){$('aerr').textContent='Аккаунт создан, но вход не открылся. В Supabase отключите Confirm email и войдите.';mode(false)}
  }else{
    const {error}=await sb.auth.signInWithPassword({email,password});
    if(error)$('aerr').textContent=authErr(error);
  }
}
$('out').onclick=()=>{byUser=true;sb.auth.signOut()};
