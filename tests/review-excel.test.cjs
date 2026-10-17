const test=require('node:test');
const assert=require('node:assert/strict');
const excel=require('../assets/review-excel.js');
let counter=1;
function key(){return '00000000-0000-4000-8000-'+String(counter++).padStart(12,'0')}
function matrix(...rows){return [excel.columns,...rows.map(r=>excel.columns.map(k=>r[k]||''))]}
function fileRow(p={}){return {Review_Key:key(),Photo_File:'photo.jpg',Folder:'Shelf A/photo.jpg',ISBN_Barcode:'09780140328721',Title:'Book A',Authors:'Writer',Shelf_Number:'Shelf A',Import_Action:'SAVE',...p}}
test('Export retains a distinct, stable per-copy Review_Key even for duplicate ISBNs',()=>{
 const a={barcode:'9780140328721',title:'Same title',shelf:'Shelf A',fileName:'a.jpg'};
 const b={barcode:'9780140328721',title:'Same title',shelf:'Shelf A',fileName:'b.jpg'};
 const x=excel.exportRow(a,key),y=excel.exportRow(b,key);
 assert.notEqual(x.Review_Key,y.Review_Key);
 assert.equal(x.ISBN_Barcode,y.ISBN_Barcode);
 assert.equal(excel.exportRow(a,key).Review_Key,x.Review_Key);
 assert.deepEqual(Object.keys(x),excel.columns);
});
test('Excel import preserves ISBN leading zeros, missing fields, and different copies with same ISBN',()=>{
 const a=fileRow({Title:'Corrected A',Authors:'A Author'});
 const b=fileRow({Title:'',Authors:'',Shelf_Number:'',Review_Key:'',Photo_File:'new copy.jpg'});
 const result=excel.validateAndParse(matrix(a,b),key);
 assert.equal(result.length,2);
 assert.equal(result[0].barcode,'09780140328721');
 assert.equal(result[1].barcode,'09780140328721');
 assert.notEqual(result[0].saveRecordId,result[1].saveRecordId);
 assert.equal(result[0].title,'Corrected A');
 assert.equal(result[1].title,'');
 assert.equal(result[1].selected,true);
});
test('Skipped rows are omitted; invalid actions and duplicate review keys are rejected',()=>{
 const r=fileRow(),skipped=fileRow({Import_Action:'SKIP'});
 assert.equal(excel.validateAndParse(matrix(r,skipped),key).length,1);
 assert.throws(()=>excel.validateAndParse(matrix(r,{...r,Photo_File:'duplicate copy.jpg'}),key),/Review_Key is repeated/);
 assert.throws(()=>excel.validateAndParse(matrix(fileRow({Import_Action:'DELETE'})),key),/Import_Action must be SAVE or SKIP/);
});
test('Invalid template, damaged key, and empty rows produce helpful errors',()=>{
 assert.throws(()=>excel.validateAndParse([['Title'],['x']],key),/Wrong Excel template/);
 assert.throws(()=>excel.validateAndParse(matrix(fileRow({Review_Key:'modified-key'})),key),/Review_Key was changed/);
 assert.throws(()=>excel.validateAndParse(matrix({Import_Action:'SAVE'}),key),/No books marked SAVE/);
});
test('Added blank key rows are independent, not consolidated by repeated ISBN, and whitespace is trimmed',()=>{
 const a=fileRow({Review_Key:'',Title:'  First copy  ',ISBN_Barcode:9780140328721,Photo_File:'one.jpg'});
 const b=fileRow({Review_Key:'',Title:'  Second copy  ',ISBN_Barcode:9780140328721,Photo_File:'two.jpg'});
 const rows=excel.validateAndParse(matrix(a,b),key);
 assert.deepEqual(rows.map(r=>r.title),['First copy','Second copy']);
 assert.equal(rows[0].barcode,'9780140328721');
 assert.notEqual(rows[0].saveRecordId,rows[1].saveRecordId);
});
