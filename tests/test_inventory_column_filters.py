"""End-to-end grouped inventory column filtering at desktop and mobile sizes."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
from test_circulation import ROOT, MOCK

async def run():
 async with async_playwright() as playwright:
  browser=await playwright.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width,height in [(1440,940),(800,940),(390,844),(320,720)]:
   page=await browser.new_page(viewport={'width':width,'height':height})
   errors=[]
   page.on('pageerror',lambda error:errors.append(str(error)))
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
   tab='[data-tab="inventory"]' if width>=900 else '[data-gotab="inventory"]'
   await page.locator(tab).click()
   await page.locator('#viewTable').click()
   assert await page.locator('#bookTable tbody > tr').count()==3,'Initial: two titles plus one expandable copy row'
   assert await page.locator('[data-column-focus]').count()==9
   # Header filters open their matching, independently focusable control.
   if width>650: await page.locator('[data-column-focus="title"]').click()
   else: await page.locator('#toggleColumnFilters').click(); await page.locator('#column_title').focus()
   assert await page.locator('#columnFiltersPanel').is_visible()
   assert await page.locator('#column_title').evaluate('(el)=>el===document.activeElement')
   await page.locator('#column_title').fill('practical')
   assert await page.locator('#bookTable tbody > tr').count()==2
   assert '1 of 2 distinct books' in await page.locator('#bookTableMeta').inner_text()
   assert await page.locator('#column_title').evaluate('(el)=>el===document.activeElement'),'Typing must retain focus'
   assert await page.locator('#columnFilterBadge').inner_text()=='1'
   assert await page.locator('[data-column-focus="title"]').get_attribute('aria-pressed')=='true'
   # Shelf B belongs to the secondary physical copy, not just the representative.
   await page.locator('#column_shelf').fill('Shelf B')
   assert await page.locator('#bookTable tbody > tr').count()==2
   assert await page.locator('#columnFilterBadge').inner_text()=='2'
   await page.locator('[data-column-filter="availableMin"]').fill('3')
   assert await page.locator('#bookTable tbody > tr').count()==0
   await page.locator('[data-column-filter="availableMin"]').fill('2')
   assert await page.locator('#bookTable tbody > tr').count()==2
   await page.locator('#resetColumnFilters').click()
   assert await page.locator('#bookTable tbody > tr').count()==3
   assert await page.locator('#column_title').input_value()==''
   assert not await page.locator('#columnFilterBadge').is_visible()
   # Detail status works across grouped entries and composes with global status filters.
   await page.locator('#column_status').select_option('overdue')
   assert await page.locator('#bookTable tbody > tr').count()==1
   await page.locator('#column_status').select_option('')
   await page.locator('#column_details').select_option('attention')
   assert await page.locator('#bookTable tbody > tr').count()==3
   await page.locator('[data-book-filter="borrowed"]').click()
   assert await page.locator('#bookTable tbody > tr').count()==1
   await page.locator('#clearFilters').click()
   assert await page.locator('#bookTable tbody > tr').count()==3
   assert await page.locator('#column_details').input_value()==''
   # Switching to cards preserves filters and allows editing on mobile.
   await page.locator('#column_title').fill('Excel')
   await page.locator('#viewGrid').click()
   assert await page.locator('#bookTable .book-card').count()==1
   await page.locator('#toggleColumnFilters').click()
   assert not await page.locator('#columnFiltersPanel').is_visible()
   await page.locator('#toggleColumnFilters').click()
   assert await page.locator('#column_title').input_value()=='Excel'
   assert await page.locator('#columnFiltersPanel').is_visible()
   assert await page.locator('#bookTable .book-card').count()==1
   assert await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth+2'),f'Horizontal overflow at {width}px'
   assert not errors,(width,errors)
   print(f'PASS {width}px: grouped filters, table/card switching, clearing, search focus, no JS errors or overflow')
   await page.close()
  await browser.close()
if __name__=='__main__':asyncio.run(run())
