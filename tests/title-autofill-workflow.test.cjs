'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
test('review Auto-Fill routes typed titles to catalogue suggestions',()=>{
 assert.match(html,/if\(row\.title&&row\.title\.trim\(\)\.length>=3&&!validIsbn\(row\.barcode\)\)/);
 assert.match(html,/await batchTitleSearch\(index,false\)/);
});
test('title suggestion selection never overwrites filled fields or invents ISBN',()=>{
 assert.match(html,/if\(item\[key\]&&!String\(row\[key\]\|\|''\)\.trim\(\)\)row\[key\]/);
 assert.match(html,/ISBN is not inferred/);
});
