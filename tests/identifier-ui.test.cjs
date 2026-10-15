const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const app=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
test('inventory enrichment does not reject non-ISBN barcodes before lookup',()=>{
 const handler=app.slice(app.indexOf('async function enrichBook(recordId){'),app.indexOf('let editingRecordId=null'));
 assert.doesNotMatch(handler,/Only ISBNs can be searched/);
 assert.match(handler,/await lookupISBN\(code\)/);
 assert.match(handler,/openBookEditor\(recordId\)/);
});
test('preview, batch import and editor all permit lookup using a barcode',()=>{
 const lookup=app.slice(app.indexOf('async function lookupISBN(code){'),app.indexOf('async function previewISBN(){'));
 assert.match(lookup,/\?code=/);
 assert.match(lookup,/lookupOtherBarcodeDirect/);
 const batch=app.slice(app.indexOf('async function batchLookUp(row){'),app.indexOf('function batchDuplicate(',app.indexOf('async function batchLookUp(row){')));
 assert.doesNotMatch(batch,/if\(!isISBN\(isbn\)\)/);
 assert.match(batch,/lookupISBN\(isbn\)/);
 const editor=app.slice(app.indexOf("$('editorFindISBN').onclick"),app.indexOf("$('editorFindTitle').onclick"));
 assert.match(editor,/await lookupISBN\(isbn\)/);
});
