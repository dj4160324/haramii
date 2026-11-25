/* Hosting proxy may omit custom static headers. Establish isolation locally. */
(async()=>{
 if(globalThis.crossOriginIsolated||window.top!==window.self||!('serviceWorker'in navigator))return;
 const key='haramii-isolation-reloaded-v1';
 try{
  const registration=await navigator.serviceWorker.register('/isolation-sw.js',{scope:'/'});
  const reload=()=>{if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,'1');location.reload();};
  if(navigator.serviceWorker.controller)reload();
  else navigator.serviceWorker.addEventListener('controllerchange',reload,{once:true});
 }catch(e){console.warn('Haramii browser isolation unavailable:',e.message);}
})();
