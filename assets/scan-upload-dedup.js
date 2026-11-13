/* v5.30 — safe content deduplication and interrupted-upload recovery.
 * File hashes identify images; book inventory, not the upload lease, is the source of truth.
 * Reclaim only an old lease owned by the current user when NO saved copy and
 * NO pending Review record exists. Retain the original record ID on recovery. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.LibraryScanDedup=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TABLE='library_scan_files',BOOKS='library_books',REVIEW='library_review_queue';
  const CHUNK=40,STALE_AFTER_MS=10*60*1000;
  const digestPattern=/^sha256:[a-f0-9]{64}$/;
  async function fingerprint(file,cryptoProvider=globalThis.crypto){
    if(!file||typeof file.arrayBuffer!=='function')throw Error('Cannot read the selected image.');
    if(!cryptoProvider?.subtle?.digest)throw Error('Secure SHA-256 hashing is unavailable. Use HTTPS and a current browser.');
    const hash=await cryptoProvider.subtle.digest('SHA-256',await file.arrayBuffer());
    return 'sha256:'+Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');
  }
  // Hash independent image files concurrently while publishing results in input
  // order. This preserves duplicate semantics even when a later small photo
  // finishes hashing before an earlier large one.
  async function prepare(items,existing=[],onProgress=()=>{},{concurrency=3,fingerprintFn=fingerprint}={}){
    const known=new Set(existing),accepted=[];let skipped=0;
    if(!items.length)return {accepted,skipped};
    const hashes=new Array(items.length);
    const workers=Math.max(1,Math.min(4,Math.floor(concurrency)||1,items.length));
    let next=0,published=0;
    const worker=async()=>{
      while(next<items.length){
        const index=next++;
        hashes[index]=await fingerprintFn(items[index].file);
        // Progress is committed in source order, not completion order.
        while(published<items.length&&hashes[published]!==undefined){
          const current=items[published],signature=hashes[published];
          if(known.has(signature))skipped++;
          else{known.add(signature);accepted.push({...current,sourceSignature:signature});}
          published++;onProgress(published,items.length,skipped);
        }
      }
    };
    await Promise.all(Array.from({length:workers},worker));
    return {accepted,skipped};
  }
  function assertOK(result,message){
    if(result?.error)throw Error(`${message}: ${result.error.message||result.error.code||'database unavailable'}`);
    return result?.data||[];
  }
  async function recoverUnfinished(client,userId,items,now=Date.now(),staleAfterMs=STALE_AFTER_MS){
    if(!items.length)return {recovered:[],blocked:items,alreadySaved:0,inReview:0,inProgress:0,savedItems:[],reviewItems:[],inProgressItems:[]};
    const input=new Map(items.map(item=>[item.sourceSignature,item]));
    const rows=assertOK(await client.from(TABLE)
      .select('fingerprint,uploaded_by,record_id,status,updated_at')
      .in('fingerprint',[...input.keys()]),'Could not check previously uploaded photos');
    const byHash=new Map(rows.map(row=>[row.fingerprint,row]));
    const stale=rows.filter(row=>input.has(row.fingerprint)&&row.uploaded_by===userId&&
      (row.status==='processing'||row.status==='pending')&&
      Number.isFinite(Date.parse(row.updated_at))&&Date.parse(row.updated_at)<=now-staleAfterMs);
    // A retained per-photo record ID is a proof of this browser's own unfinished
    // job. Do not impose the ten-minute stale-lease delay on reconnect.
    const resumed=rows.filter(row=>row.uploaded_by===userId&&
      input.get(row.fingerprint)?.resumeSession===true&&
      String(input.get(row.fingerprint)?.saveRecordId||'')===String(row.record_id)&&
      (row.status==='processing'||row.status==='pending'));
    const inspected=[...new Map([...stale,...resumed].map(row=>[row.fingerprint,row])).values()];
    const savedHashes=new Set(),savedIds=new Set(),activeReviews=new Set();
    if(inspected.length){
      const signatures=inspected.map(row=>row.fingerprint),recordIds=inspected.map(row=>row.record_id);
      const savedByHash=assertOK(await client.from(BOOKS).select('record_id,source_signature')
        .in('source_signature',signatures),'Could not verify whether photos were saved');
      const savedById=assertOK(await client.from(BOOKS).select('record_id,source_signature')
        .in('record_id',recordIds),'Could not verify saved book record IDs');
      for(const saved of [...savedByHash,...savedById]){
        if(saved.source_signature)savedHashes.add(saved.source_signature);
        if(saved.record_id)savedIds.add(String(saved.record_id));
      }
      const reviews=assertOK(await client.from(REVIEW).select('review_key')
        .eq('user_id',userId).eq('status','pending').in('review_key',recordIds),
      'Could not verify existing Review books');
      for(const review of reviews)activeReviews.add(String(review.review_key));
    }
    // Reclaim a whole small chunk with ONE conditional database write. This is
    // essential for 100+ photo uploads on high-latency mobile connections.
    const candidates=stale.filter(row=>!savedHashes.has(row.fingerprint)&&
      !savedIds.has(String(row.record_id))&&!activeReviews.has(String(row.record_id)));
    const reclaimedByHash=new Map();
    if(candidates.length){
      const updated=assertOK(await client.from(TABLE)
        .update({status:'processing',updated_at:new Date(now).toISOString()})
        .eq('uploaded_by',userId)
        .in('fingerprint',candidates.map(row=>row.fingerprint))
        .in('status',['processing','pending'])
        .lt('updated_at',new Date(now-staleAfterMs).toISOString())
        .select('fingerprint,record_id'),'Could not recover interrupted uploads');
      for(const row of updated)reclaimedByHash.set(row.fingerprint,String(row.record_id));
    }
    const recovered=[],blocked=[],savedItems=[],reviewItems=[],inProgressItems=[];
    let alreadySaved=0,inReview=0,inProgress=0;
    for(const item of items){
      const row=byHash.get(item.sourceSignature);
      if(!row){blocked.push(item);inProgressItems.push(item);inProgress++;continue;}
      if(row.status==='saved'||savedHashes.has(row.fingerprint)||savedIds.has(String(row.record_id))){
        blocked.push(item);savedItems.push(item);alreadySaved++;continue;
      }
      if(activeReviews.has(String(row.record_id))){blocked.push(item);reviewItems.push(item);inReview++;continue;}
      if(reclaimedByHash.has(row.fingerprint)||resumed.some(r=>r.fingerprint===row.fingerprint)){
        recovered.push({...item,saveRecordId:reclaimedByHash.get(row.fingerprint)||String(row.record_id),recovered:true});
      }else{
        blocked.push(item);
        if(row.status==='pending'){inReview++;reviewItems.push(item)}else{inProgress++;inProgressItems.push(item)}
      }
    }
    return {recovered,blocked,alreadySaved,inReview,inProgress,savedItems,reviewItems,inProgressItems};
  }
  async function register(client,userId,items,{onProgress=()=>{}}={}){
    const accepted=[],skipped=[],savedItems=[],reviewItems=[],inProgressItems=[];let recoveredCount=0,alreadySaved=0,inReview=0,inProgress=0;
    try{
      for(let i=0;i<items.length;i+=CHUNK){
        const chunk=items.slice(i,i+CHUNK);
        const rows=chunk.map(item=>({fingerprint:item.sourceSignature,uploaded_by:userId,
          record_id:item.saveRecordId,status:'processing',updated_at:new Date().toISOString()}));
        if(rows.some(row=>!digestPattern.test(row.fingerprint)))throw Error('A photo could not be securely fingerprinted.');
        const {data,error}=await client.from(TABLE)
          .upsert(rows,{onConflict:'fingerprint',ignoreDuplicates:true}).select('fingerprint');
        if(error)throw Error(error.code==='42P01'||error.code==='PGRST205'?
          'Cloud duplicate guard is not installed. Run database/05_duplicate_upload_guard.sql before scanning.':
          `Could not register uploaded photos: ${error.message||error.code}`);
        const claimed=new Set((data||[]).map(row=>row.fingerprint)),previous=[];
        for(const item of chunk){if(claimed.has(item.sourceSignature))accepted.push(item);else previous.push(item);}
        const retry=await recoverUnfinished(client,userId,previous);
        accepted.push(...retry.recovered);skipped.push(...retry.blocked);savedItems.push(...retry.savedItems);reviewItems.push(...retry.reviewItems);inProgressItems.push(...retry.inProgressItems);
        recoveredCount+=retry.recovered.length;
        alreadySaved+=retry.alreadySaved;inReview+=retry.inReview;inProgress+=retry.inProgress;
        onProgress(Math.min(i+CHUNK,items.length),items.length,{recovered:recoveredCount,skipped:skipped.length});
      }
    }catch(error){error.claimedUploads=accepted;throw error;}
    return {accepted,skipped,recovered:recoveredCount,alreadySaved,inReview,inProgress,savedItems,reviewItems,inProgressItems};
  }
  async function changeStatus(client,userId,items,status){
    const digests=[...new Set(items.map(item=>typeof item==='string'?item:item?.sourceSignature).filter(d=>digestPattern.test(d||'')))];
    for(let i=0;i<digests.length;i+=CHUNK){
      const {error}=await client.from(TABLE).update({status,updated_at:new Date().toISOString()})
        .eq('uploaded_by',userId).in('fingerprint',digests.slice(i,i+CHUNK));
      if(error)throw Error(error.message||'Could not update upload history');
    }
  }
  async function releaseProcessing(client,userId,items){
    const digests=[...new Set(items.map(item=>typeof item==='string'?item:item?.sourceSignature).filter(d=>digestPattern.test(d||'')))];
    for(let i=0;i<digests.length;i+=CHUNK){
      const {error}=await client.from(TABLE).delete().eq('uploaded_by',userId)
        .eq('status','processing').in('fingerprint',digests.slice(i,i+CHUNK));
      if(error)throw Error(error.message||'Could not release unused uploads');
    }
  }
  return {fingerprint,prepare,register,recoverUnfinished,changeStatus,releaseProcessing,
    TABLE,STALE_AFTER_MS};
});
