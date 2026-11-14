const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const src=fs.readFileSync('assets/automation-centre.js','utf8');const context={};vm.runInNewContext(src,context);const api=context.LibraryAutomationCentre;
test('recommendation candidates exclude active borrowed physical copies',()=>{const books=[{book_id:'a',title:'Alpha',subject:'History'},{book_id:'b',title:'Beta',subject:'History'}];const out=api.recommendations(books,[{book_id:'a',status:'Borrowed'}]);assert.equal(out.length,1);assert.equal(out[0].book_id,'b')});
test('inventory quality catches duplicate copy IDs without treating ISBN as duplicate',()=>{const rows=api.inventoryRows([{book_id:'1',title:'A',authors:'X',shelf_location:'S',barcode:'123'},{book_id:'2',title:'A',authors:'X',shelf_location:'S',barcode:'123'}]);assert.equal(rows.length,0)});
test('CSV escapes spreadsheet formulas',()=>{assert.match(api.toCSV([['=1+2']]),/^"'=1\+2"/)});
