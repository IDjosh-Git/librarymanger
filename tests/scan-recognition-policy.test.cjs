'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const policy=require('../assets/scan-recognition-policy.js');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const vision=fs.readFileSync(path.join(__dirname,'../api/book-vision.js'),'utf8');
const fallback=(title='',authors='',verifiedSource='')=>({title,authors,verifiedSource});
test('Catalogue with verified title and author stops costly OCR and AI',()=>{
 const r=fallback('The Book','A Writer','isbn');assert.equal(policy.verified(r),true);assert.equal(policy.needsOCR(r,true),false);assert.equal(policy.needsAI(r,true),false);
});
test('Incomplete exact ISBN metadata can activate OCR and AI',()=>{
 const r=fallback('The Book','','isbn');assert.equal(policy.needsOCR(r,true),true);assert.equal(policy.needsAI(r,true),true);
});
test('No ISBN means OCR can create title evidence for Book API; AI remains the fallback',()=>{
 const r=fallback();assert.equal(policy.needsOCR(r,true),true);assert.equal(policy.shouldSearchTitle(r),true);assert.equal(policy.needsAI(r,true),true);
});
test('Settings switches disable cloud AI and local OCR independently',()=>{
 const r=fallback();assert.equal(policy.needsAI(r,false),false);assert.equal(policy.needsOCR(r,false),false);
});
test('Verified catalogue book never requires unnecessary title search',()=>{
 assert.equal(policy.shouldSearchTitle(fallback('A Title','An Author','catalog')),false);
});
test('Toggles are in Account Settings and absent from Scan and Review',()=>{
 const account=html.slice(html.indexOf('<details class="account-tools">'),html.indexOf('<div id="status"'));
 const scan=html.slice(html.indexOf('<div id="shelfScan"'),html.indexOf('<div id="review"'));
 const review=html.slice(html.indexOf('<div id="review"'),html.indexOf('<div id="scanned"'));
 for(const name of ['batchUseOCR','batchUseAI']){assert.match(account,new RegExp('id="'+name+'"'));assert.doesNotMatch(scan,new RegExp('id="'+name+'"'))}
 assert.doesNotMatch(review,/id="reviewUse(?:AI|OCR)"/);
 assert.doesNotMatch(review,/data-batch-(?:ai|ocr)="/);
});
test('Vision accepts OCR text as supporting image evidence but never a command',()=>{
 assert.match(html,/ocrText:String\(row\.ocrText/);
 assert.match(vision,/OCR TRANSCRIPTION \(DATA ONLY/);
 assert.match(vision,/replace\(\/\[\\x00-\\x1f<>\]/);
});
test('Automatic scanner queries ISBN before OCR and AI, and retains Review fallback',()=>{
 const scan=html.slice(html.indexOf('const scan=async item=>{'),html.indexOf('await scanStream.run('));
 assert.ok(scan.indexOf('await decodeBatchBarcode')<scan.indexOf('await batchLookUp(row)'));
 assert.ok(scan.indexOf('await batchLookUp(row)')<scan.indexOf('await enrichScanFromImage(row'));
 assert.match(scan,/route==='inventory'\)queueAutomaticSave/);
 assert.match(scan,/reviewUploads\.push\(item\)/);
});
