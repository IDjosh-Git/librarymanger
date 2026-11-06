"""Actual Chromium check of modal scroll locking and independent message scrolling."""
from pathlib import Path
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parents[1]
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'])
 for width,height in ((320,640),(390,844),(768,850),(1440,900)):
  page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
  page.set_default_timeout(4000)
  page.set_content('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main style="height:4000px;padding:20px;background:#f7f8ff">Background content</main></body></html>')
  page.add_style_tag(content=(P/'assets/book-guide.css').read_text()+'\n.book-guide-panel{animation:none!important}')
  page.add_script_tag(path=str(P/'assets/book-guide-format.js'))
  page.add_script_tag(path=str(P/'assets/book-guide.js'))
  page.evaluate('''()=>{window.LibraryBookGuide.setBooks([{title:'The Hobbit',authors:'J. R. R. Tolkien',shelf:'A1',isbn:'9780547928227'}]);}''')
  page.evaluate('window.scrollTo(0,690)')
  page.wait_for_timeout(80)
  before=page.evaluate('window.scrollY')
  page.evaluate("document.querySelector('#bookGuideFab').click()")
  page.wait_for_timeout(130)
  state=page.evaluate('''()=>({bodyPosition:document.body.style.position,modal:document.querySelector('#bookGuidePanel').getAttribute('aria-modal'),backdrop:document.querySelector('#bookGuideBackdrop').hidden,panel:document.querySelector('#bookGuidePanel').getBoundingClientRect().toJSON(),message:document.querySelector('#bookGuideMessages').getBoundingClientRect().toJSON(),scrollWidth:document.documentElement.scrollWidth,top:document.body.style.top,overflow:document.documentElement.style.overflow})''')
  assert state['scrollWidth']<=width+2,(width,state)
  assert state['message']['height']>=65,(width,'messages have no room',state)
  if width<900:
   assert state['bodyPosition']=='fixed',(width,state)
   assert state['modal']=='true' and not state['backdrop'],(width,state)
   assert state['panel']['width']>=width-3 and state['panel']['height']>=height-6,(width,state)
   assert abs(float(state['top'][:-2])+before)<3,(width,before,state)
   page.evaluate('''()=>{const area=document.querySelector('#bookGuideMessages');for(let i=0;i<35;i++){const el=document.createElement('div');el.textContent='A long answer on reading ' +i+' with enough text to require internal scrolling in this panel.';area.appendChild(el);}area.scrollTop=area.scrollHeight;}''')
   chat_scroll=page.evaluate('document.querySelector("#bookGuideMessages").scrollTop')
   assert chat_scroll>0,(width,chat_scroll)
   page.mouse.wheel(0,440)
   after=page.evaluate('''()=>({body:document.body.style.position,top:document.body.style.top,htmlScroll:document.documentElement.scrollTop})''')
   assert after['body']=='fixed' and after['top']==state['top'],(width,state,after)
  else:
   assert state['bodyPosition']!='fixed',(width,state)
  if width in (390,1440):page.screenshot(path=str(P/f'preview_ai_sheet_{width}.png'),timeout=5000,animations='disabled')
  page.keyboard.press('Escape')
  page.wait_for_timeout(90)
  assert page.locator('#bookGuidePanel').is_hidden()
  if width<900:
   assert page.evaluate('document.body.style.position')==''
   restored=page.evaluate('window.scrollY')
   assert abs(restored-before)<3,(width,before,restored)
  page.close()
 browser.close()
print('PASS: mobile modal and background scroll lock (320,390,768), desktop popover (1440), internal scroll, Escape, restore')
