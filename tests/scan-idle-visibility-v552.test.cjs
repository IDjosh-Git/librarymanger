'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/library-manager-v542.css'),'utf8');
const start=html.indexOf('function scanProgressIsActive(){');
const end=html.indexOf('function reviewFingerprint(',start);
assert.ok(start>0&&end>start);
const code=html.slice(start,end);
const setup=()=>{
 const panel={hidden:true};
 const sandbox={scanJobId:null,scanResumeJob:null,batchQueue:[],scanJournalPreparing:false,batchZipLoading:false,batchActive:false,$:id=>id==='scanLiveProgressPanel'?panel:null};
 vm.createContext(sandbox);
 vm.runInContext(code+'\nthis.isActive=scanProgressIsActive;this.sync=updateScanProgressVisibility;',sandbox);
 return {sandbox,panel};
};
test('No idle scan status is displayed before a batch starts',()=>{
 assert.match(html,/<section id="scanLiveProgressPanel"[^>]+hidden>/);
 assert.match(css,/#shelfScan #scanLiveProgressPanel\[hidden\][\s\S]*?display:none!important/);
 const {sandbox,panel}=setup();sandbox.sync();
 assert.equal(sandbox.isActive(),false);
 assert.equal(panel.hidden,true);
});
test('Active photo batches and recovered scans display the progress card',()=>{
 const {sandbox,panel}=setup();
 sandbox.batchQueue=[{name:'cover.jpg'}];sandbox.sync();assert.equal(panel.hidden,false);
 sandbox.batchQueue=[];sandbox.scanJobId='saved-recovery-job';sandbox.sync();assert.equal(panel.hidden,false);
 sandbox.scanJobId=null;sandbox.scanResumeJob={id:'recovering'};sandbox.sync();assert.equal(panel.hidden,false);
 sandbox.scanResumeJob=null;sandbox.scanJournalPreparing=true;sandbox.sync();assert.equal(panel.hidden,false);
 sandbox.scanJournalPreparing=false;sandbox.batchZipLoading=true;sandbox.sync();assert.equal(panel.hidden,false);
});
test('Review activity or a completed batch does not leave phantom scanning progress',()=>{
 const {sandbox,panel}=setup();
 sandbox.batchActive=true;sandbox.sync();assert.equal(panel.hidden,true);
 sandbox.batchActive=false;sandbox.batchQueue=[{name:'cover.jpg'}];sandbox.sync();assert.equal(panel.hidden,false);
 sandbox.batchQueue=[];sandbox.sync();assert.equal(panel.hidden,true);
 assert.match(html,/function renderBatch\(\)\{\s*updateScanProgressVisibility\(\)/);
});
test('Upload errors remain visible when there is no progress card',()=>{
 assert.match(html,/<p id="scanUploadNotice"[^>]+role="alert"[^>]+hidden>/);
 assert.match(html,/function scanUploadProblem\(message\)\{[\s\S]*note\.textContent=message;note\.hidden=false/);
 assert.match(html,/if\(!eligible\.length\)return scanUploadProblem\('No supported image files found\.'\)/);
 assert.match(css,/#shelfScan #scanUploadNotice\[hidden\]/);
});
test('A network outage without a scan does not invent an interrupted scan',()=>{
 assert.match(html,/window\.addEventListener\('offline',\(\)=>\{if\(!scanJobId&&!scanResumeJob&&!batchQueue\.length\)return;/);
 assert.match(html,/id="scanRecoveryBar"[^>]+hidden/);
 assert.match(html,/id="scanRecentSummary"[^>]+hidden/);
});
