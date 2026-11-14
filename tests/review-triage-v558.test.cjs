const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
test('review sorting has all triage choices',()=>{for(const id of ['original','missing','ready','team','duplicate'])assert.match(html,new RegExp('<option value="'+id+'"'));});
test('review sorting retains original indices for actions',()=>{assert.match(html,/reviewMatches\.slice\(\)\.sort/);assert.match(html,/a\.i-b\.i/);assert.match(html,/data-save-title="\$\{i\}"/);});
test('duplicate ISBN alert does not block legitimate additional copies',()=>{assert.match(html,/Possible matching ISBN in Inventory or Review/);assert.match(html,/separate physical copy before approving/);});
