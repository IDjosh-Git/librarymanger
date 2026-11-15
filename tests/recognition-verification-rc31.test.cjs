const test=require('node:test');const assert=require('node:assert/strict');const {verify}=require('../lib/recognition-verification.cjs');
const isbn='9780132350884';
const fetcher=async url=>({ok:true,json:async()=>String(url).includes('/authors/')?{name:'Robert C. Martin'}:{title:'Clean Code',authors:[{key:'/authors/OL123A'}],publish_date:'2008'}});
test('checks author and publication year independently',async()=>{const v=await verify({isbn,title:'Clean Code',authors:'Robert C. Martin',publication_year:'2008'},{fetcher});assert.equal(v.fields.authors.matched,true);assert.equal(v.fields.publication_year.matched,true);assert.equal(v.verified,true)});
test('reports author disagreement without fabricating agreement',async()=>{const v=await verify({isbn,title:'Clean Code',authors:'Different Writer'},{fetcher});assert.equal(v.fields.authors.matched,false);assert.equal(v.status,'author_mismatch')});
test('invalid ISBN never queries catalogue',async()=>{const v=await verify({isbn:'1234567890123',title:'Anything'},{fetcher:()=>{throw Error('should not fetch')}});assert.equal(v.status,'no_valid_isbn')});
