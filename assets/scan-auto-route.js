/* Library Manager v5.34 — strict automatic routing for scanned book covers.
 * Prefer review over creating an inventory copy when metadata is speculative. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.LibraryScanAutoRoute=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const ids=(typeof module==='object'&&module.exports)?require('./book-identifiers.js'):globalThis.LibraryBookIdentifiers;
 const VERIFIED=new Set(['isbn','catalog','inventory']);
 function decide(row){
  if(!row||row.saved)return 'skip';
  const title=String(row.title||'').trim();
  if(!title||/^(?:unknown|untitled|n\/a|title not found)$/i.test(title))return 'review';
  if(row.coverMismatch||row.catalogConflict||row.reviewStaged||row.saveError||row.error&&/mismatch|invalid|conflict|incorrect/i.test(String(row.error)))return 'review';
  if(!VERIFIED.has(String(row.verifiedSource||'')))return 'review';
  if(row.verifiedSource==='isbn'&&!ids?.valid(row.barcode))return 'review';
  // A matching work/title in another copy cannot prove this photographed edition.
  if(row.verifiedSource==='inventory'&&(!row.inventoryEditionMatched||!ids?.valid(row.barcode)))return 'review';
  return 'inventory';
 }
 function payload(row,owner,stamp=new Date()){
  const val=value=>String(value??'').trim();
  const nullable=value=>val(value)||null;
  return {user_id:owner,record_id:row.saveRecordId,source_signature:row.sourceSignature||null,
   scan_date:stamp.toLocaleDateString(),scan_time:stamp.toLocaleTimeString(),barcode:(ids?.valid(row.barcode)?ids.normalize(row.barcode):val(row.barcode).replace(/[^\dA-Za-z]/g,'')),
   title:nullable(row.title),authors:nullable(row.authors),publisher:nullable(row.publisher),
   publication_year:nullable(row.publication_year),language:nullable(row.language),pages:nullable(row.pages),
   subject:nullable(row.subject),shelf_location:nullable(row.shelf),lookup_status:val(row.lookup_status)||'Automatically verified',book_status:'Available'};
 }
 function summarize(rows,skipped=0){
  return {saved:rows.filter(r=>r.saved&&r.autoHandled).length,
    review:rows.filter(r=>!r.saved&&r.autoHandled&&r.reviewStaged&&!r.saveError).length,
    failed:rows.filter(r=>!r.saved&&r.autoHandled&&!!r.saveError).length,
    saving:rows.filter(r=>!r.saved&&r.autoHandled&&r.autoState==='saving').length,
    skipped:Number(skipped)||0};
 }
 return {decide,payload,summarize};
});
