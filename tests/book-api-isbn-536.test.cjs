'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const ids=require('../assets/book-identifiers.js');
const api=require('../lib/book-metadata.cjs');
const route=require('../assets/scan-auto-route.js');
const scan=require('../assets/scan-extraction.js');
const group=require('../assets/inventory-grouping.js');
const match=require('../assets/scan-inventory-match.js');
const ISBN='9780470455715';
const variations=[ISBN,'ISBN 978-0-470-45571-5',ISBN+'12',ISBN+'51234','0'+ISBN,'0'+ISBN+'12','0'+ISBN+'51234',']E0'+ISBN+'51234'];
test('one consistent ISBN parser across browser, server, scan route and inventory',()=>{
 for(const code of variations){
  assert.equal(ids.normalize(code),ISBN,code);assert.equal(ids.valid(code),true,code);
  assert.equal(api.identifierKind(code).code,ISBN,code);
  assert.equal(api.sameISBN(code,ISBN),true,code);
  assert.equal(group.isbn13(code),ISBN,code);
  assert.equal(scan.isbnValid(code),true,code);
  assert.equal(route.decide({title:'Immigrant Inc.',barcode:code,verifiedSource:'isbn'}),'inventory',code);
  assert.equal(route.payload({saveRecordId:'1',title:'Immigrant Inc.',barcode:code},'u').barcode,ISBN,code);
 }
});
test('ISBN-10 converted to matching ISBN-13, including an X check digit',()=>{
 assert.equal(ids.to13('0470455713'),ISBN);
 assert.equal(ids.valid('0-8044-2957-X'),true);
 assert.equal(ids.same('0470455713',ISBN),true);
});
test('unsupported or bad checksums never become a verified ISBN or auto-save',()=>{
 for(const code of ['9780470455714','978047045571412','1234567890123','9780470455715123','0009780470455715','0123456789012']){
  assert.equal(ids.valid(code),false,code);
  assert.equal(route.decide({title:'Book',barcode:code,verifiedSource:'isbn'}),'review',code);
 }
});
test('OCR extracts ISBN-13 despite extra EAN digits',()=>{
 const codes=scan.isbnFromText('ISBN 978-0-470-45571-5 51234\nPublisher');
 assert.ok(codes.some(x=>ids.same(x,ISBN)));
});
test('inventory exact edition match works with EAN supplement',()=>{
 const h=scan;
 const b={title:'The Complete Migration Handbook',authors:'J. Editor',barcode:ISBN,publisher:'Acme Press'};
 const m=match.match('The Complete Migration Handbook\nby J. Editor',[b],h,ISBN+'51234');
 assert.equal(m?.editionMatched,true);
 assert.equal(m?.publisher,'Acme Press');
});
function reply(data,status=200){return {ok:status>=200&&status<300,status,headers:{get:()=>null},text:async()=>JSON.stringify(data)}}
function mockFetch(routes){const calls=[];const fetchImpl=async(url)=>{calls.push(String(url));const found=Object.entries(routes).find(([key])=>String(url).includes(key));return found?reply(found[1]):reply({},404)};return{fetchImpl,calls};}
const full={title:'Immigrant, Inc.',authors:['Richard T. Herman','Robert L. Smith'],publisher:'John Wiley & Sons',publishedDate:'2009-03-01',pageCount:224,language:'en',industryIdentifiers:[{type:'ISBN_13',identifier:ISBN}]};
const openEdition={title:'Immigrant, Inc.',isbn_13:[ISBN],publishers:['Wiley'],publish_date:'2009',number_of_pages:224};
test('primary ISBN API pair gets complete details without redundant providers',async()=>{
 const m=mockFetch({'googleapis.com/books':{items:[{volumeInfo:full}]},'openlibrary.org/isbn':openEdition});
 const result=await api.lookup(ISBN+'51234',{fetchImpl:m.fetchImpl,timeout:350});
 assert.equal(result.found,true);assert.equal(result.metadata.title,'Immigrant, Inc.');
 assert.equal(result.metadata.authors,'Richard T. Herman; Robert L. Smith');
 assert.equal(result.metadata.publisher,'John Wiley & Sons');
 assert.equal(result.conflicted,false);
 assert.deepEqual(result.sources,['Google Books','Open Library Edition']);
 assert.equal(m.calls.length,2); // no Hathi, Wikidata, Internet Archive or AI/OCR
});
test('primary provider outage falls back independently and keeps exact ISBN validation',async()=>{
 const m=mockFetch({'openlibrary.org/isbn':{title:'Immigrant, Inc.',isbn_13:[ISBN],by_statement:'R. Herman and R. Smith',publishers:['Wiley'],publish_date:'2009'},'googleapis.com/books':{items:[]}});
 const result=await api.lookup(ISBN,{fetchImpl:m.fetchImpl,timeout:350});
 assert.equal(result.found,true);assert.equal(result.metadata.title,'Immigrant, Inc.');
 assert.ok(result.checked.some(x=>x.source==='Google Books'&&x.status==='no_match'));
 assert.ok(result.sources.includes('Open Library Edition'));
});
test('a conflicting primary title never overwrites Google; flag for Review',async()=>{
 const m=mockFetch({'googleapis.com/books':{items:[{volumeInfo:full}]},'openlibrary.org/isbn':{title:'An Entirely Different Title',isbn_13:[ISBN],publishers:['Wrong Press'],publish_date:'2020'}});
 const result=await api.lookup(ISBN,{fetchImpl:m.fetchImpl,timeout:350});
 assert.equal(result.found,true);assert.equal(result.conflicted,true);
 assert.equal(result.metadata.title,'Immigrant, Inc.');
 assert.equal(result.metadata.publisher,'John Wiley & Sons');
 assert.ok(result.checked.some(x=>x.status==='conflict'));
 assert.equal(result.sources.includes('Open Library Edition'),false);
});
test('missing primary fields trigger complementary providers, not all specialist APIs',async()=>{
 const m=mockFetch({'googleapis.com/books':{items:[{volumeInfo:{title:'Immigrant, Inc.',industryIdentifiers:[{identifier:ISBN}]}}]},'openlibrary.org/isbn':{title:'Immigrant, Inc.',isbn_13:[ISBN]},'openlibrary.org/api/books':{['ISBN:'+ISBN]:{title:'Immigrant, Inc.',identifiers:{isbn_13:[ISBN]},authors:[{name:'R. Herman'}],publishers:[{name:'Wiley'}],publish_date:'2009'}}});
 const result=await api.lookup(ISBN,{fetchImpl:m.fetchImpl,timeout:350});
 assert.equal(result.found,true);assert.equal(result.metadata.authors,'R. Herman');
 assert.equal(result.metadata.publisher,'Wiley');
 assert.ok(result.sources.includes('Open Library Books API'));
 assert.equal(m.calls.some(x=>/query.wikidata|api.datacite|api.crossref|archive.org|loc.gov/.test(x)),false);
});
test('specialist providers remain available after basic catalogue miss',async()=>{
 const m=mockFetch({'api.crossref.org/works':{message:{items:[{type:'book',ISBN:[ISBN],title:['Immigrant, Inc.'],author:[{given:'Richard',family:'Herman'}],publisher:'Wiley',published:{'date-parts':[[2009]]}}]}}});
 const result=await api.lookup(ISBN,{fetchImpl:m.fetchImpl,timeout:350});
 assert.equal(result.found,true);assert.equal(result.metadata.publisher,'Wiley');
 assert.ok(result.sources.includes('Crossref'));
 assert.ok(m.calls.some(x=>x.includes('api.datacite.org')));
 assert.ok(m.calls.some(x=>x.includes('loc.gov')));
});
test('a slow multi-provider lookup stays within the browser budget rather than cascading indefinitely',async()=>{
 const abortingFetch=async (url,{signal})=>new Promise((resolve,reject)=>{
  if(signal.aborted)return reject(Error('aborted'));
  signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});
 });
 const start=Date.now();
 const result=await api.lookup(ISBN,{fetchImpl:abortingFetch,timeout:260,budgetMs:430});
 const elapsed=Date.now()-start;
 assert.equal(result.found,false);
 assert.ok(result.checked.some(x=>x.status==='skipped_budget'),'late providers should be skipped');
 assert.ok(elapsed<1000,'lookup unexpectedly took '+elapsed+'ms');
});
