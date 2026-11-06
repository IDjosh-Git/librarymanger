'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const source=html.slice(html.indexOf('async function readCoverWithAI('),html.indexOf('async function batchTitleSearch('));
assert.ok(source.includes('function applyCoverCatalogMatch'));
const scanHelper=require('../assets/scan-extraction.js');
let coverResponse={metadata:{title:'The Hobbit',authors:'J. R. R. Tolkien',isbn:'',publisher:'',publication_year:''}};
let useAI=true,wasCalled=false;
const ctx={
 console,scanHelper,session:{access_token:'sample-access-token'},
 AbortController,AbortSignal,setTimeout,clearTimeout,
 $:id=>id==='batchUseAI'?{checked:useAI}:null,
 fetch:async()=>{wasCalled=true;return {ok:true,status:200,json:async()=>coverResponse}},
 imageForAI:async()=> 'a'.repeat(200),
 reviewSourceFile:async row=>row.file||{name:'cover.jpg'},
 ocrText:async()=>'THE HOBBIT\nby J. R. R. Tolkien',
 normalizeIsbn:s=>s, validIsbn:()=>false,
 batchLookUp:async()=>{},
 findOCRCatalogMatches:async row=>scanHelper.scoreCandidates([{title:'The Hobbit',authors:'J. R. R. Tolkien',publisher:'HarperCollins',publication_year:'2012',source:'Catalogue'}],row.ocrText,row.title,row.authors),
};
vm.createContext(ctx);vm.runInContext(source,ctx);
(async()=>{
 const row={file:{name:'cover.jpg'},title:'',authors:'',publisher:'',publication_year:'',barcode:'',matches:[],ocrText:'',lookup_status:'',error:''};
 await vm.runInContext('enrichScanFromImage',ctx)(row);
 assert.ok(wasCalled,'Opted-in AI must be called');
 assert.equal(row.title,'The Hobbit');assert.equal(row.authors,'J. R. R. Tolkien');
 assert.equal(row.publisher,'HarperCollins');assert.equal(row.publication_year,'2012');
 assert.match(row.lookup_status,/high-confidence|cover text/i);
 assert.equal(row.barcode,'','Never infer an ISBN from a title lookup');
 wasCalled=false;useAI=false;
 const row2={file:{name:'cover.jpg'},title:'',authors:'',publisher:'',publication_year:'',barcode:'',matches:[],ocrText:'',lookup_status:''};
 await vm.runInContext('enrichScanFromImage',ctx)(row2);
 assert.equal(wasCalled,false,'Default local OCR must not upload the photo');
 assert.equal(row2.title,'The Hobbit');assert.equal(row2.authors,'J. R. R. Tolkien');
 assert.equal(row2.publisher,'HarperCollins');
 wasCalled=false;
 coverResponse={metadata:{title:'The Hobbit',authors:'J. R. R. Tolkien'}};
 const row3={file:{name:'cover.jpg'},title:'',authors:'',publisher:'',publication_year:'',barcode:'',matches:[],ocrText:'',lookup_status:''};
 await vm.runInContext('enrichScanFromImage',ctx)(row3,{forceAI:true});
 assert.ok(wasCalled,'Explicit AI button must work without enabling batch-wide opt-in');
 assert.equal(row3.title,'The Hobbit');
 console.log('PASS: opted-in cover AI, title catalogue enrichment, OCR fallback, explicit AI button, no inferred ISBN');
})().catch(e=>{console.error(e);process.exitCode=1});
