/* v5.31 — streaming, backpressured photo preparation and recognition.
 * The first claimable images are scanned while later photos are still being hashed,
 * deduplicated and registered. No photo is scanned until its claim is verified.
 * Works with ordinary File objects on mobile, folders and ZIP-extracted Files. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.LibraryScanStream=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 async function run({items,prepare,claim,scan,onChunk=()=>{},workers=1,chunkSize=6,bufferLimit=16,shouldStop=()=>false}){
  if(!Array.isArray(items)||typeof prepare!=='function'||typeof claim!=='function'||typeof scan!=='function')throw Error('Invalid scan stream configuration.');
  const concurrency=Math.max(1,Math.min(4,Math.floor(workers)||1));
  const sizeAt=offset=>Math.max(1,Math.min(40,Math.floor(typeof chunkSize==='function'?chunkSize(offset):chunkSize)||6));
  const limit=Math.max(1,Math.floor(bufferLimit)||16);
  const pending=[],wakeReaders=[],wakeProducers=[];
  let producerFinished=false,producerError=null,scannerFailure=null;
  const wake=(waiters)=>{while(waiters.length)waiters.shift()()};
  const take=async()=>{
   while(!pending.length){
    if(producerFinished||shouldStop())return null;
    await new Promise(resolve=>wakeReaders.push(resolve));
   }
   const item=pending.shift();wake(wakeProducers);return item;
  };
  const scanner=async()=>{
   try{
    for(;;){
     if(shouldStop()||scannerFailure)return;
     const item=await take();if(item===null)return;
     await scan(item);
    }
   }catch(error){scannerFailure=error;wake(wakeProducers);wake(wakeReaders);throw error}
  };
  const producer=(async()=>{
   try{
    for(let i=0;i<items.length;){
     if(shouldStop())break;
     while(pending.length>=limit&&!shouldStop()&&!scannerFailure)await new Promise(resolve=>wakeProducers.push(resolve));
     if(scannerFailure)throw scannerFailure;
     if(shouldStop())break;
     const input=items.slice(i,i+sizeAt(i));
     i+=input.length;
     const prepared=await prepare(input,i-input.length);
     if(scannerFailure)throw scannerFailure;
     if(shouldStop())break;
     const claimed=prepared.accepted.length?await claim(prepared.accepted,i-input.length):{accepted:[],skipped:[],recovered:0,alreadySaved:0,inReview:0,inProgress:0};
     // Callback runs before consumers receive this chunk; this allows the caller
     // to track leases so unprocessed claims can be released if scanning stops.
     onChunk({input,prepared,claimed,checked:i});
     pending.push(...claimed.accepted);
     wake(wakeReaders);
    }
   }catch(error){producerError=error}
   finally{producerFinished=true;wake(wakeReaders);wake(wakeProducers)}
  })();
  const consumers=Array.from({length:concurrency},scanner);
  const results=await Promise.allSettled([producer,...consumers]);
  if(producerError)throw producerError;
  const failure=results.find(x=>x.status==='rejected');
  if(failure)throw failure.reason;
  return {stopped:shouldStop(),unprocessed:pending.slice()};
 }
 return {run};
});
