// Обрезка аватарки: двигать пальцем/мышью, приближать щипком, колёсиком или ползунком.
// cropImage(file, size, round) → Promise<Blob|null> (null — отменили). Своё окно поверх всего.
function cropImage(file,size=320,round=true){
  return new Promise(res=>{
    const url=URL.createObjectURL(file),img=new Image();
    img.onerror=()=>{URL.revokeObjectURL(url);alert('Это не картинка');res(null)};
    img.onload=()=>{
      const box=el('div','crop');
      const stage=el('div','crop-stage'+(round?' round':''));const pic=document.createElement('img');pic.src=url;pic.alt='';pic.draggable=false;
      const mask=el('div','crop-mask');stage.append(pic,mask);
      const zoom=document.createElement('input');zoom.type='range';zoom.min='1';zoom.max='4';zoom.step='0.01';zoom.value='1';zoom.className='crop-zoom';
      const bar=el('div','crop-bar');
      const no=el('button','ghost','Отмена'),ok=el('button','primary','Готово');bar.append(no,ok);
      const card=el('div','crop-card');card.append(el('b',null,'Выберите область'),stage,zoom,bar);box.append(card);document.body.append(box);
      const S=()=>stage.clientWidth; // размер рамки
      let k=1,x=0,y=0; // масштаб и сдвиг (в пикселях рамки)
      const base=()=>S()/Math.min(img.width,img.height); // картинка закрывает рамку при k=1
      const clamp=()=>{const s=base()*k,w=img.width*s,h=img.height*s,n=S();x=Math.min(0,Math.max(n-w,x));y=Math.min(0,Math.max(n-h,y))};
      const paint=()=>{clamp();const s=base()*k;pic.style.width=img.width*s+'px';pic.style.height=img.height*s+'px';pic.style.transform=`translate(${x}px,${y}px)`};
      const center=()=>{const s=base()*k,n=S();x=(n-img.width*s)/2;y=(n-img.height*s)/2};
      const setZoom=(nk,cx=S()/2,cy=S()/2)=>{nk=Math.max(1,Math.min(4,nk));const r=nk/k;x=cx-(cx-x)*r;y=cy-(cy-y)*r;k=nk;zoom.value=k;paint()};
      requestAnimationFrame(()=>{center();paint()});
      zoom.oninput=()=>setZoom(+zoom.value);
      stage.addEventListener('wheel',e=>{e.preventDefault();const r=stage.getBoundingClientRect();setZoom(k*(e.deltaY<0?1.1:.9),e.clientX-r.left,e.clientY-r.top)},{passive:false});
      // Перетаскивание и щипок
      const pts=new Map();let last=null,lastD=0;
      stage.addEventListener('pointerdown',e=>{try{stage.setPointerCapture(e.pointerId)}catch{}pts.set(e.pointerId,[e.clientX,e.clientY]);last=null;lastD=0});
      stage.addEventListener('pointermove',e=>{
        if(!pts.has(e.pointerId))return;pts.set(e.pointerId,[e.clientX,e.clientY]);const p=[...pts.values()];
        if(p.length===1){if(last){x+=p[0][0]-last[0];y+=p[0][1]-last[1];paint()}last=p[0]}
        else{const d=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]),r=stage.getBoundingClientRect();
          if(lastD)setZoom(k*d/lastD,(p[0][0]+p[1][0])/2-r.left,(p[0][1]+p[1][1])/2-r.top);lastD=d;last=null}
      });
      const up=e=>{pts.delete(e.pointerId);last=null;lastD=0};stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);
      const done=b=>{box.classList.add('out');setTimeout(()=>{box.remove();URL.revokeObjectURL(url)},180);res(b)};
      no.onclick=()=>done(null);box.onclick=e=>{if(e.target===box)done(null)};
      ok.onclick=()=>{
        const s=base()*k,c=document.createElement('canvas');c.width=c.height=size;
        const sx=-x/s,sy=-y/s,sw=S()/s;
        c.getContext('2d').drawImage(img,sx,sy,sw,sw,0,0,size,size);
        c.toBlob(b=>done(b),'image/jpeg',.88);
      };
    };
    img.src=url;
  });
}
