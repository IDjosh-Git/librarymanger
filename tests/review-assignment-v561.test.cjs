const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.join(__dirname,'..');const sql=fs.readFileSync(path.join(root,'database/15_review_assignment.sql'),'utf8');const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
test('review allocation requires admin and serializes claims',()=>{assert.match(sql,/role='admin'/);assert.match(sql,/pg_advisory_xact_lock/);assert.match(sql,/NOT EXISTS \(SELECT 1 FROM public\.library_review_assignments/)});
test('assignment expiry, release and renewal are defined',()=>{assert.match(sql,/15 minutes/);assert.match(sql,/library_renew_review_assignment/);assert.match(sql,/library_release_review_assignment/)});
test('review UI exposes claim and release controls',()=>{assert.match(html,/id="reviewClaimNext"/);assert.match(html,/id="reviewReleaseMine"/);assert.match(html,/library_claim_next_review/)});
