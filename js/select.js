// Выбор нескольких сообщений (в личках и группах): «Выбрать» в меню сообщения → отмечаем нажатием → копировать / переслать / удалить.
// Выбранные сообщения подсвечены рамкой и галочкой, панель действий появляется внизу.
let selMode=false,selSet=new Set();
function startSelect(id){selMode=true;selSet.clear();document.body.classList.add('sel-mode');closeMenus();toggleSel(String(id));selBar()}
function toggleSel(id){
  id=String(id);const d=nodes[id];if(!d)return;
  if(selSet.has(id)){selSet.delete(id);d.classList.remove('sel');d.querySelector('.selchk')?.remove()}
  else{selSet.add(id);d.classList.add('sel');const c=el('i','selchk');c.append(svgI('i-check'));d.append(c);navigator.vibrate?.(8)}
  if(!selSet.size){endSelect();return}updSelBar();
}
function endSelect(){
  selMode=false;document.body.classList.remove('sel-mode');
  selSet.forEach(id=>{const d=nodes[id];if(d){d.classList.remove('sel');d.querySelector('.selchk')?.remove()}});selSet.clear();
  $('selbar')?.remove();
}
const selMsgs=()=>[...selSet].map(id=>msgs[id]).filter(Boolean).sort((a,b)=>a.id-b.id);
function selBar(){
  $('selbar')?.remove();const b=el('div','selbar');b.id='selbar';
  const x=el('button','icon');x.append(svgI('i-x'));x.title='Отмена';x.onclick=endSelect;
  const n=el('b','sel-n');n.id='selN';b.append(x,n);
  const act=(ic,t,f,cls)=>{const a=el('button','sel-a'+(cls?' '+cls:''));a.append(svgI(ic),el('span',null,t));a.onclick=f;b.append(a)};
  act('i-copy','Копировать',()=>{const t=selMsgs().filter(m=>m.body&&!m.body.startsWith('::')).map(m=>(selSet.size>1?nameOf(m.sender)+': ':'')+m.body).join('\n');
    if(!t){toast('В выбранных нет текста');return}navigator.clipboard?.writeText(t);toast('Скопировано');endSelect()});
  act('i-forward','Переслать',()=>{const l=selMsgs().filter(m=>!m.deleted_at);if(!l.length)return;endSelect();forwardMsg(l)});
  act('i-trash','Удалить',()=>selDelete(),'danger');
  document.body.append(b);updSelBar();
}
function updSelBar(){const n=$('selN');if(n)n.textContent=selSet.size+' '+plural(selSet.size,'сообщение','сообщения','сообщений')}
async function selDelete(){
  const l=selMsgs(),mine=l.filter(m=>m.sender===me&&!m.deleted_at);
  openModal(s=>{
    const top=el('div','sheet-top');top.append(el('h3',null,'Удалить '+l.length+' '+plural(l.length,'сообщение','сообщения','сообщений')));const x=el('button','icon');x.append(svgI('i-x'));x.onclick=closeModal;top.append(x);s.append(top);
    const a=el('button','ghost wide','Удалить у меня');a.onclick=async()=>{closeModal();
      for(const m of l){const {error}=await sb.from('message_hides').insert({message_id:m.id});if(!error){hidden.add(m.id);nodes[m.id]?.remove();delete nodes[m.id]}}
      endSelect();toast('Удалено у вас')};s.append(a);
    if(mine.length){const b=el('button','ghost wide danger','Удалить у всех (своих: '+mine.length+')');b.onclick=async()=>{closeModal();
      for(const m of mine){const {error}=await sb.rpc('delete_for_all',{mid:m.id});if(!error)line({...m,body:'',image_path:null,deleted_at:new Date().toISOString()})}
      endSelect();toast('Удалено у всех')};s.append(b)}
  });
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&selMode)endSelect()});
