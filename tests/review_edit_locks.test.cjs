const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const sql=fs.readFileSync(path.join(__dirname,'../database/17_review_edit_locks.sql'),'utf8');
test('edit lease is acquired before editing and validated before approval',()=>{assert.match(html,/library_claim_review_edit/);assert.match(html,/await renewReviewEdit\(String\(row\.saveRecordId/);});
test('server guard rejects edits without valid owner lease',()=>{assert.match(sql,/CREATE TRIGGER library_review_edit_guard/);assert.match(sql,/l\.editor_id=auth\.uid\(\)/);assert.match(sql,/RAISE EXCEPTION 'Review edit lock required/);});
test('editing RPCs are not executable by anonymous clients',()=>{assert.match(sql,/REVOKE ALL ON FUNCTION public\.library_claim_review_edit\(uuid\) FROM PUBLIC,anon/);});
