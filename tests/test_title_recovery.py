"""Browser integration checks with mock Supabase and mock ISBN catalogs; no production writes."""
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parent.parent
MAT='9780140328721'; MOCKINGBIRD='9780061120084'; UNKNOWN='9780307474278'
BOOKS=[
  {'record_id':'book-1','book_id':'LIB-000001','barcode':MAT,'title':'Matilda','authors':'Roald Dahl','user_id':'owner','book_status':'Available'},
  {'record_id':'book-2','book_id':'LIB-000002','barcode':MAT,'title':None,'authors':'','user_id':'owner','book_status':'Available'},
  {'record_id':'book-3','book_id':'LIB-000003','barcode':MOCKINGBIRD,'title':'','authors':'','user_id':'owner','book_status':'Available'},
  {'record_id':'book-4','book_id':'LIB-000004','barcode':'12345','title':None,'user_id':'owner','book_status':'Available'},
  {'record_id':'book-5','book_id':'LIB-000005','barcode':UNKNOWN,'title':'  ','user_id':'owner','book_status':'Available'},
]
JS=r'''(()=>{
 const mem=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return mem.get(k)||null},setItem(k,v){mem.set(k,String(v))},removeItem(k){mem.delete(k)}}});
 const data={library_books:JSON.parse(BOOKS_LITERAL),library_loans:[]},writes=[];
 window.__db={data,writes};const session={user:{id:'owner',email:'owner@example.org'}};
 const copy=v=>JSON.parse(JSON.stringify(v));
 class Query{
  constructor(table){this.table=table;this.filters=[];this.action='read';this.payload=null}
  select(){return this} order(){return this} range(a,b){return Promise.resolve({data:copy(data[this.table].filter(x=>this.matches(x)).slice(a,b+1)),error:null})}
  matches(x){return this.filters.every(([k,v])=>x[k]===v)}
  eq(k,v){this.filters.push([k,v]);return this} is(k,v){this.filters.push([k,v]);return this}
  update(p){this.action='update';this.payload=copy(p);return this}
  async maybeSingle(){const b=data[this.table].find(x=>this.matches(x));if(b&&this.action==='update'){Object.assign(b,this.payload);writes.push({table:this.table,payload:copy(this.payload),recordId:b.record_id})}return {data:b?copy(b):null,error:null}}
  async single(){return this.maybeSingle()}
  then(ok,bad){return Promise.resolve({data:copy(data[this.table].filter(x=>this.matches(x))),error:null}).then(ok,bad)}
 }
 window.supabase={createClient:()=>({auth:{onAuthStateChange(){return{}},getSession:async()=>({data:{session},error:null})},from:t=>new Query(t)})};
})()'''.replace('BOOKS_LITERAL',json.dumps(json.dumps(BOOKS)))
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in (1440,390):
    page=await browser.new_page(viewport={'width':width,'height':900});errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_default_timeout(12000)
    print("start mock",width,flush=True)
    await page.evaluate(JS)
    print("mock ready",flush=True)
    await page.route('https://cdn.jsdelivr.net/**',lambda r:r.fulfill(status=200,content_type='application/javascript',body=''))
    async def static(route):
     rel=route.request.url.split('book-test.invalid/',1)[-1].split('?',1)[0]
     file=(ROOT/rel).resolve()
     if not file.is_file() or not file.is_relative_to(ROOT):return await route.fulfill(status=404,body='not found')
     mime='text/css' if file.suffix=='.css' else 'image/svg+xml' if file.suffix=='.svg' else 'text/html'
     await route.fulfill(status=200,content_type=mime,body=file.read_bytes())
    await page.route('https://book-test.invalid/**',static)
    async def meta(route):
     isbn=route.request.url.split('isbn=',1)[-1]
     if isbn==MOCKINGBIRD:body={'found':True,'metadata':{'title':'To Kill a Mockingbird'},'sources':['Google Books']}
     else:body={'found':False,'metadata':{},'sources':[]}
     await route.fulfill(status=200,content_type='application/json',body=json.dumps(body))
    await page.route('**/api/book-lookup?isbn=*',meta)
    await page.set_content((ROOT/'index.html').read_text().replace('<script src="assets/inventory-grouping.js"></script>','<script>'+(ROOT/'assets/inventory-grouping.js').read_text()+'</script>').replace('<script src="assets/dashboard-metrics.js"></script>','<script>'+(ROOT/'assets/dashboard-metrics.js').read_text()+'</script>').replace('<script src="assets/inventory-column-filters.js"></script>','<script>'+(ROOT/'assets/inventory-column-filters.js').read_text()+'</script>').replace('<head>','<head><base href="https://book-test.invalid/">',1),wait_until='domcontentloaded')
    print("page loaded",flush=True)
    await page.add_style_tag(content=(ROOT/'assets/app.css').read_text())
    await page.wait_for_timeout(650)
    print('diagnostics',errors,await page.locator('#status').inner_text(),await page.locator('#missingTitleCount').inner_text(),await page.locator('#totalBooks').inner_text(),flush=True)
    await page.wait_for_function("document.querySelector('#missingTitleCount').textContent==='4'")
    print('inventory loaded',flush=True)
    await page.locator('#findMissingTitles').click()
    print('clicked lookup',flush=True)
    await page.wait_for_function("document.querySelector('#titleRecoveryStatus').textContent.includes('2 titles found')",timeout=25000)
    print('lookup done',flush=True)
    assert await page.locator('#titleRecoveryRows input[type=checkbox]:checked').count()==2
    assert await page.evaluate('window.__db.writes.length')==0, 'preview must never write'
    assert 'Matilda' in await page.locator('#titleRecoveryRows').inner_text()
    assert 'To Kill a Mockingbird' in await page.locator('#titleRecoveryRows').inner_text()
    assert 'valid ISBN' in await page.locator('#titleRecoveryRows').inner_text()
    # Simulate another librarian filling a title after preview; the save must leave it untouched.
    await page.evaluate("window.__db.data.library_books.find(b=>b.record_id==='book-3').title='Staff entered title'")
    page.once('dialog',lambda dialog:asyncio.create_task(dialog.accept()))
    await page.locator('#saveRecoveredTitles').click()
    await page.wait_for_function("document.querySelector('#titleRecoveryStatus').textContent.startsWith('Finished:')")
    data=await page.evaluate('window.__db.data.library_books')
    assert data[0]['title']=='Matilda' and data[1]['title']=='Matilda'
    assert data[2]['title']=='Staff entered title' and data[3]['title'] is None and data[4]['title']=='  '
    assert [x['book_id'] for x in data]==[f'LIB-{i:06}' for i in range(1,6)]
    writes=await page.evaluate('window.__db.writes')
    assert len(writes)==1 and set(writes[0]['payload'])=={'title','lookup_status','updated_at'}
    assert await page.locator('#missingTitleCount').inner_text()=='2'
    assert not errors,errors
    assert not await page.evaluate('document.documentElement.scrollWidth>window.innerWidth+2')
    print(f'PASS title recovery {width}px: ISBN and known-copy matching, preview-only, optimistic lock, immutable IDs, invalid ISBN retention, responsive layout')
    await page.close()
  await browser.close()

if __name__=='__main__':asyncio.run(main())
