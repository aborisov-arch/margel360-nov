"""Local browser regressions, no database writes."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1440,'height':900})
    page.route('https://**/*',lambda route:route.abort())
    page.goto('http://127.0.0.1:8767/blog/kak-da-izberete-zala-za-sabitie-v-sofia/',wait_until='networkidle')
    page.evaluate('window.scrollTo(0,500)')
    page.wait_for_timeout(250)
    page.evaluate('window.scrollTo(0,0)')
    page.wait_for_timeout(400)
    checks={
      'interior logo remains dark':page.locator('.nav').evaluate("e=>e.classList.contains('scrolled')"),
      'desktop article title reduced':page.locator('.blog-post h1').evaluate('e=>parseFloat(getComputedStyle(e).fontSize)<=36'),
    }
    page.set_viewport_size({'width':390,'height':844})
    checks['mobile title unchanged']=page.locator('.blog-post h1').evaluate('e=>getComputedStyle(e).fontSize')=='35.2px'
    page.add_script_tag(url='http://127.0.0.1:8767/js/blog-shared.js')
    page.evaluate("document.querySelector('#blog-article').innerHTML=MargelBlog.renderBody('- One\\n• Two\\n* Three\\n- <script>bad</script>')")
    checks['pasted bullet syntax']=page.locator('#blog-article li').count()==4
    checks['bullet markers visible']=page.locator('#blog-article ul').first.evaluate("e=>getComputedStyle(e).listStyleType==='disc'")
    checks['text remains escaped']=page.locator('#blog-article script').count()==0
    page.goto('http://127.0.0.1:8767/index.html',wait_until='networkidle')
    checks['homepage hero stays transparent']=not page.locator('.nav').evaluate("e=>e.classList.contains('scrolled')")
    page.evaluate('window.scrollTo(0,500)')
    page.wait_for_timeout(400)
    checks['homepage scrolled header opaque']=page.locator('.nav').evaluate("e=>e.classList.contains('scrolled')")
    for name,result in checks.items():print(name, 'PASS' if result else 'FAIL')
    browser.close()
    assert all(checks.values()),checks
