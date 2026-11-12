'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const cloud=require('../lib/library-ai-cloud.cjs');
const inventory=require('../lib/library-ai-inventory.cjs');
const research=require('../lib/library-ai-research.cjs');
const oldRest=cloud.rest;
const books=[
 {record_id:'copy-a',book_id:'B-1',title:'Immigrant, Inc.',authors:'Richard T. Herman; Robert L. Smith',barcode:'9780470455715',publisher:'Wiley',publication_year:'2009',pages:'240',subject:'Business',shelf_location:'25',book_status:'Available',borrower_name:'PRIVATE BORROWER'},
 {record_id:'copy-b',book_id:'B-2',title:'Immigrant, Inc.',authors:'Richard T. Herman; Robert L. Smith',barcode:'9780470455715',publisher:'Wiley',publication_year:'2009',pages:'240',subject:'Business',shelf_location:'26',book_status:'Borrowed',borrower_name:'PRIVATE BORROWER'},
 {record_id:'copy-c',book_id:'B-3',title:'Immigrant, Innovation',authors:'Someone Else',barcode:'9780132350884',publisher:'',publication_year:'',pages:'',subject:'',shelf_location:'20',book_status:'Available'},
 {record_id:'copy-d',book_id:'B-4',title:'Data Science Essentials',authors:'Terry Learner',barcode:'',book_status:'Available'},
 {record_id:'copy-e',book_id:'B-5',title:'Data Science Foundations',authors:'Another Learner',barcode:'',book_status:'Available'}
];
function mockRest(_member,table,{query}){
 assert.equal(table,'library_books');
 assert.match(query,/select=record_id,book_id,title,authors,barcode,publisher,publication_year,language,pages,subject,shelf_location,book_status/);
 assert.doesNotMatch(query,/(borrower_name|due_date|return_date|user_id|source_signature)/);
 const url=new URL('https://example.com/rest/v1/library_books'+query);
 if(url.searchParams.has('record_id'))return Promise.resolve(books.filter(b=>b.record_id===url.searchParams.get('record_id').slice(3)));
 if(url.searchParams.has('barcode'))return Promise.resolve(books.filter(b=>b.barcode===url.searchParams.get('barcode').slice(3)));
 if(url.searchParams.has('title'))return Promise.resolve(books.filter(b=>b.title===url.searchParams.get('title').slice(3)));
 const q=url.searchParams.get('or')||'',terms=[...q.matchAll(/(?:title|authors)\.ilike\.\*([^*]*)\*/g)].map(x=>x[1].toLowerCase());
 return Promise.resolve(books.filter(b=>terms.some(t=>(b.title+' '+b.authors).toLowerCase().includes(t))));
}
test.before(()=>{cloud.rest=mockRest;});
test.after(()=>{cloud.rest=oldRest;});
test('a selected UI record ID is verified from database, not trusted browser metadata',async()=>{
 const r=await inventory.lookup({}, {question:'What is this book about?',selected:{recordId:'copy-a',title:'FAKE TITLE',authors:'IMPOSTOR',isbn:'123456'}});
 assert.equal(r.status,'found');assert.equal(r.book.title,'Immigrant, Inc.');assert.equal(r.book.authors,'Richard T. Herman; Robert L. Smith');
 assert.equal(r.copies.total,2);assert.equal(r.copies.available,1);assert.equal(r.copies.onLoan,1);
 assert.doesNotMatch(JSON.stringify(r),/PRIVATE BORROWER|IMPOSTOR/);
});
test('explicit named title overrides a different selected book',async()=>{
 const r=await inventory.lookup({}, {question:'Tell me about the book Immigrant, Inc. in inventory',selected:{recordId:'copy-d',title:'Data Science Essentials'}});
 assert.equal(r.status,'found');assert.equal(r.book.title,'Immigrant, Inc.');
});
test('a nonexistent named book does not get a fabricated catalogue record',async()=>{
 const r=await inventory.lookup({}, {question:'Tell me about The Book That Does Not Exist'});
 assert.equal(r.status,'not-found');assert.match(inventory.answer(r),/could not verify/i);
});
test('ambiguous inventory matches ask which book rather than guessing',async()=>{
 const r=await inventory.lookup({}, {question:'Tell me about Data Science'});
 assert.equal(r.status,'ambiguous');assert.equal(r.options.length,2);
});
test('no book selected in an ambiguous follow-up requests title, not random book',async()=>{
 const r=await inventory.lookup({}, {question:'Tell me about it'});
 assert.equal(r.status,'not-specified');
});
test('exact ISBN plus title validates a Google Books description, wrong ISBN rejected',()=>{
 const b={title:'Immigrant, Inc.',authors:'Richard T. Herman; Robert L. Smith',isbn:'9780470455715'};
 const good={id:'vol123',volumeInfo:{title:'Immigrant, Inc.: Why Immigrant Entrepreneurs Are Driving the New Economy',authors:['Richard T. Herman','Robert L. Smith'],description:'A book on immigrant entrepreneurship.',industryIdentifiers:[{identifier:'9780470455715'}]}};
 const bad={...good,volumeInfo:{...good.volumeInfo,industryIdentifiers:[{identifier:'9781111111111'}]}};
 assert.equal(research.googles(b,[bad]),null);
 assert.match(research.googles(b,[bad,good]).description,/immigrant entrepreneurship/);
});
test('title-only external matches must have both title AND verified author',()=>{
 const b={title:'Data Science Essentials',authors:'Terry Learner',isbn:''};
 assert.equal(research.matched(b,{title:'Data Science Essentials',authors:'Terry Other',isbns:[]}),false);
 assert.equal(research.matched(b,{title:'Data Science Essentials',authors:'Terry Learner',isbns:[]}),true);
});
test('ISBN edition can be verified from Open Library ISBN arrays',()=>{
 const b={title:'Immigrant, Inc.',isbn:'9780470455715'};
 const record=research.openlibrary(b,{key:'/books/OL12345M',title:'Immigrant, Inc.',isbn_13:['9780470455715'],description:'An immigrant entrepreneurship book.'});
 assert.equal(record.source,'Open Library');assert.match(record.url,/OL12345M/);
 assert.equal(research.openlibrary(b,{key:'/books/OL999M',title:'Immigrant, Inc.',isbn_13:['9781111111111']}),null);
});
test('inventory follow-up resolves only a visible previous verified inventory title',async()=>{
 const history=[{role:'assistant',content:'Inventory record: **Immigrant, Inc.**\nAuthor(s): ...'}];
 const r=await inventory.lookup({}, {question:'Who wrote it?',history});
 assert.equal(r.status,'found');assert.equal(r.book.title,'Immigrant, Inc.');
});
test('older inventory answers are not used as referents after a newer weekly-book answer',()=>{
 const h=[{role:'assistant',content:'Inventory record: **Immigrant, Inc.**'}, {role:'assistant',content:'Book of the Week: A New Book'}];
 assert.equal(inventory.referencedInConversation(h),null);
});
