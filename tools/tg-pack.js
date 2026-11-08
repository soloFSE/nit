// Скачивает набор эмодзи/стикеров Telegram в папку emoji/<код>/ и дописывает его в emoji/packs.json.
// Нужен бот: напишите @BotFather → /newbot → скопируйте токен. Токен никому не отправляйте и не вставляйте в код.
//
// Запуск (PowerShell):   $env:BOT_TOKEN="ваш_токен"; node tools/tg-pack.js RoboEmoji rb
// Запуск (Git Bash):     BOT_TOKEN=ваш_токен node tools/tg-pack.js History_Chechens_emoji_by_fStikBot hc
//   1-й аргумент — имя набора из ссылки t.me/addemoji/<имя>, 2-й — короткий код из 2–6 латинских букв (им будут писаться :hc12:)
// Поддерживаются обычные (.webp), видео (.webm) и анимированные (.tgs → сохраняются как .json для Lottie) эмодзи.
const fs=require('fs'),path=require('path'),https=require('https'),zlib=require('zlib');
const [,, setName, code]=process.argv,token=process.env.BOT_TOKEN;
if(!setName||!/^[a-z]{2,6}$/.test(code||'')||!token){console.log('Использование: BOT_TOKEN=... node tools/tg-pack.js <имя_набора> <код_2-6_латинских_букв>');process.exit(1)}
const get=(u)=>new Promise((ok,no)=>https.get(u,r=>{const b=[];r.on('data',d=>b.push(d));r.on('end',()=>ok({status:r.statusCode,buf:Buffer.concat(b)}))}).on('error',no));
const api=async(m,q)=>{const r=await get('https://api.telegram.org/bot'+token+'/'+m+'?'+new URLSearchParams(q));const j=JSON.parse(r.buf.toString());if(!j.ok)throw new Error(j.description||'ошибка Telegram');return j.result};
(async()=>{
  const set=await api('getStickerSet',{name:setName});
  const dir=path.join(__dirname,'..','emoji',code);fs.mkdirSync(dir,{recursive:true});
  let n=0,ext='webp';
  for(const s of set.stickers){
    const f=await api('getFile',{file_id:s.file_id});
    const e=s.is_animated?'json':s.is_video?'webm':'webp';ext=e;
    const r=await get('https://api.telegram.org/file/bot'+token+'/'+f.file_path);
    // .tgs — это сжатый Lottie: распаковываем в обычный .json
    fs.writeFileSync(path.join(dir,n+'.'+e),s.is_animated?zlib.gunzipSync(r.buf):r.buf);n++;process.stdout.write('\r'+n+'/'+set.stickers.length);
  }
  if(!n){console.log('\nВ наборе нет подходящих файлов.');process.exit(1)}
  const mf=path.join(__dirname,'..','emoji','packs.json');
  const j=fs.existsSync(mf)?JSON.parse(fs.readFileSync(mf,'utf8')):{packs:[]};
  j.packs=j.packs.filter(p=>p.id!==code);j.packs.push({id:code,name:set.title,n,ext});
  fs.writeFileSync(mf,JSON.stringify(j,null,1));
  console.log('\nГотово: «'+set.title+'» — '+n+' шт. Теперь закоммитьте папку emoji/ и обновите сайт.');
})().catch(e=>{console.error('Ошибка:',e.message);process.exit(1)});
