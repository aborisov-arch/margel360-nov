"""Run against the isolated local catalog preview, never production."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width':1440,'height':900})
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto('http://127.0.0.1:8766/admin/catalog.html',wait_until='networkidle')
    field=page.locator('[data-purchase-input="demo-whisky"]')
    field.fill('20')
    assert page.locator('[data-purchase-margin="demo-whisky"]').inner_text()=='75.0%'
    assert page.locator('[data-purchase-profit="demo-whisky"]').inner_text()=='€60.00'
    page.locator('[data-purchase-save="demo-whisky"]').click()
    page.wait_for_function("catalogCosts.prices.get('demo-whisky')===20")
    assert page.evaluate("rows.drinks[0].price_eur")==80
    page.evaluate('window.failSave=true')
    field.fill('25')
    page.locator('[data-purchase-save="demo-whisky"]').click()
    page.wait_for_function('catalogCosts.saving.size===0')
    assert field.input_value()=='25'
    assert page.evaluate("catalogCosts.prices.get('demo-whisky')")==20
    page.locator('[data-tab="services"]').click()
    assert page.locator('[data-purchase-header]:visible').count()==0
    page.locator('[data-tab="drinks"]').click()
    assert field.input_value()=='25'
    assert page.evaluate("catalogMargin(0,20).margin")=='—'
    assert page.evaluate("catalogMargin(80,0).margin")=='100.0%'
    assert page.evaluate("catalogMargin(80,'').margin")=='—'
    page.screenshot(path='/tmp/m360-catalog-desktop.png',full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth<=390')
    page.screenshot(path='/tmp/m360-catalog-mobile.png',full_page=True)
    restricted=browser.new_page()
    restricted.add_init_script('window.noFinance=true')
    restricted.goto('http://127.0.0.1:8766/admin/catalog.html',wait_until='networkidle')
    assert restricted.locator('[data-purchase-input]').count()==0
    assert restricted.evaluate('window.privateReads||0')==0
    assert not errors, errors
    browser.close()
    print('PASS: catalog margin, private save, failure recovery, tab drafts, role gate, mobile layout')
