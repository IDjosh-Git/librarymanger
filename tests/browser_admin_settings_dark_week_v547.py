"""Deterministic Chromium smoke test: Member/Admin menus and dark Book of the Week contrast."""
from pathlib import Path
import re
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
app=ROOT/'index.html'
html=app.read_text()
appcss=(ROOT/'assets/library-manager-v542.css').read_text()
from_pos=html.index('function authUI(){')
to_pos=html.index('async function lookupVerifiedMemberRole(',from_pos)
auth_fn=html[from_pos:to_pos]
# Remove live scripts, inline the production style and run only the auth UI function under controlled mock state.
base=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.S|re.I)
base=re.sub(r'<link[^>]*rel="stylesheet"[^>]*href="assets/[^">]*\.css[^">]*"[^>]*>', '',base)
base=base.replace('</head>','<style>'+appcss+'</style></head>',1)
setup="""const $=id=>document.getElementById(id);
let memberRole='user';let session={user:{id:'t1',email:'member@example.test'}};
const isAdmin=()=>memberRole==='admin';
const canAccess=page=>memberRole==='admin'?new Set(['dashboard','inventory','shelfScan','review','featuredAdmin','scanned','notifications','history','contactSettings','adminDirectory','attendance']).has(page):new Set(['lend','return','dailyLog']).has(page);
const roleLanding=()=>memberRole==='admin'?'dashboard':'dailyLog';function tab(page){};
window.LibraryDailyVisits={setContext(){}};window.LibraryBookGuide={setSession(){}};
"""+auth_fn+"\nwindow.testRole=r=>{memberRole=r;session=r?{user:{id:'t1',email:'someone@example.test'}}:null;authUI()};"
week=(ROOT/'book-of-the-week.html').read_text()
week=re.sub(r'<script\b[^>]*>.*?</script>','',week,flags=re.S|re.I)
week=re.sub(r'<link[^>]*rel="stylesheet"[^>]*href="assets/[^">]*\.css[^">]*"[^>]*>', '',week)
week=week.replace('</head>','<style>'+(ROOT/'assets/book-of-week-v542.css').read_text()+'</style></head>',1)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for width in [320,390,768,1024,1440]:
  page=b.new_page(viewport={'width':width,'height':920},device_scale_factor=1)
  page.set_content(base,wait_until='domcontentloaded')
  page.add_script_tag(content=setup)
  assert page.locator('#activateAdminPanel, #activateAdminInvite, #existingAdminInviteCode').count()==0, (width,'old-member-admin-activation-present')
  assert page.get_by_text('Activate admin access',exact=True).count()==0, (width,'old-member-admin-label-present')
  for role in ['user','admin']:
   page.evaluate('(role)=>window.testRole(role)',role)
   vis=page.evaluate('''() => {const ids=['#accountCard .account-tools','#accountCard .lookupbox','#memberAccountFooter','#memberSignOut','#mobileAccountJump','#mobileMemberSignOut'];return ids.map(q=>({q,visible:!!document.querySelector(q)?.getClientRects().length,hidden:document.querySelector(q)?.hidden}))}''')
   # On mobile nav, hidden drawer prevents visibility; check hidden attribute independently.
   mapv={v['q']:v for v in vis}
   assert mapv['#accountCard .account-tools']['hidden']==(role=='user'),(width,role,vis)
   assert mapv['#accountCard .lookupbox']['hidden']==(role=='user'),(width,role,vis)
   assert mapv['#memberAccountFooter']['hidden']==(role=='admin'),(width,role,vis)
   assert mapv['#mobileAccountJump']['hidden']==(role=='user'),(width,role,vis)
   assert mapv['#mobileMemberSignOut']['hidden']==(role=='admin'),(width,role,vis)
   assert mapv['#accountCard .account-tools']['visible']==(role=='admin'),(width,role,vis)
   assert mapv['#accountCard .lookupbox']['visible']==(role=='admin'),(width,role,vis)
   assert page.evaluate('document.documentElement.scrollWidth')<=width+2,(width,role,'overflow')
   if width<900:
    page.evaluate("document.querySelector('#mobileNavSheet').hidden=false")
    assert page.locator('#mobileAccountJump').is_visible()==(role=='admin'),(width,role,'mobile-account-jump')
    assert page.locator('#mobileMemberSignOut').is_visible()==(role=='user'),(width,role,'mobile-member-sign-out')
    page.evaluate("document.querySelector('#mobileNavSheet').hidden=true")
  page.evaluate('document.documentElement.dataset.theme="dark"')
  page.evaluate('window.testRole("user")')
  assert not page.locator('#accountCard .account-tools').is_visible()
  assert page.locator('#memberSignOut').is_visible() if width>=900 else page.locator('#memberSignOut').count()==1
  page.evaluate('window.testRole("admin")')
  assert page.locator('#accountCard .account-tools').is_visible()
  if width in [390,1440]:
   page.screenshot(path=str(ROOT/f'v547-sidebar-{width}.png'),full_page=False)
  page.close()
  pub=b.new_page(viewport={'width':width,'height':900})
  pub.set_content(week,wait_until='domcontentloaded')
  pub.evaluate("document.documentElement.dataset.theme='dark'")
  v=pub.evaluate('''() => {
    const rgb = str => (str.match(/[\\d.]+/g)||[]).slice(0,3).map(Number);
    const channel = n=> (n=n/255)<=.04045 ? n/12.92 : Math.pow((n+.055)/1.055,2.4);
    const luminance = arr=> arr[0]*.2126+arr[1]*.7152+arr[2]*.0722;
    const ratio=(a,b)=>{let v=[luminance(rgb(a)),luminance(rgb(b))].sort((x,y)=>x-y);return (v[1]+.05)/(v[0]+.05)};
    const card=document.querySelector('.weekly-reason');const child=card.querySelector('p');
    const label=document.querySelector('.weekly-reason-label'); const detail=document.querySelector('.weekly-detail');
    const aside=document.querySelector('.weekly-detail p');
    const info={card:ratio(getComputedStyle(child).color,getComputedStyle(card).backgroundColor),label:ratio(getComputedStyle(label).color,getComputedStyle(card).backgroundColor),detail:ratio(getComputedStyle(aside).color,getComputedStyle(detail).backgroundColor),scroll:document.documentElement.scrollWidth};
    return info
  }''')
  assert min(v['card'],v['label'],v['detail'])>=4.5,(width,v)
  assert v['scroll']<=width+2,(width,v)
  if width in [390,1440]:pub.screenshot(path=str(ROOT/f'v547-book-week-dark-{width}.png'),full_page=False)
  print(width,v)
  pub.close()
 b.close()
