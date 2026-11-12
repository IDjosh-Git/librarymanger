const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const html=readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');

test('main UI loads the verified streaming queue before scanning starts',()=>{
 assert.match(html,/assets\/scan-stream\.js\?v=5\.32\.0/);
 const start=html.indexOf('async function runBatch()');
 const end=html.indexOf('function batchSelectAll()',start);
 const body=html.slice(start,end);
 assert.match(body,/await scanStream\.run\(/);
 assert.match(body,/onChunk:/);
 assert.match(body,/chunkSize:offset=>offset===0\?1/);
 assert.doesNotMatch(body,/await scanUploadGuard\.prepare\(originalQueue/);
 assert.doesNotMatch(body,/await scanUploadGuard\.register\(sb,uploader,candidates\)\s*;[\s\S]*?const lane=/);
 assert.match(body,/processedUploads=\[\]/);
});

test('ZIP entries are unpacked during streaming preparation, not before scanning starts',()=>{
 const zip=html.slice(html.indexOf('async function batchZipFiles('),html.indexOf('function batchMime('));
 assert.match(zip,/zipEntry:x/);
 assert.doesNotMatch(zip,/await x\.async\('blob'\)/);
 const scan=html.slice(html.indexOf('async function runBatch('),html.indexOf('function batchSelectAll()'));
 assert.match(scan,/item\.zipEntry\.async\('blob'\)/);
});

test('bulk scan recognizes via local OCR before cloud AI when both are enabled',()=>{
 const recognition=html.slice(html.indexOf('async function enrichScanFromImage('),html.indexOf('async function batchTitleSearch('));
 const local=recognition.indexOf('await recognizeCoverLocally(row,file,{fast}');
 const cloud=recognition.indexOf('await readCoverWithAI(row,file');
 assert.ok(local>=0&&cloud>local);
 assert.match(recognition,/if\(found\|\|mode==='ocr'\)return/);
 const batch=html.slice(html.indexOf('async function runBatch('),html.indexOf('function batchSelectAll()'));
 assert.match(batch,/if\(!hasBookTitle\(row\.title\)/);
});

test('partial scanned covers are persisted even when cloud preparation fails',()=>{
 const body=html.slice(html.indexOf('async function runBatch('),html.indexOf('function batchSelectAll()'));
 assert.match(body,/if\(processedUploads\.length&&session\?\.user\?\.id===uploader&&scanCheckpointMarked<processedUploads\.length\)/);
 assert.match(body,/await persistReviewDraft\(uploader,reviewDraftVersion\)/);
 assert.match(body,/releaseProcessing\(sb,uploader,unused\)/);
});
