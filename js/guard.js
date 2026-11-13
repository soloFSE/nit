// Защита от «кликджекинга»: если сайт открыт внутри чужой страницы (iframe), показывать его нельзя
// (через <meta> нельзя запретить встраивание, поэтому проверяем сами; запускается первым, до остального кода)
(function(){
  try{if(window.top!==window.self){document.documentElement.style.display='none';try{window.top.location=window.self.location}catch(e){}}}
  catch(e){document.documentElement.style.display='none'}
})();
