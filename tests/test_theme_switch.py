"""Theme regression: real browser, simulated Supabase; never accesses live records."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
from test_circulation import ROOT, MOCK

async def main():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width,height in [(1440,900),(800,860),(390,844),(320,700)]:
   page=await browser.new_page(viewport={'width':width,'height':height})
   errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
   await page.evaluate(MOCK)
   async def local(route):
    rel=route.request.url.split('library-test.invalid/',1)[-1].split('?',1)[0]
    file=(ROOT/rel).resolve()
    if not file.is_file() or not file.is_relative_to(ROOT):return await route.fulfill(status=404,body='missing')
    mime={'.js':'application/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.html':'text/html'}.get(file.suffix,'text/plain')
    return await route.fulfill(status=200,content_type=mime,body=file.read_bytes())
   await page.route('https://library-test.invalid/**',local)
   await page.route('https://cdn.jsdelivr.net/**',lambda route:route.fulfill(status=200,content_type='application/javascript',body=''))
   await page.route('https://images.unsplash.com/**',lambda route:route.fulfill(status=503,body='unavailable'))
   html=(ROOT/'index.html').read_text().replace('<head>','<head><base href="https://library-test.invalid/">',1)
   await page.set_content(html,wait_until='domcontentloaded')
   await page.wait_for_function("document.getElementById('totalBooks').textContent==='3'",timeout=9000)
   nav=lambda name: f'[data-tab="{name}"]' if width>=900 else f'[data-gotab="{name}"]'
   assert await page.locator('html').get_attribute('data-theme')=='light'
   assert await page.locator('#themeToggle').get_attribute('aria-label')=='Switch to dark mode'
   for mode in ('dark','light','dark'):
    await page.locator('#themeToggle').click()
    assert await page.locator('html').get_attribute('data-theme')==mode
    assert await page.locator('#themeToggle').get_attribute('aria-label')==('Switch to light mode' if mode=='dark' else 'Switch to dark mode')
    assert await page.locator('#themeToggle').get_attribute('aria-pressed')==('true' if mode=='dark' else 'false')
    assert await page.evaluate('localStorage.getItem("library_manager_theme_v2")')==mode
    assert await page.evaluate('getComputedStyle(document.documentElement).colorScheme')==mode
    assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'),(width,mode,'horizontal overflow')
    for name in ['dashboard','inventory','lend','return','history']:
     await page.locator(nav(name)).click()
     assert await page.locator(f'#{name}').is_visible(),(width,mode,name)
     if name=='inventory':
      sel=page.locator('.hero-copy h2').first
      c=await sel.evaluate('e=>getComputedStyle(e).color')
      if mode=='dark':assert c.startswith('rgb(241, 244, 249)')
      entry=await page.locator('#manualBarcode').evaluate('e=>[getComputedStyle(e).color,getComputedStyle(e).backgroundColor]')
      if mode=='dark':assert entry[0]!='rgb(238, 242, 246)' or entry[1]!='rgb(255, 255, 255)'
      await page.locator('#viewTable').click()
      if width>=650:await page.locator('[data-column-focus="title"]').click()
      else:
       if not await page.locator('#columnFiltersPanel').is_visible():await page.locator('#toggleColumnFilters').click()
       await page.locator('[data-show-column-values="title"]').click()
      assert await page.locator('#columnValuePicker').is_visible()
      await page.locator('[data-column-choice="Practical Data Analysis"]').check()
      assert '1 of 2 distinct books' in await page.locator('#bookTableMeta').inner_text()
      await page.locator('#resetColumnFilters').click()
     assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'),(width,mode,name)
   assert not errors,(width,errors)
   if width in (1440,390):
    await page.locator(nav('dashboard')).click()
    await page.screenshot(path=f'/mnt/data/library_theme_dark_{width}.png',full_page=True)
    await page.locator('#themeToggle').click()
    await page.screenshot(path=f'/mnt/data/library_theme_light_{width}.png',full_page=True)
   print(f'PASS {width}px: toggle / persistence / five pages / filters / no overflow')
   await page.close()
  # A fresh document must render the previously saved dark preference at startup.
  startup=await browser.new_page(viewport={'width':1024,'height':768})
  await startup.evaluate(MOCK)
  await startup.evaluate('localStorage.setItem("library_manager_theme_v2","dark")')
  async def serve_startup(route):
   rel=route.request.url.split('library-test.invalid/',1)[-1].split('?',1)[0]
   file=(ROOT/rel).resolve()
   if not file.is_file() or not file.is_relative_to(ROOT):return await route.fulfill(status=404,body='missing')
   mime={'.js':'application/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.html':'text/html'}.get(file.suffix,'text/plain')
   return await route.fulfill(status=200,content_type=mime,body=file.read_bytes())
  await startup.route('https://library-test.invalid/**',serve_startup)
  await startup.route('https://cdn.jsdelivr.net/**',lambda route:route.fulfill(status=200,content_type='application/javascript',body=''))
  await startup.route('https://images.unsplash.com/**',lambda route:route.fulfill(status=503,body='unavailable'))
  await startup.set_content((ROOT/'index.html').read_text().replace('<head>','<head><base href="https://library-test.invalid/">',1),wait_until='domcontentloaded')
  await startup.wait_for_function("document.getElementById('totalBooks').textContent==='3'",timeout=9000)
  assert await startup.locator('html').get_attribute('data-theme')=='dark'
  assert await startup.locator('#themeToggle').get_attribute('aria-pressed')=='true'
  assert await startup.evaluate('getComputedStyle(document.documentElement).colorScheme')=='dark'
  await startup.close()
  print('PASS fresh-page startup: stored dark mode restored before rendering')
  await browser.close()
if __name__=='__main__':asyncio.run(main())
