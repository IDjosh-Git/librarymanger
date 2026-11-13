const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
const css = fs.readFileSync(path.join(root,'assets','library-manager-v542.css'),'utf8');
const section = (a,b) => html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));

test('review editor has a native mobile-safe submit action, not a fragile click-only save',()=>{
 assert.match(html,/<form class="batch-book-fields review-edit-form" data-review-form="\$\{i\}" data-review-key="\$\{batchAttr\(x\.saveRecordId\)\}" novalidate>/);
 assert.match(html,/<button type="submit"[^>]+data-save-title="\$\{i\}"/);
 assert.match(html,/\$\('batchResults'\)\.addEventListener\('submit',async event=>\{/);
 assert.match(html,/event\.preventDefault\(\);event\.stopPropagation\(\)/);
});

test('title alone approves without ISBN and records the empty barcode required by the database',()=>{
 const source=section('function hasBookTitle(value){','function bookQuality(')+'\n'+section('function batchValid(x){','function reviewSavePlan(').split('function reviewShelfNames(')[0];
 const context=vm.createContext({});vm.runInContext(source,context);
 assert.equal(vm.runInContext("batchValid({title:'A Good Book',barcode:'',saved:false,reviewBusy:false})",context),true);
 assert.equal(vm.runInContext("batchValid({title:'',barcode:'9780143127741',saved:false,reviewBusy:false})",context),false);
 assert.equal(vm.runInContext("batchValid({title:'Untitled book',barcode:'',saved:false,reviewBusy:false})",context),false);
 assert.match(html,/barcode:clean\(x\.barcode\),title:nullable\(x\.title\)/);
});

test('all requested metadata fields remain editable and save reads values from the current form',()=>{
 for(const field of ['title','authors','barcode','publisher','publication_year','language','pages','subject','shelf'])assert.match(html,new RegExp("'"+field+"'"));
 assert.match(html,/const REVIEW_EDIT_FIELDS=\['title','authors','barcode','publisher','publication_year','language','pages','subject','shelf'\]/);
 assert.match(html,/syncReviewFields\(form,row\);\s*if\(!hasBookTitle\(row\.title\)\)/);
 assert.match(html,/reviewShelfField\(x,i,rowBusy\)/);
});

test('mobile blur does not destroy the pressed save button or lose edits',()=>{
 const handler=section("$('batchResults').addEventListener('input',event=>{",'function applyTheme(mode)');
 assert.match(handler,/scheduleReviewDraftSave\(\)/);
 const fieldBranch=handler.slice(handler.indexOf('if(field){'),handler.indexOf('const approval='));
 assert.doesNotMatch(fieldBranch.replace(/\/\/[^\n]*/g,''),/renderBatch\(\)/);
 assert.match(handler,/syncReviewFields\(form,row\)/);
});

test('Review displays per-card save failures and retry status instead of only Scan status',()=>{
 assert.match(html,/data-review-feedback data-status="\$\{cardStatus\}"/);
 assert.match(html,/const cardMessage=x\.saveError\|\|x\.error/);
 assert.match(html,/Save failed: |try again\. Your edits are retained/);
 assert.match(html,/reviewActionStatus'\)\.textContent=.*\$\{row\.title\}.*saved to Inventory/);
});

test('review palette is scoped navy and teal in light/dark modes and touch targets are accessible',()=>{
 assert.match(css,/#review\{\s*--accent:#0b7280/);
 assert.match(css,/:root\[data-theme="dark"\] #review\{\s*--accent:#90dbe2/);
 assert.match(css,/\.review-approve-button\{[^}]*min-height:51px!important/);
 assert.match(css,/\.review-approve-button\{width:100%!important;min-width:0!important;min-height:54px!important/);
});
