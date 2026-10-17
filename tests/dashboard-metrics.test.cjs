const test=require('node:test');
const assert=require('node:assert/strict');
const {calculate,datesTo}=require('../lib/dashboard-metrics.cjs');

test('dashboard reports physical copy totals and distinct groups without conflating copies and loans',()=>{
 const books=[
  {record_id:'copy-1',book_status:'Available',created_at:'2026-10-15T08:00:00Z',title:'Data Skills'},
  {record_id:'copy-2',book_status:'Borrowed',created_at:'2026-10-15T09:00:00Z',title:'Data Skills'},
  {record_id:'copy-3',book_status:'Available',created_at:'2026-10-13T10:00:00Z',title:'Excel Tips'}
 ];
 const loans=[
  {status:'Borrowed',book_title:'Data Skills',borrower_name:'Anna',date_borrowed:'2026-10-14',due_date:'2026-10-15'},
  {status:'Returned',book_title:'Excel Tips',date_borrowed:'2026-10-11',return_date:'2026-10-16',due_date:'2026-10-20'},
  {status:'Borrowed',book_title:'Another',date_borrowed:'2026-10-16',due_date:'2026-10-18'}
 ];
 const groups=[{quality:{attention:false,full:true}},{quality:{attention:true,full:false}}];
 const m=calculate(books,loans,'2026-10-16',groups);
 assert.equal(m.distinctBooks,2);assert.equal(m.totalCopies,3);assert.equal(m.availableCopies,2);assert.equal(m.borrowedCopies,1);
 assert.equal(m.activeLoans,2);assert.equal(m.overdueLoans,1);assert.equal(m.dueSoonLoans,1);
 assert.equal(m.attentionBooks,1);
 assert.equal(m.trend.length,7);assert.equal(m.trend.find(d=>d.date==='2026-10-16').borrowed,1);
 assert.equal(m.trend.find(d=>d.date==='2026-10-16').returned,1);
 assert.equal(m.trend.find(d=>d.date==='2026-10-14').borrowed,1);
 assert.ok(m.activity.some(e=>e.type==='returned' && e.title==='Excel Tips'));
});

test('dashboard safely handles empty book and loan tables and a week spanning months',()=>{
 const m=calculate([],[],'2026-11-02',[]);
 assert.equal(m.totalCopies,0);assert.equal(m.activity.length,0);
 assert.deepEqual(datesTo('2026-11-02'),['2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01','2026-11-02']);
 assert.equal(m.trend.reduce((x,d)=>x+d.borrowed+d.returned,0),0)
});

test('dashboard separates complete, incomplete and untitled titles and ranks shelves by physical copies',()=>{
 const books=[
  {title:'Alpha',shelf_location:'A1',book_status:'Available',created_at:'2026-10-16T09:00:00Z'},
  {title:'Alpha',shelf_location:'A1',book_status:'Borrowed',created_at:'2026-10-01'},
  {title:'Beta',shelf_location:'B2',book_status:'Available',created_at:'2026-09-01'},
  {title:'Untitled',shelf_location:'',book_status:'Available',created_at:'bad-date'}
 ];
 const groups=[{quality:{full:true,attention:false,noTitle:false}},{quality:{full:false,attention:true,noTitle:false}},{quality:{full:false,attention:true,noTitle:true}}];
 const m=calculate(books,[],'2026-10-16',groups);
 assert.equal(m.catalogCompletePct,33);assert.equal(m.fullDetailsBooks,1);assert.equal(m.partialDetailsBooks,1);assert.equal(m.missingTitleBooks,1);
 assert.equal(m.added30Days,2);assert.equal(m.availabilityPct,75);assert.equal(m.onLoanPct,25);
 assert.equal(m.shelves[0].name,'A1');assert.equal(m.shelves[0].copies,2);assert.equal(m.unassignedCopies,1);
 assert.equal(m.averageCopiesPerBook,'1.3');
});

test('dashboard due watchlist is chronological and excludes returned loans, and most borrowed counts transactions',()=>{
 const loans=[
  {status:'Borrowed',book_title:'Databases',barcode:'A',borrower_name:'X',date_borrowed:'2026-10-15',due_date:'2026-10-20'},
  {status:'Returned',book_title:'JavaScript',barcode:'B',date_borrowed:'2026-10-14',return_date:'2026-10-16',due_date:'2026-10-10'},
  {status:'Borrowed',book_title:'Databases',barcode:'A',date_borrowed:'2026-10-10',due_date:'2026-10-12'},
  {status:'Borrowed',book_title:'Databases',barcode:'A',date_borrowed:'2026-10-09',due_date:'2026-12-25'},
 ];
 const m=calculate([],loans,'2026-10-16',[]);
 assert.equal(m.overdueLoans,1);assert.equal(m.dueSoonLoans,1);
 assert.deepEqual(m.upcomingDue.map(l=>l.date),['2026-10-12','2026-10-20','2026-12-25']);
 assert.equal(m.upcomingDue[0].overdue,true);assert.equal(m.popular[0].title,'Databases');assert.equal(m.popular[0].loans,3);
 assert.equal(m.loans30Days,4);assert.equal(m.returns30Days,1);
});
