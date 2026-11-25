/* Adds stricter isolation headers to this app's same-origin responses.
   No caching, data storage, request modification, or authentication bypass. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(url.origin!==self.location.origin||request.method!=='GET'||url.pathname.startsWith('/signin-with-chatgpt'))return;
 if(request.cache==='only-if-cached'&&request.mode!=='same-origin')return;
 event.respondWith((async()=>{
  const response=await fetch(request);
  if(response.status===0||response.type==='opaqueredirect')return response;
  const headers=new Headers(response.headers);
  headers.set('Cross-Origin-Opener-Policy','same-origin');
  headers.set('Cross-Origin-Embedder-Policy','require-corp');
  headers.set('Cross-Origin-Resource-Policy','same-origin');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 })());
});
