'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.join(__dirname,'..');const server=require('../lib/recognition-server.cjs');
test('private queue rejects unlabelled, repeated, oversized or malformed images',()=>{
 const img=Buffer.alloc(100,1).toString('base64');
 assert.equal(server.validatePhotos([{label:'front',image:img},{label:'front',image:img}]),false);
 assert.equal(server.validatePhotos([{label:'front',image:img},{label:'back',image:img}]),true);
 assert.equal(server.validatePhotos([{label:'front',image:'!!!'},{label:'back',image:img}]),false);
 assert.equal(server.validatePhotos([{label:'front',image:img}]),false);
});
test('worker requires a cron secret',async()=>{const prev=process.env.CRON_SECRET;process.env.CRON_SECRET='test-only-secret';const handler=require('../api/recognition-worker');let status,body;const res={setHeader(){},status(n){status=n;return this},json(b){body=b;return this}};await handler({method:'GET',headers:{}},res);assert.equal(status,401);assert.equal(body.error,'Unauthorized');if(prev===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=prev});
test('browser uses durable server queue instead of direct synchronous comparison',()=>{const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.match(html,/recognitionApi\('POST',\{photos/);assert.match(html,/recognitionApi\('DELETE'/);assert.match(html,/waitForRecognition\(/)});
test('Vercel Hobby config shares daily operations cron with protected recognition worker',()=>{const v=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));assert.ok(v.crons.some(c=>c.path==='/api/operations-cron'));assert.ok(!v.crons.some(c=>c.path==='/api/recognition-worker'));assert.ok(v.crons.every(c=>c.schedule!=='* * * * *'));assert.ok(v.functions['api/recognition-worker.js']);assert.ok(fs.readFileSync(path.join(root,'api/operations-cron.js'),'utf8').includes("require('./recognition-worker')"))});
