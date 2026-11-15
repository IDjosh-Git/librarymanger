const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
test('recognition settings persist accuracy and enhancement',()=>{
 for(const token of ['id="recognitionAccuracy"','id="recognitionEnhance"','accuracy:$(\'recognitionAccuracy\').value','enhance:!!$(\'recognitionEnhance\').checked'])assert.ok(html.includes(token),token);
});
test('OCR enhancement can be disabled without changing source image',()=>{
 assert.match(html,/\$\('recognitionEnhance'\)\?\.checked!==false&&quality\?\.needsEnhancement/);
 assert.match(html,/if\(\$\('recognitionAccuracy'\)\?\.value==='accurate'\)fast=false/);
});
test('Review smart recognition remains per-card and requires approval',()=>{
 assert.match(html,/data-review-smart="\$\{i\}"/);
 assert.match(html,/row\.reviewBusy=true/);
 assert.match(html,/verify before approval/i);
 assert.match(html,/data-save-title="\$\{i\}"/);
});
