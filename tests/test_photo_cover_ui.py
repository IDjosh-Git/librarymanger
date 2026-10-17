"""Browser smoke test: real-photo sources, offline photo fallback, exact-ISBN book covers."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
from test_circulation import ROOT, MOCK

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':1360,'height':860})
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  await page.evaluate(MOCK)
  await page.route('https://cdn.jsdelivr.net/**',lambda r:r.fulfill(status=200,content_type='application/javascript',body=''))
  await page.route('https://images.unsplash.com/**',lambda r:r.fulfill(status=503,body='offline'))
  await page.route('https://covers.openlibrary.org/**',lambda r:r.fulfill(status=404,body='No cover'))
  async def static(route):
   rel=route.request.url.split('library-test.invalid/',1)[-1].split('?',1)[0]
   file=(ROOT/rel).resolve()
   if not file.is_file() or not file.is_relative_to(ROOT):return await route.fulfill(status=404,body='not found')
   mime='application/javascript' if file.suffix in ('.js','.cjs') else 'text/css' if file.suffix=='.css' else 'image/svg+xml' if file.suffix=='.svg' else 'image/jpeg' if file.suffix=='.jpg' else 'text/html'
   await route.fulfill(status=200,content_type=mime,body=file.read_bytes())
  await page.route('https://library-test.invalid/**',static)
  html=(ROOT/'index.html').read_text().replace('<head>','<head><base href="https://library-test.invalid/">',1)
  await page.set_content(html,wait_until='domcontentloaded')
  await page.wait_for_function("document.getElementById('dashTotalCopies').textContent==='3'",timeout=6000)
  image=page.locator('.dashboard-hero-art img')
  await page.wait_for_function("document.querySelector('.dashboard-hero-art img').src.includes('library-reading-fallback.jpg')",timeout=6000)
  assert await image.evaluate('(img) => img.complete && img.naturalWidth > 0')
  await page.locator('[data-tab="inventory"]').click()
  await page.wait_for_function("document.querySelector('.hero-illustration')?.classList.contains('hero-illustration')",timeout=4000)
  await page.locator('#viewGrid').click()
  assert await page.locator('.book-card').count()==2
  cover=page.locator('.book-cover-image').first
  assert 'covers.openlibrary.org/b/isbn/' in await cover.get_attribute('src')
  await page.wait_for_function("document.querySelector('.book-cover-image')?.hidden === true",timeout=6000)
  assert await page.locator('.book-cover-slot .book-monogram').first.is_visible()
  await page.screenshot(path='/mnt/data/library_inventory_photo_preview.png',full_page=True)
  assert not errors,errors
  print('PASS real photo source and fallback, ISBN cover and neutral fallback, dashboard and inventory navigation')
  await browser.close()

if __name__=='__main__':asyncio.run(main())
