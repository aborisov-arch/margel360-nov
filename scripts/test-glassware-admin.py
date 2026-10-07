"""Admin catalog Посуда tab with a mocked database (records writes, never touches Supabase).
Start a static server for website/ on :8767, then: python3 scripts/test-glassware-admin.py"""
from playwright.sync_api import sync_playwright

stub='''
const demo={drinks:[],addon_services:[
 {id:'dj',name_bg:'DJ',name_en:'DJ',price_eur:300,active:true,sort_order:1,category:'service'},
 {id:'glass-wine',name_bg:'Чаша за вино',name_en:'Wine glass',price_eur:0.8,max_qty:999,active:true,sort_order:1,category:'glassware'}],
 drink_purchase_prices:[],addon_purchase_prices:[{addon_id:'glass-wine',cost_eur:0.3}]};
window.writes=[];
const db={auth:{getSession:async()=>({data:{session:{user:{email:'qa@example.test'}}}})},rpc:async()=>({data:true}),
 storage:{from(){return {getPublicUrl:()=>({data:{publicUrl:''}}),upload:async()=>({error:null}),remove:async()=>({error:null})}}},
 from(table){const q=new Proxy({},{get(_,key){
  if(key==='then')return resolve=>Promise.resolve(resolve({data:demo[table]||[],error:null}));
  if(['insert','update','upsert'].includes(key))return v=>{writes.push({table,op:key,v});if(key==='insert')demo[table].push(v);return q};
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
 page.locator('.cat-tab[data-tab="services"]').click()
 assert page.locator('#catalog-body tr').count()==1                        # glassware not under Услуги
 page.locator('.cat-tab[data-tab="glassware"]').click()
 assert page.locator('#catalog-body tr').count()==1
 assert 'Чаша за вино' in page.locator('#catalog-body').inner_text()
 assert page.locator('[data-purchase-header]').first.text_content()=='Покупна цена / брой'
 assert page.locator('[data-purchase-input="glass-wine"]').input_value()=='0.3'
 assert '€0.50' in page.locator('[data-purchase-profit="glass-wine"]').inner_text()   # 0.80 - 0.30
 assert page.locator('#cat-add-btn').inner_text()=='Добави посуда'
 # Add a new glassware item: per piece is implicit, no qty checkbox or free pieces.
 page.locator('#cat-add-btn').click()
 assert not page.locator('#cf-qty-toggle').is_visible()
 assert not page.locator('#cf-free-until-group').is_visible()
 assert page.locator('#cf-price-label').inner_text()=='Продажна цена на брой (EUR)'
 page.locator('#cf-name-bg').fill('Чаша за шампанско')
 page.locator('#cf-name-en').fill('Champagne flute')
 page.locator('#cf-price').fill('1.2')
 page.locator('#cf-save').click()
 page.wait_for_function("writes.some(w=>w.table==='addon_services'&&w.op==='insert')")
 row=page.evaluate("writes.find(w=>w.table==='addon_services'&&w.op==='insert').v")
 assert row['category']=='glassware' and row['max_qty']==999 and row['free_until'] is None and row['price_eur']==1.2, row
 # Purchase cost saves to the private addon_purchase_prices table.
 page.locator('[data-purchase-input="glass-wine"]').fill('0.35')
 page.locator('[data-purchase-save="glass-wine"]').click()
 page.wait_for_function("writes.some(w=>w.table==='addon_purchase_prices')")
 assert page.evaluate("writes.find(w=>w.table==='addon_purchase_prices').v")=={'addon_id':'glass-wine','cost_eur':0.35}
 page.screenshot(path='/tmp/m360-glassware-admin.png',full_page=True)
 # Services tab keeps its qty checkbox.
 page.locator('.cat-tab[data-tab="services"]').click()
 page.locator('#cat-add-btn').click()
 assert page.locator('#cf-qty-toggle').is_visible()
 assert not errors, errors
 browser.close()
print('PASS glassware admin: own tab, per-piece form, category saved, private purchase cost and margin')
