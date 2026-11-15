const {test}=require('node:test');const assert=require('node:assert/strict');
const {verify}=require('../lib/recognition-verification.cjs');
test('recognition verifies title only when ISBN catalogue agrees',async()=>{const x=await verify({isbn:'9780306406157',title:'The Book'},{fetcher:async()=>({ok:true,json:async()=>({title:'The Book'})})});assert.equal(x.verified,true);assert.equal(x.status,'title_matched')});
test('recognition does not verify mismatched title',async()=>{const x=await verify({isbn:'9780306406157',title:'Another Book'},{fetcher:async()=>({ok:true,json:async()=>({title:'The Book'})})});assert.equal(x.verified,false)});
test('recognition rejects invalid ISBN without request',async()=>{const x=await verify({isbn:'1234567890123',title:'Book'},{fetcher:async()=>{throw Error('unexpected')}});assert.equal(x.status,'no_valid_isbn')});
test('recognition degrades gracefully on catalogue outage',async()=>{const x=await verify({isbn:'9780306406157',title:'Book'},{fetcher:async()=>{throw Error('offline')}});assert.equal(x.status,'provider_unavailable')});
