"""Admin catalog Наргилета tab with a mocked database (records writes, never touches Supabase).
Start a static server for website/ on :8767, then: python3 scripts/test-shisha-admin.py"""
from playwright.sync_api import sync_playwright

stub='''
const demo={drinks:[],addon_services:[
 {id:'dj',name_bg:'DJ',name_en:'DJ',price_eur:300,active:true,sort_order:1,category:'service'},
 {id:'glass-wine',name_bg:'Чаша за вино',name_en:'Wine glass',price_eur:0.8,max_qty:999,active:true,sort_order:1,category:'glassware'},
 {id:'shisha',name_bg:'Наргиле',name_en:'Shisha',price_eur:0,max_qty:999,active:false,sort_order:100,category:'shisha'}],
 drink_purchase_prices:[],addon_purchase_prices:[]};
window.writes=[];
const db={auth:{getSession:async()=>({data:{session:{user:{email:'qa@example.test'}}}})},rpc:async()=>({data:true}),
 storage:{from(){return {getPublicUrl:()=>({data:{publicUrl:''}}),upload:async()=>({error:null}),remove:async()=>({error:null})}}},
 from(table){const q=new Proxy({},{get(_,key){
  if(key==='then')return resolve=>Promise.resolve(resolve({data:demo[table]||[],error:null}));
  if(['insert','update','upsert'].includes(key))return v=>{writes.push({table,op:key,v});if(key==='update'&&table==='addon_services')Object.assign(demo[table].find(r=>r.id==='shisha'),v);if(key==='upsert')demo[table].push(v);return q};
  return ()=>q}});return q}};
'''
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 page=browser.new_page(viewport={'width':1280,'height':900})
 page.route('https://**/*',lambda r:r.abort())
 page.route('**/js/supabase-client.js*',lambda r:r.fulfill(body=stub,content_type='application/javascript'))
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8767/admin/catalog.html',wait_until='networkidle')
 page.click('.cat-tab[data-tab="services"]')
 assert page.locator('#catalog-body tr').count()==1                 # DJ only
 page.click('.cat-tab[data-tab="shisha"]')
 body=page.locator('#catalog-body').inner_text()
 assert 'Наргиле' in body and 'няма въведена цена' in body, body
 assert page.locator('#cat-add-btn').inner_text()=='Добави наргиле'
 heads=[h.text_content() for h in page.locator('th[data-purchase-header]').all()]
 assert heads==['Покупна цена / наргиле','Окупаемост','Инвестиция общо'], heads
 # Manager fills it in: price 40, 3 shishas owned, visible.
 page.click('.btn-edit[data-id="shisha"]')
 assert page.locator('#cf-qty-toggle').is_hidden() and page.locator('#cf-free-until-group').is_hidden()
 assert 'наем' in page.locator('#cf-price-label').inner_text()
 page.fill('#cf-price','40'); page.fill('#cf-max-qty','3'); page.check('#cf-active')
 page.click('#cf-save')
 page.wait_for_timeout(300)
 w=[x for x in page.evaluate('writes') if x['table']=='addon_services'][-1]['v']
 assert w['category']=='shisha' and w['price_eur']==40 and w['max_qty']==3 and w['active'] is True and w['free_until'] is None, w
 # Purchase price 150 -> pays back after 4 rentals, 450 invested in 3.
 page.fill('[data-purchase-input="shisha"]','150')
 assert page.locator('[data-purchase-profit="shisha"]').inner_text()=='4 наема'
 assert page.locator('[data-purchase-margin="shisha"]').inner_text()=='€450.00'
 page.click('[data-purchase-save="shisha"]')
 page.wait_for_timeout(300)
 assert any(x['table']=='addon_purchase_prices' and x['v']=={'addon_id':'shisha','cost_eur':150} for x in page.evaluate('writes'))
 page.screenshot(path='/tmp/m360-shisha-admin.png',full_page=True)
 # Glassware tab keeps its margin headers.
 page.click('.cat-tab[data-tab="glassware"]')
 heads=[h.text_content() for h in page.locator('th[data-purchase-header]').all()]
 assert heads==['Покупна цена / брой','Печалба / брой','Марж'], heads
 assert not errors, errors
 browser.close()
print('PASS shisha admin: own tab, placeholder flagged, rental price + stock save, payback + investment')
