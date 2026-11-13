"""Offline signup and resend controls test with restored User/Admin role choice."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text(encoding='utf-8')
html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.S|re.I)
html=re.sub(r'<link[^>]*rel="stylesheet"[^>]*href="(assets/[^" ]+\.css[^" ]*)"[^>]*>',lambda m:'<style>'+ (root/m.group(1).split('?')[0]).read_text(encoding='utf-8') + '</style>',html)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-gpu'])
 page=browser.new_page(viewport={'width':390,'height':844})
 page.set_content(html,wait_until='domcontentloaded')
 for width in [320,390,768,1024,1440]:
  page.set_viewport_size({'width':width,'height':860})
  page.evaluate('''() => {
   document.body.dataset.account='out';
   document.querySelector('#resendConfirmation').hidden=false;
   document.querySelector('#authEmailHelp').hidden=false;
   document.querySelector('#signupFields').hidden=false;
   document.querySelector('#accessRoleControl').hidden=false;
   document.querySelector('#authSubmit').textContent='Create My Account';
  }''')
  r=page.evaluate('''() => ({overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),resendVisible:getComputedStyle(document.querySelector('#resendConfirmation')).display!=='none',helpVisible:getComputedStyle(document.querySelector('#authEmailHelp')).display!=='none',chooserVisible:getComputedStyle(document.querySelector('#accessRoleControl')).display!=='none'})''')
  print(width,r)
  assert r['overflow']<=2 and r['resendVisible'] and r['helpVisible'] and r['chooserVisible']
 browser.close()
