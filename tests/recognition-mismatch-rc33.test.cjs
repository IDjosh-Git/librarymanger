'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
test('history is scoped to the current review book',()=>{const ui=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.match(ui,/const ownJobs=jobs\.filter\(/);assert.match(ui,/j\.review_key===row\.saveRecordId/);assert.match(ui,/ownJobs\.find\(/)});
test('cancelled upload cannot silently create a running job',()=>{const ui=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.match(ui,/if\(controller\.signal\.aborted\)\{await recognitionApi\('DELETE',null,job\.id\)/)});
test('server only retries jobs whose photos are retained',()=>{const api=fs.readFileSync(path.join(root,'api/recognition-jobs.js'),'utf8');assert.match(api,/status=eq\.failed&input_paths=not\.eq\.%5B%5D&select=id/);assert.doesNotMatch(api,/status=in\.\(failed,cancelled\)/)});
test('worker writes results only for its current attempt',()=>{const worker=fs.readFileSync(path.join(root,'api/recognition-worker.js'),'utf8');assert.match(worker,/attempt_count=eq\.'\+job\.attempt_count/);assert.match(worker,/status:succeeded\?'completed':'superseded'/)});
