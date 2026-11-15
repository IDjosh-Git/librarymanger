'use strict';
/* Exact, read-only admin catalogue health; counts are computed server-side. */
const cloud=require('../lib/library-ai-cloud.cjs');
async function count(member,table,filters=''){
 const response=await fetch(member.url+'/rest/v1/'+table+'?select=*'+filters,{headers:{apikey:member.key,Authorization:'Bearer '+member.token,Prefer:'count=exact',Range:'0-0'},signal:AbortSignal.timeout(12000),cache:'no-store'});
 if(!response.ok)throw Object.assign(new Error('Catalogue count unavailable'),{status:503});
 const range=response.headers.get('content-range')||'';
 const value=Number(range.split('/').pop());
 if(!Number.isSafeInteger(value)||value<0)throw Object.assign(new Error('Invalid catalogue count'),{status:503});
 return value;
}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
 try{
  const member=await cloud.authenticate(req);
  if(member.role!=='admin')return res.status(403).json({error:'Administrator access required'});
  // Count all matching records, not merely the first 1,000 returned by PostgREST.
  const [reviewPending,inventoryTotal,missingTitle,missingAuthor,missingShelf]=await Promise.all([
   count(member,'library_review_queue','&status=eq.pending'),
   count(member,'library_books'),
   count(member,'library_books','&or=(title.is.null,title.eq.)'),
   count(member,'library_books','&or=(authors.is.null,authors.eq.)'),
   count(member,'library_books','&or=(shelf_location.is.null,shelf_location.eq.)')
  ]);
  return res.status(200).json({reviewPending,inventoryTotal,missingTitle,missingAuthor,missingShelf,sampled:false,generatedAt:new Date().toISOString()});
 }catch(e){return res.status(e.status||503).json({error:'Administrator insights are temporarily unavailable.',code:'INSIGHTS_UNAVAILABLE'});}
};
