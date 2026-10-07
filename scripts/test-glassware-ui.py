"""Посуда (glassware) on the public site with a deterministic catalog, no submissions.
Start a static server for website/ on :8767, then: python3 scripts/test-glassware-ui.py"""
import json
from playwright.sync_api import sync_playwright

base='http://127.0.0.1:8767'
services=[
 dict(id='dj',name_bg='DJ за 5 часа',name_en='DJ',price=300,img='assets/images/gallery-5.jpg',category='service'),
 dict(id='cleaning',name_bg='Почистване зала',name_en='Hall cleaning',price=100,img=None,category='service'),
 dict(id='glass-wine',name_bg='Чаша за вино',name_en='Wine glass',price=0.8,img=None,maxQty=200,category='glassware'),
 dict(id='glass-flute',name_bg='Чаша за шампанско',name_en='Flute',price=1,img='assets/images/gallery-5.jpg',maxQty=999,category='glassware'),
]
catalog='window.loadCatalog=async()=>{window.addonServices='+json.dumps(services)+';window.drinks=[];window.drinkCategories={bg:[],en:[]};};'
db="const reservationDb={from(){const q={select(){return q},eq(){return q},order(){return q},then(resolve){return Promise.resolve(resolve({data:[],error:null}))}};return q}};"
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 page=browser.new_page(viewport={'width':1280,'height':900})
 page.add_init_script("localStorage.setItem('margel_lang','bg')")
 page.route('https://**/*',lambda r:r.abort())
 page.route('**/js/catalog-db.js*',lambda r:r.fulfill(body=catalog,content_type='application/javascript'))
 page.route('**/js/reservation-supabase.js*',lambda r:r.fulfill(body=db,content_type='application/javascript'))
 errors=[]
 page.on('pageerror',lambda error:errors.append(str(error)))

 # Services page: glassware in its own section, not in the services grid.
 page.goto(base+'/services.html',wait_until='networkidle')
 assert page.locator('#services-grid .service-card').count()==2
 assert page.locator('#glassware-section').is_visible()
 assert page.locator('#glassware-grid .service-card').count()==2
 assert '€0.80 / бр.' in page.locator('#glassware-grid').inner_text()
 assert page.locator('#glassware-grid .service-card').first.locator('img').count()==0   # no photo yet -> no broken image
 page.screenshot(path='/tmp/m360-glassware-services.png',full_page=True)

 # Wizard: Посуда is step 5 (index 4), right after Напитки.
 page.goto(base+'/reservation.html',wait_until='networkidle')
 assert page.locator('.wstep').count()==8
 assert page.locator('.wstep[data-step="4"] .wstep-label').inner_text()=='Посуда'
 page.evaluate('goToStep(2)')
 assert page.locator('#addon-grid .addon-item').count()==2          # glassware not among services
 page.evaluate('goToStep(3)')
 page.locator('#step-3 [data-goto="4"]').click()                    # Напитки -> Напред
 assert page.locator('#step-4').evaluate("e=>e.classList.contains('active')")
 assert page.locator('#glassware-grid .addon-item').count()==2
 row=page.locator('#glassware-grid .addon-item').filter(has_text='Чаша за вино')
 assert '€0.80 / бр.' in row.inner_text()
 row.locator('input[type=number]').fill('50')
 assert page.evaluate("booking.addons['glass-wine']")==50
 assert page.locator('#glassware-total-val').inner_text()=='€40'
 assert page.locator('#addons-total-val').inner_text()=='€0'       # services total excludes glassware
 page.locator('#step-4 [data-goto="5"]').click()
 assert page.locator('#step-5').evaluate("e=>e.classList.contains('active')")   # Партньори
 page.locator('#step-5 [data-goto="4"]').click()
 assert page.locator('#step-4').evaluate("e=>e.classList.contains('active')")
 page.screenshot(path='/tmp/m360-glassware-wizard.png',full_page=True)
 # Declining drinks in the prompt lands on Посуда.
 page.evaluate("goToStep(2)")
 page.locator('#step-2 [data-action="drinks-prompt"]').click()
 page.locator('#drinks-prompt-no').click()
 assert page.locator('#step-4').evaluate("e=>e.classList.contains('active')")
 # Summary: Посуда is its own line; the grand total includes it once.
 page.evaluate("booking.event={id:'evening',price_eur:1000,title_bg:'Вечерно',title_en:'Evening'};booking.guests=40;goToStep(7)")
 summary=page.locator('#price-summary').inner_text()
 assert 'Посуда' in summary and '€40.00' in summary, summary
 assert page.locator('#price-summary .price-summary-row').filter(has_text='Допълнителни услуги').inner_text().endswith('€100.00'), summary   # cleaning only
 assert not errors, errors
 browser.close()
print('PASS glassware: services section, wizard step after drinks, per-piece pricing with cents, separate totals')
