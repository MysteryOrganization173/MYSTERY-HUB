"""Rendered Data buying journey review; synthetic API responses only, no real payments.

Optional review tooling: Python Playwright and a local Chromium, outside npm dependencies.
Start frontend-only Vite (npx vite --port 5173), then run: python scripts/reviewDataBuying.py
DATA_REVIEW_URL defaults to http://localhost:5173 and must be localhost.
DATA_REVIEW_DIR defaults to /tmp/mystery-data-review. DATA_REVIEW_PHASE labels files (default: after).
CHROMIUM_PATH defaults to /opt/pw-browsers/chromium.

Every /api request is answered by this script. Paystack is replaced by a stub whose callbacks the
script triggers, so no transaction, supplier order or database write can happen.
"""
import json
import os
import re
import subprocess
import urllib.parse
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
URL = os.environ.get('DATA_REVIEW_URL', 'http://localhost:5173')
assert urllib.parse.urlparse(URL).hostname in ('localhost', '127.0.0.1'), 'Use an isolated local preview'
OUTPUT = Path(os.environ.get('DATA_REVIEW_DIR', '/tmp/mystery-data-review'))
OUTPUT.mkdir(parents=True, exist_ok=True)
PHASE = os.environ.get('DATA_REVIEW_PHASE', 'after')
CATALOG = json.loads(subprocess.check_output([
    'node', '--import', 'tsx', '--input-type=module', '-e',
    "import {DATA_BUNDLES} from './src/data/bundles.ts';console.log(JSON.stringify(DATA_BUNDLES))"
], cwd=ROOT))
REF = 'MH-20261015-482913'

# Paystack stand-in: records the handoff and lets the script play the customer's popup outcome.
PAYSTACK_STUB = '''
window.__payments = [];
window.PaystackPop = class { resumeTransaction(code, options) { window.__payments.push({code, options}); } };
'''

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/opt/pw-browsers/chromium'), args=['--no-sandbox'])
    context = browser.new_context(reduced_motion='reduce', device_scale_factor=2)
    context.add_init_script(PAYSTACK_STUB)
    state = {'init': 'ok', 'order': 'pending_payment', 'lookup_fails': False, 'hold': False, 'held': []}
    calls = []
    page_errors = []

    def order(status):
        bundle = next(b for b in CATALOG if b['id'] == 'mtn-5gb')
        return {'public_reference': REF, 'recipient_phone': '024 *** 4567', 'network': 'mtn', 'service_type': 'data',
                'product_name_snapshot': 'MTN 5GB', 'bundle_size_snapshot': '5GB', 'amount': round(bundle['priceGhc'] * 100),
                'amount_ghc': bundle['priceGhc'], 'currency': 'GHS', 'status': status, 'created_at': '2026-10-15T12:41:00Z',
                'paid_at': None, 'delivered_at': None}

    def handle_api(route):
        request = route.request
        path = urllib.parse.urlparse(request.url).path
        calls.append((request.method, path))
        if path == '/api/commercial/products':
            return route.fulfill(json={'products': CATALOG})
        if path.startswith('/api/commercial/quote/'):
            product = next((b for b in CATALOG if b['id'] == path.rsplit('/', 1)[1]), CATALOG[0])
            minor = round(product['priceGhc'] * 100)
            return route.fulfill(json={'product': product, 'regularMinor': minor, 'discountMinor': 0, 'totalMinor': minor,
                                       'pricingRevision': 'review', 'promotionRevision': 'review',
                                       'offer': {'enabled': False, 'discountMinor': 0, 'state': 'disabled'}})
        if path == '/api/payments/initialize':
            body = json.loads(request.post_data or '{}')
            if state['hold']:
                # Slow network: the script answers this request later from the main flow.
                state['held'].append((route, body)); return
            if state['init'] == 'mtn_active':
                return route.fulfill(status=409, json={'error': 'An MTN order is already processing for this number.', 'code': 'ACTIVE_MTN_ORDER_EXISTS', 'existingOrderReference': REF, 'existingOrderStatus': 'processing'})
            if state['init'] == 'unavailable':
                return route.fulfill(status=409, json={'error': 'Package unavailable', 'code': 'PACKAGE_UNAVAILABLE'})
            if state['init'] == 'offline':
                return route.abort('internetdisconnected')
            return route.fulfill(json={'success': True, 'orderRef': REF, 'reference': 'review_ref', 'accessCode': 'review_access',
                                       'amountPesewas': body.get('expectedTotalMinor'), 'amountGhc': (body.get('expectedTotalMinor') or 0) / 100, 'currency': 'GHS'})
        if path.startswith('/api/payments/verify/'):
            return route.fulfill(json={'verified': True, 'order': order(state['order'])})
        if path == '/api/payments/cancel':
            return route.fulfill(json={'success': True, 'cancelled': state['order'] == 'pending_payment', 'alreadyPaid': state['order'] != 'pending_payment'})
        if path.startswith('/api/orders/lookup/'):
            if state['lookup_fails']:
                return route.abort('internetdisconnected')
            return route.fulfill(json={'success': True, 'order': order(state['order'])})
        if request.method != 'GET':
            return route.fulfill(status=403, json={'error': 'Review: mutation disabled'})
        return route.fulfill(json={'success': True, 'available': False, 'products': [], 'orders': []})

    context.route('**/api/**', handle_api)
    context.route('**/*paystack*', lambda route: route.fulfill(content_type='application/javascript', body=''))
    context.route('https://res.cloudinary.com/**', lambda route: route.abort())
    context.route('https://fonts.googleapis.com/**', lambda route: route.abort())
    page = context.new_page()
    page.on('pageerror', lambda error: page_errors.append(str(error)))

    def shot(name, full=False):
        page.wait_for_timeout(250)
        page.screenshot(path=str(OUTPUT / f'{PHASE}-{name}.png'), full_page=full)

    def fits():
        dims = page.evaluate('({w:innerWidth,b:document.documentElement.scrollWidth})')
        assert dims['b'] <= dims['w'], dims

    def data_page():
        page.goto(URL + '/data', wait_until='networkidle')
        page.wait_for_timeout(400)

    def open_checkout(name=r'^(Buy|Review order for) 5GB MTN'):
        page.get_by_role('button', name=re.compile(name)).first.click()
        expect(page.get_by_role('dialog', name='Review your purchase')).to_be_visible()
        expect(page.get_by_role('button', name=re.compile(r'^Pay GH₵'))).to_be_enabled()

    def fill_recipient(number='0241234567'):
        field = page.locator('#checkout-phone')
        field.fill('')
        field.type(number)
        email = page.locator('input[type="email"]')
        if email.count() and email.first.is_visible():
            email.first.fill('ama@example.com')

    def pay():
        page.get_by_role('button', name=re.compile(r'^Pay GH₵')).click()

    def popup(outcome):
        page.wait_for_function('window.__payments.length > 0')
        page.evaluate(f'window.__payments.at(-1).options.{outcome}()')
        page.wait_for_timeout(400)

    for width, height in [(360, 780), (390, 844), (768, 1024), (1280, 900)]:
        page.set_viewport_size({'width': width, 'height': height})
        data_page(); fits()
        shot(f'{width}-data-top')
        if width in (390, 1280):
            shot(f'{width}-data-full', full=True)
        page.evaluate('window.__payments = []')
        open_checkout(); fits(); shot(f'{width}-checkout-empty')
        fill_recipient(); page.locator('#checkout-phone').blur(); shot(f'{width}-checkout-filled')
        page.keyboard.press('Escape')

    page.set_viewport_size({'width': 390, 'height': 844})

    # Wrong-number feedback.
    data_page(); open_checkout(); page.locator('#checkout-phone').type('0201234'); pay(); shot('390-checkout-invalid')
    fill_recipient('0201234567'); shot('390-checkout-mismatch'); page.keyboard.press('Escape')

    # Full happy path: pay, approve, receipt moves through authoritative server states.
    state.update(init='ok', order='pending_payment')
    data_page(); page.evaluate('window.__payments = []'); open_checkout(); fill_recipient(); pay()
    page.wait_for_function('window.__payments.length > 0'); shot('390-paying')
    state['order'] = 'queued'; popup('onSuccess'); shot('390-receipt-queued')
    state['order'] = 'processing'; page.wait_for_timeout(3500); shot('390-receipt-processing')
    state['order'] = 'delivered'; page.wait_for_timeout(3500); shot('390-receipt-delivered')
    state['order'] = 'refund_pending'; page.keyboard.press('Escape')

    # Customer closes the payment window: what do they see, and can they recover?
    state.update(order='pending_payment')
    data_page(); page.evaluate('window.__payments = []'); open_checkout(); fill_recipient(); pay(); popup('onClose')
    shot('390-payment-closed')
    # They approved the MoMo prompt anyway; the server confirms it a moment later.
    state['order'] = 'paid'
    check = page.get_by_role('button', name=re.compile('Check payment status'))
    if check.count():
        check.click(); page.wait_for_timeout(600); shot('390-payment-closed-recovered')
    page.keyboard.press('Escape')

    # Returning later: a reload loses the popup; the Data page offers the last payment.
    state['order'] = 'pending_payment'
    data_page(); page.evaluate('window.__payments = []'); open_checkout(); fill_recipient(); pay()
    page.wait_for_function('window.__payments.length > 0')
    data_page(); shot('390-returning')

    # Server refusals before any payment.
    for case in ['mtn_active', 'unavailable', 'offline']:
        state['init'] = case
        data_page(); open_checkout(); fill_recipient(); pay(); page.wait_for_timeout(500); shot(f'390-error-{case}')
        page.keyboard.press('Escape')
    state['init'] = 'ok'

    # Slow network while preparing checkout.
    state['hold'] = True
    data_page(); open_checkout(); fill_recipient(); pay(); page.wait_for_timeout(3900); shot('390-slow-preparing')
    state['hold'] = False
    for held, body in state['held']:
        held.fulfill(status=409, json={'error': 'Package unavailable', 'code': 'PACKAGE_UNAVAILABLE'})
    state['held'].clear(); page.wait_for_timeout(400); page.keyboard.press('Escape')

    # Receipt when the status check cannot reach the server.
    state.update(order='processing', lookup_fails=False)
    page.goto(URL + '/orders', wait_until='networkidle')
    page.get_by_role('textbox').first.fill(REF); page.keyboard.press('Enter')
    page.wait_for_timeout(800); state['lookup_fails'] = True; page.wait_for_timeout(7000); shot('390-receipt-offline')
    state['lookup_fails'] = False; page.keyboard.press('Escape')
    shot('390-orders', full=True)

    page.set_viewport_size({'width': 1280, 'height': 900})
    state.update(order='processing')
    data_page(); page.evaluate('window.__payments = []'); open_checkout(); fill_recipient(); pay(); popup('onSuccess')
    shot('1280-receipt-processing')

    assert not page_errors, page_errors
    assert not [c for c in calls if c[0] != 'GET' and c[1] not in ('/api/payments/initialize', '/api/payments/cancel')], calls
    print(json.dumps({'phase': PHASE, 'screens': len(list(OUTPUT.glob(f'{PHASE}-*.png'))), 'pageErrors': page_errors}))
    browser.close()
