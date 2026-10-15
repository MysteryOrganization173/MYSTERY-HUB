"""Rendered homepage regression review; no backend or transaction requests.

Optional review tooling: Python Playwright and system Chromium, outside npm dependencies.
Start frontend-only Vite, then run: python scripts/reviewHomepage.py
HOMEPAGE_PREVIEW_URL defaults to http://localhost:5173.
HOMEPAGE_REVIEW_DIR defaults to /tmp/mystery-homepage-review.
HOMEPAGE_REVIEW_STANDINS (optional) is a folder with hero.png, logo.png and generic.png used in place
of Cloudinary images when the image host is unreachable; screenshots taken that way are not final artwork.
CHROMIUM_PATH defaults to /usr/bin/chromium.
Only localhost previews are allowed. Screenshots and fixtures stay outside the repository.
"""
import json
import os
import re
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
URL = os.environ.get('HOMEPAGE_PREVIEW_URL', 'http://localhost:5173')
assert urllib.parse.urlparse(URL).hostname in ('localhost', '127.0.0.1'), 'Use an isolated local preview'
OUTPUT = Path(os.environ.get('HOMEPAGE_REVIEW_DIR', '/tmp/mystery-homepage-review'))
OUTPUT.mkdir(parents=True, exist_ok=True)
STANDINS = os.environ.get('HOMEPAGE_REVIEW_STANDINS')
CATALOG = json.loads(subprocess.check_output([
    'node', '--import', 'tsx', '--input-type=module', '-e',
    "import {DATA_BUNDLES} from './src/data/bundles.ts';console.log(JSON.stringify(DATA_BUNDLES))"
], cwd=ROOT))

# Explicit synthetic fixture for the API-driven product rendering path, never published inventory.
PRODUCT = {
    'id': 'review-fixture', 'slug': 'review-fixture', 'name': 'Review fixture — not inventory',
    'category': 'business_essentials', 'categoryLabel': 'Review fixture', 'tagline': 'Synthetic test item',
    'description': 'Local preview fixture only.', 'priceType': 'quote', 'priceDisplay': 'Request Quote',
    'availability': 'check_availability', 'availabilityLabel': 'Check Availability', 'highlights': [],
    'imageUrl': 'https://res.cloudinary.com/da6oeat7m/image/upload/v1790865356/Futuristic_Ghana_Tech_Marketplace_Banner_uvziku.png',
}

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), args=['--no-sandbox'])
    context = browser.new_context(reduced_motion='reduce', device_scale_factor=1)
    state = {'marketplace': 'empty', 'offer': True}
    blocked_mutations, page_errors, asset_failures = [], [], []
    cache = {}

    def handle_api(route):
        path = urllib.parse.urlparse(route.request.url).path
        if route.request.method != 'GET':
            blocked_mutations.append(path)
            route.fulfill(status=403, json={'success': False, 'error': 'Review: mutations disabled'})
            return
        response = {'success': True, 'products': [], 'available': False, 'orders': [], 'rules': []}
        if path == '/api/commercial/products':
            response['products'] = CATALOG
        elif path.startswith('/api/commercial/quote/'):
            response['offer'] = {'enabled': state['offer'], 'state': 'guest', 'discountMinor': 100}
        elif path == '/api/marketplace/products':
            if state['marketplace'] == 'failed':
                route.fulfill(status=503, json={'success': False}); return
            if state['marketplace'] == 'featured':
                response['products'] = [PRODUCT]
        route.fulfill(json=response)

    def asset(route):
        # Read actual approved assets through the environment's inherited proxy.
        # This avoids Chromium's separate proxy setup while preserving real image bytes.
        url = route.request.url
        if STANDINS and 'res.cloudinary.com' in url:
            name = 'hero.png' if 'baowst' in url else 'logo.png' if 'tvptuc' in url else 'generic.png'
            route.fulfill(body=(Path(STANDINS) / name).read_bytes(), content_type='image/png')
            return
        try:
            if url not in cache:
                with urllib.request.urlopen(url, timeout=20) as response:
                    cache[url] = (response.read(), response.headers.get('content-type', 'application/octet-stream'))
            body, mime = cache[url]
            route.fulfill(body=body, content_type=mime)
        except Exception:
            asset_failures.append(url)
            route.abort()

    context.route('**/api/**', handle_api)
    context.route('**/*paystack*', lambda route: route.fulfill(
        content_type='application/javascript', body='window.PaystackPop={setup:()=>({openIframe:()=>{}})}'))
    context.route('https://res.cloudinary.com/**', asset)
    context.route('https://fonts.googleapis.com/**', asset)
    context.route('https://fonts.gstatic.com/**', asset)
    page = context.new_page()
    page.on('pageerror', lambda error: page_errors.append(str(error)))
    results = []

    def home():
        page.goto(URL, wait_until='networkidle')
        expect(page.get_by_role('heading', name='Everything digital. One trusted place.')).to_be_visible()

    def assert_fits():
        dimensions = page.evaluate('({width:innerWidth,body:document.body.scrollWidth,root:document.getElementById("root").scrollWidth})')
        assert dimensions['width'] == dimensions['body'] == dimensions['root'], dimensions
        # Detect offscreen children too; overflow-x:clip alone can conceal a layout defect.
        offscreen = page.locator('.home-page button, .home-page a, header button, nav[aria-label="Mobile Navigation"] a').evaluate_all('''elements => elements.filter(e => {
          // Items inside an intentional horizontal scroller (template chips) are reachable by scrolling.
          for (let a=e.parentElement; a; a=a.parentElement) if (['auto','scroll'].includes(getComputedStyle(a).overflowX)) return false;
          const r=e.getBoundingClientRect(); return r.width && (r.left < -.5 || r.right > innerWidth + .5);
        }).map(e=>e.textContent)''')
        assert not offscreen, offscreen
        brand = page.locator('header a[aria-label="Mystery Hub Homepage"]')
        assert brand.bounding_box()['height'] <= 32, 'Brand wordmark must not wrap'

    for width in [360, 390, 430, 768, 1024, 1280]:
        page.set_viewport_size({'width': width, 'height': 844 if width < 768 else 900})
        home()
        for position in range(0, page.evaluate('document.body.scrollHeight'), 600):
            page.evaluate('(y)=>window.scrollTo(0,y)', position)
            page.wait_for_timeout(120)
        page.wait_for_timeout(300)
        assert_fits()
        # Phones hide the decorative Marketplace banner; it must not download there.
        if width < 768:
            assert page.locator('.home-marketplace-art img').evaluate_all('(i)=>i.filter(x=>x.complete&&x.naturalWidth>0).length') == 0
        assert page.locator('.home-utility').count() == 6
        images = page.locator('.home-page img').evaluate_all('(images)=>images.filter(i=>i.getClientRects().length).map(i=>({src:i.currentSrc,ok:i.complete&&i.naturalWidth>0}))')
        assert all(image['ok'] for image in images), images
        page.evaluate('window.scrollTo(0,0)')
        page.screenshot(path=str(OUTPUT / f'after-{width}.png'), full_page=True)
        page.screenshot(path=str(OUTPUT / f'after-top-{width}.png'))

        # Expanded search must stay within the header's viewport, including 360px.
        page.get_by_role('button', name='Search', exact=True).click()
        search = page.get_by_role('textbox', name='Search services')
        expect(search).to_be_visible()
        bounds = search.bounding_box()
        assert bounds['x'] >= 0 and bounds['x'] + bounds['width'] <= width
        search.fill('website'); search.press('Enter')
        expect(page).to_have_url(re.compile('/website-builder$'))
        home()

        # Assistant comes from navigation rather than floating above content.
        if width < 768:  # Phones reach the assistant from the header menu.
            page.get_by_role('button', name='Toggle menu').click()
        page.get_by_role('button', name='Open Mystery AI Assistant').click()
        expect(page.get_by_role('dialog', name='Mystery AI Assistant')).to_be_visible()
        if width < 768:
            expect(page.get_by_role('navigation', name='Mobile Navigation')).to_have_count(0)
        page.keyboard.press('Escape')
        expect(page.get_by_role('dialog', name='Mystery AI Assistant')).to_have_count(0)

        # At several scroll offsets, the actual Buy control must receive pointer events.
        buy = page.get_by_role('button', name=re.compile(r'^Buy 1GB MTN Ghana data'))
        buy.scroll_into_view_if_needed()
        for offset in [0, 80, -80]:
            page.evaluate('(offset)=>window.scrollBy(0,offset)', offset)
            assert buy.evaluate('''e => {const r=e.getBoundingClientRect();
              return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}'''), (width, offset)
        buy.click()
        expect(page.get_by_role('dialog', name='Review your purchase')).to_be_visible()
        expect(page.get_by_text('Confirm your order', exact=True)).to_be_visible()
        expect(page.get_by_role('navigation', name='Mobile Navigation')).to_have_count(0)
        page.get_by_role('button', name='Close checkout').click()
        results.append({'width': width, 'overflow': False, 'images': len(images), 'search': 'passed', 'assistant': 'passed', 'buy': 'passed'})

    page.set_viewport_size({'width': 390, 'height': 844})
    home()
    page.get_by_role('link', name='Create a Free Website', exact=True).click()
    expect(page).to_have_url(re.compile('/website-builder$'))
    home()
    page.get_by_role('button', name='Airtime Top-Up', exact=False).click()
    expect(page).to_have_url(re.compile('/data$'))
    expect(page.get_by_text('1. Select Network', exact=True)).to_be_visible()
    home()
    page.locator('.home-template-showcase').get_by_role('button', name='Preview', exact=True).click()
    expect(page.get_by_role('dialog', name='Website template preview')).to_be_visible()
    page.keyboard.press('Escape')
    expect(page.get_by_role('dialog', name='Website template preview')).to_have_count(0)
    # Template chips open the same preview as the showcase.
    page.locator('.home-template-chips button').first.click()
    expect(page.get_by_role('dialog', name='Website template preview')).to_be_visible()
    page.keyboard.press('Escape')
    # Network switch shows that network's catalogue rows, and View all keeps the choice.
    page.get_by_role('button', name='AirtelTigo', exact=True).click()
    expect(page.get_by_role('button', name='AirtelTigo', exact=True)).to_have_attribute('aria-pressed', 'true')
    assert page.locator('.home-bundle-list').get_by_role('button', name=re.compile('AirtelTigo')).count() > 0
    page.get_by_role('button', name=re.compile('^View all AirtelTigo')).click()
    expect(page).to_have_url(re.compile('/data$'))
    for title, path in [('AFA Registration', '/afa'), ('Mystery Earn', '/earn'), ('Website Builder', '/website-builder'), ('Marketplace', '/marketplace')]:
        home(); page.locator('.home-utility').filter(has_text=title).click()
        expect(page).to_have_url(re.compile(re.escape(path) + '$'))
    home(); page.get_by_role('link', name='Browse Marketplace', exact=True).click()
    expect(page).to_have_url(re.compile('/marketplace$'))
    home(); page.get_by_role('button', name='Track an Order', exact=True).click()
    expect(page).to_have_url(re.compile('/orders$'))
    home(); page.get_by_role('button', name='All Services', exact=True).click()
    expect(page).to_have_url(re.compile('/services$'))
    home(); page.locator('.home-future-item').first.click()
    expect(page.get_by_role('dialog')).to_be_visible()
    page.keyboard.press('Escape')

    state['offer'] = False
    home(); expect(page.get_by_text('Welcome Offer', exact=True)).to_have_count(0)
    state['marketplace'] = 'failed'
    home(); expect(page.get_by_text('Featured items could not load.', exact=False)).to_be_visible()
    state['marketplace'] = 'featured'
    page.get_by_role('button', name='Try Again', exact=True).click()
    expect(page.get_by_role('heading', name=PRODUCT['name'])).to_be_visible()
    page.get_by_role('button', name='Ask About This Item', exact=True).click()
    expect(page.get_by_role('dialog')).to_be_visible()
    assert not page_errors, page_errors
    assert not asset_failures, asset_failures
    summary = {'layouts': results, 'journeys': 'passed', 'offer_disabled': 'passed',
               'marketplace_empty_error_retry_featured': 'passed', 'page_errors': page_errors,
               'asset_failures': asset_failures, 'blocked_mutations': blocked_mutations,
               'note': 'Synthetic API responses. ' + ('Stand-in images, not approved artwork. ' if STANDINS else 'Actual approved image bytes. ') + 'No backend or financial transactions.'}
    (OUTPUT / 'results.json').write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))
    browser.close()
