"""Наргилета (shisha) on the public site with a deterministic catalog, no submissions.
Start a static server for website/ on :8767, then: python3 scripts/test-shisha-ui.py"""
import json
from playwright.sync_api import sync_playwright

base='http://127.0.0.1:8767'
services=[
 dict(id='dj',name_bg='DJ за 5 часа',name_en='DJ',price=300,img='assets/images/gallery-5.jpg',category='service'),
 dict(id='cleaning',name_bg='Почистване зала',name_en='Hall cleaning',price=70,img=None,category='service'),
 dict(id='glass-wine',name_bg='Чаша за вино',name_en='Wine glass',price=0.8,img=None,maxQty=200,category='glassware'),
 dict(id='shisha',name_bg='Наргиле',name_en='Shisha',price=40,img=None,maxQty=3,category='shisha'),
]
def catalog(items): return 'window.loadCatalog=async()=>{window.addonServices='+json.dumps(items)+';window.drinks=[];window.drinkCategories={bg:[],en:[]};};'
db="const reservationDb={from(){const q={select(){return q},eq(){return q},order(){return q},then(resolve){return Promise.resolve(resolve({data:[],error:null}))}};return q}};"
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 page=browser.new_page(viewport={'width':1280,'height':900})
 page.add_init_script("localStorage.setItem('margel_lang','bg')")
 page.route('https://**/*',lambda r:r.abort())
 current={'items':services}
 page.route('**/js/catalog-db.js*',lambda r:r.fulfill(body=catalog(current['items']),content_type='application/javascript'))
 page.route('**/js/reservation-supabase.js*',lambda r:r.fulfill(body=db,content_type='application/javascript'))
 errors=[]
 page.on('pageerror',lambda error:errors.append(str(error)))

 # Services page: shisha in its own section, not among services or glassware.
 page.goto(base+'/services.html',wait_until='networkidle')
 assert page.locator('#services-grid .service-card').count()==2
 assert page.locator('#glassware-grid .service-card').count()==1
 assert page.locator('#shisha-section').is_visible()
 assert page.locator('#shisha-grid .service-card').count()==1
 assert '€40 / бр.' in page.locator('#shisha-grid').inner_text()
 page.screenshot(path='/tmp/m360-shisha-services.png',full_page=True)

 # Wizard: shishas are a block inside the add-on services step.
 page.goto(base+'/reservation.html',wait_until='networkidle')
 page.evaluate('goToStep(2)')
 assert page.locator('#addon-grid .addon-item').count()==2
 assert page.locator('#shisha-block').is_visible()
 row=page.locator('#shisha-grid .addon-item')
 assert row.count()==1
 row.locator('input[type=number]').fill('5')                       # capped at the 3 owned
 assert page.evaluate("booking.addons['shisha']")==3
 assert page.locator('#addons-total-val').inner_text()=='€120'
 page.screenshot(path='/tmp/m360-shisha-wizard.png',full_page=True)
 page.evaluate("booking.event={id:'evening',price_eur:1000,title_bg:'Вечерно',title_en:'Evening'};booking.guests=40;goToStep(7)")
 summary=page.locator('#price-summary').inner_text()
 assert page.locator('#price-summary .price-summary-row').filter(has_text='Допълнителни услуги').inner_text().endswith('€190.00'), summary   # shisha 120 + cleaning 70

 # No active shisha in the catalog: both blocks stay hidden.
 current['items']=[s for s in services if s['category']!='shisha']
 page.goto(base+'/services.html',wait_until='networkidle')
 assert page.locator('#shisha-section').is_hidden()
 page.goto(base+'/reservation.html',wait_until='networkidle')
 page.evaluate('goToStep(2)')
 assert page.locator('#shisha-block').is_hidden()
 assert not errors, errors
 browser.close()
print('PASS shisha: services section, wizard block in add-ons step, stock cap, totals, hidden when empty')
