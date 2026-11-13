// Безопасность «Нити» (v6.0). Что здесь:
//  • двухфакторная защита (TOTP: Google Authenticator, Authy и т.п.): включение, вход с кодом, отключение. На стороне базы 2FA тоже проверяется (supabase/v12.sql);
//  • код-пароль на вход в приложение (как в Telegram): хранится только в виде «отпечатка» PBKDF2, автоблокировка, задержки после ошибок,
//    после 10 неверных попыток — выход из аккаунта. Это защита от чужих рук на вашем устройстве;
//  • скрытие содержимого при сворачивании (в списке запущенных приложений видно размытый экран);
//  • защита от перебора пароля при входе (задержки после неудачных попыток);
//  • «центр безопасности» в Настройках с проверкой того, что включено;
//  • токен входа для игровых серверов (сервер узнаёт, кто вы, и не даёт подставить чужое имя).
const SEC_KEY='nit-sec',LOCK_KEY='nit-lock';
const secPref=()=>{try{return JSON.parse(localStorage.getItem(SEC_KEY)||'{}')}catch{return {}}};
const secSet=(k,v)=>{const p=secPref();p[k]=v;try{localStorage.setItem(SEC_KEY,JSON.stringify(p))}catch{}};
async function gameToken(){try{const {data}=await sb.auth.getSession();return data?.session?.access_token||''}catch{return ''}}
const secEnc=u=>btoa(String.fromCharCode(...u)),secDec=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));

// ---------- Защита от перебора пароля при входе ----------
function secLoginWait(){
  try{const f=JSON.parse(sessionStorage.getItem('nit-lf')||'{"n":0,"t":0}');
    if(f.n<5)return 0;const wait=Math.min(300,15*Math.pow(2,f.n-5));const left=Math.ceil((f.t+wait*1000-Date.now())/1000);return left>0?left:0}catch{return 0}
}
function secLoginFail(){try{const f=JSON.parse(sessionStorage.getItem('nit-lf')||'{"n":0,"t":0}');f.n++;f.t=Date.now();sessionStorage.setItem('nit-lf',JSON.stringify(f))}catch{}}
function secLoginOk(){try{sessionStorage.removeItem('nit-lf')}catch{}}

// ---------- Скрытие при сворачивании ----------
document.addEventListener('visibilitychange',()=>{
  if(secPref().hide===false){document.body.classList.remove('sec-blur');return}
  document.body.classList.toggle('sec-blur',document.hidden);
});

// ---------- Код-пароль ----------
const lockCfg=()=>{try{return JSON.parse(localStorage.getItem(LOCK_KEY)||'null')}catch{return null}};
async function lockHash(code,salt){
  const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(code),'PBKDF2',false,['deriveBits']);
  return secEnc(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:150000},k,256)));
}
async function lockStore(code,tmo){
  const salt=crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(LOCK_KEY,JSON.stringify({salt:secEnc(salt),hash:await lockHash(code,salt),len:code.length,tmo,fails:0,until:0}));
}
async function lockVerify(code){
  const c=lockCfg();if(!c)return true;
  if(c.until>Date.now())return null; // ещё нельзя пробовать
  const ok=(await lockHash(code,secDec(c.salt)))===c.hash;
  if(ok){c.fails=0;c.until=0;localStorage.setItem(LOCK_KEY,JSON.stringify(c));return true}
  c.fails=(c.fails||0)+1;
  if(c.fails>=10){ // слишком много попыток: выходим из аккаунта и снимаем код
    try{localStorage.removeItem(LOCK_KEY)}catch{}
    try{byUser=true;await sb.auth.signOut()}catch{}
    return 'wipe';
  }
  if(c.fails>=5)c.until=Date.now()+30000*Math.pow(2,c.fails-5);
  localStorage.setItem(LOCK_KEY,JSON.stringify(c));return false;
}
let lockEl=null,hiddenAt=0,lastAct=Date.now();
function lockNow(){
  const cfg=lockCfg();if(!cfg||lockEl)return;
  let code='';const box=el('div','lock-screen');lockEl=box;
  const lg=el('div','lock-logo');lg.append(svgI('i-lock'));
  const ttl=el('b','lock-t','Введите код-пароль'),msg=el('small','lock-m','');
  const dots=el('div','lock-dots');for(let i=0;i<cfg.len;i++)dots.append(el('i'));
  const pad=el('div','lock-pad');
  const paint=()=>[...dots.children].forEach((d,i)=>d.classList.toggle('on',i<code.length));
  const unlock=()=>{lockEl=null;box.classList.add('out');setTimeout(()=>box.remove(),220);lastAct=Date.now()};
  const submit=async()=>{
    const r=await lockVerify(code);code='';paint();
    if(r===true){unlock();return}
    if(r==='wipe'){box.remove();lockEl=null;toast('Слишком много попыток: вы вышли из аккаунта');return}
    box.classList.remove('bad');void box.offsetWidth;box.classList.add('bad');navigator.vibrate?.(120);
    const c=lockCfg();const left=c&&c.until>Date.now()?Math.ceil((c.until-Date.now())/1000):0;
    msg.textContent=r===null||left?'Подождите '+left+' с':'Неверный код'+(c?'. Осталось попыток до выхода: '+(10-c.fails):'');
  };
  const press=d=>{if(code.length>=cfg.len)return;code+=d;paint();if(code.length===cfg.len)submit()};
  [1,2,3,4,5,6,7,8,9,'',0,'⌫'].forEach(k=>{const b=el('button','lock-k',String(k));if(k==='')b.style.visibility='hidden';
    b.onclick=()=>{if(k==='⌫'){code=code.slice(0,-1);paint()}else if(k!=='')press(String(k))};pad.append(b)});
  const out=el('button','lock-out','Выйти из аккаунта');out.onclick=()=>{if(confirm('Выйти из аккаунта?')){box.remove();lockEl=null;byUser=true;sb.auth.signOut().catch(()=>{})}};
  box.append(lg,ttl,dots,msg,pad,out);document.body.append(box);
  const kd=e=>{if(!lockEl){document.removeEventListener('keydown',kd);return}if(/^[0-9]$/.test(e.key))press(e.key);else if(e.key==='Backspace'){code=code.slice(0,-1);paint()}};
  document.addEventListener('keydown',kd);
}
document.addEventListener('visibilitychange',()=>{
  const c=lockCfg();if(!c)return;
  if(document.hidden)hiddenAt=Date.now();
  else if(!lockEl&&(c.tmo===0||Date.now()-hiddenAt>=c.tmo*60000))lockNow();
});
['pointerdown','keydown','touchstart'].forEach(e=>document.addEventListener(e,()=>{lastAct=Date.now()},{passive:true}));
setInterval(()=>{const c=lockCfg();if(c&&c.tmo>0&&!lockEl&&!document.hidden&&Date.now()-lastAct>=c.tmo*60000)lockNow()},15000);
if(lockCfg())lockNow(); // при запуске приложения — сразу просим код

// ---------- Двухфакторная защита (TOTP) ----------
async function mfaFactor(){
  try{const {data}=await sb.auth.mfa.listFactors();return (data?.totp||[]).find(f=>f.status==='verified')||null}catch{return null}
}
async function mfaVerifyCode(factorId,code){
  const ch=await sb.auth.mfa.challenge({factorId});if(ch.error)throw ch.error;
  const v=await sb.auth.mfa.verify({factorId,challengeId:ch.data.id,code:String(code).replace(/\s/g,'')});if(v.error)throw v.error;
}
// Вход с кодом: вызывается перед запуском приложения. true — можно продолжать
async function mfaGate(){
  try{
    const {data}=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if(!(data&&data.nextLevel==='aal2'&&data.currentLevel!=='aal2'))return true;
    const f=await mfaFactor();if(!f)return true;
    return await new Promise(res=>{
      const box=el('div','mfa-gate');const card=el('div','mfa-card');
      const ic=el('div','lock-logo');ic.append(svgI('i-shield'));
      const inp=document.createElement('input');inp.inputMode='numeric';inp.maxLength=7;inp.placeholder='Код из приложения';inp.autocomplete='one-time-code';
      const err=el('p','err'),go=el('button','primary wide','Подтвердить'),out=el('button','ghost wide','Выйти');
      const run=async()=>{err.textContent='';if(inp.value.replace(/\s/g,'').length<6){err.textContent='Введите 6 цифр';return}
        go.disabled=true;try{await mfaVerifyCode(f.id,inp.value);box.remove();res(true)}catch(e){err.textContent=/rate|too many/i.test(e.message||'')?'Слишком много попыток. Подождите минуту':'Неверный код';go.disabled=false;inp.value='';inp.focus()}};
      go.onclick=run;inp.onkeydown=e=>{if(e.key==='Enter')run()};
      out.onclick=()=>{box.remove();byUser=true;sb.auth.signOut().catch(()=>{});res(false)};
      card.append(ic,el('h2',null,'Двойная защита'),el('p','sm','Откройте приложение-аутентификатор и введите 6-значный код для «Нити».'),inp,err,go,out);
      box.append(card);document.body.append(box);setTimeout(()=>inp.focus(),100);
    });
  }catch{return true}
}
async function mfaEnable(){
  const {data,error}=await sb.auth.mfa.enroll({factorType:'totp',friendlyName:'Нить '+new Date().toLocaleDateString('ru-RU')});
  if(error){toast(/disabled|not enabled/i.test(error.message)?'Двухфакторная защита выключена в настройках Supabase (Authentication → MFA)':'Не удалось: '+error.message);return}
  const fid=data.id;let done=false;
  openModal(s=>{
    s.classList.add('sec-sheet');
    const top=el('div','sheet-top');top.append(el('h3',null,'Двухфакторная защита'));const x=el('button','icon');x.append(svgI('i-x'));
    x.onclick=()=>{closeModal()};top.append(x);s.append(top);
    s.append(el('p','sm','1. Установите приложение-аутентификатор (Google Authenticator, Authy, 2FAS). 2. Отсканируйте код или введите ключ вручную. 3. Введите 6-значный код.'));
    const qr=el('div','mfa-qr');const img=document.createElement('img');img.alt='QR-код';img.src=data.totp.qr_code;qr.append(img);s.append(qr);
    const sec=el('button','mfa-secret',data.totp.secret);sec.title='Скопировать ключ';sec.onclick=()=>{navigator.clipboard?.writeText(data.totp.secret);toast('Ключ скопирован')};s.append(sec);
    s.append(el('p','sm','Сохраните этот ключ в надёжном месте: если потеряете телефон, вход без кода станет невозможен (сбросить защиту сможет только Главный админ).'));
    const inp=document.createElement('input');inp.inputMode='numeric';inp.maxLength=7;inp.placeholder='6-значный код';inp.autocomplete='one-time-code';s.append(inp);
    const err=el('p','err'),go=el('button','primary wide','Включить защиту');
    go.onclick=async()=>{err.textContent='';go.disabled=true;
      try{await mfaVerifyCode(fid,inp.value);done=true;closeModal();toast('Двухфакторная защита включена');if(typeof refreshSettings==='function')refreshSettings()}
      catch(e){err.textContent='Неверный код. Проверьте время на телефоне и попробуйте ещё раз';go.disabled=false}};
    s.append(err,go);
    // если закрыли окно, не подтвердив, — удаляем неподтверждённый фактор, чтобы не копились
    const mo=new MutationObserver(()=>{if(!done&&$('modal').classList.contains('hide')){mo.disconnect();sb.auth.mfa.unenroll({factorId:fid}).catch(()=>{})}});
    mo.observe($('modal'),{attributes:true,attributeFilter:['class']});
  });
}
async function mfaDisable(f){
  if(!confirm('Выключить двухфакторную защиту? Аккаунт станет менее защищён.'))return;
  const {error}=await sb.auth.mfa.unenroll({factorId:f.id});
  if(error){toast('Не удалось: '+error.message);return}
  toast('Двухфакторная защита выключена');refreshSettings?.();
}

// ---------- Код-пароль: настройка ----------
function lockSetup(){
  openModal(s=>{
    s.classList.add('sec-sheet');
    const top=el('div','sheet-top');top.append(el('h3',null,'Код-пароль'));const x=el('button','icon');x.append(svgI('i-x'));x.onclick=closeModal;top.append(x);s.append(top);
    s.append(el('p','sm','Приложение будет просить код при запуске и после сворачивания. Код хранится только на этом устройстве. Забудете код — придётся выйти из аккаунта и войти снова.'));
    const a=document.createElement('input');a.type='password';a.inputMode='numeric';a.maxLength=8;a.placeholder='Новый код (4–8 цифр)';
    const b=document.createElement('input');b.type='password';b.inputMode='numeric';b.maxLength=8;b.placeholder='Повторите код';
    const err=el('p','err'),go=el('button','primary wide','Сохранить');
    s.append(a,b);
    s.append(el('div','sec-lab','Блокировать'));
    let tmo=lockCfg()?.tmo??1;const chips=el('div','adm-chips');
    [[0,'Сразу'],[1,'Через 1 мин'],[5,'Через 5 мин'],[15,'Через 15 мин'],[60,'Через час']].forEach(([v,n])=>{const c=el('button','adm-chip'+(v===tmo?' on':''),n);c.onclick=()=>{tmo=v;[...chips.children].forEach(z=>z.classList.toggle('on',z===c))};chips.append(c)});
    s.append(chips,err,go);
    go.onclick=async()=>{err.textContent='';
      if(!/^[0-9]{4,8}$/.test(a.value)){err.textContent='Код — от 4 до 8 цифр';return}
      if(a.value!==b.value){err.textContent='Коды не совпадают';return}
      if(/^(\d)\1+$/.test(a.value)||'01234567890123456789'.includes(a.value)||'98765432109876543210'.includes(a.value)){err.textContent='Слишком простой код (например 1111 или 1234)';return}
      go.disabled=true;await lockStore(a.value,tmo);closeModal();toast('Код-пароль включён');refreshSettings?.()};
  });
}
function lockDisable(){
  openModal(s=>{
    s.classList.add('sec-sheet');
    const top=el('div','sheet-top');top.append(el('h3',null,'Выключить код-пароль'));const x=el('button','icon');x.append(svgI('i-x'));x.onclick=closeModal;top.append(x);s.append(top);
    const a=document.createElement('input');a.type='password';a.inputMode='numeric';a.maxLength=8;a.placeholder='Введите текущий код';s.append(a);
    const err=el('p','err'),go=el('button','primary wide danger','Выключить');
    go.onclick=async()=>{const r=await lockVerify(a.value);if(r===true){localStorage.removeItem(LOCK_KEY);closeModal();toast('Код-пароль выключен');refreshSettings?.()}else if(r==='wipe'){closeModal()}else err.textContent=r===null?'Подождите немного':'Неверный код'};
    s.append(err,go);
  });
}

// ---------- Страница «Безопасность» в Настройках (v6.2: минимализм — сводка и компактные строки со статусом) ----------
function setSecurity(sc){
  const lock=lockCfg(),hide=secPref().hide!==false;
  // сводка
  const sum=el('section','sec-sum');const ic=el('div','sec-shield');ic.append(svgI('i-shield'));
  const tx=el('div','sec-sum-t');const ttl=el('b',null,'Защита аккаунта'),sub=el('small',null,'Проверяю…');tx.append(ttl,sub);
  const bar=el('div','sec-bar');for(let i=0;i<4;i++)bar.append(el('i'));sum.append(ic,tx,bar);sc.append(sum);
  const set=(n)=>{[...bar.children].forEach((b,i)=>b.classList.toggle('on',i<n));
    sub.textContent=n>=4?'Всё включено — отлично':n>=2?'Включено '+n+' из 4 — можно лучше':'Включено '+n+' из 4 — стоит усилить';sum.dataset.n=n};
  // строка со статусом справа
  const row=(icon,title,subt,pill,f)=>{const r=giRow(icon,title,subt);r.classList.add('sec-row');if(pill!=null){const p=el('span','sec-pill'+(pill.ok?' ok':''),pill.t);r.append(p);r.pill=p}
    const ch=el('span','chev');ch.append(svgI('i-back'));r.append(ch);r.onclick=f;return r};
  // 1. вход
  const g1=el('section','gi-card sec-card');g1.append(el('div','gi-h','Вход'));
  const r2fa=row('i-shield','Двойная защита','Код из приложения при входе',{t:'…'},()=>{});g1.append(r2fa);
  g1.append(row('i-lock','Пароль и способы входа','Пароль, почта, Google, GitHub',null,()=>openAccount()));
  const lo=row('i-out','Выйти на всех устройствах','Если потеряли телефон',null,async()=>{if(!confirm('Выйти из аккаунта на всех телефонах и компьютерах, включая этот?'))return;byUser=true;closeSettings?.();await sb.auth.signOut({scope:'global'}).catch(()=>{})});lo.classList.add('gi-danger');g1.append(lo);
  sc.append(g1);
  // 2. устройство
  const g2=el('section','gi-card sec-card');g2.append(el('div','gi-h','Это устройство'));
  g2.append(row('i-lock','Код-пароль','Просит код при запуске и после сворачивания',{t:lock?'Включён':'Выключен',ok:!!lock},lockSetup));
  if(lock){const ld=row('i-x','Выключить код-пароль',null,null,lockDisable);ld.classList.add('gi-danger');g2.append(ld)}
  g2.append(switchRow('i-eye','Скрывать экран при сворачивании','В списке приложений виден размытый экран',hide,on=>{secSet('hide',on);document.body.classList.remove('sec-blur');set(cnt())}));
  g2.append(switchRow('i-image','Загружать картинки из ссылок','Выключено: картинка грузится после нажатия — иначе сайт узнаёт ваш IP',!!secPref().autoimg,on=>secSet('autoimg',on)));
  sc.append(g2);
  sc.append(el('p','sec-foot','Сообщения хранятся на сервере в открытом виде и защищены правилами доступа. Сквозного шифрования, как в Signal, нет.'));
  // состояние
  let has2fa=false,hasMail=false;const cnt=()=>[has2fa,!!lockCfg(),hasMail,secPref().hide!==false].filter(Boolean).length;
  set(cnt());
  sb.auth.getUser().then(async({data})=>{
    const u=data?.user;hasMail=!!u&&!isFakeEmail(u.email);const f=await mfaFactor();has2fa=!!f;
    r2fa.pill.textContent=f?'Включена':'Выключена';r2fa.pill.classList.toggle('ok',!!f);
    r2fa.onclick=()=>f?mfaDisable(f):mfaEnable();
    r2fa.querySelector('.gi-rt small').textContent=f?'Вход требует код из приложения':'Самая важная защита от взлома пароля';
    set(cnt());
  });
}
