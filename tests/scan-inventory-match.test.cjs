const {test}=require('node:test');const assert=require('node:assert/strict');
const helper=require('../assets/scan-extraction'),match=require('../assets/scan-inventory-match');
const a={title:'The Adventures of Sherlock Holmes',authors:'Arthur Conan Doyle',publisher:'Original Press',publication_year:'2010',barcode:'9780470455715'};
test('existing inventory exact title matched immediately without inventing edition details',()=>{
 const result=match.match('THE ADVENTURES OF SHERLOCK HOLMES\nby Arthur Conan Doyle',[a],helper);
 assert.equal(result?.title,a.title);assert.equal(result?.authors,a.authors);
 assert.equal(result?.publisher,undefined);assert.equal(result.editionMatched,false);
});
test('exact printed ISBN may reuse edition fields',()=>{
 const result=match.match('THE ADVENTURES OF SHERLOCK HOLMES\nby Arthur Conan Doyle',[a],helper,a.barcode);
 assert.equal(result?.publisher,'Original Press');assert.equal(result?.editionMatched,true);
});
test('different scanned ISBN does not copy a different edition',()=>{
 assert.equal(match.match('THE ADVENTURES OF SHERLOCK HOLMES\nby Arthur Conan Doyle',[a],helper,'9780000000000'),null);
});
test('same title with ambiguous authors cannot be guessed',()=>{
 const b={...a,authors:'Another Author'};
 assert.equal(match.match('THE ADVENTURES OF SHERLOCK HOLMES',[a,b],helper),null);
});
test('unrelated OCR text does not match existing inventory book',()=>{
 assert.equal(match.match('Introduction to corporate finance by R K Smith',[a],helper),null);
});
