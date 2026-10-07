"""Посуда cost of goods on the finance page, mocked database (never writes business data).
Start a static server for website/ on :8765, then: python3 scripts/test-glassware-pnl.py"""
from playwright.sync_api import sync_playwright
import json

EV='33333333-3333-4333-8333-333333333333'
fixture = {
 'enquiries': [{'id':'enq-1','enquiry_number':7,'full_name':'Глас Клиент','preferred_date':'05/09/2026','event_type':'Evening Event','event_id':'evening','pipeline_status':'completed','guests':40,
   'addons':[{'id':'glass-wine','name':'Wine glass','name_bg':'Чаша за вино','price':40,'qty':50,'category':'glassware'},
             {'id':'glass-flute','name':'Flute','name_bg':'Чаша за шампанско','price':20,'qty':20,'category':'glassware'},
             {'id':'dj','name':'DJ','price':300}],'drinks':[]}],
 'occupied_dates': [], 'financial_income_items': [], 'partners': [], 'partner_commission_rates': [], 'partner_commissions': [],
 'financial_events': [{'id':EV,'enquiry_id':'enq-1','month':'2026-09','event_date':'2026-09-05','customer_name':'Глас Клиент','income_rent_eur':1000,'income_addons_eur':360,'pnl_drinks':[]}],
 'financial_expenses':[], 'manager_monthly_pay':[], 'manager_event_overtime':[],
 'monthly_electricity':[{'month':'2026-09-01','amount_eur':0,'reference':'-'}],
 'addon_purchase_prices':[{'addon_id':'glass-wine','cost_eur':0.3}],
}
stub = 'const fixtures='+json.dumps(fixture)+';'+'''
const db={auth:{getSession:async()=>({data:{session:{user:{email:'qa@example.test'}}}}),signOut:async()=>({})},rpc:async()=>({data:true}),from(table){const q={select(){return q},not(){return q},eq(key,value){q.key=key;q.value=value;return q},order(){return q},insert(value){q.inserted={id:crypto.randomUUID(),...value};fixtures[table].push(q.inserted);return q},single(){return Promise.resolve({data:q.inserted,error:null})},update(value){q.patch=value;return q},upsert(value){fixtures[table]=[value];return Promise.resolve({error:null})},then(resolve){return (q.patch&&window.__saveGate?window.__saveGate:Promise.resolve()).then(()=>{if(q.patch)(fixtures[table]||[]).filter(r=>r[q.key]===q.value).forEach(r=>Object.assign(r,q.patch));return resolve({data:fixtures[table]||[],error:null})})}};return q}};
'''
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 page=browser.new_page(viewport={'width':1440,'height':1000})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/js/supabase-client.js*',lambda route:route.fulfill(body=stub,content_type='application/javascript'))
 page.route('**/js/catalog-db.js*',lambda route:route.fulfill(body="window.loadCatalog=async()=>{window.drinks=[];window.addonServices=[{id:'glass-wine',category:'glassware',name_bg:'Чаша за вино',price:0.8},{id:'glass-flute',category:'glassware',name_bg:'Чаша за шампанско',price:1}];};",content_type='application/javascript'))
 import sys
 page.goto((sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8765')+'/admin/financials.html',wait_until='networkidle')
 page.locator('#fin-month').fill('2026-09');page.locator('#fin-month').dispatch_event('change')
 # 50 wine glasses x €0.30 counted; flutes have no purchase price yet.
 cost=page.evaluate(f"eventGlasswareCost(financialEventsById.get('{EV}'))")
 assert cost['auto']==15 and cost['missing']==1 and cost['pieces']==70, cost
 assert page.locator('#sum-expense-eur').inner_text()=='€15.00'
 assert page.locator('[data-chart-cat="glassware"][data-chart-kind="expense"]').count()==1
 assert 'Чаша за шампанско' not in page.locator('#finance-gaps').inner_text()
 assert 'липсва покупна цена за 1 вид посуда' in page.locator('#finance-gaps').inner_text()
 # Category drilldown lists the event's glassware cost.
 page.evaluate("openCategoryBreakdown('expense','glassware')")
 assert '€15.00' in page.locator('#drill-body').inner_text() and '70 бр.' in page.locator('#drill-body').inner_text()
 page.locator('#drill-body [data-glassware-event]').click()
 note=page.locator('#event-glassware-expense')
 assert note.is_visible() and '€15.00' in note.inner_text() and 'Чаша за вино × 50' in note.inner_text(), note.inner_text()
 assert page.locator('#pnl-expense-total').inner_text()=='€15.00'
 # The automatic category is never offered for manual expense rows.
 page.locator('#btn-add-event-expense').click()
 assert page.locator('#pnl-expense-lines select option[value="glassware"]').count()==0
 # Setting the flute price completes the cost: 15 + 20 x 0.50.
 page.evaluate("addonPurchasePrices.set('glass-flute',0.5);renderMonthSummary();updateDetailTotals()")
 assert page.evaluate(f"eventGlasswareCost(financialEventsById.get('{EV}')).auto")==25
 assert page.locator('#finance-gaps').is_hidden() or 'посуда' not in page.locator('#finance-gaps').inner_text()
 assert not errors, errors
 browser.close()
print('PASS glassware P&L: cost of goods in event and month expenses, category drilldown, missing-price gap, no manual category')
