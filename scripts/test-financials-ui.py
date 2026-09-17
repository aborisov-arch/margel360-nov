# Requires Python Playwright and Chromium. Start a static server for website/,
# then run: python3 scripts/test-financials-ui.py http://127.0.0.1:8765
# All database/auth calls are mocked; never writes business data.
from playwright.sync_api import sync_playwright
import json
import sys

fixture = {
 'enquiries': [], 'occupied_dates': [], 'financial_income_items': [], 'partners': [], 'partner_commission_rates': [], 'partner_commissions': [],
 'financial_events': [{'id':'11111111-1111-4111-8111-111111111111','month':'2026-09','event_date':'2026-09-01','customer_name':'QA Event','income_rent_eur':1000,'income_overtime_hours':3,'income_overtime_rate_eur':100,'income_overtime_eur':300,'pnl_drinks':[]}],
 'financial_expenses':[{'id':'22222222-2222-4222-8222-222222222222','event_id':'11111111-1111-4111-8111-111111111111','amount_eur':50,'category':'other','notes':'QA expense'}],
 'manager_monthly_pay':[], 'manager_event_overtime':[]
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
 page.route('**/js/catalog-db.js*',lambda route:route.fulfill(body='window.loadCatalog=async()=>{window.drinks=[];window.addonServices=[];};',content_type='application/javascript'))
 page.goto((sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8765')+'/admin/financials.html',wait_until='networkidle')
 page.locator('#fin-month').fill('2026-09');page.locator('#fin-month').dispatch_event('change')
 assert page.locator('#staff-allocations > h2').inner_text()=='Месечни разходи'
 assert page.locator('#staff-allocations #monthly-electricity').count()==1
 assert page.locator('.staff-group h3').all_inner_texts()==['Иван','Ели','Ток']
 page.locator('#staff-allocations').screenshot(path='/tmp/m360-monthly-expenses.png')
 page.locator('#manager-pay summary').click()
 assert page.locator('.finance-pie').count()==2
 assert page.locator('#sum-income-eur').inner_text()=='€1300.00'
 assert page.locator('[data-chart-total="income"]').inner_text()=='€1300.00'
 assert page.locator('[data-chart-total="expense"]').inner_text()=='€50.00'
 page.locator('#finance-charts').screenshot(path='/tmp/m360-donut-desktop.png')
 page.locator('[data-chart-cat="overtime"]').click()
 page.locator('#drill-modal [data-manual-fe]').click()
 assert page.locator('.finance-focus [data-fe-field="income_overtime_hours"]').input_value()=='3'
 page.locator('#income-cat-breakdown [data-cat="overtime"]').click()
 page.locator('#drill-modal [data-manual-fe]').click()
 assert page.locator('.finance-focus [data-fe-field="income_overtime_hours"]').input_value()=='3'
 assert page.locator('#event-manager-overtime').count()==0
 assert page.locator('#event-overtime-form').count()==0
 # Historical overtime remains counted even though its event editor was removed.
 page.evaluate("fixtures.manager_event_overtime=[{event_id:'11111111-1111-4111-8111-111111111111',manager_email:'qa@example.test',hours:3,rate_eur:20,register_hours:3}];managerOvertimeRows=fixtures.manager_event_overtime;renderManagerPay()")
 assert page.locator('#manager-pay-body .pay-match').inner_text()=='Съвпада'
 page.locator('#monthly-pay-form [name="wage_eur"]').fill('1000')
 page.locator('#monthly-pay-form [name="commission_eur"]').fill('100')
 page.locator('#monthly-pay-form button').click()
 page.wait_for_function('managerPayRows.length===1')
 assert '€1160.00' in page.locator('#manager-pay-body').inner_text()
 page.locator('#expense-cat-breakdown [data-cat="other"]').click()
 page.locator('#drill-modal [data-expense-id]').click()
 assert page.locator('.finance-focus [data-f="amount_eur"]').input_value()=='50'
 page.locator('#monthly-pay-form [name="wage_eur"]').fill('1234')
 page.evaluate('managerOvertimeRows[0].register_hours=2;renderManagerPay()')
 assert page.locator('#manager-pay-body .pay-mismatch').inner_text()=='1 ч.'
 assert page.locator('#monthly-pay-form [name="wage_eur"]').input_value()=='1234'
 page.screenshot(path='/tmp/m360-finance-desktop.png',full_page=True)
 page.set_viewport_size({'width':390,'height':844})
 page.wait_for_timeout(300)
 assert page.evaluate('document.documentElement.scrollWidth <= 390'), page.evaluate('document.documentElement.scrollWidth')
 page.screenshot(path='/tmp/m360-finance-mobile.png',full_page=True)
 page.locator('#finance-charts').screenshot(path='/tmp/m360-donut-mobile.png')
 page.locator('#fin-month').fill('2099-02');page.locator('#fin-month').dispatch_event('change')
 assert page.locator('[data-chart-total="income"]').inner_text()=='€0.00'
 assert page.locator('.finance-chart-empty').count()==2
 assert page.locator('#finance-charts svg circle').count()==2
 page.evaluate('renderFinanceCharts({rent:100,overtime:-20},{other:10})')
 assert page.locator('[data-chart-total="income"]').inner_text()=='€80.00'
 assert 'корекция' in page.locator('[data-chart-cat="overtime"]').inner_text()
 assert page.locator('#finance-charts svg circle').count()==4
 page.evaluate("monthFilter='2026-09'; expensesByEvent.get('11111111-1111-4111-8111-111111111111').push({id:'correction',category:'other',amount_eur:-20});renderMonthSummary();openCategoryBreakdown('expense','other')")
 assert page.locator('[data-chart-total="expense"]').inner_text()=='€30.00'
 assert page.locator('#drill-modal [data-expense-id]').count()==2
 page.evaluate('closeDrill();renderMonthSummary()')
 page.locator('#electricity-form [name="amount_eur"]').fill('200')
 page.locator('#electricity-form [name="reference"]').fill('QA invoice')
 page.locator('#electricity-form button').click()
 page.wait_for_function('electricityRows.length===1')
 assert page.locator('#sum-expense-eur').inner_text()=='€230.00'
 assert page.locator('#sum-profit-eur').inner_text()=='€1070.00'
 assert page.locator('[data-chart-total="expense"]').inner_text()=='€230.00'
 page.locator('[data-chart-cat="utilities"]').click()
 assert page.locator('[data-electricity-month]').count()==1
 page.locator('[data-electricity-month]').click()
 assert page.locator('#monthly-electricity.finance-focus').count()==1
 page.evaluate("openMetricBreakdown('profit')")
 assert '€1070.00' in page.locator('#drill-body').inner_text()
 page.evaluate("closeDrill();electricityError=true;openMetricBreakdown('expense')")
 assert page.locator('#drill-modal').is_hidden()
 page.evaluate("openCategoryBreakdown('expense','utilities')")
 assert page.locator('#drill-modal').is_hidden()
 page.evaluate('electricityError=false;renderMonthSummary()')
 assert page.locator('[data-staff-category]').count()==6
 assert 'Не е зададена' in page.locator('[data-staff-category="ivan_salary"]').inner_text()
 page.locator('#staff-allocation-form [name="category"]').select_option('ivan_fee')
 page.locator('#staff-allocation-form [name="event"]').select_option('11111111-1111-4111-8111-111111111111')
 page.locator('#staff-allocation-form button').click()
 page.wait_for_function("fixtures.financial_expenses.some(r=>r.category==='ivan_fee')")
 assert page.locator('#pnl-expense-lines li:last-child select').input_value()=='ivan_fee'
 page.locator('#pnl-expense-lines li:last-child [data-f="amount_eur"]').fill('80')
 page.locator('#pnl-expense-lines li:last-child [data-f="amount_eur"]').dispatch_event('change')
 page.locator('#btn-save-pnl').click()
 page.wait_for_function("fixtures.financial_expenses.some(r=>r.category==='ivan_fee' && Number(r.amount_eur)===80)")
 assert '€80.00' in page.locator('[data-staff-category="ivan_fee"]').inner_text()
 assert page.locator('#sum-expense-eur').inner_text()=='€310.00'
 page.locator('[data-staff-category="ivan_fee"] button').click()
 assert '€80.00' in page.locator('#drill-body').inner_text()
 page.evaluate('closeDrill()')
 page.locator('#staff-allocations').screenshot(path='/tmp/m360-staff-allocations.png')
 assert page.evaluate('document.documentElement.scrollWidth <= 390')
 page.locator('#btn-add-drink-manual').click()
 page.locator('[data-drink-f="name"]').fill('QA bottle')
 page.locator('[data-drink-f="unit_price_eur"]').fill('40')
 page.locator('[data-drink-f="qty"]').fill('3')
 assert page.locator('#pnl-net-eur').inner_text()=='Непълни данни'
 page.locator('[data-bottle-cost="0"]').fill('20')
 assert '€60.00' in page.locator('#bottle-cost-summary').inner_text()
 page.locator('#btn-save-pnl').click()
 page.wait_for_function("financialEventsById.get('11111111-1111-4111-8111-111111111111').pnl_drinks.length===1")
 assert page.locator('#sum-expense-eur').inner_text()=='€370.00'
 assert page.locator('#sum-profit-eur').inner_text()=='€1050.00'
 page.locator('#finance-charts [data-chart-cat="drinks"][data-chart-kind="expense"]').click()
 page.locator('[data-bottle-event]').click()
 assert page.locator('#pnl-drinks-lines.finance-focus').count()==1
 page.evaluate("const fe=financialEventsById.get('11111111-1111-4111-8111-111111111111');fe.pnl_drinks[0].manual=false;fe.pnl_drinks[0].id='qa-bottle';drinkCatalogById.set('qa-bottle',{id:'qa-bottle',name_bg:'QA bottle',price_eur:50});drinkPurchasePrices.set('qa-bottle',30)")
 page.wait_for_function("drinkPurchasePrices.get('qa-bottle')===30")
 assert page.evaluate("eventBottleCost(currentSelection().fe).cost") == 60
 assert page.evaluate("savedDrinksTotal(currentSelection().fe)") == 120
 page.locator('[data-bottle-cost="0"]').fill('')
 page.locator('#btn-save-pnl').click()
 page.wait_for_function("eventBottleCost(currentSelection().fe).missing===1")
 assert page.locator('#sum-profit-eur').inner_text()=='Непълни данни'
 page.locator('[data-bottle-cost="0"]').fill('0')
 page.locator('#btn-save-pnl').click()
 page.wait_for_function("eventBottleCost(currentSelection().fe).missing===0")
 assert page.locator('#sum-profit-eur').inner_text()=='€1110.00'
 page.evaluate("expensesByEvent.get(currentSelection().fe.id).push({id:'bottle-manual-cost',category:'drinks',amount_eur:60});renderDetail()")
 page.locator('#bottle-cost-manual').check()
 page.locator('#btn-save-pnl').click()
 page.wait_for_function("currentSelection().fe.drinks_cost_in_expenses===true")
 assert page.locator('#sum-expense-eur').inner_text()=='€370.00'
 assert page.locator('#sum-profit-eur').inner_text()=='€1050.00'
 assert not errors,errors
 page.evaluate("financialEventsById.set('correction-event',{id:'correction-event',month:'2026-09',event_date:'2026-09-02',customer_name:'Correction QA',pnl_drinks:[]});expensesByEvent.set('correction-event',[{id:'negative-expense',category:'other',amount_eur:-25}]);renderMonthSummary();openMetricBreakdown('expense')")
 assert page.locator('#sum-expense-eur').inner_text()=='€345.00'
 assert '€345.00' in page.locator('#drill-body').inner_text()
 page.evaluate('closeDrill()')
 page.locator('#bottle-cost-summary').screenshot(path='/tmp/m360-bottle-profit.png')
 page.evaluate("window.__saveGate=new Promise(resolve=>window.__releaseSave=resolve);dirtyFe={income_rent_eur:100};window.__savePromise=saveDraft();void 0")
 assert page.evaluate('pnlSaving')
 assert page.locator('.event-pnl').evaluate('(el)=>el.inert')
 page.evaluate("dirtyFe.income_rent_eur=200;selectManual('correction-event')")
 assert page.evaluate('currentSelection().fe.id')=='11111111-1111-4111-8111-111111111111'
 page.evaluate('window.__releaseSave();window.__savePromise')
 assert page.evaluate('currentSelection().fe.income_rent_eur')==100
 assert page.evaluate('dirtyFe.income_rent_eur')==200
 assert not page.evaluate('pnlSaving')
 assert not page.locator('.event-pnl').evaluate('(el)=>el.inert')
 print('PASS charts, income/expense drilldowns, highlighted lines, payroll save/total, overtime match/mismatch, mobile render; no JS exceptions')
 browser.close()
