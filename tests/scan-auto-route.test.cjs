'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const route=require('../assets/scan-auto-route');
const title='The Science of Reading';
const base={saveRecordId:'75265b3a-5071-48a1-9c40-abcb78e2815a',sourceSignature:'sha256:'+'a'.repeat(64),title,authors:'Grace Author',barcode:'9780143127741',verifiedSource:'isbn',shelf:'A-4'};
test('verified ISBN with complete title is saved to Inventory',()=>assert.equal(route.decide(base),'inventory'));
test('title-only inventory matches require Review',()=>assert.equal(route.decide({...base,verifiedSource:'inventory',barcode:''}),'review'));
test('an edition-verified ISBN inventory match may be saved',()=>assert.equal(route.decide({...base,verifiedSource:'inventory',inventoryEditionMatched:true}),'inventory'));
test('high-confidence catalogue match is allowed',()=>assert.equal(route.decide({...base,verifiedSource:'catalog',barcode:''}),'inventory'));
test('OCR guessed title without verified catalogue is sent to Review',()=>assert.equal(route.decide({...base,verifiedSource:'',title:'Might Be Something'}),'review'));
test('AI-only cover details are reviewed rather than hallucinated into Inventory',()=>assert.equal(route.decide({...base,verifiedSource:'ai'}),'review'));
test('mismatched title/ISBN blocks automatic inventory save',()=>assert.equal(route.decide({...base,coverMismatch:true}),'review'));
test('manual review stage always wins',()=>assert.equal(route.decide({...base,reviewStaged:true}),'review'));
test('existing saved row is skipped even with verified metadata',()=>assert.equal(route.decide({...base,saved:true}),'skip'));
test('invalid record with no title goes to Review',()=>assert.equal(route.decide({...base,title:''}),'review'));
test('saved schema retains unique copy ID and source signature, no borrower fields',()=>{
 const p=route.payload(base,'3e0aaad1-b65d-4ee3-b9ed-4f70e8ed0853',new Date('2026-11-12T17:00:00Z'));
 assert.equal(p.record_id,base.saveRecordId);assert.equal(p.source_signature,base.sourceSignature);
 assert.equal(p.title,title);assert.equal(p.shelf_location,'A-4');assert.equal(p.book_status,'Available');
 assert.equal(p.user_id,'3e0aaad1-b65d-4ee3-b9ed-4f70e8ed0853');assert.equal('borrower_name' in p,false);
});
test('automatic results distinguish confirmed Inventory and confirmed Review from in-flight',()=>{
 const result=route.summarize([{saved:true,autoHandled:true},{saved:false,autoHandled:true,reviewStaged:true},{saved:false,autoHandled:true,saveError:'network',reviewStaged:true},{saved:false,autoHandled:true,autoState:'saving'}],3);
 assert.deepEqual(result,{saved:1,review:1,failed:1,saving:1,skipped:3});
});
