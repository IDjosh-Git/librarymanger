const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=html.match(/function batchShelf\([\s\S]*?\n\}/)?.[0];
assert.ok(source,'batchShelf found');
const batchShelf=vm.runInNewContext(source+';batchShelf');
test('folder shelf detection preserves nested folders and supports default root shelf',()=>{
 assert.equal(batchShelf('SelectedFolder/Book.jpg','','folder'),'SelectedFolder');
 assert.equal(batchShelf('SelectedFolder/Book.jpg','Shelf 01','folder'),'Shelf 01');
 assert.equal(batchShelf('SelectedFolder/Shelf A/Book.jpg','Default','folder'),'Shelf A');
 assert.equal(batchShelf('Book.jpg','Loose','photos'),'Loose');
 assert.equal(batchShelf('Shelf B/Book.jpg','','ZIP'),'Shelf B');
 assert.equal(batchShelf('Archive\\Shelf C\\Book.jpg','','ZIP'),'Shelf C');
});
test('scan batch preserves corrected details and permits incomplete duplicate saves',()=>{
 assert.match(html,/batchZipLoading=true/);
 assert.match(html,/finally\{batchZipLoading=false/);
 assert.match(html,/if\(x\.barcode&&!x\.title\)await batchLookUp\(x\)/);
 assert.match(html,/record_id:x\.saveRecordId\|\|\(x\.saveRecordId=uuid\(\)\)/);
 assert.match(html,/barcode:clean\(x\.barcode\),title:nullable\(x\.title\)/);
 assert.doesNotMatch(html,/Complete the title and shelf details for/);
});

test('top-of-inventory ISBN form includes shelf and optional title, and saves shelf with each new copy',()=>{
 assert.match(html,/<input id="manualShelf"[^>]*aria-label="Shelf number or location"/);
 assert.match(html,/<input id="manualTitle"[^>]*aria-label="Book title, optional"/);
 assert.match(html,/shelf_location:manualShelf\|\|null/);
 assert.match(html,/title:manualTitle\|\|null/);
 assert.match(html,/\$\('manualShelf'\)\.value\.trim\(\)\|\|\$\('batchDefaultShelf'\)/);
});
