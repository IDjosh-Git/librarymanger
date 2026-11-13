"""Offline, deterministic UI smoke checks for v5.42 stylesheet bundles."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
css=(ROOT/'assets/library-manager-v542.css').read_text()
html=(ROOT/'index.html').read_text()
html=re.sub(r'<script\b[^>]*>.*?</script>', '', html, flags=re.S|re.I)
html=re.sub(r'<link[^>]*rel="stylesheet"[^>]*href="(assets/[^" ]+\.css[^" ]*)"[^>]*>', lambda m:'<style>'+ (ROOT/m.group(1).split('?')[0]).read_text() + '</style>', html)

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-gpu'])
 page=browser.new_page(viewport={'width':1440,'height':940},device_scale_factor=1)
 page.set_content(html,wait_until='domcontentloaded')
 page.evaluate('''() => {
  document.body.dataset.account='in';
  const logged=document.querySelector('#loggedIn');logged.hidden=false;
  const panel=logged.parentElement;panel.hidden=false;
  for(const child of [...panel.children])if(child!==logged)child.hidden=true;
  const card=document.querySelector('#accountCard');
  for(const child of [...card.children])if(child!==panel)child.hidden=true;
  document.querySelector('#who').textContent='Library Administrator';
  document.querySelector('#memberRolePill').textContent='Administrator';
  document.querySelectorAll('.nav-admin-only').forEach(x=>x.hidden=false);
  document.querySelectorAll('.nav-user-only').forEach(x=>x.hidden=true);
 }''')
 for width, height in [(1440,940),(1280,900),(1100,850),(1024,820),(900,800),(768,900),(390,844),(320,740)]:
  page.set_viewport_size({'width':width,'height':height})
  measurements=page.evaluate('''() => ({
    overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),
    width:document.querySelector('#accountCard').getBoundingClientRect().width,
    sidebarVisible:getComputedStyle(document.querySelector('.workspace-nav')).display!=='none',
    activeBackground:getComputedStyle(document.querySelector('.workspace-nav .tab.active')).backgroundImage,
    scrollableSidebar:getComputedStyle(document.querySelector('#accountCard')).overflowY
  })''')
  print(width, measurements)
  assert measurements['overflow'] <= 2, f'Horizontal scroll at {width}px: {measurements}'
  if width >= 1101:
   assert abs(measurements['width']-312)<2
  elif 900<=width<=1100:
   assert abs(measurements['width']-284)<2
  if width>=900:
   assert 'rgb(21, 53, 76)' in measurements['activeBackground'],measurements
  if width==1440:
   page.screenshot(path=str(ROOT/'LibraryManager_v5.42_Sidebar_Desktop.png'))
  if width==390:
   page.screenshot(path=str(ROOT/'LibraryManager_v5.42_Mobile.png'))
 # keyboard navigation focus visible and click state are CSS-only/DOM smoke checks
 page.set_viewport_size({'width':1440,'height':940})
 page.locator('.workspace-nav button.tab[data-tab="inventory"]').focus()
 outline=page.locator('.workspace-nav button.tab[data-tab="inventory"]').evaluate('(e)=>getComputedStyle(e).outlineStyle')
 print('focused item outline:',outline)
 assert outline!='none'
 browser.close()
