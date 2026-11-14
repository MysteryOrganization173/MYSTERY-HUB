"""Actual checkout component, synthetic API and payment stub; no production access."""
import http.server,functools,threading,shutil,subprocess,os,re
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent;os.chdir(ROOT)
out=Path('/tmp/recipient-verification-browser');out.mkdir(exist_ok=True)
js="""import{build}from'esbuild';import path from'node:path';await build({entryPoints:['server/suppliers/__tests__/fixtures/checkoutReliability.browser.tsx'],bundle:true,format:'esm',outfile:'/tmp/recipient-verification-browser/fixture.js',define:{'import.meta.env':'{}'},plugins:[{name:'context',setup(b){b.onResolve({filter:/context\\/AppContext$/},()=>({path:path.resolve('server/suppliers/__tests__/fixtures/recipientContext.browser.ts')}));}}]});"""
subprocess.run(['node','--input-type=module','-e',js],check=True)
shutil.copy(next(Path('dist/assets').glob('index-*.css')),out/'style.css');(out/'index.html').write_text('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script type="module" src="/fixture.js"></script>')
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(out)));threading.Thread(target=s.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width in [360,390,430,768,1280]:
  page=b.new_page(viewport={'width':width,'height':800});page.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1') else r.abort())
  page.goto(f'http://127.0.0.1:{s.server_port}/?surface=checkout&case=denied&instant')
  page.locator('input[type=tel]').fill('0241234567');page.locator('input[type=email]').fill('fixture@example.test')
  pay=page.get_by_role('button',name=re.compile('Pay GH'))
  expect(pay).to_be_enabled();pay.click()
  expect(page.get_by_text("This number isn't ready for this bundle yet",exact=True)).to_be_visible();expect(pay).to_be_disabled()
  expect(page.get_by_role('button',name='Try Again',exact=True)).to_have_count(0)
  page.screenshot(path=str(out/f'{width}-denied.png'),full_page=True)
  page.get_by_role('button',name='Try Another Number').click();expect(pay).to_be_disabled()
  page.locator('input[type=tel]').fill('024 123 4567');expect(pay).to_be_disabled()
  support=page.get_by_role('link',name='Contact Support');assert '024' not in support.get_attribute('href');assert '233594521108' in support.get_attribute('href')
  expect(page.get_by_role('button',name='Explore Instant Bundles')).to_be_visible()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.locator('input[type=tel]').fill('0241234568');expect(pay).to_be_enabled();expect(page.get_by_text("This number isn't ready for this bundle yet",exact=True)).to_have_count(0)
  page.close();print(width,'passed: denial, disabled CTA, change number, support privacy, alternative and overflow')
 # Wallet and transient failures use different safe copy and keep Pay blocked until deliberate review.
 for case in ['denied','unavailable']:
  page=b.new_page(viewport={'width':390,'height':800});page.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1') else r.abort())
  page.goto(f'http://127.0.0.1:{s.server_port}/?surface=checkout&case={case}&signed&wallet')
  page.locator('input[type=tel]').fill('0241234567')
  expect(page.get_by_role('radio',name=re.compile('Mystery Wallet'))).to_be_checked()
  pay=page.get_by_role('button',name=re.compile('Pay GH'));expect(pay).to_be_enabled();pay.click()
  expect(pay).to_be_disabled()
  if case=='denied': expect(page.get_by_text('This recipient check was rejected.',exact=False)).to_be_visible()
  else:
   expect(page.get_by_text('The check is temporarily unavailable.',exact=False)).to_be_visible();page.get_by_role('button',name='Review and retry').click();expect(pay).to_be_enabled()
  page.close();print('Wallet',case,'passed')
 page=b.new_page(viewport={'width':390,'height':800});page.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1') else r.abort())
 page.goto(f'http://127.0.0.1:{s.server_port}/?surface=checkout&case=held-wallet&signed&wallet')
 page.locator('input[type=tel]').fill('0241234567');pay=page.get_by_role('button',name=re.compile('Pay GH'));expect(pay).to_be_enabled();pay.click()
 page.wait_for_function('window.__walletPending?.length===1');page.evaluate('window.__swapProduct()')
 pay=page.get_by_role('button',name=re.compile('Pay GH'));expect(pay).to_be_enabled();pay.click();page.wait_for_function('window.__walletPending.length===2')
 page.evaluate('window.__walletPending[0]()');page.wait_for_timeout(100)
 expect(page.get_by_role('button',name='Placing your order…')).to_be_disabled();expect(page.get_by_text("This number isn't ready for this bundle yet",exact=True)).to_have_count(0)
 page.evaluate('window.__walletPending[1]()');expect(page.get_by_text("This number isn't ready for this bundle yet",exact=True)).to_be_visible();page.close();print('Stale Wallet result isolation passed')
 b.close()
s.shutdown()
