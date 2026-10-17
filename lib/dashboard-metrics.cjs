/* Pure, dependency-free library dashboard calculations. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.LibraryDashboardMetrics=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const str=x=>String(x??'').trim();
const day=x=>{const s=str(x).slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return '';const d=new Date(s+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s?s:''};
const dateShift=(value,n)=>{const d=new Date(value+'T12:00:00Z');if(!Number.isFinite(d.getTime()))return '';d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const datesTo=today=>Array.from({length:7},(_,i)=>dateShift(today,-6+i));
const percent=(n,d)=>d?Math.round(n/d*100):0;
function calculate(books=[],loans=[],today='2026-01-01',groups=[]){
 const now=day(today)||'2026-01-01',week=datesTo(now);
 const physical=Array.isArray(books)?books:[],history=Array.isArray(loans)?loans:[],distinct=Array.isArray(groups)?groups:[];
 const available=physical.filter(b=>(b.book_status||'Available')==='Available').length;
 const borrowed=physical.filter(b=>b.book_status==='Borrowed').length;
 const active=history.filter(l=>l.status==='Borrowed');
 const overdue=active.filter(l=>day(l.due_date)&&day(l.due_date)<now).length;
 const weekAhead=dateShift(now,7);
 const dueSoon=active.filter(l=>day(l.due_date)&&day(l.due_date)>=now&&day(l.due_date)<=weekAhead).length;
 const trend=week.map(date=>({date,borrowed:history.filter(l=>day(l.date_borrowed)===date).length,returned:history.filter(l=>l.status==='Returned'&&day(l.return_date)===date).length}));
 const attention=distinct.filter(g=>g.quality?.attention).length;
 const full=distinct.filter(g=>g.quality?.full).length;
 const untitled=distinct.filter(g=>g.quality?.noTitle).length;
 const partial=Math.max(0,distinct.length-full-untitled);
 const added30=physical.filter(b=>{const d=day(b.created_at);return d&&d>=dateShift(now,-29)&&d<=now}).length;
 const recentLoans=history.filter(l=>{const d=day(l.date_borrowed);return d&&d>=dateShift(now,-29)&&d<=now}).length;
 const recentReturns=history.filter(l=>l.status==='Returned'&&day(l.return_date)>=dateShift(now,-29)&&day(l.return_date)<=now).length;
 const shelfMap=new Map();
 physical.forEach(b=>{const shelf=str(b.shelf_location)||'Unassigned';shelfMap.set(shelf,(shelfMap.get(shelf)||0)+1)});
 const shelves=[...shelfMap].map(([name,copies])=>({name,copies})).sort((a,b)=>b.copies-a.copies||a.name.localeCompare(b.name));
 const popularMap=new Map();
 history.forEach(l=>{const title=str(l.book_title)||str(l.barcode);if(!title)return;const key=(str(l.barcode)||title).toLocaleLowerCase();if(!popularMap.has(key))popularMap.set(key,{title,loans:0});popularMap.get(key).loans++});
 const popular=[...popularMap.values()].sort((a,b)=>b.loans-a.loans||a.title.localeCompare(b.title)).slice(0,5);
 const dueQueue=active.filter(l=>day(l.due_date)).sort((a,b)=>day(a.due_date).localeCompare(day(b.due_date))).slice(0,6).map(l=>({title:str(l.book_title)||str(l.barcode)||'Untitled book',borrower:str(l.borrower_name),date:day(l.due_date),overdue:day(l.due_date)<now,bookId:str(l.book_id)}));
 const events=[];
 history.forEach(l=>{
  const title=str(l.book_title)||str(l.barcode)||'Untitled book',borrower=str(l.borrower_name),lent=day(l.date_borrowed)||day(l.created_at);
  if(lent)events.push({date:lent,time:str(l.created_at),type:'borrowed',title,description:borrower?`Borrowed by ${borrower}`:'Book loaned'});
  const returned=l.status==='Returned'?day(l.return_date):'';
  if(returned)events.push({date:returned,time:str(l.updated_at)||str(l.return_date),type:'returned',title,description:borrower?`Returned by ${borrower}`:'Book returned'});
 });
 physical.forEach(b=>{const added=day(b.created_at);if(added)events.push({date:added,time:str(b.created_at),type:'added',title:str(b.title)||str(b.barcode)||'Untitled book',description:'New physical copy added'})});
 events.sort((a,b)=>b.date.localeCompare(a.date)||b.time.localeCompare(a.time));
 return {distinctBooks:distinct.length,totalCopies:physical.length,availableCopies:available,borrowedCopies:borrowed,activeLoans:active.length,overdueLoans:overdue,dueSoonLoans:dueSoon,attentionBooks:attention,fullDetailsBooks:full,missingTitleBooks:untitled,partialDetailsBooks:partial,catalogCompletePct:percent(full,distinct.length),availabilityPct:percent(available,physical.length),onLoanPct:percent(borrowed,physical.length),added30Days:added30,loans30Days:recentLoans,returns30Days:recentReturns,averageCopiesPerBook:distinct.length?(physical.length/distinct.length).toFixed(1):'0.0',trend,shelves:shelves.slice(0,6),unassignedCopies:shelfMap.get('Unassigned')||0,popular,upcomingDue:dueQueue,activity:events.slice(0,7)};
}
return {calculate,datesTo};
});
