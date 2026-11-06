"""End-to-end tests (Playwright/Chromium). External services are MOCKED via request interception, so these tests
verify EstateIQ's behaviour, not the live availability of OpenStreetMap services.
Usage: npm run build && python3 e2e/run_e2e.py
"""
import http.server, json, os, shutil, socketserver, subprocess, sys, tempfile, threading, functools
from playwright.sync_api import sync_playwright, expect

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')
SUB = 'estateiq-repo'  # simulate https://user.github.io/estateiq-repo/
site = tempfile.mkdtemp()
shutil.copytree(DIST, os.path.join(site, SUB))

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
Handler = functools.partial(Q, directory=site)
httpd = socketserver.TCPServer(('127.0.0.1', 0), Handler)
PORT = httpd.server_address[1]
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{PORT}/{SUB}/'

SUPER = [{"lat": "22.7983", "lon": "75.8650", "display_name": "Super Corridor, Indore, Madhya Pradesh, India",
          "address": {"suburb": "Super Corridor", "city": "Indore", "state": "Madhya Pradesh", "postcode": "453331", "country": "India"}}]
OVERPASS = {"elements": [
    {"type": "node", "id": 1, "lat": 22.800, "lon": 75.866, "tags": {"amenity": "school", "name": "Test Public School"}},
    {"type": "node", "id": 2, "lat": 22.797, "lon": 75.862, "tags": {"amenity": "hospital", "name": "Test Hospital"}},
    {"type": "node", "id": 3, "lat": 22.801, "lon": 75.870, "tags": {"highway": "bus_stop", "name": "Corridor Stop"}},
    {"type": "node", "id": 4, "lat": 22.82, "lon": 75.9, "tags": {"railway": "station", "name": "Test Station"}}]}
CSV = ("A,transaction,4000,1500,0.5,{d1},Registered deed seen\nB,asking,4100,1500,0.9,{d2},Listing seen\nC,asking,3950,1200,1.4,{d3},Listing seen\n"
       "D,transaction,4050,1500,1.8,{d4},Registered deed seen\nE,asking,4020,1800,2.2,{d5},Listing seen")

results = []
def check(name, fn):
    try:
        fn(); results.append((name, True, ''))
        print(f'PASS  {name}')
    except Exception as e:  # noqa
        results.append((name, False, str(e)[:400])); print(f'FAIL  {name}: {str(e)[:400]}')

import datetime
today = datetime.date.today()
d = lambda n: (today - datetime.timedelta(days=n)).isoformat()
CSV = CSV.format(d1=d(30), d2=d(10), d3=d(40), d4=d(60), d5=d(20))

def setup_routes(ctx, search=SUPER, reverse=None, overpass=OVERPASS, fail_market=True):
    def nominatim(route):
        u = route.request.url
        if '/reverse' in u:
            body = reverse or {"lat": "22.7", "lon": "75.8", "display_name": "Reverse Locality, Indore, Madhya Pradesh", "address": {"suburb": "Reverse Locality", "city": "Indore", "state": "Madhya Pradesh", "postcode": "452010"}}
            route.fulfill(status=200, content_type='application/json', body=json.dumps(body))
        else:
            route.fulfill(status=200, content_type='application/json', body=json.dumps(search))
    ctx.route('**/nominatim.openstreetmap.org/**', nominatim)
    ctx.route('**/overpass*/**', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(overpass)))
    ctx.route('**/tile.openstreetmap.org/**', lambda r: r.abort())
    ctx.route('**/fonts.g*apis.com/**', lambda r: r.abort())
    ctx.route('**/market.invalid/**', lambda r: r.abort())

def fill_location(page):
    page.get_by_test_id('addr-search').fill('Super Corridor, Indore')
    page.get_by_test_id('addr-search-btn').click()
    page.get_by_test_id('geo-results').locator('button').first.click()

def advance_to_end(page):
    for _ in range(6):
        page.wait_for_timeout(200)
        if page.get_by_test_id('run-analysis').is_visible(): return
        page.get_by_test_id('next').click()
    raise AssertionError('never reached final wizard step')

def go_to_details(page):
    page.get_by_test_id('next').click()            # -> type
    page.get_by_test_id('type-plot').click()
    page.get_by_test_id('next').click()            # -> details

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={'width': 1280, 'height': 900}, accept_downloads=True)
    setup_routes(ctx)
    failed_requests = []
    page = ctx.new_page()
    page.on('requestfailed', lambda r: failed_requests.append(r.url) if '127.0.0.1' in r.url else None)
    page.on('pageerror', lambda e: failed_requests.append('PAGEERROR ' + str(e)))
    page.goto(BASE); page.wait_for_load_state('networkidle')

    def t10_subpath():
        expect(page.get_by_text('Know the value.')).to_be_visible()
        page.get_by_test_id('start').click()
        expect(page).to_have_url(BASE + '#/analyze')
        expect(page.get_by_role('heading', name='Analyse a property')).to_be_visible()
    check('TEST 10 subpath deploy: app loads and navigates under /estateiq-repo/', t10_subpath)

    def t3():
        fill_location(page)
        expect(page.get_by_test_id('selected-location')).to_contain_text('22.798300, 75.865000')
        expect(page.get_by_test_id('selected-location')).to_contain_text('Super Corridor')
        expect(page.locator('.eiq-pin')).to_have_count(1)
        expect(page.locator('#locality')).to_have_value('Super Corridor')
    check('TEST 3 search Super Corridor, Indore -> marker + coordinates', t3)

    def t4():
        box = page.get_by_test_id('map').bounding_box()
        page.mouse.click(box['x'] + box['width'] * 0.25, box['y'] + box['height'] * 0.75)
        expect(page.get_by_test_id('geo-status')).to_contain_text('Location updated from the marker')
        lat = page.locator('#lat').input_value()
        assert lat != '22.798300', lat
        expect(page.locator('#locality')).to_have_value('Reverse Locality')
        expect(page.locator('#pin')).to_have_value('452010')
    check('TEST 4 moving the marker updates coordinates + location info', t4)

    def t5():
        ctx2 = browser.new_context(viewport={'width': 1280, 'height': 900}); setup_routes(ctx2, search=[])
        pg = ctx2.new_page(); pg.goto(BASE + '#/analyze'); pg.wait_for_load_state('networkidle')
        pg.get_by_test_id('addr-search').fill('zzzzzz nowhere 000000'); pg.get_by_test_id('addr-search-btn').click()
        expect(pg.get_by_test_id('geo-status')).to_contain_text('No matching location found')
        expect(pg.get_by_role('heading', name='Analyse a property')).to_be_visible()
        ctx2.close()
    check('TEST 5 invalid address -> useful message, no crash', t5)

    def t12():
        page.get_by_test_id('next').click()
        page.get_by_test_id('type-plot').click(); page.get_by_test_id('next').click()
        page.locator('#area').fill('1500'); page.locator('#rate').fill('4500')
        expect(page.get_by_test_id('base-price-value')).to_have_text('₹67,50,000')
        page.locator('#area').fill('1200'); page.locator('#rate').fill('5000')
        expect(page.get_by_test_id('base-price-value')).to_have_text('₹60,00,000')
        page.locator('#area').fill('1500'); page.locator('#rate').fill('4500')
        expect(page.get_by_test_id('base-price-value')).to_have_text('₹67,50,000')
    check('TEST 1+2 base price 1,500x4,500=₹67,50,000 and 1,200x5,000=₹60,00,000 in the UI', t12)

    def t6():
        # configure an unreachable market endpoint, then run with no comparables
        page.get_by_role('link', name='Settings').click()
        page.get_by_test_id('market-endpoint').fill('https://market.invalid/api')
        page.get_by_role('link', name='Analyse').click()
        advance_to_end(page)
        page.get_by_test_id('run-analysis').click()
        expect(page.get_by_test_id('verdict')).to_be_visible(timeout=60000)
        expect(page.get_by_test_id('preliminary-banner')).to_contain_text('PRELIMINARY')
        expect(page.get_by_text('Market-data endpoint problem')).to_be_visible()
        expect(page.get_by_test_id('verdict')).to_have_text('HOLD')
        expect(page.get_by_text('Not estimated')).to_be_visible()
    check('TEST 6 market API fails -> graceful, labelled preliminary report', t6)

    def t7():
        # new analysis with real-looking (mock) comparables via CSV, then PDF
        page.get_by_role('link', name='Reports').click(); page.get_by_role('link', name='Settings').click()
        page.get_by_test_id('market-endpoint').fill('')
        page.get_by_role('link', name='Analyse').click()
        expect(page.get_by_role('heading', name='Analyse a property')).to_be_visible()
        # edit inputs retains draft; go to step 5
        advance_to_end(page)
        page.get_by_text('Paste many comparables (CSV)').click()
        page.get_by_label('Comparables CSV').fill(CSV)
        page.get_by_role('button', name='Import').click()
        expect(page.get_by_text('5 imported')).to_be_visible()
        page.locator('#gl').fill('2500')
        page.get_by_test_id('run-analysis').click()
        expect(page.get_by_test_id('verdict')).to_be_visible(timeout=60000)
        expect(page.get_by_test_id('verdict')).not_to_have_text('BUY')
        with page.expect_download() as dl:
            page.get_by_test_id('download-pdf').click()
        path = os.path.join(tempfile.gettempdir(), 'eiq.pdf'); dl.value.save_as(path)
        txt = subprocess.run(['pdftotext', '-layout', path, '-'], capture_output=True, text=True).stdout
        for needle in ['PROPERTY INTELLIGENCE REPORT', 'Rs 67,50,000', 'Executive summary', 'Legal due-diligence checklist', 'Disclaimer', 'Confidence score and methodology', 'Data sources and timestamps', 'Rs 37,50,000']:
            assert needle in txt, f'missing in PDF: {needle}'
        pages = subprocess.run(['pdfinfo', path], capture_output=True, text=True).stdout
        print('      PDF info:', [l for l in pages.splitlines() if l.startswith('Pages')])
    check('TEST 7 PDF downloads with correct details and calculations', t7)

    def t_legal():
        page.get_by_role('tab', name='Legal').click()
        sel = page.locator('#st-title'); sel.select_option('document_available')
        page.get_by_role('tab', name='Overview').click()
        expect(page.get_by_text('critical legal checks are not yet verified')).to_be_visible()
        assert page.get_by_test_id('verdict').inner_text() != 'BUY'
    check('Legal: unresolved critical checks block BUY and are shown prominently', t_legal)

    def t8():
        url = page.url
        page.reload(); page.wait_for_load_state('networkidle')
        expect(page).to_have_url(url)
        expect(page.get_by_test_id('verdict')).to_be_visible()
        page.get_by_role('link', name='Reports').click()
        expect(page.get_by_test_id('reports-list').locator('li')).to_have_count(2)
        page.get_by_test_id('reports-list').locator('li').first.get_by_role('button', name='Open').click()
        expect(page.get_by_test_id('verdict')).to_be_visible()
    check('TEST 8 refresh keeps saved analysis; reports history reopens', t8)

    def t_loc():
        page.get_by_role('tab', name='Location').click()
        expect(page.get_by_text('Test Public School').first).to_be_visible()
        expect(page.get_by_text('not assessed').first).to_be_visible()
        page.get_by_role('tab', name='Valuation').click()
        expect(page.get_by_test_id('comp-table')).to_contain_text('Registered deed seen')
    check('Location intelligence + comparable evidence render', t_loc)
    ctx.close()

    def t9():
        m = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True); setup_routes(m)
        pg = m.new_page(); pg.goto(BASE); pg.wait_for_load_state('networkidle')
        def no_hscroll(label):
            w = pg.evaluate('document.documentElement.scrollWidth'); assert w <= 392, f'horizontal overflow {w}px on {label}'
        no_hscroll('landing'); pg.get_by_test_id('start').click(); no_hscroll('step1')
        pg.get_by_test_id('addr-search').fill('Super Corridor, Indore'); pg.get_by_test_id('addr-search-btn').click()
        pg.get_by_test_id('geo-results').locator('button').first.click()
        pg.get_by_test_id('next').click(); pg.get_by_test_id('type-plot').click(); no_hscroll('step2')
        pg.get_by_test_id('next').click(); pg.locator('#area').fill('1500'); pg.locator('#rate').fill('4500'); no_hscroll('step3')
        expect(pg.get_by_test_id('base-price-value')).to_have_text('₹67,50,000')
        pg.get_by_test_id('next').click(); no_hscroll('vastu'); pg.get_by_test_id('next').click(); no_hscroll('step5')
        pg.get_by_test_id('run-analysis').click(); expect(pg.get_by_test_id('verdict')).to_be_visible(timeout=60000); no_hscroll('results')
        for t in ['Valuation', 'Costs', 'Location', 'Vastu', 'Legal', 'Risks', 'Sources']:
            pg.get_by_role('tab', name=t).click(); no_hscroll(t)
        pg.screenshot(path=os.path.join(ROOT, 'e2e', 'mobile-results.png'))
        m.close()
    check('TEST 9 mobile (390px): full workflow usable, no horizontal overflow', t9)

    # desktop screenshots for the record
    d2 = browser.new_context(viewport={'width': 1360, 'height': 900}); setup_routes(d2)
    pg = d2.new_page(); pg.goto(BASE); pg.wait_for_load_state('networkidle'); pg.screenshot(path=os.path.join(ROOT, 'e2e', 'desktop-landing.png'))
    d2.close()
    browser.close()

bad = [u for u in failed_requests if 'market.invalid' not in u and 'googleapis' not in u and 'gstatic' not in u and 'tile.openstreetmap' not in u]
print('Unexpected failed same-origin requests / page errors:', bad or 'none')
ok = all(r[1] for r in results) and not bad
print(f"\n{sum(1 for r in results if r[1])}/{len(results)} e2e checks passed")
sys.exit(0 if ok else 1)
