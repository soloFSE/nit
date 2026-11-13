// Подарки (supabase/v7.sql): друзьям дарят подарки за «узелки» — внутреннюю валюту (ежедневный бонус, растёт с нитью).
// У каждого подарка — случайные фон и узор, редкость (обычный/редкий/эпический/легендарный), номер из тиража у лимитированных.
// Подарок приходит карточкой в чат, живёт в коллекции профиля (можно скрыть) и обменивается назад на 50% узелков.
const GBG=[['#fecdd3','#fb7185'],['#bfdbfe','#60a5fa'],['#bbf7d0','#34d399'],['#fde68a','#f59e0b'],['#c4b5fd','#7c3aed'],['#f9a8d4','#db2777'],['#67e8f9','#2563eb'],['#4c1d95','#c026d3'],['#fef08a','#d97706']];
const GRAR={common:['Обычный','#94a3b8'],rare:['Редкий','#3b82f6'],epic:['Эпический','#a855f7'],legendary:['Легендарный','#f59e0b']};
// Рисунок подарка: клубок нужного уровня или значок
const GEMB={yarn1:{y:3},yarn2:{y:7},gold:{y:30},diamond:{y:100},legend:{y:200},heart:{i:'i-heart'},flame:{i:'i-flame'},bug:{i:'i-bug'},star:{i:'i-star'},shield:{i:'i-shield'},rocket:{i:'i-rocket'},crown:{i:'i-crown'}};
let giftCat={},wallet=null,giftOk=true,giftCache={};
async function loadGiftCatalog(){
  if(!me)return;const {data,error}=await sb.from('gift_catalog').select('*').order('price');
  if(error){giftOk=!/relation|does not exist|schema cache/i.test(error.message)?giftOk:false;return}
  giftOk=true;giftCat={};(data||[]).forEach(c=>giftCat[c.id]=c);
}
async function loadWallet(){
  if(!me||!giftOk)return;const {data,error}=await sb.from('wallets').select('*').eq('user_id',me).maybeSingle();
  if(error){if(/relation|does not exist|schema cache/i.test(error.message))giftOk=false;return}
  wallet=data||{balance:0,last_claim:null};refreshSettings?.();
}
const giftName=t=>giftCat[t]?.name||t;
const infKnots=()=>typeof adminRole!=='undefined'&&adminRole===4;
const balText=()=>infKnots()?'∞':String(wallet?.balance??0);
const canClaim=()=>!wallet||wallet.last_claim!==strToday();
function dailyAmount(){const st=typeof strEff==='function'?strEff(strMe):0,pr=typeof isPremium==='function'&&isPremium(me);return (10+Math.min(st,30))*(pr?2:1)+(wallet&&wallet.last_claim?0:50)}

// ---------- рисунок ----------
function giftSvg(type,bg,pat,rar,size){
  const u='g'+Math.random().toString(36).slice(2,7),art=GART[type],scene=giftIsScene(type),[c1,c2]=scene?(GSKY_T[type]||GSKY[bg%3]):(GBG[bg%9]||GBG[0]),e=GEMB[type]||{i:'i-gem'};
  const P=[`<circle cx="10" cy="10" r="2.4" fill="#fff"/>`,`<path d="M10 5v10M5 10h10" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`,`<circle cx="10" cy="10" r="6" fill="none" stroke="#fff" stroke-width="1.8"/>`,`<path d="M-2 22L22 -2" stroke="#fff" stroke-width="2.4"/>`,`<path d="M0 10q5-7 10 0t10 0" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`][pat%5];
  let em;
  if(art)em=art(u);
  else if(e.y){const s=yarnSvg(e.y,'g'+type);em='<svg x="18" y="16" width="64" height="64" viewBox="0 0 64 64" overflow="visible">'+s.slice(s.indexOf('>')+1,s.lastIndexOf('</svg>'))+'</svg>'}
  else em='<svg x="20" y="18" width="60" height="60" viewBox="0 0 24 24" style="color:#fff;overflow:visible;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))"><use href="#'+e.i+'" stroke-width="2.4"/><use href="#'+e.i+'" opacity=".5" transform="translate(.35 .35)" style="color:rgba(0,0,0,.35)"/></svg>';
  const svg='<svg viewBox="0 0 100 100"><defs><clipPath id="'+u+'cl"><rect width="100" height="100" rx="24"/></clipPath><linearGradient id="'+u+'g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+c1+'"/><stop offset="1" stop-color="'+c2+'"/></linearGradient>'
   +'<pattern id="'+u+'p" width="20" height="20" patternUnits="userSpaceOnUse">'+P+'</pattern>'+giftDefs(u)+'<radialGradient id="'+u+'h" cx=".3" cy=".2" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>'
   +'<rect width="100" height="100" rx="24" fill="url(#'+u+'g)"/><rect width="100" height="100" rx="24" fill="url(#'+u+'p)" opacity="'+(scene?0:.22)+'"/><rect width="100" height="100" rx="24" fill="url(#'+u+'h)"/>'
   +(art?'':'<ellipse cx="50" cy="84" rx="22" ry="4" fill="rgba(0,0,0,.18)"/>')+'<g clip-path="url(#'+u+'cl)">'+em+'</g>'
   +(rar==='legendary'?'<rect width="100" height="100" rx="24" fill="none" stroke="#fde047" stroke-width="3"/>':rar==='epic'?'<rect width="100" height="100" rx="24" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="2"/>':'')+'</svg>';
  return size&&size<60?svg.replace(/<animate(?:Transform)?[^>]*\/>/g,'').replace(/<animate(?:Transform)?[^>]*>[^]*?<\/animate(?:Transform)?>/g,''):svg;
}
function giftEl(g,size,cls){
  const s=el('span','gf-art r-'+(g.rarity||'common')+(cls?' '+cls:''));s.style.width=s.style.height=size+'px';s.innerHTML=giftSvg(g.type,g.bg??0,g.pat??0,g.rarity,size);
  if(g.rarity==='legendary'||g.rarity==='epic'||(cls&&cls.includes('gf-big')))s.append(el('i','gf-shine'));return s;
}
const giftWhen=t=>new Date(t).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
const rarChip=r=>{const c=el('span','gf-rar',GRAR[r]?.[0]||'Обычный');c.style.setProperty('--rc',GRAR[r]?.[1]||'#94a3b8');return c};
const knot=()=>{const k=ico('i-thread','gf-knot');return k};

// ---------- кошелёк ----------
function openWallet(){
  if(!giftOk){toast('Подарки появятся после запуска supabase/v7.sql');return}
  loadWallet();
  openModal(s=>{
    s.classList.add('gf-sheet');
    const top=el('div','sheet-top');top.append(el('h3',null,'Узелки'));const x=el('button','icon');x.append(svgI('i-x'));x.onclick=closeModal;top.append(x);s.append(top);
    const hero=el('div','gf-wallet');const big=el('div','gf-bal');big.append(knot(),el('b',null,balText()));hero.append(big,el('small',null,infKnots()?'у Главного админа узелки бесконечные':'узелков на счёте'));
    const claim=el('button','primary',canClaim()?'Забрать бонус +'+dailyAmount():'Бонус на сегодня получен');claim.disabled=!canClaim();
    claim.onclick=async()=>{claim.disabled=true;const {data,error}=await sb.rpc('claim_daily');if(error){toast(error.message);return}toast('+'+data+' узелков');await loadWallet();openWallet()};
    hero.append(claim);s.append(hero);
    s.append(el('p','gf-how','Бонус каждый день: 10 узелков плюс ваша нить (до 30), у Премиума вдвое больше. Подарок можно обменять обратно на половину цены.'));
    if(typeof adminRole!=='undefined'&&adminRole===0){const bh=giRow('i-shield','Стать Помощником администрации','2500 узелков · аккаунту 14+ дней · бонус забран 7+ раз','gi-accent');bh.onclick=()=>buyHelper();s.append(bh)}
    const mine=giRow('i-gift','Мои подарки','Коллекция, обмен, скрыть из профиля','gi-accent');mine.onclick=()=>{closeModal();setTimeout(()=>openGiftCollection(me),220)};s.append(mine);
    const shop=giRow('i-forward','Подарить другу','Выберите друга в «Новый чат» или откройте чат → «+» → «Подарок»');s.append(shop);
  });
}

// ---------- магазин ----------
function openGiftShop(toUid){
  if(!giftOk){toast('Подарки появятся после запуска supabase/v7.sql');return}
  if(!toUid||String(toUid).startsWith('g:')){toast('Подарки дарят друзьям в личных чатах');return}
  loadWallet();let pick=null;
  openModal(s=>{
    s.classList.add('gf-sheet');
    const top=el('div','sheet-top');top.append(el('h3',null,'Подарок для '+nameOf(toUid).split(' ')[0]));const x=el('button','icon');x.append(svgI('i-x'));x.onclick=closeModal;top.append(x);s.append(top);
    const bar=el('div','gf-bar');const bal=el('button','gf-balchip');bal.append(knot(),el('b',null,balText()));bal.onclick=()=>{closeModal();setTimeout(openWallet,220)};bar.append(bal);
    if(canClaim()){const cl=el('button','gf-claim','Забрать бонус +'+dailyAmount());cl.onclick=async()=>{cl.disabled=true;const {data,error}=await sb.rpc('claim_daily');if(error){toast(error.message);return}toast('+'+data+' узелков');await loadWallet();closeModal();openGiftShop(toUid)};bar.append(cl)}
    s.append(bar);
    let coll='all';const tabs=el('div','gf-tabs');[['all','Все'],['caucasus','Кавказ'],['classic','Классика']].forEach(([k,n])=>{const b=el('button','gf-tab'+(k===coll?' on':''),n);b.onclick=()=>{coll=k;[...tabs.children].forEach(c=>c.classList.toggle('on',c===b));fill()};tabs.append(b)});s.append(tabs);
    const grid=el('div','gf-grid');s.append(grid);const form=el('div','gf-form hide');s.append(form);
    function fill(){grid.innerHTML='';pick=null;form.classList.add('hide');Object.values(giftCat).filter(c=>c.active!==false&&(coll==='all'||giftColl(c.id)===coll)).sort((a,b)=>a.price-b.price).forEach((c,i)=>{
      const left=c.supply==null?null:c.supply-c.sold,out=left!=null&&left<=0;
      const t=el('button','gf-tile'+(out?' out':''));t.style.animationDelay=i*35+'ms';
      t.append(giftEl({type:c.id,bg:(i*3+1)%4,pat:i%5},64),el('b',null,c.name));
      const pr=el('span','gf-price');pr.append(knot(),document.createTextNode(String(c.price)));t.append(pr);
      if(c.supply!=null)t.append(el('small',null,out?'Распродан':'Осталось '+left+' из '+c.supply));
      t.onclick=()=>{if(out)return;pick=c;[...grid.children].forEach(z=>z.classList.toggle('on',z===t));buildForm()};grid.append(t);
    })}
    fill();
    function buildForm(){
      form.classList.remove('hide');form.innerHTML='';
      const row=el('div','gf-pick');row.append(giftEl({type:pick.id,bg:3,pat:0},56),el('div','gf-pick-t'));row.lastChild.append(el('b',null,pick.name),el('small',null,'Редкость и номер выпадут случайно'));form.append(row);
      const note=document.createElement('input');note.placeholder='Сообщение (необязательно)';note.maxLength=100;form.append(note);
      const an=el('label','gf-anon');const cb=document.createElement('input');cb.type='checkbox';an.append(cb,document.createTextNode(' Анонимно (ваше имя не покажем)'));form.append(an);
      const err=el('p','err');const go=el('button','primary wide');go.append(document.createTextNode('Подарить за '+pick.price+' '),knot());
      const have=infKnots()?1e9:(wallet?.balance||0);if(have<pick.price){go.disabled=true;form.append(el('p','gf-need','Не хватает '+(pick.price-have)+' узелков. Заберите ежедневный бонус или обменяйте свой подарок.'))}
      go.onclick=async()=>{go.disabled=true;go.textContent='Отправляю…';
        const {data,error}=await sb.rpc('send_gift',{to_user:toUid,gtype:pick.id,gnote:note.value.trim(),is_anon:cb.checked});
        if(error){err.textContent=error.message;go.disabled=false;go.textContent='Подарить';return}
        await loadWallet();closeModal();toast('Подарок отправлен');if(typeof fx==='function')fx('confetti');
        sendMsg(toUid,{body:'::gift:'+data.id+'::'},{noReply:true}).catch(()=>{});};
      form.append(err,go);form.scrollIntoView?.({block:'nearest',behavior:'smooth'});
    }
  });
}

// ---------- коллекция и карточка подарка ----------
async function giftById(id){
  if(giftCache[id]!==undefined)return giftCache[id];
  const {data}=await sb.from('gifts').select('*').eq('id',id).maybeSingle();return giftCache[id]=data||null;
}
async function loadGiftsOf(uid){
  const {data,error}=await sb.from('gifts').select('*').eq('owner',uid).order('created_at',{ascending:false}).limit(80);
  if(error)return [];(data||[]).forEach(g=>giftCache[g.id]=g);return data||[];
}
function giftsCard(uid){
  if(!giftOk)return null;
  const c=el('section','gi-card gf-card');const h=el('div','gi-h');const cnt=el('small',null,'');h.append(el('span',null,'Подарки'),cnt);c.append(h);
  const grid=el('div','gf-mini');c.append(grid);
  loadGiftsOf(uid).then(list=>{
    const shown=list.filter(g=>g.shown||uid===me);cnt.textContent=shown.length?String(shown.length):'';
    shown.slice(0,8).forEach(g=>{const t=el('button','gf-mt');t.append(giftEl(g,54));t.onclick=()=>openGift(g,uid===me);grid.append(t)});
    if(shown.length>8){const m=el('button','gf-more','+'+(shown.length-8));m.onclick=()=>openGiftCollection(uid);grid.append(m)}
    if(!shown.length)grid.append(el('p','gf-empty',uid===me?'Пока нет подарков':'Подарков пока нет'));
  });
  if(uid!==me&&friendState(uid).s==='friend'){const r=giRow('i-gift','Подарить подарок','За узелки','gi-accent');r.onclick=()=>openGiftShop(uid);c.append(r)}
  return c;
}
async function openGiftCollection(uid){
  const list=await loadGiftsOf(uid);
  openModal(s=>{
    s.classList.add('gf-sheet');
    const top=el('div','sheet-top');top.append(el('h3',null,uid===me?'Мои подарки':'Подарки '+nameOf(uid).split(' ')[0]));const x=el('button','icon');x.append(svgI('i-x'));x.onclick=closeModal;top.append(x);s.append(top);
    const shown=list.filter(g=>g.shown||uid===me);
    if(!shown.length)s.append(el('p','gf-empty','Здесь пока пусто'));
    const grid=el('div','gf-grid');shown.forEach((g,i)=>{const t=el('button','gf-tile');t.style.animationDelay=i*30+'ms';t.append(giftEl(g,64),el('b',null,giftName(g.type)));
      if(!g.shown&&uid===me)t.append(el('small',null,'скрыт'));t.append(rarChip(g.rarity));t.onclick=()=>{closeModal();setTimeout(()=>openGift(g,uid===me),220)};grid.append(t)});
    s.append(grid);
  });
}
function openGift(g,mine){
  const cat=giftCat[g.type]||{};
  openModal(s=>{
    s.classList.add('gf-sheet','gf-detail');s.style.setProperty('--rc',GRAR[g.rarity]?.[1]||'#94a3b8');
    const x=el('button','icon gf-x');x.append(svgI('i-x'));x.onclick=closeModal;s.append(x);
    const stage=el('div','gf-stage');const big=giftEl(g,150,'gf-big');stage.append(el('span','gf-rays'),big);s.append(stage);
    const tilt=e=>{const r=stage.getBoundingClientRect(),x=((e.clientX-r.left)/r.width-.5)*2,y=((e.clientY-r.top)/r.height-.5)*2;big.style.setProperty('--ry',(x*18)+'deg');big.style.setProperty('--rx',(-y*18)+'deg');big.classList.add('tilt')};
    stage.addEventListener('pointermove',tilt);stage.addEventListener('pointerdown',tilt);stage.addEventListener('pointerleave',()=>{big.style.setProperty('--rx','0deg');big.style.setProperty('--ry','0deg')});
    s.append(el('h3','gf-title',giftName(g.type)),rarChip(g.rarity));
    const info=el('div','t-info');
    const row=(k,v)=>{const r=el('div','t-info-r');r.append(el('span',null,k),el('b',null,v));info.append(r)};
    if(cat.supply)row('Номер',g.serial+' из '+cat.supply);else row('Номер','№'+g.serial);
    row('От',g.anon&&g.sender!==me?'Аноним':(g.sender===me?'Вас':nameOf(g.sender||'')));row('Дата',giftWhen(g.created_at));if(cat.price)row('Цена',cat.price+' узелков');
    s.append(info);if(g.note)s.append(el('p','gf-note','«'+g.note+'»'));
    if(mine&&g.owner===me){
      const sh=el('button','ghost wide',g.shown?'Скрыть из профиля':'Показывать в профиле');sh.onclick=async()=>{const {error}=await sb.rpc('set_gift_shown',{gid:g.id,v:!g.shown});if(error){toast(error.message);return}g.shown=!g.shown;delete giftCache[g.id];toast(g.shown?'Показывается в профиле':'Скрыт из профиля');closeModal()};
      const sell=el('button','ghost wide danger',g.farm?'Нельзя обменять (от нового аккаунта)':'Обменять на '+Math.floor((cat.price||0)/2)+' узелков');if(g.farm)sell.disabled=true;sell.onclick=async()=>{
        if(!confirm('Обменять подарок «'+giftName(g.type)+'» на '+Math.floor((cat.price||0)/2)+' узелков? Подарок исчезнет.'))return;
        const {error}=await sb.rpc('sell_gift',{gid:g.id});if(error){toast(error.message);return}delete giftCache[g.id];await loadWallet();closeModal();toast('Обменяно на узелки')};
      s.append(sh,sell);
    }
  });
}

// ---------- карточка в чате ----------
SPECIAL.push({re:/^::gift:(\d+)::$/,cls:'gift-m',forward:false,preview:()=>PI('i-gift')+'Подарок',
  render:(m,d,x)=>{
    const w=el('div','gfcard');d.append(w);
    giftById(+x[1]).then(g=>{
      w.innerHTML='';
      if(!g){w.append(el('small',null,'Подарок обменян или недоступен'));return}
      if(g.sender!==m.sender){w.append(el('small',null,'Карточка не совпадает с подарком (возможна подделка)'));return}
      const mine=m.sender===me,who=g.anon&&!mine?'Аноним':nameOf(m.sender);
      w.style.setProperty('--rc',GRAR[g.rarity]?.[1]||'#94a3b8');
      const ic=giftEl(g,92,'gf-card-art');const t=el('div','gfcard-t');
      t.append(el('small',null,mine?'Вы подарили':who+' дарит вам подарок'),el('b',null,giftName(g.type)),rarChip(g.rarity));
      const cat=giftCat[g.type];if(cat?.supply)t.append(el('small',null,'№'+g.serial+' из '+cat.supply));
      if(g.note)t.append(el('p','gfcard-n','«'+g.note+'»'));
      const b=el('button','ghost sm-btn','Открыть');b.onclick=e=>{e.stopPropagation();openGift(g,g.owner===me)};
      w.append(ic,t,b);
      if(!mine&&Date.now()-new Date(m.created_at)<8000&&typeof fx==='function')setTimeout(()=>fx('confetti'),300);
    });
  }});
function startGiftChat(){if(!cur||isGroupKey(cur)){toast('Откройте личный чат с другом, чтобы сделать подарок');return}openGiftShop(cur)}

async function buyHelper(){
  if(!confirm('Купить уровень «Помощник» за 2500 узелков? Помощник может выдавать короткий мьют нарушителям.'))return;
  const {error}=await sb.rpc('buy_helper');if(error){toast(error.message);return}
  await loadAdminRole();await loadWallet();closeModal();toast('Вы стали Помощником администрации!');if(typeof fx==='function')fx('confetti');
}
