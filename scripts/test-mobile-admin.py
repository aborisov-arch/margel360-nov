"""Shared admin phone layout smoke checks; all backend calls are mocked."""
from playwright.sync_api import sync_playwright

stub='''
const demo={enquiries:[{id:'demo',enquiry_number:1,full_name:'Тестов клиент с дълго име',email:'test@example.test',phone:'+359000000000',preferred_date:'01/09/2026',event_type:'Събитие',created_at:'2026-09-01T12:00:00Z',status:'confirmed',guests:50,addons:[],drinks:[]}],drinks:[{id:'demo',name_bg:'Бутилка с дълго име за проверка',name_en:'Demo bottle',cat:2,price_eur:80,active:true}],drink_purchase_prices:[{drink_id:'demo',cost_eur:40}]};
const db={auth:{getSession:async()=>({data:{session:{user:{email:'qa@example.test'}}}})},rpc:async()=>({data:true}),functions:{invoke:async()=>({data:{users:[]},error:null})},from(table){const q=new Proxy({},{get(_,key){if(key==='then')return resolve=>Promise.resolve(resolve({data:demo[table]||[],count:(demo[table]||[]).length,error:null}));return ()=>q}});return q}};
'''
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 page=browser.new_page(viewport={'width':390,'height':844})
 page.route('https://**/*',lambda r:r.abort())
 page.route('**/js/supabase-client.js*',lambda r:r.fulfill(body=stub,content_type='application/javascript'))
 page.add_init_script("localStorage.setItem('admin_lang','bg')")
 for width in [320,390,768]:
  page.set_viewport_size({'width':width,'height':844})
  for route in ['dashboard','customers','catalog','calendar','blog','partners','marketing','content','activity','users']:
   errors=[]
   def onerror(error):errors.append(str(error))
   page.on('pageerror',onerror)
   page.goto('http://127.0.0.1:8767/admin/'+route+'.html',wait_until='networkidle')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(route,width,page.evaluate("Array.from(document.querySelectorAll('.admin-main *')).filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+1&&getComputedStyle(e).position!=='absolute'}).slice(0,15).map(e=>[e.tagName,e.className,e.id,e.getBoundingClientRect().right])"))
   assert not errors,(route,width,errors)
   if route=='dashboard':
    assert page.locator('.enquiries-table tbody tr').first.locator('td').nth(1).is_visible()
    assert page.locator('.enquiries-table tbody tr').first.locator('td').nth(4).is_visible()
    page.locator('.btn-expand').first.click()
    assert page.locator('#detail-demo').is_visible()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),('expanded enquiry',width)
   if route=='catalog' and width==390:
    assert page.locator('.admin-records td[data-label="Покупна цена / бутилка"]').count()==1
    page.screenshot(path='/tmp/m360-catalog-phone.png',full_page=True)
   if route=='blog':
    page.locator('#blg-add-btn').click()
    assert page.locator('#blg-body-bg').evaluate('e=>e.getBoundingClientRect().right<=innerWidth'),width
   page.remove_listener('pageerror',onerror)
 browser.close()
 print('PASS admin mobile: 10 pages at 320/390/768px, catalog labels and blog editor')
