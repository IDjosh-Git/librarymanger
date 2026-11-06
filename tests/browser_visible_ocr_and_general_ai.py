from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parents[1]
html=(P/'index.html').read_text()
scan=BeautifulSoup(html,'html.parser').select_one('.scan-recognition-settings')
assert scan
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'])
 for width,height in ((320,680),(390,844),(768,850),(1440,900)):
  page=browser.new_page(viewport={'width':width,'height':height})
  page.set_default_timeout(5000)
  page.set_content('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main style="height:4000px;padding:20px">Background content</main></body></html>')
  page.add_style_tag(content=(P/'assets/book-guide.css').read_text())
  page.add_script_tag(path=str(P/'assets/book-guide-format.js'))
  page.add_script_tag(path=str(P/'assets/book-guide.js'))
  page.evaluate('''()=>{
    window.__aiRequest=null;
    window.fetch=async (url,options)=>{
      window.__aiRequest={url,body:JSON.parse(options.body)};
      return {ok:true,status:200,json:async()=>({reply:'## General AI answer\\n\\nAn answer about research outside the catalogue.',grounded:true,searchRequested:true,
        sources:[{title:'Research',url:'https://example.com/research'}],searchSuggestions:''})};
    };
    window.LibraryBookGuide.setBooks([{title:'A Library Book',authors:'A Writer'}]);
    window.scrollTo(0,690);
  }''')
  page.locator('#bookGuideFab').click()
  assert page.locator('#bookGuideWebSearch').count()==1
  assert page.locator('#bookGuideContext').get_attribute('open') is None
  page.locator('label.book-guide-web-switch').click()
  assert page.locator('#bookGuideWebSearch').is_checked()
  page.locator('#bookGuideInput').fill('Tell me about libraries beyond the catalogue')
  page.locator('#bookGuideForm').evaluate('(form)=>form.requestSubmit()')
  page.wait_for_function("window.__aiRequest !== null",timeout=5000)
  page.wait_for_function("document.querySelector('.book-guide-sources a') !== null",timeout=5000)
  request=page.evaluate('window.__aiRequest')
  assert request['body']['book'] is None,(width,request)
  assert request['body']['searchWeb'] is True
  assert page.locator('.book-guide-sources a').get_attribute('href')=='https://example.com/research'
  assert page.locator('.book-guide-message-body h3').count()>=1
  assert page.evaluate('document.documentElement.scrollWidth')<=width+2
  if width<900:
   assert page.evaluate('document.body.style.position')=='fixed'
  page.locator('#bookGuideContext > summary').click()
  assert page.locator('#bookGuideSelect').is_visible(),width
  page.locator('#bookGuideSelect').select_option('0')
  assert page.locator('#bookGuideContextLabel').inner_text()=='A Library Book'
  if width==390:page.screenshot(path=str(P/'tests/preview_general_ai_390.png'),animations='disabled')
  page.locator('#bookGuideClose').click()
  assert page.locator('#bookGuidePanel').is_hidden()
  if width<900:assert page.evaluate('document.body.style.position')==''
  page.close()
  scanpage=browser.new_page(viewport={'width':width,'height':height})
  scanpage.set_content('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div class="panel active" id="shelfScan" style="max-width:950px;margin:40px auto;padding:8px">'+str(scan)+'</div></body></html>')
  scanpage.add_style_tag(content=(P/'assets/library-ui.css').read_text())
  for control in ('batchUseAI','batchUseOCR'):
   assert scanpage.locator('#'+control).is_checked()
   switch=scanpage.locator('label[for="'+control+'"]')
   assert switch.is_visible()
   switch.click()
   assert not scanpage.locator('#'+control).is_checked(),(width,control)
   switch.click()
   assert scanpage.locator('#'+control).is_checked()
  assert scanpage.evaluate('document.documentElement.scrollWidth')<=width+2
  if width==390:scanpage.screenshot(path=str(P/'tests/preview_scan_controls_390.png'),animations='disabled')
  scanpage.close()
 browser.close()
print('PASS: OCR+AI toggles visible & functional; no-book general chat, optional search, safe sources, book context, mobile lock, 320/390/768/1440 responsive')
