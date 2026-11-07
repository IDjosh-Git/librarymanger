/* v5.20 — exact-content upload deduplication across photos, folders, ZIPs and devices.
   Only fingerprints, never image bytes, are sent to the shared Supabase registry. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.LibraryScanDedup=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TABLE='library_scan_files';
  const CHUNK=40;
  const digestPattern=/^sha256:[a-f0-9]{64}$/;
  async function fingerprint(file,cryptoProvider=globalThis.crypto){
    if(!file||typeof file.arrayBuffer!=='function')throw Error('Cannot read the selected image.');
    if(!cryptoProvider?.subtle?.digest)throw Error('Secure SHA-256 hashing is unavailable. Use HTTPS and a current browser.');
    // Hash ALL bytes: name, file timestamp, folder and ZIP wrapper do not affect identity.
    const hash=await cryptoProvider.subtle.digest('SHA-256',await file.arrayBuffer());
    return 'sha256:'+Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');
  }
  async function prepare(items,existing=[],onProgress=()=>{}){
    const known=new Set(existing),accepted=[];
    let skipped=0;
    for(let i=0;i<items.length;i++){
      const fingerprintValue=await fingerprint(items[i].file);
      if(known.has(fingerprintValue))skipped++;
      else{known.add(fingerprintValue);accepted.push({...items[i],sourceSignature:fingerprintValue});}
      if((i+1)%5===0||i===items.length-1)onProgress(i+1,items.length,skipped);
    }
    return {accepted,skipped};
  }
  async function register(client,userId,items){
    const accepted=[],skipped=[];
    try{for(let i=0;i<items.length;i+=CHUNK){
      const chunk=items.slice(i,i+CHUNK);
      const rows=chunk.map(item=>({fingerprint:item.sourceSignature,uploaded_by:userId,record_id:item.saveRecordId,status:'processing',updated_at:new Date().toISOString()}));
      if(rows.some(row=>!digestPattern.test(row.fingerprint)))throw Error('A photo could not be securely fingerprinted.');
      const {data,error}=await client.from(TABLE).upsert(rows,{onConflict:'fingerprint',ignoreDuplicates:true}).select('fingerprint');
      if(error)throw Error(error.code==='42P01'||error.code==='PGRST205'?'Cloud duplicate guard is not installed. Run database/05_duplicate_upload_guard.sql before scanning.':`Could not verify uploaded photos in Supabase: ${error.message||error.code}`);
      const claimed=new Set((data||[]).map(row=>row.fingerprint));
      for(const item of chunk){if(claimed.has(item.sourceSignature))accepted.push(item);else skipped.push(item);}
    }
    }catch(error){error.claimedUploads=accepted;throw error;}
    return {accepted,skipped};
  }
  async function changeStatus(client,userId,items,status){
    const digests=[...new Set(items.map(item=>typeof item==='string'?item:item?.sourceSignature).filter(d=>digestPattern.test(d||'')))];
    for(let i=0;i<digests.length;i+=CHUNK){
      const {error}=await client.from(TABLE).update({status,updated_at:new Date().toISOString()}).eq('uploaded_by',userId).in('fingerprint',digests.slice(i,i+CHUNK));
      if(error)throw Error(error.message||'Could not update upload history');
    }
  }
  async function releaseProcessing(client,userId,items){
    const digests=[...new Set(items.map(item=>typeof item==='string'?item:item?.sourceSignature).filter(d=>digestPattern.test(d||'')))];
    for(let i=0;i<digests.length;i+=CHUNK){
      const {error}=await client.from(TABLE).delete().eq('uploaded_by',userId).eq('status','processing').in('fingerprint',digests.slice(i,i+CHUNK));
      if(error)throw Error(error.message||'Could not release unused uploads');
    }
  }
  return {fingerprint,prepare,register,changeStatus,releaseProcessing,TABLE};
});
