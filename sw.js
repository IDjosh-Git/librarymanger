/* Library Manager 5.53 - offline-tolerant app shell.
   Only public app files and pinned library scripts are cached. Account data,
   uploaded book images, Supabase/auth requests and API responses are NEVER cached.
   Those remain in Supabase or the authenticated user's IndexedDB scan journal. */
'use strict';
const VERSION='lm-app-shell-v553',SHELL='lm-app-shell-v553',LIBRARIES='lm-libraries-v553';
const PAGES=['/','/index.html','/book-of-the-week.html','/reading-guide.html'];
const LOCAL=[
 '/assets/library-manager-v542.css?v=5.53.0','/assets/reading-v542.css','/assets/book-of-week-v542.css',
 '/assets/scan-resume.js?v=5.51.0','/assets/scan-upload-dedup.js?v=5.51.0','/assets/scan-stream.js?v=5.32.0',
 '/assets/scan-progress.js?v=5.32.0','/assets/scan-extraction.js?v=5.36.0',
 '/assets/scan-auto-route.js?v=5.37.0','/assets/book-identifiers.js?v=5.36.0',
 '/assets/premium-progress-upload.js?v=5.53.0','/assets/library-shelves-fallback.jpg',
 '/assets/library-reading-fallback.jpg','/assets/book-logo.svg','/assets/icons.svg'
];
const EXTERNAL=[
 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js',
 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0/dist/umd/supabase.min.js'
];
const CDN='https://cdn.jsdelivr.net/';
const safeLocal=url=>url.origin===self.location.origin&&!url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/auth/')&&!url.pathname.startsWith('/rest/');
const externalScript=url=>url.origin===new URL(CDN).origin&&EXTERNAL.includes(url.href);
async function cacheWorkingRequest(cache,request,response){
 if(response&&(response.ok||response.type==='opaque'))try{await cache.put(request,response.clone())}catch{}
 return response;
}
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(SHELL);
  await Promise.allSettled([...PAGES,...LOCAL].map(async pathname=>{
   const req=new Request(new URL(pathname,self.location.origin),{cache:'reload'});
   try{await cacheWorkingRequest(cache,req,await fetch(req))}catch{}
  }));
  const deps=await caches.open(LIBRARIES);
  await Promise.allSettled(EXTERNAL.map(async url=>{
   const req=new Request(url,{mode:'no-cors',cache:'reload'});
   try{await cacheWorkingRequest(deps,req,await fetch(req))}catch{}
  }));
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('lm-')&&![SHELL,LIBRARIES].includes(k)).map(k=>caches.delete(k)));
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(externalScript(url)){
  event.respondWith((async()=>{
   const cache=await caches.open(LIBRARIES),saved=await cache.match(request);
   if(saved)return saved;
   try{return await cacheWorkingRequest(cache,request,await fetch(request))}catch{return Response.error()}
  })());return;
 }
 if(!safeLocal(url))return;
 const isDoc=request.mode==='navigate';
 event.respondWith((async()=>{
  const cache=await caches.open(SHELL);
  try{
   const live=await Promise.race([fetch(request),new Promise((_,reject)=>setTimeout(()=>reject(Error('Network too slow')),isDoc?3000:2500))]);
   if(live.ok)return cacheWorkingRequest(cache,request,live);
  }catch{}
  const cached=await cache.match(request,{ignoreSearch:false}) || (isDoc?await cache.match('/index.html'):null);
  return cached||Response.error();
 })());
});
