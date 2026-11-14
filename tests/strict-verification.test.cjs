'use strict';const {test}=require('node:test');const assert=require('node:assert/strict');const {verify}=require('../lib/strict-verification.cjs');
const row={data:{barcode:'9780131103627',title:'The C Programming Language',authors:'Brian W. Kernighan; Dennis M. Ritchie'}};
const provider={found:true,metadata:{title:row.data.title,authors:row.data.authors},checked:[{source:'Google Books',status:'found'}],conflicts:[]};
test('strict verifier accepts matching independent edition',()=>assert.equal(verify(row,provider).ok,true));
test('strict verifier rejects conflicting author',()=>assert.equal(verify(row,{...provider,metadata:{...provider.metadata,authors:'Unknown'}}).ok,false));
test('strict verifier rejects untrusted unsupported sources',()=>assert.equal(verify(row,{...provider,checked:[{source:'Wikidata',status:'found'}]}).ok,false));
test('strict verifier rejects invalid ISBN',()=>assert.equal(verify({data:{...row.data,barcode:'9780131103628'}},provider).ok,false));
test('strict verifier rejects provider conflicts',()=>assert.equal(verify(row,{...provider,conflicts:[{source:'Google Books',reason:'title'}]}).ok,false));
