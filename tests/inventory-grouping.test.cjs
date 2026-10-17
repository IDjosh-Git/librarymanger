const test = require('node:test');
const assert = require('node:assert/strict');
const { groupBooks, identity, isbn13 } = require('../lib/inventory-grouping.cjs');
const make = (id, barcode, overrides={}) => ({record_id:id,barcode,title:'Books and Data',authors:'Ada',book_status:'Available',shelf_location:'A1',...overrides});
test('matching ISBN copies are shown as one inventory book with available and total counts',()=>{
 const grouped=groupBooks([make('a','9780140328721'),make('b','9780140328721',{book_status:'Borrowed',due_date:'2026-10-01'}),make('c','9780140328721')],'2026-10-16');
 assert.equal(grouped.length,1);assert.equal(grouped[0].totalCopies,3);assert.equal(grouped[0].availableCopies,2);
 assert.equal(grouped[0].borrowedCopies,1);assert.equal(grouped[0].overdueCopies,1);
 assert.equal(grouped[0].availableCopy.record_id,'a');assert.equal(grouped[0].borrowedCopy.record_id,'b');
});
test('equivalent ISBN-10 and ISBN-13 codes share the same inventory row',()=>{
 assert.equal(isbn13('0-14-032872-6'),'9780140328721');
 assert.equal(groupBooks([make('a','0-14-032872-6'),make('b','9780140328721')]).length,1);
});
test('two different ISBNs for same title remain separate editions',()=>{
 const groups=groupBooks([make('a','9780140328721'),make('b','9780679734529')]);assert.equal(groups.length,2);
});
test('missing ISBN records never merge just because title is empty',()=>{
 assert.equal(groupBooks([make('a','',{title:'',authors:''}),make('b','',{title:'',authors:''})]).length,2);
});
test('matching sufficiently complete bibliography can group copies without barcodes',()=>{
 const details={publisher:'Acme Press',publication_year:'2020'};
 assert.equal(groupBooks([make('a','',details),make('b','',details)]).length,1);
 assert.equal(groupBooks([make('a','',details),make('b','',{...details,publication_year:'2021'})]).length,2);
});
test('representative prefers metadata complete copy and retains all shelves and IDs',()=>{
 const g=groupBooks([make('a','CODE',{title:'',authors:''}),make('b','CODE',{publisher:'Press',shelf_location:'B2'})])[0];
 assert.equal(g.representative.record_id,'b');assert.deepEqual(g.shelves,['A1','B2']);assert.equal(g.copies.length,2);
});
