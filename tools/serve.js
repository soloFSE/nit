// Локальный сервер для проверки: node tools/serve.js .  →  http://localhost:5173/ (настоящий Supabase)
// и http://localhost:5173/__test (та же страница с подставной базой из tools/mock.js, без входа).
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..')),T={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript'};
http.createServer((q,r)=>{
  const u=q.url.split('?')[0];
  // /__test — та же страница, но с подставным Supabase вместо настоящего
  if(u==='/__test'){
    let h=fs.readFileSync(path.join(root,'index.html'),'utf8');
    h=h.replace(/<script src="(https:\/\/cdn\.jsdelivr[^"]*|js\/vendor\/supabase\.min\.js)"><\/script>/,'<script src="/__mock.js"></script>');
    r.writeHead(200,{'Content-Type':T['.html']});r.end(h);return;
  }
  if(u==='/__mock.js'){r.writeHead(200,{'Content-Type':T['.js']});r.end(fs.readFileSync(path.join(__dirname,'mock.js')));return}
  let p=path.join(root,decodeURIComponent(u));if(u==='/')p=path.join(root,'index.html');
  fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'});r.end(d)});
}).listen(5173,()=>console.log('listening'));
