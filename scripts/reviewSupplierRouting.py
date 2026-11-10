"""Real component + synthetic API, no live supplier or Admin calls."""
import http.server, functools, threading, shutil, subprocess, os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parent.parent
os.chdir(ROOT)
out=Path('/tmp/supplier-routing-browser'); out.mkdir(exist_ok=True)
subprocess.run(['node','--input-type=module','-e',"import{build}from'esbuild';await build({entryPoints:['server/suppliers/__tests__/fixtures/supplierRouting.browser.tsx'],bundle:true,format:'esm',outfile:'/tmp/supplier-routing-browser/fixture.js',define:{'import.meta.env':'{}'}});"],check=True)
shutil.copy(next(Path('dist/assets').glob('index-*.css')),out/'style.css')
(out/'index.html').write_text('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script type="module" src="/fixture.js"></script>')
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(out)))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width in [360,390,1440]:
  page=browser.new_page(viewport={'width':width,'height':900})
  page.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1') else r.abort())
  page.goto(f'http://127.0.0.1:{server.server_port}')
  expect(page.get_by_role('heading',name='Supplier Routing')).to_be_visible()
  expect(page.get_by_role('heading',name='TELCOGH',exact=True)).to_be_visible()
  expect(page.get_by_text('Inactive / unavailable',exact=True)).to_be_visible()
  expect(page.get_by_role('list',name='Effective telecom routes').locator('li')).to_have_count(9)
  assert page.get_by_role('button').count()==1
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.screenshot(path=str(out/f'{width}-routing.png'),full_page=True)
  page.evaluate("window.__routingMode='hold'")
  page.get_by_role('button',name='Refresh routing',exact=True).click()
  expect(page.get_by_role('button',name='Loading…',exact=True)).to_be_disabled()
  expect(page.get_by_role('list',name='Effective telecom routes')).to_have_count(0)
  page.wait_for_function('window.__routingPending.length>0')
  page.evaluate("window.__routingMode='error';for(const done of window.__routingPending)done()")
  expect(page.get_by_role('alert')).to_contain_text('could not be loaded')
  page.evaluate("window.__routingMode='malformed'")
  page.get_by_role('button',name='Refresh routing',exact=True).click()
  expect(page.get_by_role('alert')).to_be_visible()
  page.evaluate("window.__routingMode='success'")
  page.get_by_role('button',name='Refresh routing',exact=True).click()
  expect(page.get_by_role('list',name='Effective telecom routes').locator('li')).to_have_count(9)
  page.close(); print(width,'passed: routes, inactive provider, loading, failure, malformed response, recovery, no overflow')
 browser.close()
server.shutdown()
