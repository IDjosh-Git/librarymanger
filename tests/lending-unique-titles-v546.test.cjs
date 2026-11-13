'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/library-manager-v542.css'),'utf8');
const catalogue=require('../assets/lending-catalogue.js');
const rows=[
 {record_id:'1',book_id:'BOOK-001',title:' Data Analytics Essentials ',authors:'Alex A',book_status:'Available',shelf_location:'A1'},
 {record_id:'2',book_id:'BOOK-002',title:'data  analytics essentials',authors:'Alex A',book_status:'Available',shelf_location:'A2'},
 {record_id:'3',book_id:'BOOK-003',title:'Data Analytics Essentials',authors:'Alex A',book_status:'Borrowed',shelf_location:'A3'},
 {record_id:'4',book_id:'BOOK-004',title:'SQL Explained',authors:'Pat B',book_status:'Available',shelf_location:'B1'},
 {record_id:'5',book_id:'BOOK-005',title:'SQL Explained',authors:'Pat B',book_status:'Borrowed',shelf_location:'B2'},
 {record_id:'6',book_id:'BOOK-006',title:'  ',book_status:'Available'},
 {record_id:'7',book_id:'BOOK-007',title:null,book_status:'Available'}
];
test('one option per normalized title, not per physical copy, including mixed-case title copies',()=>{
 const available=rows.filter(catalogue.isAvailable);
 const groups=catalogue.groupAvailableTitles(rows,available);
 assert.equal(groups.length,4);
 assert.equal(catalogue.countDistinctTitles(available),4);
 const analytics=groups.find(g=>g.representative.record_id==='1');
 assert.ok(analytics);
 assert.deepEqual({available:analytics.available,borrowed:analytics.borrowed,total:analytics.total}, {available:2,borrowed:1,total:3});
});
test('a search for an individual Book ID narrows the chosen physical copy without reducing title availability count',()=>{
 const match=rows.filter(b=>b.book_id==='BOOK-002');
 const groups=catalogue.groupAvailableTitles(rows,match);
 assert.equal(groups.length,1);
 assert.equal(groups[0].representative.record_id,'2');
 assert.equal(groups[0].available,2);
 assert.equal(groups[0].total,3);
});
test('loans and unavailable status are never offered as available choices',()=>{
 const available=rows.filter(catalogue.isAvailable);
 assert.equal(available.length,5);
 assert.equal(catalogue.groupAvailableTitles(rows,available).some(g=>g.representative.book_status==='Borrowed'),false);
 assert.equal(catalogue.titleSummary(rows,rows[4]).borrowed,1);
});
test('separate unidentified physical records must not merge under one untitled option',()=>{
 assert.notEqual(catalogue.titleKey(rows[5]),catalogue.titleKey(rows[6]));
});
test('generator is inside Administrators page and absent from shared Account Settings / User page',()=>{
 const adminSection=html.indexOf('<div id="adminDirectory"');
 const generation=html.indexOf('<details id="adminInvitePanel"');
 const nextSection=html.indexOf('id="dailyLog"',adminSection);
 assert.ok(adminSection>=0 && generation>adminSection && generation<nextSection);
 const sharedSettings=html.slice(html.indexOf('<details class="account-tools">'),html.indexOf('<div id="status"'));
 assert.doesNotMatch(sharedSettings,/id="adminInvitePanel"/);
 assert.match(css,/#adminInvitePanel\[hidden\],body:not\(\[data-role="admin"\]\) #adminInvitePanel\{display:none!important\}/);
 assert.match(html,/if\(!session\?\.user\|\|!isAdmin\(\)\)return msg\('Only an existing administrator can generate/);
});
test('Lending page has accessible selected-title availability card, distinct selector and live inventory counts',()=>{
 for(const id of ['lendTitleAvailability','lendTitleAvailabilityName','lendTitleAvailable','lendTitleBorrowed','lendTitleTotal'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/function refreshLendTitleAvailability\(\)/);
 assert.match(html,/groupAvailableTitles\(books,matches\)/);
 assert.match(html,/lendingCatalogue\.titleSummary\(books,selected\)/);
 assert.match(html,/id="lendBookSelect" aria-describedby="lendBookCount lendTitleAvailabilityName"/);
 assert.match(html,/assets\/lending-catalogue\.js\?v=5\.46\.0/);
});
test('current visual theme uses navy and teal gradients with matching light/dark tokens',()=>{
 assert.match(css,/\/\* v5\.46 — unified navy\/teal components/);
 assert.match(css,/--accent:#0b7280/);
 assert.match(css,/--bright-gradient:linear-gradient\(118deg,#143f5b/);
 assert.match(css,/:root\[data-theme="dark"\]/);
 assert.match(css,/#lend \.lend-availability-card/);
});
