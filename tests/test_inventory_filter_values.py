"""Real browser smoke checks for Excel-like clickable distinct column values."""
import asyncio
from playwright.async_api import async_playwright
from test_inventory_column_filters import ROOT, MOCK

async def main():
 async with async_playwright() as playwright:
  browser=await playwright.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width,height in [(1440,940),(800,860),(390,844),(320,700)]:
   page=await browser.new_page(viewport={'width':width,'height':height})
   errors=[]
   page.on('pageerror',lambda error: errors.append(str(error)))
   await page.evaluate(MOCK)
   async def serve(route):
    rel=route.request.url.split('library-test.invalid/',1)[-1].split('?',1)[0]
    file=(ROOT/rel).resolve()
    if not file.is_file() or not file.is_relative_to(ROOT):
     return await route.fulfill(status=404,body='missing')
    mime='application/javascript' if file.suffix in ('.js','.cjs') else 'text/css' if file.suffix=='.css' else 'image/svg+xml' if file.suffix=='.svg' else 'image/jpeg' if file.suffix in ('.jpg','.jpeg') else 'text/html'
    await route.fulfill(status=200,content_type=mime,body=file.read_bytes())
   await page.route('https://library-test.invalid/**',serve)
   await page.route('https://cdn.jsdelivr.net/**',lambda route:route.fulfill(status=200,content_type='application/javascript',body=''))
   await page.route('https://images.unsplash.com/**',lambda route:route.fulfill(status=503,body='unavailable'))
   html=(ROOT/'index.html').read_text().replace('<head>','<head><base href="https://library-test.invalid/">',1)
   await page.set_content(html,wait_until='domcontentloaded')
   await page.wait_for_function("document.getElementById('totalBooks').textContent==='3'",timeout=6000)
   await page.locator('[data-tab="inventory"]' if width>=900 else '[data-gotab="inventory"]').click()
   await page.locator('#viewTable').click()
   if width>=650:
    await page.locator('[data-column-focus="shelf"]').click()
   else:
    await page.locator('#toggleColumnFilters').click()
    await page.locator('[data-show-column-values="shelf"]').click()
   assert await page.locator('#columnValuePicker').is_visible()
   assert 'Shelf' in await page.locator('#columnValueTitle').inner_text()
   assert await page.locator('[data-column-choice]').count()==3
   await page.locator('[data-column-choice="Shelf A"]').check()
   assert '1 of 2 distinct books' in await page.locator('#bookTableMeta').inner_text()
   assert await page.locator('[data-column-focus="shelf"]').get_attribute('aria-pressed')=='true'
   await page.locator('[data-column-choice="Shelf C"]').check()
   assert '2 of 2 distinct books' in await page.locator('#bookTableMeta').inner_text()
   assert await page.locator('#columnFilterBadge').inner_text()=='1'
   await page.locator('#columnValueSearch').fill('Shelf B')
   assert await page.locator('[data-column-choice]').count()==1
   assert await page.locator('[data-column-choice="Shelf B"]').is_visible()
   await page.locator('#columnValueSearch').fill('')
   await page.locator('[data-show-column-values="title"]').click()
   assert 'Title' in await page.locator('#columnValueTitle').inner_text()
   assert await page.locator('[data-column-choice="Practical Data Analysis"]').is_visible()
   await page.locator('[data-column-choice="Practical Data Analysis"]').check()
   assert '1 of 2 distinct books' in await page.locator('#bookTableMeta').inner_text()
   assert await page.locator('#columnFilterBadge').inner_text()=='2'
   await page.locator('#viewGrid').click()
   assert await page.locator('#bookTable .book-card').count()==1
   await page.locator('#columnValueClear').click()
   assert await page.locator('#bookTable .book-card').count()==2
   await page.locator('[data-show-column-values="available"]').click()
   assert await page.locator('[data-column-choice="2"]').is_visible()
   await page.locator('[data-column-choice="2"]').check()
   assert await page.locator('#bookTable .book-card').count()==1
   await page.locator('#resetColumnFilters').click()
   assert await page.locator('#bookTable .book-card').count()==2
   assert not await page.locator('#columnFilterBadge').is_visible()
   assert await page.evaluate('document.documentElement.scrollWidth<=window.innerWidth+2'),f'Horizontal scroll overflow {width}'
   assert not errors,(width,errors)
   print(f'PASS {width}px: clickable values, multi-select, search, combined filters, clear, grid and no overflow')
   await page.close()
  await browser.close()
if __name__=='__main__':asyncio.run(main())
