// Редактор фото перед отправкой (как в Telegram/WhatsApp): рисование кистью, текст, обрезка и поворот.
// editPhoto(file) → Promise<File|null> (null — отменили). Работает на canvas до 1600 px; «назад» хранит снимки.
const PE_COLORS=['#ffffff','#111111','#ef4444','#f97316','#facc15','#22c55e','#3b82f6','#a855f7','#ec4899'];

function editPhoto(file){
  return new Promise(done=>{
    const img=new Image(),url=URL.createObjectURL(file);
    img.onerror=()=>{URL.revokeObjectURL(url);toast('Не получилось открыть фото');done(null)};
    img.onload=()=>{URL.revokeObjectURL(url);run(img)};img.src=url;
    function run(img){
      const k=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
      let cv=document.createElement('canvas');cv.width=Math.round(img.naturalWidth*k);cv.height=Math.round(img.naturalHeight*k);
      cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
      const undo=[];let tool='draw',color=PE_COLORS[2],size=8,aspect=0,crop=null,changed=false;
      const snap=()=>{const c=document.createElement('canvas');c.width=cv.width;c.height=cv.height;c.getContext('2d').drawImage(cv,0,0);undo.push(c);if(undo.length>14)undo.shift();changed=true;upd()};
      // --- разметка ---
      const box=el('div','pe');
      const top=el('div','pe-top');
      const x=el('button','icon pe-b');x.append(svgI('i-x'));x.title='Отмена';
      const un=el('button','icon pe-b');un.append(svgI('i-undo'));un.title='Отменить действие';
      const ok=el('button','pe-done','Готово');
      top.append(x,el('span','pe-sp'),un,ok);
      const stage=el('div','pe-stage');const view=document.createElement('canvas');view.className='pe-view';stage.append(view);
      const cropBox=el('div','pe-crop hide');['tl','tr','bl','br'].forEach(h=>cropBox.append(el('i','pe-h '+h)));stage.append(cropBox);
      const opts=el('div','pe-opts');
      const bar=el('div','pe-bar');
      const tools=[['draw','i-brush','Рисовать'],['text','i-type','Текст'],['crop','i-crop','Обрезать']];
      const tb={};tools.forEach(([id,ic,t])=>{const b=el('button','pe-t');b.append(svgI(ic),el('span',null,t));b.onclick=()=>setTool(id);tb[id]=b;bar.append(b)});
      box.append(top,stage,opts,bar);document.body.append(box);requestAnimationFrame(()=>box.classList.add('in'));
      const fit=()=>{ // холст целиком помещается в сцену
        const r=stage.getBoundingClientRect(),s=Math.min(r.width/cv.width,r.height/cv.height);
        view.style.width=Math.round(cv.width*s)+'px';view.style.height=Math.round(cv.height*s)+'px';view.width=cv.width;view.height=cv.height;paint();placeCrop()};
      const paint=()=>{view.getContext('2d').drawImage(cv,0,0)};
      const upd=()=>{un.disabled=!undo.length};
      const close=r=>{box.classList.remove('in');setTimeout(()=>box.remove(),220);removeEventListener('resize',fit);done(r)};
      x.onclick=()=>{if(changed&&!confirm('Отменить все изменения?'))return;close(null)};
      un.onclick=()=>{const c=undo.pop();if(!c)return;cv=c;fit();upd()};
      ok.onclick=()=>{if(tool==='crop')applyCrop();
        if(!changed){close(null);return}
        cv.toBlob(b=>close(b?new File([b],(file.name||'photo').replace(/\.\w+$/,'')+'.jpg',{type:'image/jpeg'}):null),'image/jpeg',.9)};
      addEventListener('resize',fit);
      // --- координаты ---
      const pt=e=>{const r=view.getBoundingClientRect();return [(e.clientX-r.left)*cv.width/r.width,(e.clientY-r.top)*cv.height/r.height]};
      // --- рисование ---
      let drawing=null;
      view.onpointerdown=e=>{
        if(tool==='draw'){view.setPointerCapture(e.pointerId);snap();const [px,py]=pt(e);drawing={x:px,y:py};
          const c=cv.getContext('2d');c.fillStyle=color;c.beginPath();c.arc(px,py,lw()/2,0,7);c.fill();paint()}
        else if(tool==='text'){e.preventDefault();addText(pt(e),e)}
      };
      const lw=()=>size*cv.width/900*1.6;
      view.onpointermove=e=>{if(!drawing)return;const [px,py]=pt(e),c=cv.getContext('2d');
        c.strokeStyle=color;c.lineWidth=lw();c.lineCap=c.lineJoin='round';c.beginPath();c.moveTo(drawing.x,drawing.y);c.lineTo(px,py);c.stroke();drawing={x:px,y:py};paint()};
      view.onpointerup=view.onpointercancel=()=>{drawing=null};
      // --- текст ---
      function addText([px,py],e){
        const r=stage.getBoundingClientRect();const inp=document.createElement('input');inp.className='pe-text';inp.placeholder='Текст';inp.maxLength=60;inp.style.color=color;
        inp.style.left=(e.clientX-r.left)+'px';inp.style.top=(e.clientY-r.top)+'px';stage.append(inp);setTimeout(()=>inp.focus(),30);
        const commit=()=>{const t=inp.value.trim();inp.remove();if(!t)return;snap();const c=cv.getContext('2d'),fs=Math.round(size*cv.width/900*6+cv.width/22);
          c.font='800 '+fs+'px Manrope,system-ui,sans-serif';c.textBaseline='middle';c.lineJoin='round';c.lineWidth=fs/6;c.strokeStyle=color==='#111111'||color==='#ffffff'?(color==='#ffffff'?'rgba(0,0,0,.55)':'rgba(255,255,255,.7)'):'rgba(0,0,0,.45)';
          c.fillStyle=color;const w=c.measureText(t).width,tx=Math.max(8,Math.min(cv.width-w-8,px-w/2));c.strokeText(t,tx,py);c.fillText(t,tx,py);paint()};
        inp.onkeydown=ev=>{if(ev.key==='Enter')commit();if(ev.key==='Escape')inp.remove()};inp.onblur=commit;
      }
      // --- обрезка ---
      const placeCrop=()=>{if(tool!=='crop'||!crop){cropBox.classList.add('hide');return}
        const vw=view.clientWidth,vh=view.clientHeight,sr=stage.getBoundingClientRect(),vr=view.getBoundingClientRect(),ox=vr.left-sr.left,oy=vr.top-sr.top;
        cropBox.classList.remove('hide');Object.assign(cropBox.style,{left:ox+crop.x/cv.width*vw+'px',top:oy+crop.y/cv.height*vh+'px',width:crop.w/cv.width*vw+'px',height:crop.h/cv.height*vh+'px'})};
      const resetCrop=()=>{crop={x:cv.width*.06,y:cv.height*.06,w:cv.width*.88,h:cv.height*.88};if(aspect)setAspect(aspect)};
      const setAspect=a=>{aspect=a;if(!a||!crop)return;let w=crop.w,h=w/a;if(h>cv.height){h=cv.height*.9;w=h*a}if(w>cv.width){w=cv.width*.9;h=w/a}
        crop={x:Math.max(0,Math.min(cv.width-w,crop.x+(crop.w-w)/2)),y:Math.max(0,Math.min(cv.height-h,crop.y+(crop.h-h)/2)),w,h};placeCrop()};
      let cd=null;
      cropBox.onpointerdown=e=>{e.preventDefault();cropBox.setPointerCapture(e.pointerId);const h=e.target.classList.contains('pe-h')?e.target.classList[1]:'move';cd={h,x:e.clientX,y:e.clientY,c:{...crop}}};
      cropBox.onpointermove=e=>{if(!cd)return;const vr=view.getBoundingClientRect(),sx=cv.width/vr.width,dx=(e.clientX-cd.x)*sx,dy=(e.clientY-cd.y)*sx,o=cd.c,min=40;let {x:cx,y:cy,w,h}=o;
        if(cd.h==='move'){cx=Math.max(0,Math.min(cv.width-w,o.x+dx));cy=Math.max(0,Math.min(cv.height-h,o.y+dy))}
        else{let l=o.x,t=o.y,r=o.x+o.w,b=o.y+o.h;
          if(cd.h.includes('l'))l=Math.max(0,Math.min(r-min,o.x+dx));if(cd.h.includes('r'))r=Math.min(cv.width,Math.max(l+min,r+dx));
          if(cd.h.includes('t'))t=Math.max(0,Math.min(b-min,o.y+dy));if(cd.h.includes('b'))b=Math.min(cv.height,Math.max(t+min,b+dy));
          w=r-l;h=b-t;if(aspect){const nh=w/aspect;if(cd.h.includes('t'))t=b-nh;else b=t+nh;h=nh;if(t<0||b>cv.height){return}}cx=l;cy=t}
        crop={x:cx,y:cy,w,h};placeCrop()};
      cropBox.onpointerup=cropBox.onpointercancel=()=>{cd=null};
      const applyCrop=()=>{if(!crop)return;const full=crop.w>=cv.width*.995&&crop.h>=cv.height*.995;if(full){crop=null;return}
        snap();const c=document.createElement('canvas');c.width=Math.round(crop.w);c.height=Math.round(crop.h);c.getContext('2d').drawImage(cv,crop.x,crop.y,crop.w,crop.h,0,0,c.width,c.height);cv=c;crop=null;fit()};
      const rotate=()=>{snap();const c=document.createElement('canvas');c.width=cv.height;c.height=cv.width;const g=c.getContext('2d');g.translate(c.width/2,c.height/2);g.rotate(Math.PI/2);g.drawImage(cv,-cv.width/2,-cv.height/2);cv=c;if(tool==='crop')resetCrop();fit()};
      // --- панель настроек инструмента ---
      function setTool(t){
        if(tool==='crop'&&t!=='crop')applyCrop();
        tool=t;Object.entries(tb).forEach(([id,b])=>b.classList.toggle('on',id===t));opts.innerHTML='';view.style.cursor=t==='draw'?'crosshair':t==='text'?'text':'default';
        if(t==='crop'){resetCrop();
          [['Свободно',0],['1:1',1],['4:3',4/3],['16:9',16/9]].forEach(([n,a])=>{const b=el('button','pe-chip'+(aspect===a?' on':''),n);b.onclick=()=>{aspect=a;[...opts.querySelectorAll('.pe-chip')].forEach(z=>z.classList.toggle('on',z===b));if(a)setAspect(a)};opts.append(b)});
          const r=el('button','pe-chip');r.append(svgI('i-rotate'),document.createTextNode('Повернуть'));r.onclick=rotate;opts.append(r)}
        else{
          const sw=el('div','pe-colors');PE_COLORS.forEach(c=>{const b=el('button','pe-col'+(c===color?' on':''));b.style.background=c;b.onclick=()=>{color=c;[...sw.children].forEach(z=>z.classList.toggle('on',z===b))};sw.append(b)});
          const sl=document.createElement('input');sl.type='range';sl.min=3;sl.max=22;sl.value=size;sl.className='pe-size';sl.oninput=()=>size=+sl.value;
          opts.append(sw,sl)}
        placeCrop();
      }
      upd();setTool('draw');requestAnimationFrame(fit);
    }
  });
}
