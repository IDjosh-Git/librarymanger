'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const code=require(path.join(root,'lib/inventory-grouping.cjs'));
const browserModule=fs.readFileSync(path.join(root,'assets/inventory-grouping.js'),'utf8');
assert.equal(browserModule,fs.readFileSync(path.join(root,'lib/inventory-grouping.cjs'),'utf8'));
const rows=[
 {record_id:'copy-a',book_id:'BOOK-001',title:'Things Fall Apart',authors:'Chinua Achebe',barcode:'COPY-00001',shelf_location:'A1',book_status:'Available',created_at:'2026-11-02'},
 {record_id:'copy-b',book_id:'BOOK-002',title:'THINGS FALL APART!',authors:'Chinua Achebe',barcode:'9780385474542',shelf_location:'B1',book_status:'Borrowed',due_date:'2026-11-17',created_at:'2026-11-03'},
 {record_id:'copy-c',book_id:'BOOK-003',title:'Things Fall Apart',authors:'Chinua Achebe',barcode:'COPY-00003',book_status:'Available',created_at:'2026-11-04'},
 {record_id:'copy-d',book_id:'BOOK-004',title:'Things Fall Apart',authors:'A Different Author',barcode:'COPY-00004',book_status:'Available',created_at:'2026-11-05'},
 {record_id:'copy-e',book_id:'BOOK-005',title:'Dune',authors:'Frank Herbert',barcode:'9780441172719',book_status:'Available'},
 {record_id:'copy-f',book_id:'BOOK-006',title:'',authors:'',barcode:'COPY-00006',book_status:'Available'},
 {record_id:'copy-g',book_id:'BOOK-007',title:'',authors:'',barcode:'COPY-00006',book_status:'Available'},
 {record_id:'copy-h',book_id:'BOOK-008',title:'Things Fall Apart',authors:'',book_status:'Available'},
 {record_id:'copy-i',book_id:'BOOK-009',title:'Dune',authors:'',book_status:'Available'}
];
const groups=code.groupBooks(rows,'2026-11-06');
const achebe=groups.find(g=>g.representative.title.toLowerCase().includes('things fall apart')&&g.copies.some(x=>x.authors==='Chinua Achebe'));
assert(achebe,'Achebe title group missing');
assert.equal(achebe.totalCopies,3,'same title + author with distinct barcodes must group');
assert.equal(achebe.availableCopies,2);assert.equal(achebe.borrowedCopies,1);
assert.equal(achebe.isbns.length,1);
assert.equal(groups.length,6,'ambiguous author, different author, Dune and two untitled copies remain separately identifiable');
assert.equal(new Set(rows.map(x=>x.record_id)).size,9,'individual book records must remain intact');
assert.equal(groups.reduce((sum,g)=>sum+g.totalCopies,0),rows.length,'inventory quantity must agree with physical rows');
function extract(start,end){const i=html.indexOf(start),j=html.indexOf(end,i+start.length);assert(i>=0&&j>i,`Cannot find ${start}`);return html.slice(i,j)}
const nodes=Object.fromEntries(['totalBooks','availableBooks','borrowedBooks','overdueAlert','overdueAlertTitle','attentionCount','noTitleCount','fullCount','bookTable','bookPager','bookTableMeta','bookSort','inventoryCopiesBackdrop','inventoryCopiesList','inventoryCopiesTitle','inventoryCopiesSubtitle','closeInventoryCopies'].map(id=>[id,{id,innerHTML:'',textContent:'',hidden:true,focus(){this.focused=true;},className:''}]));
nodes.bookSort.selectedOptions=[{textContent:'Recently added'}];
const classes=new Set();
const c={books:rows,loans:[],inventoryGroups:()=>groups,bookRenderTimer:null,clearTimeout:()=>{},bookView:'table',bookSort:'title',bookPageSize:10,bookPage:1,session:{user:{id:'owner'}},libraryOwnerId:'owner',
  $:id=>nodes[id],today:()=>'2026-11-06',isOverdue:()=>false,
  bookSearch:'',bookFilter:'all',qualityFilter:'all',columnFilters:{},selectedColumnValues:{},
  passesGlobalInventoryFilters:()=>true,LibraryInventoryColumnFilters:{matches:()=>true,active:()=>[]},
  inventoryGroupQuality:g=>({full:!!g.representative.title,attention:!g.representative.title,noTitle:!g.representative.title}),
  syncColumnFilterUI:()=>{},renderColumnPickerOptions:()=>{},renderPager:()=>{},
  esc:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
  uiIcon:()=>'',editionCoverMarkup:()=>'',isCirculationUser:()=>true,statusPill:()=>'<span>Available</span>',
  document:{body:{classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)}},activeElement:{isConnected:true,focus(){this.focused=true}}},
  msg(){throw Error('Unexpected error message')}
};
const src=extract('function copyManagement(g){','// Only retrieve cover artwork');
const ui=extract('function inventoryGroupBarcode(g){','\nfunction renderDashboard(){');
vm.createContext(c);
vm.runInContext(src+'\n'+ui,c);
c.renderBooks();
const table=nodes.bookTable.innerHTML;
assert.equal((table.match(/<tbody><tr>/g)||[]).length,1);
assert.equal((table.match(/<tr>/g)||[]).length,groups.length+1,'one title row per group, plus header');
assert(!table.includes('inventory-copy-subrow'),'duplicate copies must not create second inventory row');
assert.match(table,/data-label="Total Books"[^>]*>3</,'aggregated quantity must be in row');
assert.match(table,/Manage 3 copies/,'individual copies must be manageable without duplicate rows');
assert.match(table,/data-label="On Loan"[^>]*>1</,'on-loan total must be accurate');
assert.match(nodes.bookTableMeta.textContent,/9 total physical copies/);
const open=vm.runInContext('openInventoryCopies',c),close=vm.runInContext('closeInventoryCopies',c);
open(achebe.key);
assert.equal(nodes.inventoryCopiesBackdrop.hidden,false);
assert.equal((nodes.inventoryCopiesList.innerHTML.match(/class="inventory-copy-item"/g)||[]).length,3);
assert(classes.has('inventory-copies-modal-open'));
close();assert.equal(nodes.inventoryCopiesBackdrop.hidden,true);
assert(!classes.has('inventory-copies-modal-open'));
c.bookView='grid';c.renderBooks();
assert.equal((nodes.bookTable.innerHTML.match(/<article class="book-card">/g)||[]).length,groups.length);
assert.match(nodes.bookTable.innerHTML,/Manage 3 copies/);
console.log('PASS: one Inventory row per title/author, correct Total Books, no duplicate subrows, private copy modal, grid counts, unique physical records');

if(process.env.INVENTORY_WRITE_FIXTURE){
 const fs=require('node:fs');
 const css=fs.readFileSync(require('node:path').join(root,'assets/library-ui.css'),'utf8');
 c.bookView='table';c.renderBooks();
 const section=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><style>body{margin:0}main{max-width:1480px;margin:auto;padding:20px}.testbar{padding:22px 0}h1{margin:0 0 6px}</style></head><body><main><section class="panel active" id="inventory"><div class="testbar"><h1>Inventory · Books and copies</h1><p>Every title appears once. Total Books shows how many physical copies are available.</p></div><div class="inventory-workspace-card"><div id="bookTable" class="tablewrap">${nodes.bookTable.innerHTML}</div></div></section></main><div id="inventoryCopiesBackdrop" class="inventory-copies-backdrop" hidden><section class="inventory-copies-dialog" role="dialog" aria-modal="true" aria-labelledby="inventoryCopiesTitle"><div class="inventory-copies-heading"><div><span class="eyebrow">Inventory · physical copies</span><h2 id="inventoryCopiesTitle">Things Fall Apart</h2><p>${achebe.totalCopies} total copies · ${achebe.availableCopies} available · ${achebe.borrowedCopies} on loan</p></div><button id="closeInventoryCopies" type="button">Close</button></div><div class="inventory-copies-content">${c.copyManagement(achebe)}</div></section></div><script>const modal=document.getElementById('inventoryCopiesBackdrop');document.querySelector('[data-manage-copies]').addEventListener('click',()=>{modal.hidden=false;document.body.classList.add('inventory-copies-modal-open')});document.getElementById('closeInventoryCopies').addEventListener('click',()=>{modal.hidden=true;document.body.classList.remove('inventory-copies-modal-open')});</script></body></html>`;
 fs.writeFileSync(process.env.INVENTORY_WRITE_FIXTURE,section);
}
