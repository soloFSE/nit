// Профили: имя, описание, аватарка; окно настроек и карточка собеседника
let prof={},profFull=true,profCols=0;
// Пробуем от полного набора полей к простому: SQL-обновления могли быть запущены не все
const COLS_TRY=['id,username,display_name,bio,avatar_path,status','id,username,display_name,bio,avatar_path','id,username'];
let PROFILE_COLS=COLS_TRY[0];

// Загружает профили; если SQL для профиля ещё не запущен — берёт только ник
async function loadProfiles(ids,force){
  ids=[...new Set(ids)].filter(i=>i&&(force||!prof[i]));
  if(!ids.length)return;
  let data,error;
  for(;profCols<COLS_TRY.length;profCols++){
    ({data,error}=await sb.from('profiles').select(COLS_TRY[profCols]).in('id',ids));
    if(!error)break;
  }
  PROFILE_COLS=COLS_TRY[Math.min(profCols,COLS_TRY.length-1)];profFull=profCols<2;
  (data||[]).forEach(p=>{prof[p.id]=p;people[p.id]=p.username});
}
const nameOf=id=>prof[id]?.display_name||people[id]||'?';
const avatarUrl=p=>!p?'':/^https:\/\//.test(p)?p:SUPABASE_URL+'/storage/v1/object/public/avatars/'+p; // https — фото из Google/GitHub

// Кружок с фото или с первой буквой на цветном фоне (цвет зависит от id)
function hue(s){let h=2166136261;for(const c of String(s||''))h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)%360}
function avatar(id,size,label){
  const p=prof[id],el=document.createElement('span');
  el.className='ava';
  if(!label){el.dataset.uid=id;if(typeof online!=='undefined'&&online.has(id)&&id!==me)el.classList.add('online')}el.style.setProperty('--s',(size||40)+'px');
  const name=label||nameOf(id);
  if(p?.avatar_path&&!label){
    const i=document.createElement('img');i.alt='';i.src=avatarUrl(p.avatar_path);
    i.onerror=()=>{i.remove();el.textContent=name[0]?.toUpperCase()||'?'};el.append(i);
  }else{el.textContent=(name.replace(/^#\s*/,'')[0]||'?').toUpperCase();el.style.setProperty('--h',hue(id))}
  return el;
}

// ---------- Модальное окно ----------
function openModal(build){if(typeof stashNew==='function')stashNew();const s=$('sheet');s.className='sheet';$('modal').classList.remove('closing');s.innerHTML='';build(s);$('modal').classList.remove('hide')}
function closeModal(){
  const m=$('modal');if(m.classList.contains('hide')||m.classList.contains('closing'))return;
  m.classList.add('closing');
  setTimeout(()=>{if(!m.classList.contains('closing'))return; // за это время открыли новое окно
    m.classList.add('hide');m.classList.remove('closing');if(typeof stashNew==='function')stashNew();$('sheet').innerHTML=''},180);
}
$('modal').onclick=e=>{if(e.target.id==='modal')closeModal()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('modal').classList.contains('hide'))closeModal()});
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}

// ---------- Мой профиль ----------
function renderMe(){
  const a=$('meAva');a.innerHTML='';a.append(avatar(me,38));
  $('who').textContent=nameOf(me);$('whoNick').textContent='@'+myName;
}
$('meBtn').onclick=()=>openSettings(); // окно настроек — settings.js

// Редактирование профиля: фото, имя, описание, статус
function openProfileEdit(){
  const p=prof[me]||{};let newAva=null,dropAva=false;
  openModal(s=>{
    const top=el('div','sheet-top');top.append(el('h3',null,'Профиль'));
    const x=el('button','icon');x.append(svgI('i-x'));x.title='Закрыть';x.onclick=closeModal;top.append(x);s.append(top);

    const ava=el('div','ava-edit');const holder=el('div');holder.append(avatar(me,96));ava.append(holder);
    const btns=el('div','ava-btns');
    const pick=el('button','ghost','Сменить фото'),del=el('button','ghost danger','Убрать');
    const f=document.createElement('input');f.type='file';f.accept='image/*';f.hidden=true;
    pick.onclick=()=>f.click();
    f.onchange=async()=>{const file=f.files[0];f.value='';if(!file)return;
      try{const b=await cropImage(file,320,true);if(!b)return;newAva=b;dropAva=false;
        const img=document.createElement('img');img.src=URL.createObjectURL(newAva);
        const sp=el('span','ava');sp.style.setProperty('--s','96px');sp.append(img);holder.innerHTML='';holder.append(sp);
      }catch(e){err.textContent=e.message}};
    del.onclick=()=>{newAva=null;dropAva=true;holder.innerHTML='';holder.append(avatar(me,96,p.display_name||myName))};
    btns.append(pick,del,f);ava.append(btns);s.append(ava);
    if(typeof titlesCard==='function'){const mt=mainTitle(me);if(mt){const b=el('div','t-self');b.append(titleBadge(mt,'big'));s.append(b);if((titlesOf[me]||[]).length>1){const tc=titlesCard(me);if(tc)s.append(tc)}}}

    const nm=el('label','fld');nm.append(el('span',null,'Имя'));
    const ni=document.createElement('input');ni.maxLength=30;ni.placeholder=myName;ni.value=p.display_name||'';nm.append(ni);s.append(nm);

    // Ник можно менять (не чаще раза в неделю — supabase/v3.sql, change_username). Свободен ли — проверяем на лету
    const nk=el('label','fld');const nkh=el('span',null,'Ник ');const nks=el('small','nick-st');nkh.append(nks);nk.append(nkh);
    const nkw=el('div','nick-in');nkw.append(el('span','nick-at','@'));
    const nki=document.createElement('input');nki.value=myName;nki.maxLength=20;nki.autocapitalize='none';nki.autocomplete='off';nki.spellcheck=false;nkw.append(nki);nk.append(nkw);
    nk.append(el('small','sm','По нику вас находят друзья. Латиница, цифры и _, от 3 символов. Менять можно раз в неделю.'));s.append(nk);
    let nkT=0,nickOk=true;
    nki.oninput=()=>{nki.value=nki.value.toLowerCase().replace(/[^a-z0-9_]/g,'');nks.textContent='';nks.className='nick-st';clearTimeout(nkT);
      nickOk=nki.value===myName;if(nickOk)return;
      if(nki.value.length<3){fillRich(nks,PI('i-x')+'минимум 3 символа');nks.classList.add('bad');return}
      nkT=setTimeout(async()=>{const v=nki.value;const {data}=await sb.rpc('username_free',{u:v});if(nki.value!==v)return;nickOk=!!data;
        fillRich(nks,data?PI('i-check')+'свободен':PI('i-x')+'занят');nks.classList.add(data?'ok':'bad')},350)};

    const bi=el('label','fld');const cnt=el('small','sm');
    const bh=el('span');bh.append(document.createTextNode('О себе '),cnt);bi.append(bh);
    const ta=document.createElement('textarea');ta.maxLength=160;ta.rows=3;ta.placeholder='Пара слов о себе';ta.value=p.bio||'';
    const upd=()=>cnt.textContent=ta.value.length+'/160';ta.oninput=upd;upd();bi.append(ta);s.append(bi);

    // Статус под ником
    const stl=el('label','fld');stl.append(el('span',null,'Статус'));
    const sti=document.createElement('input');sti.maxLength=40;sti.placeholder='Например: на работе';sti.value=p.status||'';stl.append(sti);
    const chips=el('div','chips');
    ['играю','учусь','работаю','сплю','в дороге','слушаю музыку','ем'].forEach(t=>{const c=el('button','chip',t);c.onclick=e=>{e.preventDefault();sti.value=t};chips.append(c)});
    const clr=el('button','chip chip-x');clr.append(ico('i-x'),'очистить');clr.onclick=e=>{e.preventDefault();sti.value=''};chips.append(clr);
    stl.append(chips);s.append(stl);
    if(profCols>0)stl.append(el('small','sm','Чтобы сохранить статус, запустите supabase/more.sql.'));


    const err=el('p','err');s.append(err);
    if(!profFull)err.textContent='Чтобы сохранять имя, описание и фото, запустите supabase/profile.sql в Supabase.';
    const save=el('button','primary wide','Сохранить');s.append(save);
    save.onclick=async()=>{
      err.textContent='';
      const newNick=nki.value.trim();
      if(newNick!==myName&&(!nickOk||newNick.length<3)){err.textContent='Ник занят или слишком короткий';return}
      save.disabled=true;save.textContent='Сохраняю…';
      try{
        if(newNick!==myName){
          const r=await sb.rpc('change_username',{u:newNick});
          if(r.error)throw new Error(/function|schema cache/i.test(r.error.message)?'смена ника появится после обновления базы (supabase/v3.sql)':r.error.message);
          people[me]=myName=newNick;if(prof[me])prof[me].username=newNick;toast('Ник изменён: @'+newNick);
        }
        const patch={display_name:ni.value.trim()||null,bio:ta.value.trim()||null};
        if(profCols===0)patch.status=sti.value.trim()||null;
        const old=p.avatar_path;
        if(newAva){
          const path=me+'/'+crypto.randomUUID()+'.jpg';
          const up=await sb.storage.from('avatars').upload(path,newAva,{contentType:'image/jpeg'});
          if(up.error)throw up.error;patch.avatar_path=path;
        }else if(dropAva)patch.avatar_path=null;
        const {data,error}=await sb.from('profiles').update(patch).eq('id',me).select(PROFILE_COLS).single();
        if(error)throw error;
        if(old&&old!==data.avatar_path)sb.storage.from('avatars').remove([old]);
        prof[me]=data;renderMe();render();closeModal();refreshSettings?.();
      }catch(e){err.textContent='Не удалось сохранить: '+(e.message||e);save.disabled=false;save.textContent='Сохранить'}
    };
  });
}

// Квадратная обрезка по центру и сжатие в JPEG
function squareJpeg(f,size){return new Promise((ok,no)=>{
  const i=new Image();
  i.onload=()=>{const m=Math.min(i.width,i.height),c=document.createElement('canvas');c.width=c.height=size;
    c.getContext('2d').drawImage(i,(i.width-m)/2,(i.height-m)/2,m,m,0,0,size,size);
    c.toBlob(b=>b?ok(b):no(new Error('Не удалось обработать фото')),'image/jpeg',.85)};
  i.onerror=()=>no(new Error('Это не картинка'));i.src=URL.createObjectURL(f);
})}

// Чужой профиль — отдельный экран, см. peer.js (showProfile)

// ---------- Тема ----------
function getTheme(){try{return localStorage.getItem('nit-theme')||'auto'}catch{return 'auto'}}
function setTheme(v){try{localStorage.setItem('nit-theme',v)}catch{}applyTheme()}
function applyTheme(){const v=getTheme();if(v==='auto')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=v}
applyTheme();
