'use strict';
const assert=require('node:assert/strict');
const handler=require('../api/book-vision.js');
const oldFetch=global.fetch,oldKey=process.env.GEMINI_API_KEY;
function response(){return {headers:{},code:0,setHeader(k,v){this.headers[k]=v;return this},status(n){this.code=n;return this},json(j){this.data=j;return this}}}
(async()=>{
 process.env.GEMINI_API_KEY='example-test-not-real';
 let calledModel=false;
 global.fetch=async(url,init)=>{
  if(url.includes('/auth/v1/user'))return {ok:true,json:async()=>({id:'sample-user-123'})};
  calledModel=true;
  assert.ok(url.includes('gemini-3.5-flash-lite'));
  const body=JSON.parse(init.body);
  assert.ok(body.contents[0].parts.some(x=>x.inline_data?.mime_type==='image/jpeg'));
  assert.match(body.contents[0].parts[0].text,/publisher, publication_year/);
  return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({title:'The Hobbit',authors:'J. R. R. Tolkien',isbn:'',publisher:'',publication_year:''})}]}}]})};
 };
 const req={method:'POST',headers:{authorization:'Bearer sample-long-jwt-token-12345678901'},body:{image:'A'.repeat(400)}};
 const r=response();await handler(req,r);
 assert.equal(r.code,200,JSON.stringify(r));assert.ok(calledModel);
 assert.equal(r.data.metadata.title,'The Hobbit');
 assert.equal(r.data.metadata.authors,'J. R. R. Tolkien');
 assert.equal(r.data.verified,false);
 process.env.GEMINI_API_KEY='';
 const noKey=response();await handler(req,noKey);assert.equal(noKey.code,501);
 console.log('PASS: authenticated Gemini image extraction; bounded JSON metadata; safe missing-key response');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{global.fetch=oldFetch;process.env.GEMINI_API_KEY=oldKey});
