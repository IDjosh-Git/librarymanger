const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const html=fs.readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8');
test('reconciliation export is explicitly user-initiated and uses fresh cloud review',()=>{assert.match(html,/id="exportReviewAudit"/);assert.match(html,/addEventListener\('click',exportReviewReconciliation\)/);assert.match(html,/const rows=await fetchCloudReview\(session\.user\.id\)/)});
test('reconciliation compares physical IDs and treats ISBN as informational',()=>{assert.match(html,/ids\.has\(copyId\)/);assert.match(html,/Physical copy already in Inventory/);assert.doesNotMatch(html,/if\(ids\.has\(data\.barcode\)\)/)});
test('CSV fields protect against spreadsheet formula injection',()=>{assert.match(html,/function downloadReviewReconciliation/);assert.match(html,/str='\\t'\+str/)});
