// Логотип «Нити»: облачко с прострочкой, @ в пунктирном круге и иголка с ниткой.
// Восемь цветовых вариантов; выбранный красит и логотип, и всё приложение (акцентные цвета, обои).
// Этот же файл рисует PNG-иконки для экрана телефона: node tools/logos.js
// [id, название, фон1, фон2, облачко: верх-право, середина, низ-лево, нитка, иголка, акцент, акцент2, светлый фон?]
const LOGOS=[
  ['sunset','Закат',   '#24206b','#0c0a30','#b46cff','#f15bb5','#ff9a5a','#f58aa5','#ffffff','#e0459b','#ff8a5c',0],
  ['mint',  'Мята',    '#0d4a3f','#03201b','#27c6f2','#1fd6c6','#43e08a','#4ade80','#ffffff','#0fa391','#27c6f2',0],
  ['light', 'Светлая', '#ffffff','#e9ebf3','#a35cff','#f15bb5','#ff8a5a','#c026d3','#6d28d9','#a855f7','#f472b6',1],
  ['berry', 'Ягода',   '#3d0b52','#170420','#b46cff','#ee4fae','#ff9a5a','#fb7185','#ffffff','#c23ad9','#ff8a5c',0],
  ['ocean', 'Океан',   '#1f56e0','#0a2785','#8fdcff','#5fb0ff','#3b7cf5','#7dd3fc','#ffffff','#2563eb','#38bdf8',0],
  ['gold',  'Графит и золото','#2c2c30','#121214','#ffe066','#f7c531','#e0a31a','#facc15','#ffffff','#c9930e','#f5c542',0],
  ['black', 'Чёрный',  '#222226','#09090b','#e4e4e7','#b9b9c1','#8b8b94','#ffffff','#ffffff','#52525b','#a1a1aa',0],
  ['white', 'Белый',   '#ffffff','#eeeef2','#52525b','#2f2f35','#18181b','#18181b','#18181b','#27272a','#71717a',1],
];
const LOGO_DEFAULT='berry';
const logoById=id=>LOGOS.find(l=>l[0]===id)||LOGOS.find(l=>l[0]===LOGO_DEFAULT);

// shape: 'round' — скруглённый квадрат (сайт, Android), 'square' — без скругления (iPhone сам скругляет),
// 'maskable' — квадрат, рисунок уменьшен в безопасную зону. uid — чтобы id градиентов не пересекались.
function logoSVG(id,shape,uid){
  const [k,,bg1,bg2,c1,c2,c3,thr,ndl,,,light]=logoById(id);
  const u=(uid||k)+'-',sc=shape==='maskable'?.84:1.08,off=(100-100*sc)/2+(shape==='maskable'?0:-1),rx=shape==='round'?23:0;
  const dash=light&&k==='white'?'#ffffff':'#ffffff';
  const glow=light?'rgba(30,20,60,.18)':c2;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
   +'<defs>'
   +'<linearGradient id="'+u+'bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+bg1+'"/><stop offset="1" stop-color="'+bg2+'"/></linearGradient>'
   +'<linearGradient id="'+u+'bb" x1=".95" y1=".05" x2=".1" y2="1"><stop offset="0" stop-color="'+c1+'"/><stop offset=".5" stop-color="'+c2+'"/><stop offset="1" stop-color="'+c3+'"/></linearGradient>'
   +'<radialGradient id="'+u+'hl" cx=".3" cy=".2" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
   +'<filter id="'+u+'gl" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="'+(light?2.2:3.2)+'" flood-color="'+glow+'" flood-opacity="'+(light?1:.55)+'"/></filter>'
   +'</defs>'
   +'<rect width="100" height="100" rx="'+rx+'" fill="url(#'+u+'bg)"/>'
   +'<g transform="translate('+off+' '+off+') scale('+sc+')">'
   // облачко с хвостиком
   +'<path filter="url(#'+u+'gl)" fill="url(#'+u+'bb)" d="M36 19h28a15 15 0 0 1 15 15v15a15 15 0 0 1-15 15H45c-3.6 8.2-11.8 14.2-22 16.6 4.2-4.6 6.3-10 6.5-16.9A15 15 0 0 1 21 49V34a15 15 0 0 1 15-15z"/>'
   +'<path fill="url(#'+u+'hl)" d="M36 19h28a15 15 0 0 1 15 15v15a15 15 0 0 1-15 15H45c-3.6 8.2-11.8 14.2-22 16.6 4.2-4.6 6.3-10 6.5-16.9A15 15 0 0 1 21 49V34a15 15 0 0 1 15-15z"/>'
   // прострочка
   +'<rect x="25.6" y="23.6" width="48.8" height="35.8" rx="11" fill="none" stroke="'+dash+'" stroke-opacity=".92" stroke-width="1.35" stroke-dasharray="3.4 2.5" stroke-linecap="round"/>'
   // @ в пунктирном круге
   +'<circle cx="50" cy="41.5" r="10" fill="none" stroke="'+dash+'" stroke-opacity=".9" stroke-width="1.2" stroke-dasharray="2.6 2.2" stroke-linecap="round"/>'
   +'<g fill="none" stroke="'+dash+'" stroke-opacity=".95" stroke-width="1.35" stroke-linecap="round"><circle cx="50" cy="41.6" r="2.6"/>'
   +'<path d="M52.6 39.2v3.6c0 1.6 2.9 1.9 3-.6.1-3.9-2.6-6.6-5.8-6.6-3.4 0-6.1 2.7-6.1 6.1s2.7 6.1 6.1 6.1c1.3 0 2.4-.3 3.3-.9"/></g>'
   // иголка с ниткой
   +'<path d="M59.6 80.4 81 66.2" stroke="'+ndl+'" stroke-width="2.7" stroke-linecap="round"/>'
   +'<path d="M78.6 67.9 81 66.2" stroke="'+ndl+'" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>'
   +'<path d="M60.4 79.9 64.3 77.3" stroke="'+thr+'" stroke-width="3.1" stroke-linecap="round"/>'
   +'<path d="M60.6 79.7C55.2 83.4 48.6 84.6 42.2 82.6" fill="none" stroke="'+thr+'" stroke-width="1.9" stroke-linecap="round"/>'
   +'</g></svg>';
}
if(typeof module!=='undefined')module.exports={LOGOS,logoSVG,LOGO_DEFAULT};
