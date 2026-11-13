/* Library Manager v5.46 — distinct lending titles / accurate physical-copy availability. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.LibraryLendingCatalogue=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function titleKey(book){
  const title=String(book?.title||'').trim().replace(/\s+/g,' ').toLocaleLowerCase();
  // Never group unrelated unidentified copies under a single "Untitled" option.
  return title?'title:'+title:'copy:'+String(book?.record_id||book?.book_id||'unknown');
 }
 function isAvailable(book){return String(book?.book_status||'Available').toLowerCase()==='available'}
 function preferredTitle(copies,selected){
  const options=(copies||[]).map(b=>String(b.title||'').trim().replace(/\s+/g,' ')).filter(Boolean);
  const rank=s=>(/^[A-Z]/.test(s)?4:0)+((s.match(/\b[A-Z][a-z]/g)||[]).length*2)-(s===s.toUpperCase()?3:0);
  return options.sort((a,b)=>rank(b)-rank(a))[0]||String(selected?.title||'Untitled book').trim().replace(/\s+/g,' ')||'Untitled book';
 }
 function titleSummary(books,selected){
  if(!selected)return null;
  const key=titleKey(selected),same=(books||[]).filter(b=>titleKey(b)===key);
  return {key,title:preferredTitle(same,selected),available:same.filter(isAvailable).length,borrowed:same.filter(b=>String(b.book_status||'').toLowerCase()==='borrowed').length,total:same.length};
 }
 function groupAvailableTitles(books,matchingAvailable){
  // Match filters determine which physical copy the option selects, but totals
  // always use the entire loaded inventory, not the search result subset.
  const groups=new Map();
  for(const copy of matchingAvailable||[]){
   if(!isAvailable(copy))continue;
   const key=titleKey(copy);
   if(!groups.has(key))groups.set(key,{key,title:String(copy.title||'Untitled book').trim().replace(/\s+/g,' ')||'Untitled book',representative:copy});
  }
  return Array.from(groups.values()).map(g=>({...g,...titleSummary(books,g.representative)}));
 }
 function countDistinctTitles(eligible){return new Set((eligible||[]).map(titleKey)).size}
 return Object.freeze({titleKey,isAvailable,titleSummary,groupAvailableTitles,countDistinctTitles});
});
