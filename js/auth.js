// Вход и регистрация: почта с подтверждением, Google, GitHub, вход по коду из письма, сброс пароля.
// Старые аккаунты «ник + пароль» (служебная почта ник@FAKE_DOMAIN) продолжают входить по нику.
// Настройка на стороне Supabase описана в docs/AUTH_SETUP.md.
const SITE_URL=location.origin+location.pathname.replace(/index\.html$/,'');
const isFakeEmail=e=>!e||e.endsWith('@'+FAKE_DOMAIN);
let authView='login',authEmail='',resendAt=0;

// ---------- Поля и мелочи ----------
function fld(label,type,ph,extra={}){
  const l=el('label','fld');const h=el('span',null,label);l.append(h);
  const wrap=el('div','fld-in');const i=document.createElement('input');i.type=type;i.placeholder=ph||'';Object.assign(i,extra);wrap.append(i);
  if(type==='password'){const eye=el('button','eye','👁');eye.type='button';eye.title='Показать пароль';
    eye.onclick=()=>{i.type=i.type==='password'?'text':'password';eye.classList.toggle('on',i.type==='text')};wrap.append(eye)}
  l.append(wrap);l.input=i;l.head=h;return l;
}
const aerr=t=>{$('aerr').textContent=t||'';$('aerr').classList.remove('ok')};
const aok=t=>{$('aerr').textContent=t||'';$('aerr').classList.add('ok')};
const emailOk=e=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
// Надёжность пароля: 0–4
function pwScore(p){let s=0;if(p.length>=8)s++;if(p.length>=12)s++;if(/[a-zа-я]/.test(p)&&/[A-ZА-Я]/.test(p))s++;if(/\d/.test(p))s++;if(/[^\w\s]/.test(p))s++;return Math.min(4,s)}
const pwProblem=p=>p.length<8?'Пароль — минимум 8 символов':!/\d/.test(p)||!/[a-zA-Zа-яА-Я]/.test(p)?'В пароле нужны и буквы, и цифры':'';
async function busy(btn,text,f){const t=btn.textContent;btn.disabled=true;btn.textContent=text;try{await f()}catch(e){aerr(authErr(e))}finally{btn.disabled=false;btn.textContent=t}}
function link(t,f){const b=el('button','alink',t);b.type='button';b.onclick=f;return b}

// ---------- Экраны ----------
function showAuth(view){authView=view;aerr('');renderAuth()}
function renderAuth(){
  const box=$('authBody');if(!box)return;box.innerHTML='';box.className='auth-view v-'+authView;
  ({login:viewLogin,register:viewRegister,check:viewCheck,forgot:viewForgot,otp:viewOtp,newpass:viewNewPass})[authView](box);
}
function oauthButtons(box){
  const w=el('div','oauth');
  [['google','Продолжить с Google'],['github','Продолжить с GitHub']].forEach(([p,t])=>{
    const b=el('button','obtn '+p);b.type='button';b.append(svgI('i-'+p),el('span',null,t));
    b.onclick=()=>busy(b,'Перехожу…',async()=>{
      const {error}=await sb.auth.signInWithOAuth({provider:p,options:{redirectTo:SITE_URL}});
      if(error)throw error;
    });
    w.append(b);
  });
  box.append(w,el('div','or',null));box.lastChild.append(el('span',null,'или'));
}
function tabs(box){
  const s=el('div','seg');
  [['login','Вход'],['register','Регистрация']].forEach(([v,t])=>{const b=el('button',authView===v?'':'g',t);b.type='button';b.onclick=()=>showAuth(v);s.append(b)});
  box.append(s);
}

function viewLogin(box){
  if(typeof accountsOnAuth==='function')accountsOnAuth(box);
  oauthButtons(box);tabs(box);
  const u=fld('Почта или ник','text','you@mail.com',{autocomplete:'username',autocapitalize:'none'});
  const p=fld('Пароль','password','••••••••',{autocomplete:'current-password'});
  u.input.value=authEmail;box.append(u,p);
  const go=el('button','primary wide','Войти');box.append(go);
  const enter=e=>{if(e.key==='Enter')go.click()};u.input.onkeydown=enter;p.input.onkeydown=enter;
  go.onclick=()=>busy(go,'Вхожу…',async()=>{
    const id=u.input.value.trim().toLowerCase(),pw=p.input.value;aerr('');
    if(!id||!pw){aerr('Введите почту (или ник) и пароль');return}
    let email=id;
    if(!id.includes('@')){
      if(!/^[a-z0-9_]{3,20}$/.test(id)){aerr('Ник: 3–20 символов, латиница, цифры, _');return}
      email=id+'@'+FAKE_DOMAIN;
    }
    authEmail=id.includes('@')?id:'';
    const {error}=await sb.auth.signInWithPassword({email,password:pw});
    if(!error)return;
    if(/not confirmed/i.test(error.message)){authEmail=email;showAuth('check');aerr('Почта ещё не подтверждена. Откройте письмо или отправьте его снова.');return}
    if(/invalid login|invalid credentials/i.test(error.message)&&!id.includes('@')){aerr('Неверный ник или пароль. Если регистрировались по почте — введите почту.');return}
    throw error;
  });
  const links=el('div','alinks');
  links.append(link('Забыли пароль?',()=>{authEmail=u.input.value.includes('@')?u.input.value.trim():authEmail;showAuth('forgot')}),
    link('Войти по коду из письма',()=>{authEmail=u.input.value.includes('@')?u.input.value.trim():authEmail;showAuth('otp')}));
  box.append(links);
  setTimeout(()=>u.input.focus(),50);
}

function viewRegister(box){
  oauthButtons(box);tabs(box);
  const e=fld('Почта','email','you@mail.com',{autocomplete:'email',autocapitalize:'none'});
  const n=fld('Ник','text','латиница, цифры, _',{autocomplete:'off',autocapitalize:'none',maxLength:20});
  const p=fld('Пароль','password','минимум 8 символов, буквы и цифры',{autocomplete:'new-password'});
  const p2=fld('Повторите пароль','password','ещё раз',{autocomplete:'new-password'});
  e.input.value=authEmail;
  const nickSt=el('small','nick-st');n.head.append(nickSt);
  const meter=el('div','pwm');meter.append(el('i'),el('i'),el('i'),el('i'));const mt=el('small','pwm-t');p.append(meter,mt);
  const agree=el('label','check');const ck=document.createElement('input');ck.type='checkbox';
  agree.append(ck,document.createTextNode(' Мне есть 13 лет, и я не буду рассылать спам и оскорблять людей'));
  const go=el('button','primary wide','Создать аккаунт');
  box.append(e,n,p,p2,agree,go);
  // Проверка ника «на лету»
  let nt=0,nickFree=null;
  n.input.oninput=()=>{
    const v=n.input.value=n.input.value.toLowerCase().replace(/[^a-z0-9_]/g,'');nickFree=null;nickSt.className='nick-st';nickSt.textContent='';
    clearTimeout(nt);if(v.length<3)return;
    nt=setTimeout(async()=>{const {data,error}=await sb.rpc('username_free',{u:v});if(n.input.value!==v||error)return;
      nickFree=!!data;nickSt.textContent=data?'✓ свободен':'✕ занят';nickSt.classList.add(data?'ok':'bad')},350);
  };
  p.input.oninput=()=>{const s=p.input.value?pwScore(p.input.value):0;meter.dataset.s=s;
    mt.textContent=p.input.value?['Очень слабый','Слабый','Средний','Хороший','Надёжный'][s]:''};
  go.onclick=()=>busy(go,'Создаю…',async()=>{
    const email=e.input.value.trim().toLowerCase(),username=n.input.value.trim(),pw=p.input.value;aerr('');
    if(!emailOk(email)){aerr('Введите настоящую почту — на неё придёт письмо для подтверждения');return}
    if(!/^[a-z0-9_]{3,20}$/.test(username)){aerr('Ник: 3–20 символов, латиница, цифры, _');return}
    if(nickFree===false){aerr('Такой ник уже занят');return}
    const bad=pwProblem(pw);if(bad){aerr(bad);return}
    if(pw!==p2.input.value){aerr('Пароли не совпадают');return}
    if(!ck.checked){aerr('Отметьте согласие с правилами');return}
    const {data,error}=await sb.auth.signUp({email,password:pw,options:{data:{username},emailRedirectTo:SITE_URL}});
    if(error){
      if(/username taken|already|database error/i.test(error.message)&&!/registered/i.test(error.message)){aerr('Такой ник уже занят');return}
      if(/registered|exists/i.test(error.message)){aerr('На эту почту уже есть аккаунт. Войдите или восстановите пароль.');return}
      throw error;
    }
    authEmail=email;
    // Подтверждение почты выключено в Supabase — сразу вошли
    if(data.session)return;
    // Supabase не говорит, что почта уже занята (защита от перебора) — у такого ответа нет identities
    if(data.user&&Array.isArray(data.user.identities)&&!data.user.identities.length){aerr('На эту почту уже есть аккаунт. Войдите или восстановите пароль.');return}
    resendAt=Date.now()+60e3;showAuth('check');
  });
}

function viewCheck(box){
  const c=el('div','mailbox');c.append(el('div','mail-ic','✉️'),el('h3',null,'Подтвердите почту'));
  const p=el('p','sm');p.append(document.createTextNode('Мы отправили письмо на '),el('b',null,authEmail||'вашу почту'),
    document.createTextNode('. Откройте его и нажмите «Подтвердить» — после этого вы сразу войдёте. Письма нет? Загляните в «Спам».'));
  c.append(p);box.append(c);
  const again=el('button','ghost wide','');box.append(again);
  const tick=()=>{const s=Math.ceil((resendAt-Date.now())/1000);again.disabled=s>0;again.textContent=s>0?'Отправить ещё раз через '+s+' с':'Отправить письмо ещё раз';
    if(s>0&&authView==='check')setTimeout(tick,1000)};tick();
  again.onclick=()=>busy(again,'Отправляю…',async()=>{
    const {error}=await sb.auth.resend({type:'signup',email:authEmail,options:{emailRedirectTo:SITE_URL}});if(error)throw error;
    resendAt=Date.now()+60e3;aok('Письмо отправлено ещё раз');tick();
  });
  const links=el('div','alinks');links.append(link('← Изменить почту',()=>showAuth('register')),link('Я подтвердил — войти',()=>showAuth('login')));box.append(links);
}

function viewForgot(box){
  box.append(el('h3',null,'Восстановление пароля'),el('p','sm','Пришлём на почту ссылку, по которой можно задать новый пароль.'));
  const e=fld('Почта','email','you@mail.com',{autocomplete:'email'});e.input.value=authEmail;box.append(e);
  const go=el('button','primary wide','Отправить ссылку');box.append(go);
  go.onclick=()=>busy(go,'Отправляю…',async()=>{
    const email=e.input.value.trim().toLowerCase();if(!emailOk(email)){aerr('Введите почту, указанную при регистрации');return}
    const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:SITE_URL});if(error)throw error;
    authEmail=email;aok('Если такой аккаунт есть, письмо уже в пути. Откройте ссылку из него на этом устройстве.');
  });
  box.append(el('p','sm hint2','Аккаунты, созданные по нику без почты, восстановить нельзя — привяжите почту в настройках, пока помните пароль.'));
  const links=el('div','alinks');links.append(link('← Назад ко входу',()=>showAuth('login')));box.append(links);
}

function viewOtp(box){
  box.append(el('h3',null,'Вход по коду'),el('p','sm','Пришлём на почту одноразовый код — пароль не нужен.'));
  const e=fld('Почта','email','you@mail.com',{autocomplete:'email'});e.input.value=authEmail;
  const c=fld('Код из письма','text','123456',{inputMode:'numeric',autocomplete:'one-time-code',maxLength:10});c.classList.add('hide');
  const send=el('button','primary wide','Получить код'),go=el('button','primary wide hide','Войти');
  box.append(e,c,send,go);
  send.onclick=()=>busy(send,'Отправляю…',async()=>{
    const email=e.input.value.trim().toLowerCase();if(!emailOk(email)){aerr('Введите почту');return}
    const {error}=await sb.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:SITE_URL}});
    if(error){if(/signups? not allowed|not found/i.test(error.message)){aerr('Аккаунта с такой почтой нет. Зарегистрируйтесь.');return}throw error}
    authEmail=email;c.classList.remove('hide');go.classList.remove('hide');send.classList.add('hide');aok('Код отправлен на '+email+'. Можно и просто нажать ссылку в письме.');c.input.focus();
  });
  c.input.oninput=()=>{c.input.value=c.input.value.replace(/\D/g,'');if(c.input.value.length>=6)go.click()};
  go.onclick=()=>busy(go,'Проверяю…',async()=>{
    const {error}=await sb.auth.verifyOtp({email:authEmail,token:c.input.value,type:'email'});
    if(error){aerr(/expired|invalid/i.test(error.message)?'Код неверный или устарел. Запросите новый.':authErr(error));return}
  });
  const links=el('div','alinks');links.append(link('← Назад ко входу',()=>showAuth('login')));box.append(links);
}

// После перехода по ссылке «сбросить пароль» — задать новый
function viewNewPass(box){
  box.append(el('h3',null,'Новый пароль'),el('p','sm','Придумайте новый пароль для входа.'));
  const p=fld('Новый пароль','password','минимум 8 символов, буквы и цифры',{autocomplete:'new-password'}),p2=fld('Повторите пароль','password','ещё раз',{autocomplete:'new-password'});
  const go=el('button','primary wide','Сохранить пароль');box.append(p,p2,go);
  go.onclick=()=>busy(go,'Сохраняю…',async()=>{
    const bad=pwProblem(p.input.value);if(bad){aerr(bad);return}if(p.input.value!==p2.input.value){aerr('Пароли не совпадают');return}
    const {error}=await sb.auth.updateUser({password:p.input.value});if(error)throw error;
    recovering=false;toast('Пароль изменён');
    const {data}=await sb.auth.getSession();if(data?.session?.user)safeBoot(data.session.user);
  });
}

// Настоящая причина ошибки вместо «неверный пароль» на всё подряд
function authErr(e){
  const m=(e?.message||String(e||'')).toLowerCase(),st=e?.status;
  if(st===429||/rate limit|too many|security purposes/.test(m))return 'Слишком много попыток или писем. Подождите минуту и попробуйте снова.';
  if(/invalid login|invalid credentials/.test(m))return 'Неверная почта или пароль';
  if(/failed to fetch|network|load failed|timeout/.test(m))return 'Нет связи с сервером. Проверьте интернет (или отключите VPN/блокировщик) и попробуйте ещё раз.';
  if(/email not confirmed/.test(m))return 'Почта ещё не подтверждена — откройте письмо.';
  if(/provider is not enabled|unsupported provider/.test(m))return 'Этот способ входа ещё не включён в Supabase (см. docs/AUTH_SETUP.md).';
  if(/weak|pwned|password should/.test(m))return 'Пароль слишком простой или встречался в утечках. Придумайте другой.';
  if(/same password|different from the old/.test(m))return 'Новый пароль должен отличаться от старого.';
  if(/sending.*(email|mail)|smtp|unexpected_failure/.test(m)||st===500)return 'Сервер не смог отправить письмо. Попробуйте позже или сообщите администратору «Нити».';
  return 'Ошибка: '+(e?.message||e);
}

// Ошибка, с которой Supabase вернул нас обратно (просроченная ссылка, отмена входа через Google и т. п.)
let recovering=/type=recovery/.test(location.hash);
(function(){
  const q=new URLSearchParams(location.hash.slice(1)+'&'+location.search.slice(1));
  const d=q.get('error_description');if(!d)return;
  setTimeout(()=>aerr(/expired|invalid/i.test(d)?'Ссылка из письма устарела или уже использована. Запросите новую.':'Не получилось: '+d.replace(/\+/g,' ')),0);
  history.replaceState(null,'',location.pathname);
})();

$('out').onclick=()=>{byUser=true;if(typeof forgetAccount==='function')forgetAccount(me);sb.auth.signOut()};
renderAuth();
