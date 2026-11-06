'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
function extract(start,end){const a=html.indexOf(start),b=html.indexOf(end,a+start.length);assert(a>=0&&b>a,`${start} not found`);return html.slice(a,b)}
const hasBookTitleSrc=extract('function hasBookTitle(value){','function bookQuality(b){');
const qualitySrc=extract('function bookQuality(b){','let inventoryGroupCache=');
const renderSrc=extract('function renderBatch(){','function setBatchQueue(');
const selectSrc=extract('function batchSelectAll(){','function batchRemoveSelected(){');
const ids=['batchReadyResults','batchResults','scanNeedsTitleCount'];
const nodes=Object.fromEntries(ids.map(id=>[id,{innerHTML:'',textContent:''}]));
const original=[
  {fileName:'identified-a.jpg',title:'The Hobbit',authors:'Tolkien',shelf:'',selected:true,saved:false,duplicate:false,saveRecordId:'a'},
  {fileName:'unknown-b.jpg',title:'',authors:'',shelf:'',selected:false,saved:false,duplicate:false,saveRecordId:'b'},
  {fileName:'identified-c.jpg',title:'Dune',authors:'Herbert',shelf:'',selected:false,saved:false,duplicate:true,saveRecordId:'c'},
  {fileName:'unknown-d.jpg',title:'Unknown',authors:'',shelf:'',selected:false,saved:false,duplicate:true,saveRecordId:'d'}
];
const scope={batchItems:original,reviewPage:1,books:[],batchActive:false,batchSaving:false,batchZipLoading:false,batchExcelLoading:false,
 $:id=>nodes[id]||null,batchSummary(){},renderSavedAttentionReview(){},scheduleReviewDraftSave(){},
 esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
 batchAttr:s=>String(s??'').replaceAll('"','&quot;'),reviewShelfField:()=>'',batchCandidateMarkup:()=>'',batchPreview:()=>'',
 batchOutput(){},refreshBatchDuplicates(){},batchValid:x=>!!(!x.saved&&!x.reviewBusy&&x.title&&x.title!=='Unknown'),console};
vm.createContext(scope);vm.runInContext(hasBookTitleSrc+'\n'+qualitySrc+'\n'+renderSrc+'\n'+selectSrc,scope);
const quality=vm.runInContext('bookQuality',scope),title=vm.runInContext('hasBookTitle',scope);
assert(title('A') && title('Dune') && !title('Unknown') && !title('Untitled book') && !title(''));
assert.equal(quality({title:'Dune',authors:'',publisher:'',barcode:'',shelf_location:''}).attention,false,'Title alone is enough');
assert.equal(quality({title:'',authors:'Tolkien',barcode:'9780143127741'}).attention,true,'Only titleless books need review');
scope.renderBatch();
assert.match(nodes.batchReadyResults.innerHTML,/data-save-ready="0"/);
assert.match(nodes.batchReadyResults.innerHTML,/data-save-ready="2"/);
assert.doesNotMatch(nodes.batchReadyResults.innerHTML,/data-save-ready="1"|data-save-ready="3"/);
assert.match(nodes.batchResults.innerHTML,/data-save-title="1"/);
assert.match(nodes.batchResults.innerHTML,/data-save-title="3"/);
assert.doesNotMatch(nodes.batchResults.innerHTML,/data-save-title="0"|data-save-title="2"/);
assert.equal(nodes.scanNeedsTitleCount.textContent,'2');
const selectAll=vm.runInContext('batchSelectAll',scope);selectAll();
assert.equal(original[0].selected,true);assert.equal(original[2].selected,true);
assert.equal(original[1].selected,false);assert.equal(original[3].selected,false);
const selectDuplicates=vm.runInContext('batchSelectDuplicates',scope);selectDuplicates();
assert.equal(original[0].selected,false);assert.equal(original[2].selected,true);
assert.equal(original[3].selected,false,'Titleless duplicates remain in review');
assert(html.includes("$('addManual').onclick=()=>void addBook($('manualBarcode').value)"),'Manual Add to library must be wired');
assert(html.includes('const plan=reviewSavePlan(batchItems,false)'), 'Titleless bulk save bypass must be disabled');
assert(html.includes('zipPrepared&&!batchActive&&!batchSaving'),'ZIP error must never replay stale queue');
assert(html.includes('new Set([row.saveRecordId])'),'Individual save must target stable copy id');
assert.equal((html.match(/data-nav-action="scan"/g)||[]).length,0,'No duplicate scan shortcut outside studio');
assert.equal((html.match(/data-dashboard-action="scan"/g)||[]).length,0,'No dashboard scan buttons');
assert.match(html,/data-gotab="shelfScan"[^>]*>.*?Scan &amp; Review/s);
console.log('PASS: title-only criteria, mixed batch indices, select all, duplicate selection, manual button, ZIP safety, and unified scan navigation');
