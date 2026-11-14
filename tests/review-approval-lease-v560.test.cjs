const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sql=fs.readFileSync(path.join(root,'database/14_review_approval_leases.sql'),'utf8');
test('approval requires an atomic cloud lease and rejects missing migration',()=>{
 assert.match(html,/sb\.rpc\('library_claim_review_approval'/);
 assert.match(html,/if\(leaseError\).*return/);
 assert.match(html,/if\(!leaseGranted\).*return/);
 assert.match(html,/finally\{[\s\S]*?library_release_review_approval/);
});
test('lease is limited to admins and expires for abandoned approvals',()=>{
 assert.match(sql,/role='admin'/);
 assert.match(sql,/expires_at<now\(\)/);
 assert.match(sql,/interval '5 minutes'/);
 assert.match(sql,/REVOKE ALL ON public\.library_review_approval_leases/);
});
