"""Static browser smoke for unique lending titles, available quantity, and role-scoped admin generator."""
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[1]
source=(root/'index.html').read_text()
soup=BeautifulSoup(source,'html.parser')
sections=[]
for tag in ['lend','return','adminDirectory']:
 node=soup.find(id=tag)
 assert node is not None,tag
 node['class']=list(node.get('class',[]))+['active']
 sections.append(str(node))
style=(root/'assets/library-manager-v542.css').read_text()
script=(root/'assets/lending-catalogue.js').read_text()
start=source.index('const pickerIds={lend:')
end=source.index('function findBookByCode(',start)
script+='\n'+'''const $=id=>document.getElementById(id);
const books=[
{record_id:'u1',book_id:'BK-100',title:'Data & Decisions',authors:'Alfa',barcode:'9780000000001',book_status:'Available',shelf_location:'A'},
{record_id:'u2',book_id:'BK-101',title:'  data & decisions  ',authors:'Alfa',barcode:'9780000000001',book_status:'Available',shelf_location:'B'},
{record_id:'u3',book_id:'BK-102',title:'Data & Decisions',authors:'Alfa',book_status:'Borrowed',shelf_location:'C'},
{record_id:'u4',book_id:'BK-103',title:'Introduction to SQL',authors:'Beta',book_status:'Available',shelf_location:'D'}
];
const loans=[]; let selectedLend=null,selectedReturn=null,memberRole='user';const session={user:{id:'id'}};
const isCirculationUser=()=>true;
const esc=x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const msg=(...args)=>{};const tab=()=>{};
const clean=v=>String(v||'').trim();
const requestAnimationFrame=()=>1;
''' + source[start:end] + '''
for(const mode of ['lend','return']){
 const ids=pickerIds[mode];
 $(ids.search).addEventListener('input',()=>{clearSelectedBook(mode);renderBookPicker(mode)});
 $(ids.select).addEventListener('change',e=>{const id=e.target.value;if(!id){clearSelectedBook(mode);return}setSelectedBook(mode,books.find(b=>b.record_id===id))});
}
renderBookPicker('lend');renderBookPicker('return');
window.testLending={renderBookPicker,clearSelectedBook,selected:()=>selectedLend};
'''
html='<html data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+style+'</style></head><body data-account="in" data-role="user"><main style="width:100%;margin:0 auto;max-width:1200px;padding:15px"><div id="libraryArea">'+''.join(sections)+'</div></main></body></html>'
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for width in [320,390,600,768,1024,1440]:
  page=browser.new_page(viewport={'width':width,'height':900},device_scale_factor=1)
  page.set_content(html,wait_until='domcontentloaded')
  page.on('pageerror',lambda e:print('PAGE ERROR',e))
  page.on('console',lambda m:print('CONSOLE',m.text) if m.type=='error' else None)
  page.add_script_tag(content=script)
  options=page.locator('#lendBookSelect option').all_text_contents()
  assert len(options)==3,(width,options)
  assert len([x for x in options if 'data & decisions' in x.lower()])==1,(width,options)
  # Member page must never display generator even if hidden attribute removed by a bug.
  page.evaluate("document.querySelector('#adminInvitePanel').hidden=false")
  visible=page.locator('#adminInvitePanel').is_visible()
  assert not visible,(width,'Admin code visible to member!')
  page.locator('#lendBookSelect').select_option(index=1)
  values=page.evaluate("()=>({available:document.querySelector('#lendTitleAvailable').textContent,borrowed:document.querySelector('#lendTitleBorrowed').textContent,total:document.querySelector('#lendTitleTotal').textContent,copyId:document.querySelector('#lendBookId').value,scroll:document.documentElement.scrollWidth})")
  assert values['available']=='2' and values['borrowed']=='1' and values['total']=='3',(width,values)
  assert values['copyId'] in ('BK-100','BK-101'),(width,values)
  assert values['scroll']<=width+2,(width,values)
  page.locator('#lendBookSearch').fill('BK-100')
  options2=page.locator('#lendBookSelect option').all_text_contents()
  assert len(options2)==2,(width,options2)
  page.locator('#lendBookSelect').select_option('u1')
  assert page.locator('#lendBookId').input_value()=='BK-100'
  assert page.locator('#lendTitleAvailable').inner_text()=='2'
  if width in [390,1440]:
   page.evaluate("document.querySelector('#return').style.display='none';document.querySelector('#adminDirectory').style.display='none'")
   page.screenshot(path=str(root/f'v546-lending-{width}.png'),full_page=True)
   page.evaluate("document.querySelector('#return').style.display='';document.querySelector('#adminDirectory').style.display=''")
  page.evaluate("document.body.dataset.role='admin'")
  assert page.locator('#adminInvitePanel').is_visible()
  print(json.dumps({'width':width,'unique_titles':len(options)-1,'quantity':values,'member_generator_hidden':not visible,'admin_generator_visible':True}))
  page.close()
 browser.close()
