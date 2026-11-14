'use strict';const {test}=require('node:test');const assert=require('node:assert/strict');const {verifyIndependentEdition}=require('../lib/independent-edition-verifier.cjs');
const row={data:{barcode:'9780131103627',title:'The C Programming Language',authors:'Brian W. Kernighan; Dennis M. Ritchie'}};
const google={items:[{volumeInfo:{title:row.data.title,authors:['Brian W. Kernighan','Dennis M. Ritchie'],industryIdentifiers:[{identifier:row.data.barcode}]}}]};
const open={title:row.data.title,authors:[{name:'Brian W. Kernighan'},{name:'Dennis M. Ritchie'}],isbn_13:[row.data.barcode]};
const mock=async url=>({ok:true,json:async()=>url.includes('googleapis')?google:open});
test('independent exact-edition verification succeeds',async()=>assert.equal((await verifyIndependentEdition(row,{fetchImpl:mock})).ok,true));
test('conflicting provider prevents approval',async()=>{const bad=async url=>({ok:true,json:async()=>url.includes('googleapis')?google:{...open,title:'Another Book'}});assert.deepEqual((await verifyIndependentEdition(row,{fetchImpl:bad})).reasons,['provider_metadata_conflict']);});
test('provider ISBN mismatch is not accepted',async()=>{const bad=async url=>({ok:true,json:async()=>url.includes('googleapis')?{items:[]}: {...open,isbn_13:['9780131103628']}});assert.equal((await verifyIndependentEdition(row,{fetchImpl:bad})).ok,false);});
