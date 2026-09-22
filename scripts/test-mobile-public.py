"""Exercise real public layouts with a deterministic catalog, no submissions."""
import json
from playwright.sync_api import sync_playwright

base='http://127.0.0.1:8767'
# A remaining photo4 variant must still be shown even when photo2 is hidden.
services=[dict(id='photo4',name_bg='Фотограф за четири часа',name_en='Photographer',price=100,img='assets/images/gallery-5.jpg')]
services += [dict(id=f'mobile-{i}',name_bg=f'Допълнителна услуга {i} с дълго описание и пълно наименование',name_en=f'Additional service {i}',price=20+i,img='assets/images/gallery-5.jpg',qtyItem=i==8,maxQty=100 if i==8 else None) for i in range(9)]
catalog='window.loadCatalog=async()=>{window.addonServices='+json.dumps(services)+';window.drinks=[];window.drinkCategories={bg:[],en:[]};};'
db="const reservationDb={from(){const q={select(){return q},eq(){return q},order(){return q},then(resolve){return Promise.resolve(resolve({data:[],error:null}))}};return q}};"
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 page=browser.new_page()
 page.add_init_script("localStorage.setItem('margel_lang','bg')")
 page.route('https://**/*',lambda r:r.abort())
 page.route('**/js/catalog-db.js*',lambda r:r.fulfill(body=catalog,content_type='application/javascript'))
 page.route('**/js/reservation-supabase.js*',lambda r:r.fulfill(body=db,content_type='application/javascript'))
 errors=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 for width in [320,375,390,430,768,1024,1440]:
  page.set_viewport_size({'width':width,'height':844})
  page.goto(base+'/services.html',wait_until='networkidle')
  assert page.locator('#services-grid .service-card').count()==len(services),(width,page.locator('#services-grid .service-card').count(),errors)
  for card in page.locator('#services-grid .service-card').all():
   assert card.evaluate('e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1}'),width
  if width==390:page.screenshot(path='/tmp/m360-services-phone.png',full_page=True)
  page.goto(base+'/reservation.html',wait_until='networkidle')
  page.evaluate('goToStep(2)')
  page.wait_for_function("getComputedStyle(document.getElementById('step-2')).transform==='none'")
  page.evaluate("window.scrollTo({top:document.getElementById('step-2').offsetTop,behavior:'instant'})")
  assert page.locator('#addon-grid .addon-item').count()==len(services)
  for item in page.locator('#addon-grid .addon-item').all():
   assert item.evaluate('e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1}'),width
  if width<=600:
   for name in page.locator('.addon-name').all():
    assert name.evaluate('e=>e.scrollWidth<=e.clientWidth+1'),'Truncated service name'
   for control in page.locator('.addon-qty button').all():
    assert control.bounding_box()['width']>=43.5,(width,control.bounding_box())
  page.locator('#addon-grid .addon-item').filter(has_text='Допълнителна услуга 0').locator('.addon-name').click()
  assert page.evaluate("booking.addons['mobile-0']")==1,(width,page.evaluate('booking.addons'))
  page.locator('.addon-qty button[aria-label="Увеличи"]').click()
  assert page.evaluate("booking.addons['mobile-8']")==1
  if width==390:page.locator('#step-2').screenshot(path='/tmp/m360-addons-phone.png')
 assert not errors, errors
 # Common public pages and the open navigation drawer at narrow widths.
 for route in ['index.html','contact.html','menu.html','gallery.html','blog.html','wedding.html','birthday.html','corporate.html','evening.html','faq.html','partners.html']:
  page.set_viewport_size({'width':320,'height':740})
  page.goto(base+'/'+route,wait_until='networkidle')
  if page.locator('.age-gate-yes').count():page.locator('.age-gate-yes').click()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(route,page.evaluate("Array.from(document.querySelectorAll('main *')).filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+1}).slice(0,12).map(e=>[e.tagName,e.className,e.getBoundingClientRect().right])"))
  if page.locator('.hamburger').count():
   page.locator('.hamburger').click()
   assert page.locator('.nav-drawer').evaluate('e=>{const r=e.getBoundingClientRect();return r.bottom<=innerHeight+1}'),route
 browser.close()
 print('PASS public mobile: all service cards, surviving variants, full addon names, selection, touch controls, page widths and navigation')
