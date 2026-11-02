/* Overdue notification model — safe for browser and Node tests; no extra data storage. */
(function(root,factory){
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.LibraryOverdueNotifications=model;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function validDate(v){const d=String(v||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return null;const n=Date.parse(d+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===d?n:null;}
 function daysLate(due,asOf){const d=validDate(due),t=validDate(asOf);if(d===null||t===null)return 0;return Math.max(0,Math.round((t-d)/86400000));}
 function list(records,asOf,query='',order='oldest'){
  const q=String(query||'').trim().toLocaleLowerCase();
  const result=(Array.isArray(records)?records:[]).filter(x=>x&&x.status==='Borrowed'&&daysLate(x.due_date,asOf)>0).map(x=>({
   loanId:String(x.id??''),borrower:String(x.borrower_name||''),borrowerId:String(x.borrower_id||''),title:String(x.book_title||''),bookId:String(x.book_id||''),bookRecordId:String(x.book_record_id||''),barcode:String(x.barcode||''),borrowedDate:String(x.date_borrowed||''),dueDate:String(x.due_date).slice(0,10),daysOverdue:daysLate(x.due_date,asOf)
  })).filter(x=>!q||[x.loanId,x.borrower,x.borrowerId,x.title,x.bookId,x.barcode,x.dueDate].some(v=>v.toLocaleLowerCase().includes(q)));
  if(order==='borrower')result.sort((a,b)=>a.borrower.localeCompare(b.borrower)||b.daysOverdue-a.daysOverdue);
  else result.sort((a,b)=>(order==='recent'?a.daysOverdue-b.daysOverdue:b.daysOverdue-a.daysOverdue)||a.dueDate.localeCompare(b.dueDate));
  return result;
 }
 const formatCount=n=>n>99?'99+':String(Math.max(0,n));
 return {daysLate,list,formatCount};
});
