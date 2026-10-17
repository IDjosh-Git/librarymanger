const test = require('node:test');
const assert = require('node:assert/strict');
const filter = require('../lib/inventory-column-filters.cjs');
const {groupBooks} = require('../lib/inventory-grouping.cjs');
const books = [
  {record_id:'1',barcode:'9781111111111',title:'Practical Data Analysis',authors:'Ada Okoye',book_status:'Available',shelf_location:'A-01'},
  {record_id:'2',barcode:'9781111111111',title:'Practical Data Analysis',authors:'Ada Okoye',book_status:'Borrowed',due_date:'2026-01-01',shelf_location:'A-02'},
  {record_id:'3',barcode:'9782222222222',title:'Everyday Excel',authors:'B Maker',book_status:'Available',shelf_location:'B-12'},
  {record_id:'4',barcode:'unreadable',title:'',authors:'',book_status:'Available',shelf_location:''}
];
const grouped=groupBooks(books,'2026-10-17');
const get=(barcode)=>grouped.find(g=>g.representative.barcode===barcode);
const quality=g=>({full:!!g.representative.title&&!!g.representative.authors,attention:!g.representative.title,noTitle:!g.representative.title});
const matching=(values)=>grouped.filter(g=>filter.matches(g,{...filter.empty(),...values},quality(g)));
test('field filters match within all copies of grouped books, with no changes to counts',()=>{
  assert.equal(matching({isbn:'978111'}).length,1);
  assert.equal(matching({authors:'aDa'}).length,1);
  assert.equal(matching({shelf:'a-02'}).length,1);
  assert.equal(matching({title:'excel'}).length,1);
  assert.equal(get('9781111111111').totalCopies,2);
  assert.equal(matching({shelf:'A-02',title:'Excel'}).length,0);
});
test('number ranges filter total, available and on-loan copies inclusively',()=>{
  assert.equal(matching({totalMin:'2',totalMax:'2'}).length,1);
  assert.equal(matching({availableMin:'1',availableMax:'1',loanMin:'1'}).length,1);
  assert.equal(matching({availableMin:'2'}).length,0);
  assert.equal(matching({loanMax:'0'}).length,2);
  assert.equal(matching({totalMin:''}).length,3);
});
test('status distinguishes mixed, overdue, all borrowed and all available',()=>{
  assert.equal(matching({status:'mixed'}).length,1);
  assert.equal(matching({status:'overdue'}).length,1);
  assert.equal(matching({status:'fully-available'}).length,2);
  assert.equal(matching({status:'all-on-loan'}).length,0);
  assert.equal(matching({status:'borrowed'}).length,1);
});
test('details criteria and active filter badge group numeric range as one column',()=>{
  assert.equal(matching({details:'no-title'}).length,1);
  assert.equal(matching({details:'attention'}).length,1);
  assert.equal(matching({details:'full'}).length,2);
  assert.deepEqual(filter.active({title:'  ',availableMin:'0',availableMax:'3',details:'attention',shelf:' B '}),['available','details','shelf']);
  assert.equal(filter.active(filter.empty()).length,0);
});

test('column picker lists values from every physical copy and groups duplicate ISBNs',()=>{
 const isbn=filter.choices(grouped,'isbn',quality);
 assert.deepEqual(isbn.map(x=>x.value),['(Blank)'].filter(()=>false).concat(['9781111111111','9782222222222','unreadable']));
 assert.equal(isbn.find(x=>x.value==='9781111111111').count,1);
 assert.deepEqual(filter.choices(grouped,'shelf',quality).map(x=>x.value),['(Blank)','A-01','A-02','B-12']);
 assert.deepEqual(filter.choices(grouped,'total',quality).map(x=>x.value),['1','2']);
});
test('multi-select is OR within a column and AND across columns',()=>{
 const selected={shelf:['A-02','B-12'],title:['Practical Data Analysis']};
 assert.equal(grouped.filter(g=>filter.matches(g,filter.empty(),quality(g),selected)).length,1);
 selected.title=['Practical Data Analysis','Everyday Excel'];
 assert.equal(grouped.filter(g=>filter.matches(g,filter.empty(),quality(g),selected)).length,2);
 assert.deepEqual(filter.active(filter.empty(),selected),['title','shelf']);
 selected.available=['0'];
 assert.equal(grouped.filter(g=>filter.matches(g,filter.empty(),quality(g),selected)).length,0);
});
test('picker supports blank values, multiple states and zero-count filters without a crash',()=>{
 const untitled=get('unreadable');
 assert.deepEqual(filter.groupValues(untitled,'title',quality(untitled)),['(Blank)']);
 assert.equal(filter.matches(untitled,filter.empty(),quality(untitled),{title:['(Blank)']}),true);
 assert.equal(filter.matches(untitled,filter.empty(),quality(untitled),{title:['Unknown']}),false);
 const both=get('9781111111111');
 assert.deepEqual(filter.groupValues(both,'status',quality(both)),['Available','On loan','Overdue']);
 assert.equal(filter.matches(both,filter.empty(),quality(both),{status:['On loan','Overdue']}),true);
 assert.equal(filter.matches(both,filter.empty(),quality(both),{status:['Not recorded']}),false);
 assert.deepEqual(filter.choices([], 'title',quality),[]);
});
