"""Run actual Finance components against synthetic read-only APIs in local Chromium.
Requires npm run build, Python Playwright, and Chromium. External requests are blocked.
Artifacts: /tmp/mystery-finance-reconciliation-review. No real sessions, messages or payments.
"""
import functools,http.server,json,os,re,shutil,subprocess,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent
OUT=Path(os.environ.get('FINANCE_REVIEW_DIR','/tmp/mystery-finance-reconciliation-review'));OUT.mkdir(parents=True,exist_ok=True)
subprocess.run(['node','--input-type=module','-'],cwd=ROOT,check=True,text=True,env={**os.environ,'FINANCE_REVIEW_DIR':str(OUT)},input="""
import {build} from 'esbuild';
await build({entryPoints:['server/suppliers/__tests__/fixtures/financeReconciliation.browser.tsx'],bundle:true,format:'esm',outfile:process.env.FINANCE_REVIEW_DIR+'/fixture.js',define:{'import.meta.env':'{}'}});
""")
shutil.copy(next((ROOT/'dist/assets').glob('index-*.css')),OUT/'style.css')
(OUT/'index.html').write_text('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body class="bg-slate-950 text-white"><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>')
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(OUT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/';results=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
  for width in [320,360,390,430,768,1440]:
   page=browser.new_page(viewport={'width':width,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/*',lambda route:route.continue_() if route.request.url.startswith(base) else route.abort());page.goto(base)
   expect(page.get_by_role('tab',name='Reconciliation',exact=True)).to_be_visible()
   assert page.evaluate('window.__financeFixture.requests.every(r=>!r.path.includes("/reconciliation"))')
   page.get_by_role('tab',name='Reconciliation',exact=True).click()
   region=page.get_by_role('region',name='Reconciliation records');view=page.get_by_label('Reconciliation view');search=page.get_by_role('textbox',name='Exact order reference or finance ID')
   expect(region.get_by_text('3 matching records',exact=True)).to_be_visible()
   assert page.get_by_role('button',name=re.compile('refund|payout|Paystack',re.I)).count()==0
   count=page.evaluate('window.__financeFixture.requests.length');page.wait_for_timeout(600);assert page.evaluate('window.__financeFixture.requests.length')==count,'No background polling'
   view.select_option('all');expect(region.get_by_text('56 matching records',exact=True)).to_be_visible()
   page.get_by_role('button',name='Next records',exact=True).click();expect(page.get_by_text('26–50 of 56',exact=True)).to_be_visible()
   view.select_option('completed');expect(page.get_by_text(re.compile('^1–25 of '))).to_be_visible();assert region.locator('article').count()==25
   view.select_option('attention');search.fill('MH-FIN-BROWSER-0');page.get_by_role('button',name='Find record',exact=True).click();expect(view).to_have_value('all');expect(region.get_by_text('1 matching records',exact=True)).to_be_visible()
   expect(region.get_by_role('link',name='Open existing order details')).to_have_attribute('href','#orders/ref/MH-FIN-BROWSER-0')
   search.fill('MH-FIN-NOT-FOUND');page.get_by_role('button',name='Find record',exact=True).click();expect(page.get_by_text('No records match this view',exact=True)).to_be_visible()
   search.fill('not-valid');page.get_by_role('button',name='Find record',exact=True).click();expect(page.get_by_text('Use a valid exact order reference or finance ID and bounded page.',exact=True)).to_be_visible()
   search.fill('MH-FIN-BROWSER-1');page.get_by_role('button',name='Find record',exact=True).click();expect(region.get_by_text('Operator-attested service completed',exact=True)).to_be_visible();expect(region.get_by_text('success / failed',exact=True)).to_be_visible();assert 'Archived history' in region.inner_text()
   page.get_by_role('button',name='Clear search',exact=True).click();view.select_option('all');expect(region.get_by_text('56 matching records',exact=True)).to_be_visible()
   page.screenshot(path=str(OUT/f'{width}-records.png'),full_page=False)
   if width<768:
    page.set_viewport_size({'width':width,'height':420});search.scroll_into_view_if_needed();search.focus();expect(search).to_be_focused();assert search.bounding_box()['y']<420;page.set_viewport_size({'width':width,'height':900})
   page.evaluate('window.__financeFixture.failNext=true');page.get_by_role('button',name='Refresh',exact=True).click();expect(page.get_by_text('Synthetic reporting unavailable; no records changed.',exact=True)).to_be_visible();assert region.count()==0
   page.get_by_role('button',name='Try again',exact=True).click();expect(region.get_by_text('56 matching records',exact=True)).to_be_visible()
   page.evaluate('window.__financeFixture.slowNext=true');view.select_option('monitoring');page.wait_for_timeout(100);view.select_option('completed');expect(region.locator('article')).to_have_count(25);page.wait_for_timeout(750);expect(view).to_have_value('completed');assert region.locator('article').count()==25
   search.fill('fin_BROWSER_TOPUP');page.get_by_role('button',name='Find record',exact=True).click();expect(region.get_by_text('Wallet funding outcome unconfirmed',exact=True)).to_be_visible()
   region.get_by_role('button',name='Open customer finance history',exact=True).click();expect(page.get_by_role('heading',name='Customer finance history',exact=True)).to_be_visible();assert page.evaluate('window.__financeFixture.requests.some(r=>r.path.startsWith("/api/admin/finance/customers/fixture-owner"))')
   page.get_by_role('tab',name='Reconciliation',exact=True).click();expect(region.get_by_text('3 matching records',exact=True)).to_be_visible()
   page.evaluate('window.__financeFixture.slowNext=true');page.get_by_role('button',name='Refresh',exact=True).click();page.wait_for_timeout(80);page.evaluate('window.__financeFixture.setToken("expired-session")');expect(page.get_by_text('Unauthorized',exact=True)).to_be_visible();page.wait_for_timeout(750);assert region.count()==0
   assert page.evaluate('window.__financeFixture.writes')==0;assert not errors,errors
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'Horizontal overflow at {width}'
   results.append({'width':width,'passed':True,'cases':'lazy loading, counts, paging, exact search, historical resolution, errors, no polling/writes, stale results/session, finance/order navigation, keyboard focus'})
   page.close()
  page=browser.new_page(viewport={'width':390,'height':900});page.route('**/*',lambda route:route.continue_() if route.request.url.startswith(base) else route.abort());page.goto(base+'?view=reconciliation');expect(page.get_by_role('region',name='Reconciliation records')).to_be_visible();assert page.evaluate('window.__financeFixture.requests.every(r=>r.path.includes("/reconciliation"))');page.close()
  page=browser.new_page(viewport={'width':390,'height':900});page.route('**/*',lambda route:route.continue_() if route.request.url.startswith(base) else route.abort());page.goto(base+'?control-fail');page.get_by_role('button',name='Open read-only reconciliation',exact=True).click();expect(page.get_by_role('region',name='Reconciliation records')).to_be_visible();page.close()
  browser.close()
finally:
 server.shutdown();server.server_close()
(OUT/'results.json').write_text(json.dumps(results,indent=2));print(json.dumps({'widthsPassed':len(results),'additionalChecks':2,'artifacts':str(OUT)}))
