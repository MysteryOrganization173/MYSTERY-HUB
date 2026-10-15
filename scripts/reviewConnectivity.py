"""Rendered review of Instant Bundles, Airtime, AFA and the homepage quick-buy; synthetic API only.

Optional review tooling: Python Playwright and a local Chromium, outside npm dependencies.
Start frontend-only Vite (npx vite --port 5173), then run: python scripts/reviewConnectivity.py
Env: CONNECT_REVIEW_URL (localhost only, default http://localhost:5173), CONNECT_REVIEW_DIR
(default /tmp/mystery-connect-review), CONNECT_REVIEW_PHASE (labels files; "before" only captures
screens), CHROMIUM_PATH (default /opt/pw-browsers/chromium).

Every /api request is answered here. Paystack is a stub, the AFA redirect lands on a local stand-in
page, and no registration, payment or supplier request can leave the browser. Identity values are
fictional fixtures.
"""
import json
import os
import re
import subprocess
import urllib.parse
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
URL = os.environ.get('CONNECT_REVIEW_URL', 'http://localhost:5173')
assert urllib.parse.urlparse(URL).hostname in ('localhost', '127.0.0.1'), 'Use an isolated local preview'
OUTPUT = Path(os.environ.get('CONNECT_REVIEW_DIR', '/tmp/mystery-connect-review'))
OUTPUT.mkdir(parents=True, exist_ok=True)
PHASE = os.environ.get('CONNECT_REVIEW_PHASE', 'after')
CATALOG = json.loads(subprocess.check_output([
    'node', '--import', 'tsx', '--input-type=module', '-e',
    "import {DATA_BUNDLES} from './src/data/bundles.ts';console.log(JSON.stringify(DATA_BUNDLES))"
], cwd=ROOT))
REF = 'MH-20261015-551204'
CARD, DOB = 'GHA-123456789-0', '1994-03-12'  # fictional fixture identity


def instant(key, network, amount, price, fee, category=None, validity='7 Days', flexi=False, stock=True, ref=None):
    product = {'productKey': f'instant-{key}', 'packageId': key, 'name': amount, 'network': network, 'dataAmount': amount,
               'validity': validity, 'isFlexi': flexi, 'retailPriceGhc': price, 'retailPricePesewas': round(price * 100),
               'paymentProcessingFeeGhc': fee, 'estimatedTotalGhc': round(price + fee, 2),
               'availability': 'in_stock' if stock else 'out_of_stock', 'category': category}
    if flexi:
        product.update(minAmountGhc=1, maxAmountGhc=500)
    if ref:
        product.update(networkReferencePriceGhc=ref, savingsOnProductGhc=round(ref - price, 2))
    return product


INSTANT = [
    instant('mtn_1gb', 'mtn', '1GB', 5.99, 0.23, ref=6.00),
    instant('mtn_video_2gb', 'mtn', '2GB', 4.00, 0.19, 'Video'),
    instant('mtn_midnight_3gb', 'mtn', '3GB', 3.00, 0.17, 'Midnight', validity='1 Day'),
    instant('mtn_flexi', 'mtn', 'Flexi Data', 1.00, 0.13, flexi=True, validity='Based on amount'),
    instant('telecel_social', 'telecel', '1.5GB', 3.50, 0.18, 'Social Media'),
    instant('at_idd', 'airteltigo', '30 Mins', 10.00, 0.32, 'IDD International', validity='30 Days'),
    instant('at_2gb', 'airteltigo', '2GB', 8.00, 0.27, stock=False),
]

PAYSTACK_STUB = '''
window.__payments = [];
window.PaystackPop = class { resumeTransaction(code, options) { window.__payments.push({code, options}); } };
'''
USER = {'id': 'review-user', 'name': 'Ama Review', 'email': 'ama@example.com', 'phone': '0241234567', 'role': 'customer',
        'status': 'active', 'createdAt': '2026-01-01T00:00:00Z', 'lastLoginAt': None, 'mustChangePassword': False,
        'passwordChangedAt': None}

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/opt/pw-browsers/chromium'), args=['--no-sandbox'])
    state = {'instant': 'ok', 'afa': 'ok', 'afa_order': 'queued', 'afa_hold': False, 'held': []}
    calls, page_errors, afa_bodies = [], [], []

    def afa_order(status):
        return {'public_reference': REF, 'recipient_phone': '024 *** 4567', 'network': 'mtn', 'service_type': 'afa',
                'product_name_snapshot': 'AFA Registration', 'bundle_size_snapshot': 'AFA', 'amount': 1500, 'amount_ghc': 15.0,
                'currency': 'GHS', 'status': status, 'created_at': '2026-10-15T12:41:00Z', 'paid_at': None, 'delivered_at': None}

    def handle_api(route):
        request = route.request
        path = urllib.parse.urlparse(request.url).path
        calls.append((request.method, request.url))
        if path == '/api/commercial/products':
            return route.fulfill(json={'products': CATALOG})
        if path.startswith('/api/commercial/quote/'):
            product = next((b for b in CATALOG if b['id'] == path.rsplit('/', 1)[1]), CATALOG[0])
            minor = round(product['priceGhc'] * 100)
            return route.fulfill(json={'product': product, 'regularMinor': minor, 'discountMinor': 0, 'totalMinor': minor,
                                       'pricingRevision': 'review', 'promotionRevision': 'review',
                                       'offer': {'enabled': False, 'discountMinor': 0, 'state': 'disabled'}})
        if path == '/api/instant-bundles':
            if state['instant'] == 'error':
                return route.abort('internetdisconnected')
            if state['instant'] == 'unavailable':
                return route.fulfill(json={'success': True, 'available': False, 'reason': 'Instant Bundles are paused for maintenance.', 'products': []})
            return route.fulfill(json={'success': True, 'available': True, 'products': INSTANT})
        if path == '/api/afa/config':
            if state['afa'] == 'unavailable':
                return route.fulfill(json={'enabled': True, 'available': False, 'retailPriceMinor': None, 'retailPriceGhc': None, 'status': 'paused', 'message': 'Paused'})
            return route.fulfill(json={'enabled': True, 'available': True, 'retailPriceMinor': 1500, 'retailPriceGhc': 15.0, 'status': 'available', 'message': ''})
        if path == '/api/afa/payments/initialize':
            body = json.loads(request.post_data or '{}')
            afa_bodies.append(body)
            if state['afa_hold']:
                state['held'].append(route); return
            if state['afa'] == 'reject':
                return route.fulfill(status=400, json={'error': 'Enter a valid Ghana Card number: GHA-#########-#.', 'field': 'idNumber'})
            return route.fulfill(json={'success': True, 'orderRef': REF, 'reference': 'afa_review', 'authorizationUrl': 'https://checkout.paystack.com/afa-review',
                                       'amountGhc': 15, 'amountPesewas': 1500, 'currency': 'GHS'})
        if path.startswith('/api/payments/verify/'):
            return route.fulfill(json={'verified': True, 'order': afa_order(state['afa_order'])})
        if path == '/api/auth/me':
            return route.fulfill(json={'success': True, 'user': USER})
        if path.startswith('/api/finance'):
            return route.fulfill(json={'walletMinor': 0, 'restricted': False})
        if path == '/api/payments/initialize':
            return route.fulfill(status=503, json={'error': 'Review: payment initialisation is not exercised here'})
        if request.method != 'GET':
            return route.fulfill(status=403, json={'error': 'Review: mutation disabled'})
        return route.fulfill(json={'success': True, 'available': False, 'products': [], 'orders': []})

    def new_context(signed_in=False):
        context = browser.new_context(reduced_motion='reduce', device_scale_factor=2)
        context.add_init_script(PAYSTACK_STUB)
        if signed_in:
            context.add_init_script(f"localStorage.setItem('mystery_hub_session_token','review-token');localStorage.setItem('mystery_hub_user',{json.dumps(json.dumps(USER))});")
        context.route('**/api/**', handle_api)
        context.route('**/*paystack*', lambda route: route.fulfill(content_type='application/javascript', body=''))
        context.route('https://checkout.paystack.com/**', lambda route: route.fulfill(content_type='text/html', body='<title>Paystack stand-in</title><p>Paystack stand-in</p>'))
        context.route('https://res.cloudinary.com/**', lambda route: route.abort())
        context.route('https://fonts.googleapis.com/**', lambda route: route.abort())
        page = context.new_page()
        page.on('pageerror', lambda error: page_errors.append(str(error)))
        return context, page

    context, page = new_context()

    def shot(name, full=False, target=None):
        (target or page).wait_for_timeout(250)
        (target or page).screenshot(path=str(OUTPUT / f'{PHASE}-{name}.png'), full_page=full)

    def fits(target=None):
        dims = (target or page).evaluate('({w:innerWidth,b:document.documentElement.scrollWidth})')
        assert dims['b'] <= dims['w'], dims

    def mode(name, target=None):
        target = target or page
        target.goto(URL + '/data', wait_until='networkidle')
        target.get_by_role('button', name=name, exact=True).first.click()
        target.wait_for_timeout(500)
        target.evaluate('window.scrollTo(0,0)')

    def afa(target=None):
        target = target or page
        target.goto(URL + '/afa', wait_until='networkidle')
        target.wait_for_timeout(400)

    for width, height in [(360, 780), (390, 844), (430, 932), (768, 1024), (1280, 900)]:
        page.set_viewport_size({'width': width, 'height': height})
        mode('Instant Bundles'); fits(); shot(f'{width}-instant-top')
        mode('Airtime'); fits(); shot(f'{width}-airtime-top')
        afa(); fits(); shot(f'{width}-afa-top')
        if width in (390, 1280):
            shot(f'{width}-afa-full', full=True)
            mode('Instant Bundles'); shot(f'{width}-instant-full', full=True)
            mode('Airtime'); shot(f'{width}-airtime-full', full=True)
            page.goto(URL + '/', wait_until='networkidle'); page.wait_for_timeout(400)
            quick = page.locator('.home-bundle-list').first
            if quick.count():
                quick.scroll_into_view_if_needed(); page.wait_for_timeout(200); fits(); shot(f'{width}-home-quickbuy')

    if PHASE == 'before':
        print('captured before screens; page errors:', page_errors)
        browser.close(); raise SystemExit(0)

    page.set_viewport_size({'width': 390, 'height': 844})

    # Instant: a fixed package shows its checkout fee before checkout and carries it into the sheet.
    mode('Instant Bundles')
    fixed = page.get_by_role('button', name=re.compile(r'^Buy 1GB MTN'))
    expect(fixed).to_contain_text('fee')
    fixed.click()
    sheet = page.get_by_role('dialog', name='Review your purchase')
    expect(sheet).to_be_visible(); expect(sheet).to_contain_text('GH₵0.23'); expect(sheet).to_contain_text('GH₵6.22')
    shot('390-instant-checkout'); page.keyboard.press('Escape')
    # Out of stock cannot be bought; restriction notes stay visible.
    page.get_by_role('button', name='All Networks').click(); shot('390-instant-all')
    expect(page.get_by_role('button', name=re.compile(r'2GB AirtelTigo.*unavailable', re.I))).to_be_disabled()
    expect(page.get_by_text('Midnight-only data').first).to_be_visible()
    # Flexi: amount outside the server limits is refused inline, a valid one reaches checkout.
    page.get_by_role('button', name=re.compile(r'^Choose an amount for Flexi')).click()
    amount = page.get_by_label(re.compile(r'^Amount'))
    amount.fill('0.5'); page.get_by_role('button', name=re.compile(r'^Continue with GH₵')).click()
    expect(page.get_by_text('Minimum amount is GH₵1.')).to_be_visible(); shot('390-instant-flexi-error')
    amount.fill('20'); expect(page.get_by_role("button", name="Continue with GH₵20.00")).to_be_visible(); shot("390-instant-flexi")
    page.get_by_role('button', name=re.compile(r'^Continue with GH₵')).click()
    expect(sheet).to_be_visible(); expect(sheet).to_contain_text('GH₵20.00'); shot('390-instant-flexi-checkout')
    page.keyboard.press('Escape')
    # Catalogue failure and paused service.
    state['instant'] = 'error'; mode('Instant Bundles'); fits(); shot('390-instant-error')
    state['instant'] = 'unavailable'; mode('Instant Bundles'); fits(); shot('390-instant-unavailable')
    state['instant'] = 'ok'

    # Airtime: formatted number, network hint, invalid and valid amounts, then checkout.
    mode('Airtime')
    phone = page.get_by_label('Recipient number')
    phone.fill('0201234567')
    expect(phone).to_have_value('020 123 4567')
    expect(page.get_by_text(re.compile('looks like a Telecel number', re.I))).to_be_visible(); shot('390-airtime-mismatch')
    page.get_by_role('button', name=re.compile(r'^Switch to Telecel')).click()
    page.get_by_role('button', name='Other amount').click()
    custom = page.get_by_label('Airtime amount in cedis')
    custom.fill('0.5'); page.get_by_role('button', name=re.compile(r'^Continue')).click()
    expect(page.get_by_text('Minimum airtime is GH₵1.00.')).to_be_visible(); shot('390-airtime-error')
    custom.fill('15'); page.get_by_role('button', name=re.compile(r'^Continue')).click()
    expect(sheet).to_be_visible(); expect(sheet).to_contain_text('GH₵15.00'); expect(page.locator('#checkout-phone')).to_have_value('020 123 4567')
    shot('390-airtime-checkout'); page.keyboard.press('Escape')

    # AFA signed out: the fee, the packages as MTN information and a sign-in step before paying.
    afa()
    expect(page.get_by_text('GH₵15.00').first).to_be_visible()
    packages = page.get_by_role('region', name=re.compile('MTN AFA packages'))
    expect(packages).to_contain_text('Bought on MTN')
    assert packages.get_by_role('button', name=re.compile('buy|pay', re.I)).count() == 0
    page.get_by_role('button', name='Weekly').click(); shot('390-afa-packages-weekly'); fits()
    page.get_by_role('button', name=re.compile(r'^Continue to payment|^Sign in to continue')).click()
    expect(page.get_by_role('dialog').first).to_be_visible(); shot('390-afa-signin'); page.keyboard.press('Escape')

    state['afa'] = 'unavailable'; afa(); shot('390-afa-unavailable'); state['afa'] = 'ok'
    context.close()

    # AFA signed in: empty submit, field feedback, server rejection and a mocked Paystack handoff.
    for width, height in [(360, 780), (390, 844), (1280, 900)]:
        context, page = new_context(signed_in=True)
        page.set_viewport_size({'width': width, 'height': height})
        afa()
        submit = page.get_by_role('button', name=re.compile(r'^Continue to payment'))
        page.get_by_label('Ghana Card number').fill('')
        submit.click(); page.wait_for_timeout(300); fits(); shot(f'{width}-afa-empty-submit')
        card = page.get_by_label('Ghana Card number')
        card.type('1234567890'); expect(card).to_have_value(CARD); card.blur()
        page.get_by_label('Date of birth').fill(DOB)
        page.get_by_label('Town or area').fill('Madina')
        page.get_by_label(re.compile('I confirm these details')).check()
        if width == 390:
            page.get_by_label('Ghana Card number').fill('GHA-12345')
            page.get_by_label('Ghana Card number').blur()
            expect(page.get_by_text('Enter a valid Ghana Card number: GHA-#########-#.').first).to_be_visible(); shot('390-afa-card-error')
            page.get_by_label('Ghana Card number').fill(''); page.get_by_label('Ghana Card number').type('1234567890')
            state['afa'] = 'reject'; submit.click(); page.wait_for_timeout(400)
            expect(page.get_by_label('Ghana Card number')).to_be_focused(); shot('390-afa-server-error'); state['afa'] = 'ok'
            state['afa_hold'] = True; submit.click(); page.wait_for_timeout(300)
            expect(page.get_by_role('button', name=re.compile('Opening secure payment'))).to_be_disabled(); shot('390-afa-submitting')
            state['afa_hold'] = False
            held = state['held'].pop(); held.fulfill(json={'success': True, 'orderRef': REF, 'reference': 'afa_review', 'authorizationUrl': 'https://checkout.paystack.com/afa-review', 'amountGhc': 15, 'amountPesewas': 1500, 'currency': 'GHS'})
        else:
            shot(f'{width}-afa-filled', full=True)
            submit.click()
        page.wait_for_url('https://checkout.paystack.com/**')
        context.close()

    # Nothing sensitive in URLs, and the identity values only travel in the initialize POST body.
    for method, url in calls:
        assert CARD not in url and DOB not in url and '123456789' not in url, url
    assert afa_bodies and afa_bodies[-1]['idNumber'] == CARD and afa_bodies[-1]['dateOfBirth'] == DOB
    context, page = new_context(signed_in=True)
    afa(); page.get_by_label('Ghana Card number').type('1234567890'); page.get_by_label('Date of birth').fill(DOB)
    storage = page.evaluate('JSON.stringify({...localStorage})+JSON.stringify({...sessionStorage})')
    assert '123456789' not in storage and DOB not in storage, 'identity reached browser storage'

    # Returning from Paystack: server-verified states only.
    for status in ('queued', 'processing', 'delivered'):
        state['afa_order'] = status
        page.set_viewport_size({'width': 390, 'height': 844})
        page.goto(URL + '/afa?reference=afa_review', wait_until='networkidle'); page.wait_for_timeout(400)
        fits(); shot(f'390-afa-return-{status}')
    page.set_viewport_size({'width': 1280, 'height': 900}); page.reload(wait_until='networkidle'); page.wait_for_timeout(400); shot('1280-afa-return-delivered')
    context.close()

    browser.close()
    assert not page_errors, page_errors
    print('connectivity review ok:', len(calls), 'API calls answered locally')
