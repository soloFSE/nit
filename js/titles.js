// Звания «Нити» (supabase/titles.sql): особые значки, которые выдаёт администрация приложения.
// В профиле — главное звание под ником и «витрина» всех званий; в группах — значок у имени;
// человеку приходит сообщение-грамота ::title:<id>::. Главное звание человек выбирает сам.
let titlesOf={},titleById={},titlesOk=true,amAppAdmin=false;
const TITLE_ICONS=['i-star','i-crown','i-medal','i-bug','i-flame','i-shield','i-rocket','i-gem','i-heart','i-check','i-gear','i-thread'];
const TITLE_COLORS=['#8b5cf6','#3b82f6','#06b6d4','#22c55e','#eab308','#f97316','#ef4444','#ec4899'];

async function loadTitles(){
  if(!me)return;
  const {data,error}=await sb.from('titles').select('*').order('created_at').limit(2000);
  if(error){titlesOk=false;return}
  titlesOk=true;titlesOf={};titleById={};
  (data||[]).forEach(t=>{(titlesOf[t.user_id]=titlesOf[t.user_id]||[]).push(t);titleById[t.id]=t});
  const a=await sb.from('app_admins').select('user_id').eq('user_id',me);amAppAdmin=!a.error&&!!(a.data||[]).length;
  refreshPeer?.();
}
const mainTitle=uid=>{const l=titlesOf[uid];if(!l?.length)return null;return l.find(t=>t.main)||l[l.length-1]};

// Значок звания: цветная «нашивка» с иконкой
function titleBadge(t,cls){
  const b=el('span','tbadge'+(cls?' '+cls:''));b.style.setProperty('--tc',t.color||'#8b5cf6');
  b.append(ico(t.icon||'i-star'),el('span',null,t.name));b.title=t.note||t.name;return b;
}
// Маленький значок у имени в группе
function titleMini(uid){const t=mainTitle(uid);if(!t)return null;const s=el('span','tmini');s.style.setProperty('--tc',t.color);s.append(ico(t.icon));s.title=t.name;return s}

// Витрина званий в профиле
function titlesCard(uid){
  const list=titlesOf[uid]||[];
  if(!list.length&&!(amAppAdmin&&uid!==me))return null;
  const c=el('section','gi-card t-card');
  const h=el('div','gi-h');h.append(el('span',null,'Звания'),el('small',null,list.length?String(list.length):''));c.append(h);
  const main=mainTitle(uid);
  [...list].reverse().forEach(t=>{
    const r=el('div','t-row');r.style.setProperty('--tc',t.color);
    const i=el('span','t-ic');i.append(svgI(t.icon));
    const tx=el('span','t-tx');tx.append(el('b',null,t.name));
    const sub=[t.note,'выдал'+(t.granted_by===me?'и вы':' '+nameOf(t.granted_by)),(t.created_at&&!isNaN(new Date(t.created_at))?new Date(t.created_at).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}):'')].filter(Boolean).join(' · ');
    tx.append(el('small',null,sub));r.append(i,tx);
    if(list.length>1&&t===main)r.append(el('span','t-main','Главное'));
    if(uid===me&&list.length>1&&t!==main){const b=el('button','t-act','Сделать главным');b.onclick=async()=>{b.disabled=true;
      const {error}=await sb.rpc('set_main_title',{tid:t.id});if(error){toast('Не удалось: '+error.message);b.disabled=false;return}
      list.forEach(z=>z.main=z.id===t.id);toast('Теперь главное — «'+t.name+'»');c.replaceWith(titlesCard(uid)||el('i'))};r.append(b)}
    if(amAppAdmin){const d=el('button','icon t-del');d.append(svgI('i-trash'));d.title='Забрать звание';d.onclick=async()=>{
      if(!confirm('Забрать звание «'+t.name+'» у '+nameOf(uid)+'?'))return;
      const {error}=await sb.from('titles').delete().eq('id',t.id);if(error){toast('Не удалось: '+error.message);return}
      await loadTitles();toast('Звание забрано')};r.append(d)}
    c.append(r);
  });
  if(amAppAdmin&&uid!==me){const g=giRow('i-medal','Выдать звание','Значок появится в профиле и у имени в группах','gi-accent');g.onclick=()=>grantTitle(uid);c.append(g)}
  return c;
}

// Окно выдачи звания (только админам приложения) — с живым предпросмотром
function grantTitle(uid){
  const st={name:'',icon:'i-star',color:TITLE_COLORS[0],note:''};
  openModal(s=>{
    const top=el('div','sheet-top');top.append(el('h3',null,'Звание для '+nameOf(uid)));const x=el('button','icon');x.append(svgI('i-x'));x.onclick=closeModal;top.append(x);s.append(top);
    const pv=el('div','t-preview');s.append(pv);
    const paint=()=>{pv.innerHTML='';const a=avatar(uid,56);const n=el('b',null,nameOf(uid));pv.append(a,n,titleBadge({name:st.name||'Название звания',icon:st.icon,color:st.color},'big'))};
    const nl=el('label','fld');nl.append(el('span',null,'Название'));const ni=document.createElement('input');ni.maxLength=32;ni.placeholder='Например: Главный тестировщик';nl.append(ni);s.append(nl);
    const sug=el('div','chips');['Главный тестировщик','Основатель','Первый пользователь','Охотник за багами','Душа группы'].forEach(t=>{const c=el('button','chip',t);c.onclick=e=>{e.preventDefault();ni.value=t;st.name=t;paint()};sug.append(c)});s.append(sug);
    ni.oninput=()=>{st.name=ni.value;paint()};
    s.append(el('div','nc-h','Значок'));
    const ig=el('div','t-icons');TITLE_ICONS.forEach(n=>{const b=el('button','t-pick'+(n===st.icon?' on':''));b.append(svgI(n));b.onclick=()=>{st.icon=n;ig.querySelectorAll('.t-pick').forEach(z=>z.classList.toggle('on',z===b));paint()};ig.append(b)});s.append(ig);
    s.append(el('div','nc-h','Цвет'));
    const cg=el('div','t-colors');TITLE_COLORS.forEach(c=>{const b=el('button','t-col'+(c===st.color?' on':''));b.style.background=c;b.onclick=()=>{st.color=c;cg.querySelectorAll('.t-col').forEach(z=>z.classList.toggle('on',z===b));paint()};cg.append(b)});s.append(cg);
    const tl=el('label','fld');tl.append(el('span',null,'За что (необязательно)'));const ti=document.createElement('input');ti.maxLength=120;ti.placeholder='Например: нашёл 20 багов за неделю';tl.append(ti);s.append(tl);ti.oninput=()=>st.note=ti.value;
    const err=el('p','err');const go=el('button','primary wide','Выдать звание');s.append(err,go);
    go.onclick=async()=>{
      const name=st.name.trim();if(!name){err.textContent='Введите название';return}
      go.disabled=true;go.textContent='Выдаю…';
      const {data,error}=await sb.from('titles').insert({user_id:uid,name,icon:st.icon,color:st.color,note:st.note.trim()||null,granted_by:me}).select().single();
      if(error){err.textContent=/relation|schema cache/i.test(error.message)?'Запустите supabase/titles.sql в Supabase.':'Не удалось: '+error.message;go.disabled=false;go.textContent='Выдать звание';return}
      titleById[data.id]=data;(titlesOf[uid]=titlesOf[uid]||[]).push(data);
      closeModal();sendMsg(uid,{body:'::title:'+data.id+'::'},{noReply:true}).catch(()=>{});
      toast('Звание «'+name+'» выдано');refreshPeer?.();
    };
    paint();setTimeout(()=>ni.focus(),80);
  });
}

// Сообщение-грамота
SPECIAL.push({re:/^::title:([0-9a-f-]{1,36})::$/,cls:'title-m',forward:false,
  preview:x=>{const t=titleById[x[1]];return PI('i-medal')+'Звание'+(t?' «'+t.name+'»':'')},
  render:(m,d,x)=>{
    const t=titleById[x[1]];const w=el('div','t-cert');
    if(!t){w.append(el('small',null,'Звание забрано или ещё загружается'));d.append(w);if(!m._tl){m._tl=1;loadTitles().then(()=>{if(titleById[x[1]]&&nodes[m.id])draw(m)})}return}
    w.style.setProperty('--tc',t.color);
    const ic=el('div','t-cert-ic');ic.append(svgI(t.icon));
    const to=t.user_id===me?'Вам присвоено звание':nameOf(t.user_id)+' получает звание';
    w.append(ic,el('small',null,to),el('b',null,t.name));if(t.note)w.append(el('p',null,t.note));
    w.append(el('span','t-cert-by','Выдал'+(t.granted_by===me?'и вы':' '+nameOf(t.granted_by))));
    d.append(w);
    if(t.user_id===me&&Date.now()-new Date(m.created_at)<8000&&typeof fx==='function')setTimeout(()=>fx('confetti'),300);
  }});
setInterval(()=>{if(me&&!document.hidden)loadTitles()},180000);
