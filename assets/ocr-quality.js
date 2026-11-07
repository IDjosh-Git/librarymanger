/* Fast, confidence-aware OCR helpers. No network calls or dependencies. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.LibraryOCRQuality=api;
})(typeof window!=='undefined'?window:undefined,function(){
 'use strict';
 const clean=t=>String(t||'').replace(/\s+/g,' ').trim();
 function evaluate(result,{hasISBN=false,hasTitle=false}={}){
  const text=clean(result?.data?.text);
  const confidence=Math.max(0,Math.min(100,Number(result?.data?.confidence)||0));
  const readable=(text.match(/[\p{L}\p{N}]/gu)||[]).length;
  const noisy=(text.match(/[~`|\\{}<>]/g)||[]).length;
  const meaningful=readable>=18&&readable/Math.max(1,text.length)>.55;
  let score=Math.min(1,confidence/100)*.55 + Math.min(1,readable/110)*.18 + (meaningful?.12:0) + (hasTitle?.10:0) + (hasISBN?.23:0) - Math.min(.2,noisy/Math.max(1,text.length));
  score=Math.max(0,Math.min(1,score));
  return {text,confidence,readable,score,hasISBN,hasTitle};
 }
 function needsEnhancement(q){
  if(!q||q.readable<10)return true;
  if(q.hasISBN&&q.confidence>=45)return false;
  return !(q.confidence>=74&&q.readable>=35&&(q.hasTitle||q.readable>=95))&&q.score<.70;
 }
 function needsOrientation(q){return !q||q.readable<13||q.score<.23}
 function prefer(a,b){
  if(!a)return b;if(!b)return a;
  if(a.hasISBN!==b.hasISBN)return b.hasISBN?b:a;
  return b.score>a.score+.035?b:a;
 }
 function maxSide({memory=4,cores=2,enhanced=false}={}){
  if(enhanced)return memory<=2?1760:memory<4?1920:2200;
  return memory<=2?1400:cores>=4&&memory>=4?1740:1540;
 }
 return {evaluate,needsEnhancement,needsOrientation,prefer,maxSide};
});
