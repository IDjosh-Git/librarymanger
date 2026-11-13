'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const helper=require('../assets/scan-extraction');
const match=require('../assets/scan-inventory-match');
const route=require('../assets/scan-auto-route');
const ids=require('../assets/book-identifiers');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const book={title:'The Adventures of Sherlock Holmes',authors:'Arthur Conan Doyle',publisher:'Test Press',publication_year:'2010',barcode:'9780470455715'};
const cover='THE ADVENTURES OF SHERLOCK HOLMES\nby Arthur Conan Doyle';
test('an existing work-level title match is NOT edition-verified or automatically saved',()=>{
 const result=match.match(cover,[book],helper);
 assert.equal(result?.title,book.title);
 assert.equal(result?.editionMatched,false);
 const row={title:result.title,authors:result.authors,verifiedSource:result.editionMatched?'inventory':''};
 assert.equal(route.decide(row),'review');
});
test('a checksum-invalid but otherwise identical barcode is NOT edition evidence',()=>{
 const fake='9780141034266';
 assert.equal(ids.valid(fake),false);
 const result=match.match(cover,[{...book,barcode:fake}],helper,fake);
 assert.equal(result?.editionMatched,false);
});
test('a verified matching ISBN may reuse publisher and publication-year details',()=>{
 const result=match.match(cover,[book],helper,book.barcode);
 assert.equal(result?.editionMatched,true);
 assert.equal(result.publisher,'Test Press');
 assert.equal(result.publication_year,'2010');
 assert.equal(route.decide({title:result.title,authors:result.authors,barcode:book.barcode,verifiedSource:'inventory',inventoryEditionMatched:true}),'inventory');
});
test('the real OCR pipeline does not elevate title-only inventory matches to verified editions',async()=>{
 const code=html.slice(html.indexOf('async function recognizeCoverLocally(row,file,'),html.indexOf('async function enrichScanFromImage(row,'));
 assert.ok(code.includes('if(local.editionMatched){row.verifiedSource='));
 const row={title:'',authors:'',barcode:'',ocrText:'',matches:[],verifiedSource:'',lookup_status:''};
 const ctx={row,books:[book],scanHelper:helper,inventoryScanMatch:match,
  ocrText:async()=>cover,batchLookUp:async()=>{},findOCRCatalogMatches:async()=>[],
  hasBookTitle:x=>!!String(x||'').trim(),
  globalThis:{LibraryRecognitionPolicy:{shouldSearchTitle:()=>false}}};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 assert.equal(await vm.runInContext('recognizeCoverLocally(row,{}, {fast:true})',ctx),true);
 assert.equal(row.title,book.title);
 assert.equal(row.verifiedSource,'');
 assert.equal(route.decide(row),'review');
});
test('a work-level title search cannot invent an edition publisher, date or page count',()=>{
 const code=html.slice(html.indexOf('function applyCoverCatalogMatch(row){'),html.indexOf('// OCR first is usually much faster'));
 const row={title:book.title,authors:book.authors,ocrText:cover,matches:[{title:book.title,authors:book.authors,publisher:'Unrelated Edition Press',publication_year:'2040',pages:'999',subject:'Literature',source:'Book Index'}]};
 const ctx={row,scanHelper:helper};vm.createContext(ctx);vm.runInContext(code,ctx);
 assert.equal(vm.runInContext('applyCoverCatalogMatch(row)',ctx),true);
 assert.equal(row.verifiedSource,'catalog');
 assert.equal(row.publisher,undefined);
 assert.equal(row.publication_year,undefined);
 assert.equal(row.pages,undefined);
 assert.equal(row.subject,'Literature');
});
