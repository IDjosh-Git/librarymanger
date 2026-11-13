"""Responsive registration interaction test; uses real UI functions, no cloud accounts."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text(encoding='utf-8')
start=html.index('function setAuthMode(mode){')
end=html.index('function readPendingAdminAccess(){',start)
auth_ui_js=html[start:end]
html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.S|re.I)
html=re.sub(r'<link[^>]*rel="stylesheet"[^>]*href="(assets/[^" ]+\.css[^" ]*)"[^>]*>',lambda m:'<style>'+(root/m.group(1).split('?')[0]).read_text(encoding='utf-8')+'</style>',html)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-gpu'])
 page=browser.new_page(viewport={'width':390,'height':844})
 page.set_content(html,wait_until='domcontentloaded')
 page.add_script_tag(content="""
 const $=id=>document.getElementById(id);
 let authMode='signin';
 const clearPendingAdminAccess=()=>{};
 const readPendingAdminInvite=()=>null;
 const savePendingAdminAccess=()=>{};
 """+auth_ui_js+"""
 document.querySelectorAll('[data-select-role]').forEach(button=>button.addEventListener('click',()=>{$('signupAccessRole').value=button.dataset.selectRole;updateSignupRole()}));
 """)
 for width in [320,390,600,768,1024,1440]:
  page.set_viewport_size({'width':width,'height':860})
  page.evaluate("() => { document.querySelector('#signupAccessRole').value='user'; setAuthMode('signup'); }")
  user=page.evaluate("""() => ({visible:getComputedStyle(document.querySelector('#accessRoleControl')).display!=='none',noCode:!document.querySelector('#signupInviteCode').required && getComputedStyle(document.querySelector('#signupAdminInvite')).display==='none'})""")
  page.locator('[data-select-role="admin"]').click()
  admin=page.evaluate("""() => ({visible:getComputedStyle(document.querySelector('#signupAdminInvite')).display!=='none',needsCode:document.querySelector('#signupInviteCode').required,selected:document.querySelector('[data-select-role="admin"]').getAttribute('aria-pressed')==='true'})""")
  page.locator('[data-select-role="user"]').click()
  back=page.evaluate("""() => ({noCode:!document.querySelector('#signupInviteCode').required,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth)})""")
  print(width,user,admin,back)
  assert user['visible'] and user['noCode'] and admin['visible'] and admin['needsCode'] and admin['selected'] and back['noCode'] and back['overflow']<=2
 browser.close()
