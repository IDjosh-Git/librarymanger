'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/library-manager-v542.css'),'utf8');
const progressUI=fs.readFileSync(path.join(root,'assets/premium-progress-upload.js'),'utf8');
const resume=require('../assets/scan-resume.js');

function historyHarness(){
 const first=html.indexOf('function scanHistoryBreakdown(');
 const last=html.indexOf('function scanRecoveryNotice(',first);
 assert.ok(first>0&&last>first,'History renderer must be available');
 const keys=['scanRecentSummary','scanRecentTotal','scanRecentWhen','scanRecentBreakdown','scanRecentDetails',
  'scanRecentSaved','scanRecentSavedRate','scanRecentBarSaved',
  'scanRecentReview','scanRecentReviewRate','scanRecentBarReview',
  'scanRecentSkipped','scanRecentSkippedRate','scanRecentBarSkipped',
  'scanRecentFailed','scanRecentFailedRate','scanRecentBarFailed'];
 const elements=Object.fromEntries(keys.map(id=>[id,{textContent:'',hidden:true,style:{width:''},attrs:{},setAttribute(k,v){this.attrs[k]=v;}}]));
 const context={$:id=>elements[id],Date,Math,Number,String};
 vm.createContext(context);vm.runInContext(html.slice(first,last)+'\nthis.renderRecentScan=renderRecentScan;this.scanHistoryBreakdown=scanHistoryBreakdown;',context);
 return {elements,context};
}

test('live scanning shows progress as a percentage, not x of y photos',()=>{
 assert.match(html,/id="batchProgressPercent"[^>]*>0%<\/strong>/);
 assert.doesNotMatch(html,/id="batchProgressCount"/);
 assert.doesNotMatch(progressUI,/count\.textContent\s*=/);
 assert.match(progressUI,/progress\.setAttribute\('aria-label',`\$\{stage\.textContent\}: \$\{Number\(pct\.toFixed\(1\)\)\}% complete`\)/);
 assert.match(progressUI,/Verified books save automatically as recognition finishes/);
 assert.match(html,/batchOutput\('Recognizing covers and checking book details…'\)/);
});

test('last completed scan shows exact separate Inventory Review Skipped and Needs-attention totals',()=>{
 const {context,elements}=historyHarness();
 context.renderRecentScan({total:100,saved:62,review:30,skipped:8,failed:0,finishedAt:Date.now()});
 assert.equal(elements.scanRecentSummary.hidden,false);
 for(const [id,expected] of Object.entries({scanRecentTotal:'100',scanRecentSaved:'62',scanRecentReview:'30',scanRecentSkipped:'8',scanRecentFailed:'0',scanRecentSavedRate:'62% of photos',scanRecentReviewRate:'30% of photos',scanRecentSkippedRate:'8% of photos'}))assert.equal(elements[id].textContent,expected,id);
 assert.equal(elements.scanRecentBarSaved.style.width,'62%');
 assert.equal(elements.scanRecentBarReview.style.width,'30%');
 assert.match(elements.scanRecentBreakdown.attrs['aria-label'],/62 saved to Inventory, 30 sent to Review, 8 skipped/);
 assert.match(elements.scanRecentDetails.textContent,/100 photos were accounted for/);
});

test('outcome breakdown safely handles zero totals and unclassified results',()=>{
 const {context,elements}=historyHarness();
 context.renderRecentScan({total:10,saved:2,review:3,skipped:1,failed:1,finishedAt:Date.now()});
 assert.equal(elements.scanRecentFailedRate.textContent,'10% of photos');
 assert.match(elements.scanRecentDetails.textContent,/3 additional outcome/);
 context.renderRecentScan({total:0,saved:0,review:0,skipped:0,finishedAt:Date.now()});
 assert.equal(elements.scanRecentSavedRate.textContent,'0% of photos');
 assert.equal(elements.scanRecentBarSaved.style.width,'0%');
 context.renderRecentScan(null);assert.equal(elements.scanRecentSummary.hidden,true);
});

test('the detailed report remains for six hours and is account scoped',()=>{
 assert.equal(resume.HISTORY_MS,6*60*60*1000);
 assert.match(html,/await scanResumeStore\.history\(owner\)/);
 assert.match(css,/\.scan-recent-metric\[data-kind="inventory"\]/);
 assert.match(css,/\.scan-recent-breakdown/);
 assert.match(css,/@media\(max-width:540px\)/);
});
