/* v5.32 — truthful, continuously updated multi-stage batch progress. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.LibraryScanProgress=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const clamp=(n,max)=>Math.max(0,Math.min(max,Number.isFinite(+n)?+n:0));
 function snapshot({total=0,prepared=0,checked=0,finished=0}={}){
  const count=Math.max(0,Math.floor(+total||0)),prep=clamp(prepared,count),verified=clamp(checked,count),completed=clamp(finished,count);
  // Preparation, cloud checking and recognition are measured separately;
  // the percentage never reaches 100% before all images are resolved.
  const progress=count?(0.18*prep+0.12*verified+0.70*completed)/count:0;
  const percentage=count&&completed>=count?100:Math.min(99.9,progress*100);
  const label=completed>=count&&count?'Complete':completed?'Scanning books':verified?'Scanning books':prep?'Preparing photos':'Preparing photos';
  return {total:count,prepared:prep,checked:verified,finished:completed,percentage:Number(percentage.toFixed(2)),label};
 }
 return {snapshot};
});
