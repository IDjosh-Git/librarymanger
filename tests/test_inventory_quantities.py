"""Browser integration test: grouped inventory displays quantities without losing per-copy loan actions."""
import asyncio, sys
from playwright.async_api import async_playwright
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from test_circulation import ROOT, MOCK
async def main():
 if True:
  async with async_playwright() as p:
   browser=await p.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox'])
   page=await browser.new_page(viewport={'width':1280,'height':860})
   issues=[]
   page.on('pageerror',lambda err:issues.append(str(err)))
   await page.add_init_script(MOCK)
   await page.evaluate(MOCK)
   await page.route('https://cdn.jsdelivr.net/**',lambda route:route.fulfill(status=200,content_type='application/javascript',body=''))
   async def local_route(route):
    rel=route.request.url.split('library-test.invalid/',1)[-1].split('?',1)[0]
    file=(ROOT/rel).resolve()
    if not file.is_file() or not file.is_relative_to(ROOT):
     return await route.fulfill(status=404,body='not found')
    ext=file.suffix
    mime='application/javascript' if ext in ('.js','.cjs') else 'text/css' if ext=='.css' else 'image/svg+xml' if ext=='.svg' else 'text/html'
    await route.fulfill(status=200,content_type=mime,body=file.read_bytes())
   await page.route('https://library-test.invalid/**',local_route)
   html=(ROOT/'index.html').read_text().replace('<head>','<head><base href="https://library-test.invalid/">',1)
   await page.set_content(html,wait_until='domcontentloaded')
   await page.wait_for_function("document.getElementById('totalBooks').textContent==='3'",timeout=4000)
   await page.locator('[data-tab="inventory"]').click()
   await page.locator('#viewTable').click()
   assert await page.locator('#bookTable tbody > tr').count()==3, '2 grouped headings, one expanded details row'
   row=page.locator('#bookTable tbody > tr').first
   assert await row.locator('[data-label="Available Copies"]').inner_text()=='2'
   assert await row.locator('[data-label="Total Copies"]').inner_text()=='2'
   assert await page.locator('.inventory-copy-expand summary').count()==1
   await page.locator('.inventory-copy-expand summary').click()
   assert await page.locator('.inventory-copy-item').count()==2
   assert await page.locator('.inventory-copy-item [data-edit-book]').count()==2
   await page.locator('[data-book-filter="borrowed"]').click()
   assert await page.locator('#bookTable tbody > tr').count()==1
   await page.locator('[data-book-filter="all"]').click()
   await page.evaluate('''() => { const one=window.__db.data.library_books.find(b=>b.book_id==='BK-002');one.book_status='Borrowed';one.due_date='2026-10-01'; }''')
   await page.locator('#reload').click()
   await page.wait_for_function("document.getElementById('availableBooks').textContent==='1'")
   row=page.locator('#bookTable tbody > tr').first
   assert await row.locator('[data-label="Available Copies"]').inner_text()=='1'
   assert await row.locator('[data-label="Total Copies"]').inner_text()=='2'
   assert await row.locator('[data-label="On Loan"]').inner_text()=='1'
   await page.locator('#viewGrid').click()
   assert await page.locator('.book-card').count()==2
   assert await page.locator('.inventory-quantity').count()==2
   assert not issues,issues
   print('PASS grouped book rows, count columns, borrowed/available counts, per-copy actions, table/grid, and filters')
   await browser.close()
if __name__=='__main__':asyncio.run(main())
