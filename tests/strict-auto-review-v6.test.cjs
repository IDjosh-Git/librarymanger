const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const sql=fs.readFileSync(path.join(root,'database/22_intelligent_auto_review.sql'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'assets/automation-centre.js'),'utf8');
test('strict review is disabled by default and preview defaults to dry-run',()=>{assert.match(sql,/enabled boolean NOT NULL DEFAULT false/);assert.match(sql,/p_dry_run boolean DEFAULT true/);assert.match(sql,/NOT p_dry_run AND NOT v_enabled/)});
test('approval requires verified provenance and rejects duplicate physical copy ids',()=>{assert.match(sql,/verified_metadata,source/);assert.match(sql,/no_server_verified_metadata/);assert.match(sql,/duplicate_physical_copy_id/);assert.match(sql,/pg_advisory_xact_lock/)});
test('batch is bounded, audited, admin-gated and row-locked',()=>{assert.match(sql,/max_batch BETWEEN 1 AND 100/);assert.match(sql,/FOR UPDATE SKIP LOCKED/);assert.match(sql,/library_auto_review_audit/);assert.match(sql,/role='admin'/)});
test('UI exposes preview, explicit enablement and confirmed execution',()=>{for(const id of ['autoReviewPreview','autoReviewRun','autoReviewEnabled','autoReviewResults'])assert.ok(html.includes('id="'+id+'"'));assert.match(js,/window\.confirm/);assert.match(js,/library_run_strict_auto_review/)});
