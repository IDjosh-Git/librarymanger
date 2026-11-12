'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/daily-visit-register.css'),'utf8');
const js=fs.readFileSync(path.join(root,'assets/daily-visit-register.js'),'utf8');
const sql=fs.readFileSync(path.join(root,'database/08_library_daily_visit_register.sql'),'utf8');
function helpers(){const win={};vm.runInNewContext(js,{window:win,Date,Intl,Number,String,Math,Object,Array,Set,Boolean});return win.LibraryDailyVisits}

test('daily attendance has distinct member and admin pages and desktop/mobile navigation',()=>{
 for(const id of ['dailyLog','attendance','vlCheckInForm','vlVisitorName','vlVisitPurpose','vlCheckoutBtn','vlBookChips','vlMyHistory','vlAdminBody','vlFilterForm','vlExportCsv','vlPrevPage','vlNextPage'])assert.match(html,new RegExp('id="'+id+'"'));
 for(const tab of ['dailyLog','attendance']){
  assert.match(html,new RegExp('data-tab="'+tab+'"'));
  assert.match(html,new RegExp('data-mobile-tab="'+tab+'"'));
 }
 assert.match(html,/const ADMIN_PAGES=new Set\([^\n]*"attendance"/);
 assert.match(html,/const USER_PAGES=new Set\([^\n]*"dailyLog"/);
 assert.match(html,/roleLanding\(\).*?isAdmin\(\)\?'dashboard':'dailyLog'/);
});

test('attendance is created on explicit check-in only, not login or signup',()=>{
 assert.match(js,/sb\.rpc\('library_daily_check_in'/);
 assert.match(js,/sb\.rpc\('library_daily_check_out'/);
 assert.match(js,/sb\.rpc\('library_daily_record_books'/);
 assert.match(sql,/create unique index if not exists library_daily_visits_one_open_per_member/i);
 assert.match(sql,/where completed=false/i);
 assert.match(sql,/visitor_email=\(select auth\.jwt\(\)->>'email'\)/i);
 assert.doesNotMatch(js,/localStorage|sessionStorage|indexedDB/i);
});

test('server stamps visit times and restricts edits to authenticated members',()=>{
 for(const name of ['library_daily_check_in','library_daily_record_books','library_daily_check_out','library_daily_admin_report']){
  assert.match(sql,new RegExp('create or replace function public\\.'+name+'\\('));
 }
 assert.match(sql,/new\.checked_out_at\s*:?=\s*greatest\(clock_timestamp\(\),old\.checked_in_at\)/i);
 assert.match(sql,/checked_in_at timestamptz not null default clock_timestamp\(\)/i);
 assert.match(sql,/grant insert \(user_id,visitor_name,visitor_email,visit_purpose\)/i);
 assert.match(sql,/grant update \(completed,check_out_notes\)/i);
 assert.match(sql,/alter table public\.library_daily_visits enable row level security/i);
 assert.match(sql,/alter table public\.library_visit_books enable row level security/i);
 assert.match(sql,/exists\s*\(select 1 from public\.library_member_roles.*role='admin'/is);
 assert.match(sql,/security invoker/g);
 assert.doesNotMatch(sql,/security definer/i);
});

test('admin report includes only visit rows, with filterable book titles and server pagination',()=>{
 assert.match(sql,/from public\.library_daily_visits v/);
 assert.match(sql,/v\.visitor_name ilike/i);
 assert.match(sql,/v\.visitor_email ilike/i);
 assert.match(sql,/b\.book_title ilike/i);
 assert.match(sql,/limit v_page_size offset/);
 assert.match(js,/\bp_page_size:PAGE_SIZE\b/);
 assert.match(js,/p_page_size:100/);
 assert.match(js,/EX(?:PORT)?_LIMIT=10000/);
 assert.match(js,/csvCell/);
});

test('WAT conversion preserves Lagos day and time near UTC midnight',()=>{
 const v=helpers();
 assert.equal(v.displayTime('2026-11-11T23:30:00.000Z').match(/12:30/i)?.[0]?.toLowerCase(),'12:30');
 assert.match(v.displayDate('2026-11-11T23:30:00.000Z'),/12 Nov 2026/);
 assert.equal(v.elapsed('2026-11-12T08:00:00Z','2026-11-12T10:35:00Z'),'2h 35m');
});

test('CSV export prevents spreadsheet formula injection',()=>{
 const v=helpers();
 for(const dangerous of ['=HYPERLINK("http://evil")','+SUM(1,2)','-2+3','@NOW()'])assert.ok(v.csvCell(dangerous).startsWith('"\''));
 assert.equal(v.csvCell('Book "A"'),'"Book ""A"""');
});

test('premium pages are hidden when inactive and remain responsive on mobile',()=>{
 assert.match(css,/\.panel\.vl-page\{display:none\}/);
 assert.match(css,/\.panel\.vl-page\.active\{display:grid\}/);
 assert.match(css,/@media\(max-width:680px\)/);
 assert.match(css,/\.vl-hero\{/);
 assert.match(css,/\.vl-table-wrap\{overflow-x:auto/);
 assert.match(css,/\[data-role="user"\] \.bottomnav\{grid-template-columns:repeat\(4/);
});
