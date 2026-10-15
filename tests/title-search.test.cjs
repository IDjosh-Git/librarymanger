const test=require('node:test'),assert=require('node:assert/strict');
const {searchTitles}=require('../lib/title-search.cjs');
test('title search combines catalogs and filters unrelated titles without inventing ISBN',async()=>{
 const called=[];
 const fetchImpl=async(url)=>{called.push(url);let data={};
  if(url.includes('openlibrary'))data={docs:[{title:'The Great Gatsby',author_name:['F. Scott Fitzgerald'],publisher:['Scribner'],first_publish_year:1925},{title:'Cooking for Beginners'}]};
  if(url.includes('googleapis'))data={items:[{volumeInfo:{title:'The Great Gatsby',authors:['F. Scott Fitzgerald'],publisher:'Scribner',publishedDate:'2004'}}]};
  if(url.includes('archive.org'))data={response:{docs:[{title:'The Great Gatsby',creator:['F. Scott Fitzgerald']} ]}};
  if(url.includes('loc.gov'))data={results:[]};
  if(url.includes('gutendex'))data={results:[{title:'The Great Gatsby',authors:[{name:'Fitzgerald, F. Scott'}]}]};
  return {ok:true,json:async()=>data};
 };
 const result=await searchTitles('The Great Gatsby','',{fetchImpl});
 assert.ok(result.length);assert.equal(result[0].title,'The Great Gatsby');assert.equal(Object.hasOwn(result[0],'barcode'),false);
 assert.ok(result.every(x=>!x.title.includes('Cooking')));assert.equal(called.length,7);
});
test('title search degrades gracefully if providers are unavailable',async()=>{
 const found=await searchTitles('Invisible Cities','',{fetchImpl:async()=>{throw Error('network down')}});
 assert.deepEqual(found,[]);assert.deepEqual(await searchTitles('x'),[]);
});

test('Crossref and OpenAlex participate in title-page suggestions, not ISBN invention',async()=>{
 const requested=[];const fetchImpl=async(url)=>{requested.push(url);let d={};
 if(url.includes('crossref'))d={message:{items:[{title:['Practical Statistics'],type:'book',author:[{given:'James',family:'Lee'}],publisher:'Example Press'}]}};
 if(url.includes('openalex'))d={results:[{type:'book',display_name:'Practical Statistics',authorships:[{author:{display_name:'James Lee'}}]},{type:'article',title:'Practical Statistics'}]};
 return{ok:true,json:async()=>d}};
 const result=await searchTitles('Practical Statistics','',{fetchImpl});assert.ok(requested.some(x=>x.includes('crossref')));assert.ok(requested.some(x=>x.includes('openalex')));assert.ok(result.some(x=>x.title==='Practical Statistics'));assert.ok(result.every(x=>!Object.hasOwn(x,'barcode')));
});
