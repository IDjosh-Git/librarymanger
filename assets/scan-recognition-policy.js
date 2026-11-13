/* Library Manager 5.35: one deterministic recognition policy, shared by Scan and Review.
   ISBN / catalogue evidence outranks visual suggestions. Unverified visual text never
   assigns an edition or clears a conflict. This module is dependency free. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.LibraryRecognitionPolicy=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const fields=['title','authors','publisher','publication_year'];
 const good=x=>!!String(x||'').trim();
 const verified=r=>['isbn','catalog','inventory'].includes(String(r?.verifiedSource||''));
 function details(r){return fields.filter(k=>good(r?.[k])).length}
 function needsOCR(r,enabled){return !!enabled&&(!verified(r)||!good(r?.title)||!good(r?.authors))}
 function needsAI(r,enabled){return !!enabled&&(!good(r?.title)||!good(r?.authors)||!verified(r))}
 function shouldSearchTitle(r){return !verified(r)&&(!good(r?.title)||!good(r?.authors))}
 function state(r,settings){return {catalogVerified:verified(r),details:details(r),ocr:needsOCR(r,settings?.ocr),ai:needsAI(r,settings?.ai)};}
 return {verified,details,needsOCR,needsAI,shouldSearchTitle,state};
});
