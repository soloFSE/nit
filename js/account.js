// «Аккаунт и безопасность»: почта, пароль, привязка Google/GitHub, выход со всех устройств.
// И выбор ника для тех, кто пришёл через Google/GitHub (ник им придуман автоматически).

async function openAccount(){
  const {data:{user}={}}=await sb.auth.getUser().catch(()=>({data:{}}));
  if(!user){toast('Нет связи с сервером');return}
  let ids=[];try{ids=(await sb.auth.getUserIdentities())?.data?.identities||[]}catch{}
  const email=isFakeEmail(user.email)?'':user.email,pending=user.new_email;
  const hasPass=ids.some(i=>i.provider==='email')||!ids.length;
  openModal(s=>{
    const top=el('div','sheet-top');top.append(el('h3',null,'Аккаунт и безопасность'));const x=el('button','icon');x.append(svgI('i-x'));x.onclick=closeModal;top.append(x);s.append(top);
    const err=el('p','err');

    // Почта
    const em=el('div','acc-card');em.append(el('span','acc-l','Почта'));
    if(email)em.append(el('b',null,email),icoText('i-check','подтверждена','ok-t'));
    else em.append(el('b',null,'Не привязана'),el('small','sm','Без почты нельзя восстановить пароль, если вы его забудете.'));
    if(pending)em.append(el('small','sm','Ждёт подтверждения: '+pending+' — откройте письмо.'));
    const ei=document.createElement('input');ei.type='email';ei.placeholder=email?'Новая почта':'you@mail.com';
    const eb=el('button','ghost',email?'Сменить почту':'Привязать почту');
    const er=el('div','acc-row');er.append(ei,eb);em.append(er);s.append(em);
    eb.onclick=async()=>{
      const v=ei.value.trim().toLowerCase();err.textContent='';
      if(!emailOk(v)){err.textContent='Введите настоящую почту';return}
      eb.disabled=true;
      const {error}=await sb.auth.updateUser({email:v},{emailRedirectTo:SITE_URL});eb.disabled=false;
      if(error){err.textContent=authErr(error);return}
      closeModal();toast('Письмо отправлено на '+v+'. Откройте его, чтобы подтвердить почту.');
    };

    // Пароль
    const pw=el('div','acc-card');pw.append(el('span','acc-l',hasPass?'Пароль':'Пароль (не задан — вы входите через Google/GitHub)'));
    const p1=document.createElement('input');p1.type='password';p1.placeholder='Новый пароль (8+ символов, буквы и цифры)';p1.autocomplete='new-password';
    const p2=document.createElement('input');p2.type='password';p2.placeholder='Повторите пароль';p2.autocomplete='new-password';
    const pb=el('button','ghost',hasPass?'Сменить пароль':'Задать пароль');
    const code=document.createElement('input');code.placeholder='Код из письма';code.inputMode='numeric';code.className='hide';
    pw.append(p1,p2,code,pb);s.append(pw);
    pb.onclick=async()=>{
      err.textContent='';const bad=pwProblem(p1.value);if(bad){err.textContent=bad;return}
      if(p1.value!==p2.value){err.textContent='Пароли не совпадают';return}
      pb.disabled=true;
      const {error}=await sb.auth.updateUser(code.value?{password:p1.value,nonce:code.value.trim()}:{password:p1.value});
      pb.disabled=false;
      if(!error){closeModal();toast('Пароль изменён');return}
      // В Supabase включено «подтверждать смену пароля» — шлём код на почту
      if(/reauthenticat|nonce/i.test(error.message)&&email){
        await sb.auth.reauthenticate();code.classList.remove('hide');code.focus();
        err.textContent='Для безопасности мы отправили код на '+email+'. Введите его и нажмите кнопку ещё раз.';return;
      }
      err.textContent=authErr(error);
    };

    // Привязанные способы входа
    const lk=el('div','acc-card');lk.append(el('span','acc-l','Способы входа'));
    [['google','Google'],['github','GitHub']].forEach(([p,t])=>{
      const idn=ids.find(i=>i.provider===p);
      const r=el('div','acc-prov');const tx=el('div');tx.append(el('b',null,t),el('small','sm',idn?(idn.identity_data?.email||idn.identity_data?.user_name||'привязан'):'не привязан'));r.append(svgI('i-'+p),tx);
      const b=el('button','ghost sm-btn',idn?'Отвязать':'Привязать');
      b.onclick=async()=>{
        err.textContent='';b.disabled=true;
        if(idn){
          if(ids.length<2){err.textContent='Это ваш единственный способ входа. Сначала привяжите почту и задайте пароль.';b.disabled=false;return}
          const {error}=await sb.auth.unlinkIdentity(idn);b.disabled=false;
          if(error){err.textContent=authErr(error);return}closeModal();toast(t+' отвязан');
        }else{
          const {error}=await sb.auth.linkIdentity({provider:p,options:{redirectTo:SITE_URL}});b.disabled=false;
          if(error)err.textContent=/manual linking/i.test(error.message)?'В Supabase не включена привязка аккаунтов (Manual linking) — см. docs/AUTH_SETUP.md.':authErr(error);
        }
      };
      r.append(b);lk.append(r);
    });
    s.append(lk);

    // Устройства
    const dv=el('div','acc-card');dv.append(el('span','acc-l','Устройства'));
    const all=el('button','ghost danger wide','Выйти на всех устройствах');
    all.onclick=async()=>{if(!confirm('Выйти из аккаунта на всех телефонах и компьютерах, включая этот?'))return;
      byUser=true;closeModal();await sb.auth.signOut({scope:'global'}).catch(()=>{})};
    dv.append(el('small','sm','Если потеряли телефон или вошли с чужого устройства.'),all);s.append(dv);
    const dl=el('div','acc-card');dl.append(el('span','acc-l','Удаление аккаунта'));
    const delb=el('button','ghost danger wide','Удалить аккаунт навсегда');delb.onclick=()=>{closeModal();setTimeout(openDeleteAccount,220)};
    dl.append(el('small','sm','Профиль, друзья, подарки и сообщения удалятся без возможности вернуть.'),delb);s.append(dl);
    s.append(err);
  });
}

// ---------- Выбор ника после входа через Google/GitHub ----------
async function checkUsername(){
  const {data,error}=await sb.from('profiles').select('username_set').eq('id',me).maybeSingle();
  if(error||!data||data.username_set!==false)return;
  openModal(s=>{
    s.append((()=>{const h=el('h3',null,'Добро пожаловать в Нить! ');h.append(ico('i-wave'));return h})(),el('p','sm','Выберите ник — по нему вас будут находить друзья. Его можно выбрать только один раз.'));
    const l=el('label','fld');const h=el('span',null,'Ник');const st=el('small','nick-st');h.append(st);l.append(h);
    const i=document.createElement('input');i.maxLength=20;i.value=myName;i.autocapitalize='none';l.append(i);s.append(l);
    const err=el('p','err');const go=el('button','primary wide','Готово');s.append(err,go);
    let t=0;i.oninput=()=>{i.value=i.value.toLowerCase().replace(/[^a-z0-9_]/g,'');st.textContent='';st.className='nick-st';clearTimeout(t);
      if(i.value.length<3||i.value===myName)return;
      t=setTimeout(async()=>{const {data}=await sb.rpc('username_free',{u:i.value});fillRich(st,data?PI('i-check')+'свободен':PI('i-x')+'занят');st.classList.add(data?'ok':'bad')},350)};
    go.onclick=async()=>{
      const v=i.value;if(!/^[a-z0-9_]{3,20}$/.test(v)){err.textContent='Ник: 3–20 символов, латиница, цифры, _';return}
      go.disabled=true;const {error}=await sb.rpc('set_username',{u:v});go.disabled=false;
      if(error){err.textContent=error.message;return}
      people[me]=myName=v;if(prof[me])prof[me].username=v;renderMe();closeModal();toast('Ник сохранён: @'+v);
    };
  });
}
