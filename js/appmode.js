// Режим «приложение для Android» (оболочка Capacitor добавляет к браузеру пометку NitApp). Запускается первым.
// В приложении вход через Google и GitHub не работает (Google запрещает вход во встроенном окне) — прячем эти кнопки: остаются почта, ник и код из письма.
const IN_APP=/NitApp\//.test(navigator.userAgent);
if(IN_APP)document.documentElement.classList.add('in-app');
const APK_URL='https://github.com/soloFSE/nit/releases/download/android-latest/nit.apk';
