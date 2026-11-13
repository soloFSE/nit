// Собирает весь сайт в один файл dist/nit.html — его можно просто скинуть другу.
// Запуск: node build.js
const fs=require('fs'),path=require('path');
const dir=__dirname,read=f=>fs.readFileSync(path.join(dir,f),'utf8');
let html=read('index.html');
// Одиночный файл — это «упрощённая» версия для друга: скрипты внутри страницы, поэтому строгая политика безопасности (CSP) ей не подходит.
// Настоящий сайт (GitHub Pages) работает со строгой политикой. Эмодзи-панель и шрифт в одиночном файле недоступны (лежат в js/vendor и css/fonts).
html=html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/,'');
// Стили — внутрь <style>
html=html.replace(/<link rel="stylesheet" href="([^"]+)">/g,(_,f)=>'<style>\n'+read(f)+'\n</style>');
// Свои скрипты — внутрь <script> (внешние, вроде Supabase с CDN, не трогаем)
html=html.replace(/<script src="(js\/[^"]+)"><\/script>/g,(_,f)=>'<script>\n'+read(f).replace(/<\/script/gi,'<\\/script')+'\n</script>');
// Файл с компьютера не может быть приложением (PWA) — убираем ссылки на манифест и иконку
html=html.replace(/<link rel="(manifest|apple-touch-icon)"[^>]*>\n?/g,'');
fs.mkdirSync(path.join(dir,'dist'),{recursive:true});
fs.writeFileSync(path.join(dir,'dist','nit.html'),html);
console.log('Готово: dist/nit.html ('+Math.round(html.length/1024)+' КБ)');
