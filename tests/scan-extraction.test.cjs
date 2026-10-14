const test=require('node:test'),assert=require('node:assert/strict');
const ocr=require('../lib/scan-extraction.cjs');
test('ISBN extraction recognizes hyphenated and OCR-spaced ISBNs, rejects invalid values',()=>{
 assert.deepEqual(ocr.isbnFromText('ISBN 978-0-7432-7356-5'),['9780743273565']);
 assert.deepEqual(ocr.isbnFromText('ISBN: 0 7432 7356 8'),[]);
 assert.equal(ocr.isbnValid('9780743273565'),true);
 assert.equal(ocr.isbnValid('9780743273566'),false);
});
test('Title-page OCR generates search titles and captures author',()=>{
 const content='THE GREAT GATSBY\nA NOVEL\nby F. Scott Fitzgerald\nISBN 978-0-7432-7356-5\nCopyright 2004';
 assert.ok(ocr.titleCandidates(content).some(s=>/GREAT GATSBY/i.test(s)));
 assert.equal(ocr.authorFromText(content),'F. Scott Fitzgerald');
});
test('catalog suggestions rank close titles before unrelated titles',()=>{
 const result=ocr.scoreCandidates([{title:'The Great Gatsby',authors:'F. Scott Fitzgerald'},{title:'Invisible Cities',authors:'Italo Calvino'}], 'The Great Gatsby\nby F. Scott Fitzgerald');
 assert.equal(result[0].title,'The Great Gatsby');assert.ok(result[0].score>0.9);
});
test('inventory quality tracks missing title, missing metadata, completed records',()=>{
 const empty=ocr.detailQuality({barcode:'ABC123'});assert.equal(empty.noTitle,true);assert.equal(empty.needsAttention,true);
 assert.equal(ocr.detailQuality({barcode:'9780743273565',title:'Great Gatsby',authors:'Fitzgerald',publisher:'Scribner',publication_year:'2004',shelf_location:'A'}).full,true);
 assert.equal(ocr.detailQuality({barcode:'x',title:'A',authors:'B',shelf_location:'A'}).needsAttention,true);
});
