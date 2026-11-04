from pathlib import Path
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
import json, base64, mimetypes
ROOT=Path(__file__).resolve().parents[1]
VIS=ROOT/'visual-evidence';VIS.mkdir(exist_ok=True)
SRC=(ROOT/'index.html').read_text()
soup=BeautifulSoup(SRC,'html.parser')
for script in soup.find_all('script'):script.decompose()
# Inline app-owned icons and images into the test fixture (the managed browser blocks file navigation).
for image in soup.find_all('img'):
 src=image.get('src','')
 if src.startswith('assets/') and (ROOT/src).is_file():
  raw=(ROOT/src).read_bytes();mime=mimetypes.guess_type(src)[0] or 'application/octet-stream'
  image['src']='data:'+mime+';base64,'+base64.b64encode(raw).decode('ascii')
for use in soup.find_all('use'):
 href=use.get('href','')
 if href.startswith('assets/icons.svg#'):use['href']='#'+href.split('#',1)[1]
icon_sprite=BeautifulSoup((ROOT/'assets/icons.svg').read_text(),'html.parser').svg
soup.body.insert(0,icon_sprite)

# This browser fixture renders the exact app HTML and CSS, with auth state simulated.
preview=ROOT/'.visual-audit.html';preview.write_text(str(soup))
CSS=(ROOT/'assets/book-guide.css').read_text()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-gpu','--allow-file-access-from-files','--disable-dev-shm-usage'])
 for width in (320,390,768,1440):
  page=browser.new_page(viewport={'width':width,'height':900},device_scale_factor=1)
  page.set_content(str(soup),wait_until='domcontentloaded',timeout=20000)
  page.add_style_tag(content=(ROOT/'assets/library-ui.css').read_text())
  for theme in ('light','dark'):
   page.evaluate('''theme=>{
     document.documentElement.dataset.theme=theme;
     document.body.dataset.account='in';document.body.dataset.role='admin';document.querySelector('#libraryArea').hidden=false;
     document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));
     document.querySelector('#shelfScan').classList.add('active');
     document.querySelector('#accountCard').style.display='none';
     document.querySelector('#mainContent').style.display='block';
    }''',theme)
   page.wait_for_timeout(90)
   dimensions=page.evaluate('''()=>({width:document.documentElement.scrollWidth,viewport:innerWidth,scan:document.querySelector('#shelfScan').getBoundingClientRect().width})''')
   assert dimensions['width'] <=width+2,(width,theme,dimensions)
   assert dimensions['scan']>0,(width,theme,dimensions)
   if width in (390,1440):page.screenshot(path=str(VIS/f'scan-review-{width}-{theme}.png'),full_page=False)
  page.close()
 for width in (320,390,768,1440):
  page=browser.new_page(viewport={'width':width,'height':844})
  page.set_content('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>')
  page.add_style_tag(content=CSS)
  page.add_script_tag(path=str(ROOT/'assets/book-guide-format.js'))
  page.add_script_tag(path=str(ROOT/'assets/book-guide.js'))
  page.evaluate('''()=>{
    window.LibraryBookGuide.setBooks([{title:'The Data Book',authors:'L. Author',isbn:'9780143127741',shelf:'Shelf A1'}]);
    window.LibraryBookGuide.setVisible(true);
    window.LibraryBookGuide.openBook({title:'The Data Book',authors:'L. Author',isbn:'9780143127741',shelf:'Shelf A1'});
    window.fetch=async()=>({ok:true,json:async()=>({reply:'## Reading notes\\n- **Author:** L. Author ✓\\n- **Location:** Shelf A1 → Library\\n1. Preview the contents\\n2. Compare with another book\\n\\n*Always verify the edition.*\\n\\n<img src=x onerror=alert(1)>'})});
   }''')
  page.locator('#bookGuideInput').fill('Give me reading notes')
  page.locator('#bookGuideForm').evaluate('(form)=>form.requestSubmit()')
  page.wait_for_function("document.querySelectorAll('.book-guide-message.assistant li').length >= 4",timeout=5000)
  assert page.locator('.book-guide-message.assistant strong').count()>=2
  assert page.locator('.book-guide-message.assistant ul li').count()==2
  assert page.locator('.book-guide-message.assistant ol li').count()==2
  assert page.locator('.book-guide-message.assistant img').count()==0,'HTML must be text, never executed'
  text=page.locator('#bookGuideMessages').inner_text()
  assert '✓' in text and '→' in text and '<img' in text
  assert '**Author**' not in text
  measure=page.evaluate('''()=>{const panel=document.querySelector('#bookGuidePanel').getBoundingClientRect();return {left:panel.left,right:panel.right,width:innerWidth,scroll:document.documentElement.scrollWidth}}''')
  assert measure['left']>=-2 and measure['right']<=width+2 and measure['scroll']<=width+2,(width,measure)
  page.wait_for_timeout(420)
  if width in (390,1440):page.screenshot(path=str(VIS/f'book-guide-markdown-{width}.png'))
  page.close()
 browser.close()
print('PASS: 8 scanner viewport/theme states, 4 chat viewport states, safe formatted AI replies, no overflow')
