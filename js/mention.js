// Упоминания в группах (@ник) как в Telegram: подсказка участников при наборе «@»,
// подсветка в тексте, нажатие — профиль; если упомянули вас — сообщение выделено,
// в списке чатов у группы значок «@», уведомление приходит, даже если звук групп выключен.
const MENTION_RE=/(^|[^\w@])@([a-z0-9_]{3,20}|все|all)(?![\w])/gi;
let mentionOf={}; // chatKey → есть непрочитанное упоминание меня

// ---------- Подсказка при наборе ----------
let mlist=null,mSel=0,mItems=[];
function mentionToken(){
  const i=$('msg'),pos=i.selectionStart??i.value.length,before=i.value.slice(0,pos);
  const m=/(^|\s)@([a-zа-я0-9_]{0,20})$/i.exec(before);return m?{q:m[2].toLowerCase(),start:pos-m[2].length-1,end:pos}:null;
}
function hideMentions(){mlist?.remove();mlist=null;mItems=[]}
function showMentions(){
  if(!cur||!isGroupKey(cur)){hideMentions();return}
  const tok=mentionToken();if(!tok){hideMentions();return}
  const gid=gidOf(cur),q=tok.q;
  const users=(gm[gid]||[]).filter(u=>u!==me).filter(u=>!q||(people[u]||'').startsWith(q)||nameOf(u).toLowerCase().includes(q));
  mItems=users.slice(0,8).map(u=>({nick:people[u],u}));
  if(!q||'все'.startsWith(q)||'all'.startsWith(q))mItems.push({nick:'все',all:true});
  if(!mItems.length){hideMentions();return}
  if(!mlist){mlist=el('div','mlist');$('pane').append(mlist)}
  mSel=Math.min(mSel,mItems.length-1);mlist.innerHTML='';
  mItems.forEach((it,i)=>{
    const r=el('button','mrow'+(i===mSel?' on':''));
    if(it.all){const a=el('span','ava');a.style.setProperty('--s','32px');a.append(svgI('i-users'));r.append(a,el('b',null,'Все участники'),el('small',null,'@все'))}
    else r.append(avatar(it.u,32),el('b',null,nameOf(it.u)),el('small',null,'@'+it.nick));
    r.onpointerdown=e=>e.preventDefault(); // не терять фокус поля
    r.onclick=()=>pickMention(i);mlist.append(r);
  });
}
function pickMention(i){
  const it=mItems[i],tok=mentionToken();if(!it||!tok)return;
  const v=$('msg').value,ins='@'+it.nick+' ';
  $('msg').value=v.slice(0,tok.start)+ins+v.slice(tok.end);
  const p=tok.start+ins.length;$('msg').setSelectionRange(p,p);$('msg').dispatchEvent(new Event('input'));
  hideMentions();$('msg').focus();
}
$('msg').addEventListener('input',()=>{mSel=0;showMentions()});
$('msg').addEventListener('click',showMentions);
$('msg').addEventListener('blur',()=>setTimeout(hideMentions,150));
$('msg').addEventListener('keydown',e=>{
  if(!mlist)return;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();mSel=(mSel+(e.key==='ArrowDown'?1:-1)+mItems.length)%mItems.length;showMentions()}
  else if(e.key==='Enter'||e.key==='Tab'){e.preventDefault();e.stopImmediatePropagation();pickMention(mSel)}
  else if(e.key==='Escape'){hideMentions()}
},true);

// ---------- Подсветка в тексте ----------
const idByNick=n=>Object.keys(people).find(id=>people[id]===n);
function mentionsMe(m){
  if(!m?.group_id||!m.body||m.sender===me||!myName)return false;
  for(const x of m.body.matchAll(MENTION_RE)){const n=x[2].toLowerCase();if(n===myName||n==='все'||n==='all')return true}
  return false;
}
// Оборачиваем @ники внутри уже готового текста (ссылки не трогаем)
function linkMentions(frag){
  const walk=[...frag.childNodes].filter(n=>n.nodeType===3);
  walk.forEach(t=>{
    const s=t.textContent;if(!s.includes('@'))return;
    const f=document.createDocumentFragment();let last=0;
    for(const x of s.matchAll(MENTION_RE)){
      const at=x.index+x[1].length,n=x[2].toLowerCase(),id=idByNick(n),all=n==='все'||n==='all';
      if(!id&&!all)continue;
      f.append(document.createTextNode(s.slice(last,at)));
      const a=el('span','mention'+(id===me||all?' me':''),'@'+x[2]);
      if(id){a.onclick=e=>{e.stopPropagation();id===me?openSettings():showProfile(id)}}
      f.append(a);last=at+1+x[2].length;
    }
    if(!last)return;f.append(document.createTextNode(s.slice(last)));t.replaceWith(f);
  });
  return frag;
}
