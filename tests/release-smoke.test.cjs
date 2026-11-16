'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const pages=['index.html','reading-guide.html','book-of-the-week.html'];
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
test('all HTML pages load the current shared theme after their base stylesheet',()=>{
 for(const page of pages){
  const html=read(page);
  const theme=html.indexOf('assets/library-theme-rc62.css?v=rc63');
  assert.ok(theme>=0,`${page}: shared theme missing`);
  const base=[...html.matchAll(/assets\/(?:library-manager-v542|reading-v542|book-of-week-v542)\.css\?v=rc63/g)].map(x=>x.index);
  assert.ok(base.length&&base.every(i=>i<theme),`${page}: theme must follow base CSS`);
 }
});
test('referenced local script, stylesheet and image paths exist',()=>{
 for(const page of pages){
  const html=read(page);
  for(const match of html.matchAll(/(?:src|href)\s*=\s*["'](assets\/[^"']+)["']/g)){
   const asset=match[1].split('?')[0].split('#')[0];
   assert.ok(fs.existsSync(path.join(root,asset)),`${page}: missing ${asset}`);
  }
 }
});
test('service worker uses RC63 caches and precaches shared theme',()=>{
 const sw=read('sw.js');
 assert.match(sw,/lm-app-shell-rc63/);
 assert.match(sw,/lm-libraries-rc63/);
 assert.match(sw,/\/assets\/library-theme-rc62\.css\?v=rc63/);
 assert.doesNotMatch(sw,/\?v=rc59|lm-app-shell-v59/);
 for(const m of sw.matchAll(/['"](\/assets\/[^'"?#]+)(?:\?[^'"]+)?['"]/g)){
  assert.ok(fs.existsSync(path.join(root,m[1].slice(1))),`missing precache ${m[1]}`);
 }
});
test('release metadata is current',()=>assert.equal(JSON.parse(read('package.json')).version,'6.0.0-rc63'));
