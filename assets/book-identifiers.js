/* v5.36: one ISBN/Bookland-EAN policy shared by browser, server and Review.
 * EAN-2/EAN-5 add-on digits are *not* part of an ISBN and GTIN-14 can
 * prefix a book EAN with zero. Only accept verified checksum-bearing cores. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.LibraryBookIdentifiers=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function clean(raw){
   return String(raw??'').trim().replace(/[\u0000-\u001f\u007f]/g,'')
    .replace(/^\][A-Za-z0-9]{2}\s*/,'')
    .replace(/^ISBN(?:[\s-]*1[03])?\s*[:#]?\s*/i,'')
    .replace(/[\s.\-–‐]/g,'').toUpperCase();
 }
 function checksum(raw){
   if(/^\d{9}[\dX]$/.test(raw)){
     let n=0;for(let i=0;i<10;i++)n+=(10-i)*(raw[i]==='X'?10:Number(raw[i]));return n%11===0;
   }
   if(/^97[89]\d{10}$/.test(raw)){
     let n=0;for(let i=0;i<13;i++)n+=Number(raw[i])*(i%2?3:1);return n%10===0;
   }
   return false;
 }
 function normalize(raw){
   let x=clean(raw);
   if(/^SBN\d{9}$/.test(x))x='0'+x.slice(3);
   if(checksum(x))return x;
   // GTIN-14 (zero + ISBN-13), EAN-13 + EAN-2/5, or both.
   const wrapped=x.match(/^(0?)(97[89]\d{10})(\d{2}|\d{5})?$/);
   if(wrapped&&((wrapped[1]&&wrapped[2].length===13)||wrapped[3])&&checksum(wrapped[2]))return wrapped[2];
   return x; // Preserve an unverified, non-book inventory barcode intact.
 }
 const valid=raw=>checksum(normalize(raw));
 function to13(raw){
   const x=normalize(raw);if(!checksum(x))return '';
   if(x.length===13)return x;
   const base='978'+x.slice(0,9);let n=0;
   for(let i=0;i<12;i++)n+=Number(base[i])*(i%2?3:1);
   return base+String((10-n%10)%10);
 }
 const same=(a,b)=>!!a&&!!b&&valid(a)&&valid(b)&&to13(a)===to13(b);
 return {clean,normalize,checksum,valid,to13,same};
});
