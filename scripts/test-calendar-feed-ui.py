"""Google Calendar card on admin/calendar.html with a mocked database (records RPC calls, never touches Supabase).
Start a static server for website/ on :8767, then: python3 scripts/test-calendar-feed-ui.py"""
import json
from datetime import datetime, timedelta, timezone
from playwright.sync_api import sync_playwright

FEED_BASE = 'https://wlxutsufrobzovdsiecb.supabase.co/functions/v1/calendar-feed?token='

# Stands in for js/supabase-client.js: same globals (SUPABASE_URL, db), but
# every call is answered locally. A pre-existing token row can be seeded
# through localStorage['qa_feed_row'] before the page loads.
stub = '''
const SUPABASE_URL='https://wlxutsufrobzovdsiecb.supabase.co';
window.rpcCalls=[];
let tokenSeq=0;
const seeded=localStorage.getItem('qa_feed_row');
window.feedRows=seeded?[JSON.parse(seeded)]:[];
const db={
 auth:{getSession:async()=>({data:{session:{user:{id:'u1',email:'qa@example.test'}}}})},
 rpc:async(name)=>{
  window.rpcCalls.push(name);
  if(name==='create_calendar_feed_token'){
   tokenSeq++;const t=String(tokenSeq).padStart(64,'0');
   window.feedRows=[{token_prefix:t.slice(0,8),created_at:new Date().toISOString(),last_fetched_at:null,fetch_count:0,revoked_at:null}];
   return {data:t,error:null};
  }
  if(name==='revoke_calendar_feed_token'){window.feedRows=[];return {data:true,error:null};}
  return {data:true,error:null};
 },
 from(table){
  const rows=()=>table==='calendar_feed_tokens'?window.feedRows:[];
  // 'error' = the status select answers {error}; 'throw' = it throws (simulated client fault)
  const mode=()=>window.feedSelectMode||localStorage.getItem('qa_feed_select')||'';
  const q=new Proxy({},{get(_,key){
   if(key==='then')return resolve=>Promise.resolve(resolve({data:rows(),error:null}));
   if(key==='maybeSingle')return async()=>{
    if(table==='calendar_feed_tokens'&&mode()==='throw')throw new Error('simulated client fault');
    if(table==='calendar_feed_tokens'&&mode()==='error')return {data:null,error:{message:'simulated select error'}};
    return {data:rows()[0]??null,error:null};};
   return ()=>q}});
  return q}};
window.db=db;
'''

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 900})
    context.grant_permissions(['clipboard-read', 'clipboard-write'], origin='http://127.0.0.1:8767')
    page = context.new_page()
    page.route('https://**/*', lambda r: r.abort())
    page.route('**/js/supabase-client.js*', lambda r: r.fulfill(body=stub, content_type='application/javascript'))
    page.add_init_script("localStorage.setItem('admin_lang','bg')")
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))

    # (a) no active URL -> create button; create -> URL shown once with the steps and the warning
    page.goto('http://127.0.0.1:8767/admin/calendar.html', wait_until='networkidle')
    page.wait_for_selector('#gcal-create')
    assert page.locator('#gcal-create').inner_text() == 'Създай адрес за абонамент'
    assert page.locator('#gcal-url').count() == 0
    page.locator('#gcal-create').click()
    page.wait_for_selector('#gcal-url')
    assert page.locator('#gcal-url').input_value() == FEED_BASE + '0' * 63 + '1'
    assert page.evaluate("window.rpcCalls.filter(n=>n==='create_calendar_feed_token').length") == 1
    assert page.locator('#gcal-steps li').count() == 3
    assert page.locator('#gcal-warn').is_visible()
    assert 'не го споделяйте' in page.locator('#gcal-warn').inner_text()
    page.locator('#gcal-copy').click()
    page.wait_for_selector('.toast:has-text("копиран")')
    assert page.evaluate('navigator.clipboard.readText()') == FEED_BASE + '0' * 63 + '1'

    # (b) later visit with an active row -> prefix + fetch status, no URL anywhere
    now = datetime.now(timezone.utc)
    page.evaluate("row => localStorage.setItem('qa_feed_row', row)", json.dumps({
        'token_prefix': 'abcd1234',
        'created_at': (now - timedelta(days=2)).isoformat(),
        'last_fetched_at': (now - timedelta(hours=3)).isoformat(),
        'fetch_count': 12,
        'revoked_at': None,
    }))
    page.reload(wait_until='networkidle')
    page.wait_for_selector('#gcal-rotate')
    status = page.locator('#gcal-status').inner_text()
    assert '…abcd1234' in status, status
    assert 'преди 3 ч' in status, status
    assert '12' in status, status
    assert page.locator('#gcal-url').count() == 0
    assert page.locator('#gcal-create').count() == 0

    # EN layer re-renders the dynamic card
    page.locator('.lang-btn[data-lang="en"]').click()
    page.wait_for_function("document.querySelector('#gcal-rotate').innerText.trim()==='Generate a new link'")
    assert '3 h ago' in page.locator('#gcal-status').inner_text()
    page.locator('.lang-btn[data-lang="bg"]').click()
    page.wait_for_function("document.querySelector('#gcal-rotate').innerText.trim()==='Генерирай нов адрес'")

    # (c) rotate -> confirm -> new token shown
    page.evaluate("window.confirm = () => true")
    page.locator('#gcal-rotate').click()
    page.wait_for_selector('#gcal-url')
    assert page.locator('#gcal-url').input_value() == FEED_BASE + '0' * 63 + '1'
    assert page.evaluate("window.rpcCalls.filter(n=>n==='create_calendar_feed_token').length") == 1

    # the fresh-URL state has no rotate/deactivate buttons - only the URL, steps and warning
    assert page.locator('#gcal-rotate').count() == 0
    assert page.locator('#gcal-revoke').count() == 0

    # (d) later visit -> deactivate -> back to the empty state
    page.reload(wait_until='networkidle')
    page.wait_for_selector('#gcal-revoke')
    page.evaluate("window.confirm = () => true")
    page.locator('#gcal-revoke').click()
    page.wait_for_selector('#gcal-create')
    assert page.evaluate("window.rpcCalls.filter(n=>n==='revoke_calendar_feed_token').length") == 1
    assert page.locator('#gcal-url').count() == 0

    # declined confirm -> nothing happens
    page.evaluate("localStorage.setItem('qa_feed_row', JSON.stringify({token_prefix:'abcd1234',created_at:new Date().toISOString(),last_fetched_at:null,fetch_count:0,revoked_at:null}))")
    page.reload(wait_until='networkidle')
    page.wait_for_selector('#gcal-rotate')
    assert 'все още не е изтеглян' in page.locator('#gcal-status').inner_text()
    page.evaluate("window.confirm = () => false")
    page.locator('#gcal-revoke').click()
    page.wait_for_timeout(200)
    assert page.locator('#gcal-rotate').count() == 1
    assert page.evaluate("window.rpcCalls.filter(n=>n==='revoke_calendar_feed_token').length") == 0

    # (e) a failed status reload right after minting must not hide the fresh URL
    page.evaluate("localStorage.removeItem('qa_feed_row')")
    page.reload(wait_until='networkidle')
    page.wait_for_selector('#gcal-create')
    page.evaluate("window.feedSelectMode='error'")
    page.locator('#gcal-create').click()
    page.wait_for_selector('#gcal-url')
    assert page.locator('#gcal-url').input_value() == FEED_BASE + '0' * 63 + '1'

    # (f) a throwing status load degrades the card only - the calendar grid still renders
    page.evaluate("localStorage.setItem('qa_feed_select','throw')")
    page.reload(wait_until='networkidle')
    page.wait_for_selector('#gcal-body .gcal-status')
    assert 'не може да се зареди' in page.locator('#gcal-body').inner_text()
    assert page.locator('#calendar-grid .cal-cell').count() > 20
    page.evaluate("localStorage.removeItem('qa_feed_select')")
    page.evaluate("localStorage.setItem('qa_feed_row', JSON.stringify({token_prefix:'abcd1234',created_at:new Date().toISOString(),last_fetched_at:null,fetch_count:0,revoked_at:null}))")

    # phone width: no horizontal overflow in either state
    for width in (320, 390):
        page.set_viewport_size({'width': width, 'height': 844})
        page.reload(wait_until='networkidle')
        page.wait_for_selector('#gcal-rotate')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), width
        page.evaluate("window.confirm = () => true")
        page.locator('#gcal-rotate').click()
        page.wait_for_selector('#gcal-url')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), ('with url', width)
    page.screenshot(path='/tmp/m360-gcal-card-phone.png', full_page=True)

    assert not errors, errors
    browser.close()
print('PASS calendar feed card: create shows the URL once, status shows prefix and last fetch, rotate/deactivate confirm, EN layer, phone width')
