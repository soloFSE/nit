// Установка как приложение (PWA). Работает только с сайта по https (например GitHub Pages),
// у файла, открытого с компьютера, такой возможности нет.
(window.__mods=window.__mods||[]).push('js/pwa.js');
let installEvt=null;
if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost')){
  navigator.serviceWorker.register('sw.js').catch(e=>console.warn('sw',e));
}
// Chrome/Android: показываем свою кнопку «Установить»
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;$('install').classList.remove('hide')});
window.addEventListener('appinstalled',()=>{installEvt=null;$('install').classList.add('hide');toast('Нить установлена')});
$('install').onclick=async()=>{
  if(installEvt){installEvt.prompt();await installEvt.userChoice;installEvt=null;$('install').classList.add('hide');return}
};
// iPhone: подсказка, как добавить на главный экран (один раз)
const isIos=/iphone|ipad|ipod/i.test(navigator.userAgent),standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
if(isIos&&!standalone&&location.protocol==='https:'){
  try{if(!localStorage.getItem('nit-ios-tip')){setTimeout(()=>{toast('Чтобы установить Нить: «Поделиться» → «На экран „Домой“»');localStorage.setItem('nit-ios-tip','1')},4000)}}catch{}
}
