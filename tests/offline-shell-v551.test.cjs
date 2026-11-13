'use strict';const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
test('offline shell is registered only on secure origins, preserving the authenticated browser journal',()=>{
 assert.match(html,/navigator\.serviceWorker\.register\('\/sw\.js'/);
 assert.match(html,/location\.protocol==='https:'/);
 assert.ok(fs.existsSync(path.join(root,'assets/scan-resume.js')));
});
test('service worker never caches API calls, Supabase requests, or credentials',()=>{
 assert.match(sw,/if\(request\.method!=='GET'\)return/);
 assert.match(sw,/!url\.pathname\.startsWith\('\/api\/'\)/);
 assert.match(sw,/url\.origin===self\.location\.origin/);
 assert.match(sw,/EXTERNAL\.includes\(url\.href\)/);
 assert.doesNotMatch(sw,/Authorization.*cache\.put/);
 assert.match(sw,/book-of-the-week\.html/);
});
