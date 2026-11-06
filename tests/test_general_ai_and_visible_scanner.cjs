'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
const guide=fs.readFileSync(path.join(base,'assets/book-guide.js'),'utf8');
const css=fs.readFileSync(path.join(base,'assets/library-ui.css'),'utf8');
const scan=html.match(/<section class="scan-recognition-settings"[\s\S]+?<\/section>/)?.[0];
assert.ok(scan,'Recognition toggles must be visible in the main Scan & Review page');
assert.ok(!scan.includes('<details'),'Recognition controls must not be collapsed');
for (const id of ['batchUseOCR','batchUseAI']){
 assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,`Unique ${id}`);
 assert.ok(scan.includes(`id="${id}"`),`Visible ${id}`);
 assert.ok(guide||css);
}
assert.ok(guide.includes('id="bookGuideWebSearch"'));
assert.ok(guide.includes('No book selected — ask anything'));
assert.ok(guide.includes('searchWeb:searchRequested'));
assert.ok(guide.includes("setMessageText(pending,json.reply);addSources(pending,json)"));
const handler=require(path.join(base,'api/book-chat.js'));
function res(){return{statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;return this},status(n){this.statusCode=n;return this},json(b){this.body=b;return this}};}
async function invoke(payload,fetchImpl,ip){global.fetch=fetchImpl;const reply=res();await handler({method:'POST',headers:{'x-forwarded-for':ip},body:payload,socket:{}},reply);return reply;}
(async()=>{
 process.env.GEMINI_API_KEY='fake-key-for-mock-tests';delete process.env.GEMINI_CHAT_MODEL;
 let payload;
 const first=await invoke({question:'What is artificial intelligence?'},async (url,params)=>{payload=JSON.parse(params.body);return{ok:true,json:async()=>({candidates:[{content:{parts:[{text:'AI is a field of computing.'}]}}]})}},'general-test-1');
 assert.equal(first.statusCode,200);assert.equal(first.body.reply,'AI is a field of computing.');assert.equal(first.body.searchRequested,false);
 assert.equal(payload.tools,undefined,'Do not spend search quota without opt-in');
 assert.ok(payload.systemInstruction.parts[0].text.includes('ANY reasonable subject'));
 let searched;
 const ground=await invoke({question:'What are the latest library developments?',searchWeb:true},
  async (url,params)=>{
   searched=JSON.parse(params.body);
   return {ok:true,json:async()=>({
    candidates:[{
     content:{parts:[{text:'Recent developments in libraries.'}]},
     groundingMetadata:{
      groundingChunks:[{web:{uri:'https://example.org/library',title:'Library research'}},{web:{uri:'javascript:alert(1)',title:'unsafe'}}],
      searchEntryPoint:{renderedContent:'<span>Search by Google</span>'}
     }
    }]
   })};
  },'grounded-test-2');
 assert.equal(ground.statusCode,200);assert.deepEqual(searched.tools,[{google_search:{}}]);assert.equal(ground.body.sources.length,1);assert.equal(ground.body.grounded,true);assert.ok(ground.body.searchSuggestions.includes('Search by Google'));
 let calls=[];
 const retry=await invoke({question:'Explain literacy.',searchWeb:true},async(url,params)=>{const b=JSON.parse(params.body);calls.push(b.tools?'search':'plain');return b.tools?{ok:false,status:400}:{ok:true,json:async()=>({candidates:[{content:{parts:[{text:'Reading is important.'}]}}]})}},'fallback-test-3');
 assert.deepEqual(calls,['search','plain']);assert.equal(retry.body.searchUnavailable,true);assert.equal(retry.body.grounded,false);
 const limited=await invoke({question:'Explain a book'},async()=>({ok:false,status:429}),'rate-test-4');assert.equal(limited.statusCode,429);
 delete process.env.GEMINI_API_KEY;
 const missing=await invoke({question:'test'},async()=>{throw Error('should not call')},'key-test-5');assert.equal(missing.statusCode,503);
 console.log('PASS: visible OCR and AI controls, general Gemini chat without book, opted-in live grounding, safe sources, fallback, rate limit and missing key');
})().catch(e=>{console.error(e);process.exit(1)});
