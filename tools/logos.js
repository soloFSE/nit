// Рисует PNG-иконки логотипа во всех цветах (js/logo.js) для экрана телефона.
// Запуск: node tools/logos.js  (нужен пакет @resvg/resvg-js: npm i @resvg/resvg-js, или путь в RESVG)
// Результат: icons/logo/<id>-180.png (iPhone), -192.png, -512.png, -mask.png (Android) и icons/icon-*.png (вариант по умолчанию)
const fs=require('fs'),path=require('path');
const {Resvg}=require(process.env.RESVG||'@resvg/resvg-js');
const {LOGOS,logoSVG,LOGO_DEFAULT}=require('../js/logo.js');
const root=path.join(__dirname,'..'),out=path.join(root,'icons','logo');
fs.mkdirSync(out,{recursive:true});
const png=(svg,w)=>new Resvg(svg,{fitTo:{mode:'width',value:w},font:{loadSystemFonts:false}}).render().asPng();
for(const [id] of LOGOS){
  fs.writeFileSync(path.join(out,id+'-180.png'),png(logoSVG(id,'square'),180));
  fs.writeFileSync(path.join(out,id+'-192.png'),png(logoSVG(id,'round'),192));
  fs.writeFileSync(path.join(out,id+'-512.png'),png(logoSVG(id,'round'),512));
  fs.writeFileSync(path.join(out,id+'-mask.png'),png(logoSVG(id,'maskable'),512));
}
// Иконки по умолчанию (manifest, apple-touch-icon)
fs.copyFileSync(path.join(out,LOGO_DEFAULT+'-192.png'),path.join(root,'icons','icon-192.png'));
fs.copyFileSync(path.join(out,LOGO_DEFAULT+'-512.png'),path.join(root,'icons','icon-512.png'));
fs.copyFileSync(path.join(out,LOGO_DEFAULT+'-mask.png'),path.join(root,'icons','icon-maskable-512.png'));
fs.copyFileSync(path.join(out,LOGO_DEFAULT+'-180.png'),path.join(root,'icons','apple-touch-icon.png'));
// Лист для проверки глазами
if(process.argv[2]){
  const cells=LOGOS.map(([id],i)=>'<g transform="translate('+(i%4*110+5)+' '+(Math.floor(i/4)*110+5)+')">'+logoSVG(id,'round','s'+i).replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">','<svg width="100" height="100" viewBox="0 0 100 100">')+'</g>').join('');
  fs.writeFileSync(process.argv[2],png('<svg xmlns="http://www.w3.org/2000/svg" width="445" height="225"><rect width="445" height="225" fill="#eeeef4"/>'+cells+'</svg>',1335));
}
console.log('logos:',LOGOS.length);
