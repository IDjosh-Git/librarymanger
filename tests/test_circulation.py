"""Browser smoke test with an in-memory Supabase mock; never touches production."""
import asyncio, json, subprocess, time
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = 8776
BOOKS = [
 {"record_id":"11111111-1111-4111-8111-111111111111","book_id":None,"barcode":"9781234567897","title":"Practical Data Analysis","authors":"Ada Okoye","shelf_location":"Shelf A","book_status":"Available","user_id":"u-test","created_at":"2026-09-19T12:00:00Z"},
 {"record_id":"22222222-2222-4222-8222-222222222222","book_id":"BK-002","barcode":"9781234567897","title":"Practical Data Analysis","authors":"Ada Okoye","shelf_location":"Shelf B","book_status":"Available","user_id":"u-test","created_at":"2026-09-20T12:00:00Z"},
 {"record_id":"33333333-3333-4333-8333-333333333333","book_id":"BK-003","barcode":"9788888888888","title":"Everyday Excel","authors":"B. Maker","shelf_location":"Shelf C","book_status":"Borrowed","borrower_name":"Sam Bello","due_date":"2026-10-01","date_borrowed":"2026-09-10","user_id":"u-test","created_at":"2026-09-18T12:00:00Z"},
]
LOANS = [{"id":"loan-1","book_record_id":BOOKS[2]["record_id"],"book_id":"BK-003","book_title":"Everyday Excel","barcode":BOOKS[2]["barcode"],"borrower_name":"Sam Bello","status":"Borrowed","date_borrowed":"2026-09-10","due_date":"2026-10-01","created_at":"2026-09-10T12:00:00Z"}]
MOCK = r'''(() => {
  const mem=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return mem.get(k)||null},setItem(k,v){mem.set(k,String(v))},removeItem(k){mem.delete(k)}}});
  const deep=x=>JSON.parse(JSON.stringify(x));
  const data={library_books:deep(BOOKS_LITERAL),library_loans:deep(LOANS_LITERAL)};
  const writes=[];
  window.__db={data,writes,nextBookNumber:219};
  const session={user:{id:'u-test',email:'test@example.org'}};
  class Query {
    constructor(table){this.table=table;this.filters=[];this.action=null;this.payload=null;}
    select(){return this;}
    order(){return this;}
    eq(field,value){this.filters.push([field,value]);return this;}
    limit(){return this;}
    insert(payload){this.action='insert';this.payload=deep(payload);return this;}
    update(payload){this.action='update';this.payload=deep(payload);return this;}
    range(a,b){return Promise.resolve({data:deep(data[this.table].filter(x=>this.filters.every(([k,v])=>x[k]===v)).slice(a,b+1)),error:null});}
    async single(){
      const arr=data[this.table]; let row;
      if(this.action==='insert'){if(this.table==='library_loans'&&window.__db.failLoanInsert)return {data:null,error:{message:'Simulated loan database failure'}};row={...deep(this.payload),id:this.table==='library_loans'?'mock-loan-'+Date.now():this.payload.record_id,created_at:new Date().toISOString()};if(this.table==='library_books')row.book_id='LIB-'+String(window.__db.nextBookNumber++).padStart(6,'0');arr.unshift(row);}
      else if(this.action==='update'){row=arr.find(x=>this.filters.every(([k,v])=>x[k]===v));if(!row)return {data:null,error:{message:'Not found'}};Object.assign(row,deep(this.payload));}
      else row=arr.find(x=>this.filters.every(([k,v])=>x[k]===v));
      if(row)writes.push({table:this.table,action:this.action,row:deep(row)});
      return {data:row?deep(row):null,error:null};
    }
    then(ok,bad){
      if(this.action==='insert'&&Array.isArray(this.payload)){
        const rows=this.payload.map(item=>({...deep(item),id:item.record_id,book_id:'LIB-'+String(window.__db.nextBookNumber++).padStart(6,'0'),created_at:new Date().toISOString()}));
        data[this.table].unshift(...rows);
        return Promise.resolve({data:deep(rows.reverse()),error:null}).then(ok,bad);
      }
      return Promise.resolve({data:deep(data[this.table].filter(x=>this.filters.every(([k,v])=>x[k]===v))),error:null}).then(ok,bad);
    }
  }
  window.supabase={createClient(){return {auth:{onAuthStateChange(){return {}},async getSession(){return {data:{session},error:null}},async signOut(){return {error:null}}},from(table){return new Query(table)}}}};
})()'''.replace('BOOKS_LITERAL',json.dumps(BOOKS)).replace('LOANS_LITERAL',json.dumps(LOANS))

async def check(page,width,height):
  issues=[]
  page.on('pageerror',lambda error:issues.append(str(error)))
  await page.set_viewport_size({'width':width,'height':height})
  await page.evaluate(MOCK)
  await page.set_content((ROOT/'index.html').read_text(),wait_until='domcontentloaded')
  await page.add_style_tag(content=(ROOT/'assets/app.css').read_text())
  await page.wait_for_timeout(800)
  print("DEBUG",width,"errors",issues,"status",await page.locator("#status").inner_text(),"total",await page.locator("#totalBooks").inner_text(),"supabase",await page.evaluate("typeof window.supabase"),flush=True)
  await page.wait_for_function("document.getElementById('totalBooks').textContent==='3'", timeout=2500)
  assert await page.locator('#lendBookSelect option').count()==3, '2 available copies plus placeholder'
  assert await page.locator('#returnBookSelect option').count()==2, '1 borrowed copy plus placeholder'
  assert await page.locator('#lendBookSelect option').nth(1).get_attribute('value') != await page.locator('#lendBookSelect option').nth(2).get_attribute('value')
  # Book dropdown shows TITLES ONLY, although option values identify separate copies.
  labels=await page.locator('#lendBookSelect option').all_text_contents()
  assert labels[1:]==['Practical Data Analysis','Practical Data Analysis'],labels
  assert all('Book ID:' not in label and 'Shelf:' not in label and 'ISBN:' not in label for label in labels)
  assert await page.locator('#returnBookSelect option').nth(1).inner_text()=='Everyday Excel'
  # Click inventory Lend on a copy with no book_id: this used to fail because UUID was normalized.
  await page.locator('[data-lend-book="11111111-1111-4111-8111-111111111111"]').click()
  assert await page.locator('#lend').get_attribute('class')=='panel active'
  assert await page.locator('#lendBookId').input_value()==BOOKS[0]['record_id'], 'fallback displays internal record reference'
  assert await page.locator('#lendBookSelect').input_value()==BOOKS[0]['record_id']
  # Searching by shelf narrows a dropdown and choosing the other book auto-fills its Book ID.
  await page.locator('#lendBookSearch').fill('Shelf B')
  assert await page.locator('#lendBookSelect').input_value()==''
  await page.locator('#lendBookSelect').select_option(BOOKS[1]['record_id'])
  assert await page.locator('#lendBookId').input_value()=='BK-002'
  assert await page.locator('#lendBookSelect').input_value()==BOOKS[1]['record_id']
  assert await page.locator('#lendBookDisplay').input_value()=='Practical Data Analysis'
  assert 'Book ID: BK-002' in await page.locator('#lendCopyDetail').inner_text()
  assert 'Shelf: Shelf B' in await page.locator('#lendCopyDetail').inner_text()
  await page.locator('#borrowerName').fill('Taylor Bello')
  await page.locator('#confirmLend').click()
  await page.wait_for_function("document.getElementById('availableBooks').textContent==='1'")
  saved=await page.evaluate("window.__db.data.library_loans.find(l=>l.book_record_id==='22222222-2222-4222-8222-222222222222')")
  assert saved and saved['book_id']=='BK-002' and saved['borrower_name']=='Taylor Bello'
  # Return dropdown includes just borrowed copies; entering borrower finds the loan and fills ID and due date.
  await page.locator('[data-gotab="return"]').click() if width<900 else await page.locator('[data-tab="return"]').click()
  await page.locator('#returnBookSearch').fill('Taylor')
  assert await page.locator('#returnBookSelect option').count()==2
  await page.locator('#returnBookSelect').select_option(BOOKS[1]['record_id'])
  assert await page.locator('#returnBookId').input_value()=='BK-002'
  assert await page.locator('#returnBookDisplay').input_value()=='Practical Data Analysis'
  assert 'Book ID: BK-002' in await page.locator('#returnCopyDetail').inner_text()
  assert await page.locator('#returnBorrower').input_value()=='Taylor Bello'
  assert await page.locator('#returnDue').input_value()==await page.locator('#dueDate').input_value()
  await page.locator('#confirmReturn').click()
  await page.wait_for_function("document.getElementById('availableBooks').textContent==='2'")
  returned=await page.evaluate("window.__db.data.library_books.find(b=>b.record_id==='22222222-2222-4222-8222-222222222222')")
  assert returned['book_status']=='Available' and returned['borrower_name'] is None
  # Inventory Return button selects an exact borrowed copy and fills its ID.
  await page.locator('[data-gotab="inventory"]').click() if width<900 else await page.locator('[data-tab="inventory"]').click()
  await page.locator('[data-return-book="33333333-3333-4333-8333-333333333333"]').click()
  assert await page.locator('#returnBookId').input_value()=='BK-003'
  assert await page.locator('#returnBookSelect').input_value()==BOOKS[2]['record_id']
  # User can clear a return selection and pick from the loan-history action.
  await page.locator('#clearReturnBook').click()
  assert await page.locator('#returnBookId').input_value()==''
  await page.locator('[data-gotab="history"]').click() if width<900 else await page.locator('[data-tab="history"]').click()
  await page.locator('[data-history-return="33333333-3333-4333-8333-333333333333"]').click()
  assert await page.locator('#returnBookId').input_value()=='BK-003'
  # A stale browser must not create another loan after a copy is borrowed elsewhere.
  await page.locator('[data-gotab="inventory"]').click() if width<900 else await page.locator('[data-tab="inventory"]').click()
  await page.locator('[data-lend-book="11111111-1111-4111-8111-111111111111"]').click()
  await page.locator('#borrowerName').fill('Second librarian')
  await page.evaluate("window.__db.data.library_books.find(b=>b.record_id==='11111111-1111-4111-8111-111111111111').book_status='Borrowed'")
  await page.locator('#confirmLend').click()
  assert await page.evaluate("!window.__db.data.library_loans.some(l=>l.book_record_id==='11111111-1111-4111-8111-111111111111')")
  assert 'could not be reserved' in (await page.locator('#status').inner_text()).lower()
  # If loan insert fails after reservation, rollback frees the copy again.
  await page.evaluate("window.__db.data.library_books.find(b=>b.record_id==='11111111-1111-4111-8111-111111111111').book_status='Available';window.__db.failLoanInsert=true")
  await page.locator('#refreshLendBooks').click()
  await page.wait_for_function("document.getElementById('availableBooks').textContent==='2'")
  await page.locator('#lendBookSelect').select_option(BOOKS[0]['record_id'])
  await page.locator('#borrowerName').fill('Rollback trial')
  await page.locator('#confirmLend').click()
  assert await page.evaluate("window.__db.data.library_books[0].book_status==='Available'")
  assert 'reservation was reversed' in (await page.locator('#status').inner_text()).lower()
  await page.evaluate('window.__db.failLoanInsert=false')
  # Date checks must reject impossible dates before any database changes.
  await page.locator('#lendBookSelect').select_option(BOOKS[0]['record_id'])
  await page.locator('#dateBorrowed').fill('2099-01-01')
  await page.locator('#dueDate').fill('2099-01-15')
  await page.locator('#confirmLend').click()
  assert 'future' in (await page.locator('#status').inner_text()).lower()
  # More than 200 books: search still finds items omitted from the first dropdown page.
  await page.evaluate("""(() => { const template=window.__db.data.library_books[0];
    for(let i=0;i<230;i++)window.__db.data.library_books.push({...template,record_id:'bulk-'+i,book_id:'BK-BULK-'+i,title:'Sample catalog '+i,barcode:'978000'+i,book_status:'Available'});
  })()""")
  await page.locator('#refreshLendBooks').click()
  await page.wait_for_function("document.getElementById('totalBooks').textContent==='233'")
  assert await page.locator('#lendBookSelect option').count()==201
  await page.locator('#lendBookSearch').fill('BK-BULK-229')
  assert await page.locator('#lendBookSelect option').count()==2
  await page.locator('#lendBookSelect').select_option('bulk-229')
  assert await page.locator('#lendBookId').input_value()=='BK-BULK-229'
  overflow=await page.evaluate('document.documentElement.scrollWidth>window.innerWidth+2')
  assert not overflow,f'horizontal overflow at {width}px'
  assert not issues,issues
  return 'PASS width='+str(width)+'px · exact-copy lend/return, searchable dropdown, ID autofill, mock loan writes, no JS errors'

async def main():
  server=subprocess.Popen(['python','-m','http.server',str(PORT),'--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  await asyncio.sleep(0.4)
  try:
    async with async_playwright() as playwright:
      browser=await playwright.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
      for width,height in [(1440,900),(390,844),(360,740)]:
        page=await browser.new_page()
        await page.add_init_script(MOCK)
        await page.route('https://cdn.jsdelivr.net/**',lambda route:route.fulfill(status=200,content_type='application/javascript',body=''))
        async def local_route(route):
          rel=route.request.url.split('library-test.invalid/',1)[-1].split('?',1)[0]
          file=(ROOT/rel).resolve()
          if not file.is_file() or not file.is_relative_to(ROOT):return await route.fulfill(status=404,body='not found')
          mime='text/html' if file.suffix=='.html' else 'text/css' if file.suffix=='.css' else 'image/svg+xml'
          await route.fulfill(status=200,content_type=mime,body=file.read_bytes())
        await page.route('https://library-test.invalid/**',local_route)
        try:print(await check(page,width,height),flush=True)
        finally:await page.close()
      await browser.close()
  finally:server.terminate();server.wait(timeout=5)

if __name__=='__main__':asyncio.run(main())
