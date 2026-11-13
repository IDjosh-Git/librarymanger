/* v5.32 — safe, fast reuse of verified local inventory titles during cover OCR.
   Never infer edition metadata or ISBN from a title-only match. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.LibraryInventoryScanMatch=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const ids=(typeof module==='object'&&module.exports)?require('./book-identifiers.js'):globalThis.LibraryBookIdentifiers;
 const isbn=s=>ids.valid(s)?ids.to13(s):String(s||'').toUpperCase().replace(/[^0-9X]/g,'');
 function match(text,inventory,helpers,scannedIsbn=''){
  if(!helpers?.titleCandidates||!helpers?.similarity||!helpers?.normalizedWords)return null;
  const lines=helpers.titleCandidates(text).slice(0,8);
  const author=helpers.authorFromText?.(text)||'';
  const exactIsbn=isbn(scannedIsbn);
  const found=new Map();
  for(const book of inventory||[]){
   const title=String(book?.title||'').trim(),authors=String(book?.authors||'').trim();
   if(title.length<8||helpers.normalizedWords(title).length<2)continue;
   const bookIsbn=isbn(book.barcode);
   if(exactIsbn&&bookIsbn!==exactIsbn)continue;
   const titleScore=Math.max(0,...lines.map(line=>helpers.similarity(line,title)));
   if(titleScore<.985)continue;
   const authorScore=author&&authors?helpers.similarity(author,authors):0;
   if(author&&authors&&authorScore<.65)continue;
   const key=(title+'|'+authors).toLowerCase().replace(/\s+/g,' ');
   if(!found.has(key))found.set(key,{title,authors,titleScore,authorScore,bookIsbn,book});
  }
  const ranked=[...found.values()].sort((a,b)=>b.titleScore+b.authorScore*.1-(a.titleScore+a.authorScore*.1));
  if(ranked.length!==1)return null; // ambiguous titles/authors stay for review
  const best=ranked[0],editionMatched=!!exactIsbn&&ids.valid(scannedIsbn)&&ids.valid(best.book.barcode)&&ids.same(scannedIsbn,best.book.barcode);
  return {title:best.title,authors:best.authors,
   ...(editionMatched?{publisher:best.book.publisher||'',publication_year:best.book.publication_year||'',language:best.book.language||'',pages:best.book.pages||'',subject:best.book.subject||''}:{}),
   editionMatched,source:'Verified existing inventory'};
 }
 return {match};
});
