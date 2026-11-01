"""Optional local-only mobile review; requires npm build, Python Playwright and Chromium.
No production API, authentication, payment or supplier requests are made.
Run: python scripts/reviewSalesReliability.py
Artifacts: /tmp/mystery-sales-review (override SALES_REVIEW_DIR).
"""
import functools
import http.server
import json
import os
from pathlib import Path
import shutil
import subprocess
import threading
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parent.parent
OUT=Path(os.environ.get('SALES_REVIEW_DIR','/tmp/mystery-sales-review'))
OUT.mkdir(parents=True,exist_ok=True)
subprocess.run(['node','--input-type=module','-'],cwd=ROOT,check=True,env={**os.environ,'SALES_REVIEW_DIR':str(OUT)},input="""
import {build} from 'esbuild';
await build({entryPoints:['server/suppliers/__tests__/fixtures/salesReliability.browser.tsx'],bundle:true,format:'esm',outfile:process.env.SALES_REVIEW_DIR+'/fixture.js',define:{'import.meta.env':'{}'}});
""",text=True)
shutil.copy(next((ROOT/'dist/assets').glob('index-*.css')),OUT/'style.css')
(OUT/'index.html').write_text('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body class="bg-slate-950 text-white"><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>')
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(OUT)))
thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
results=[]
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
        for width in [360,390]:
            page=browser.new_page(viewport={'width':width,'height':844})
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.route('**/*',lambda route:route.continue_() if route.request.url.startswith(f'http://127.0.0.1:{server.server_port}/') else route.abort())
            for case in ['active','recovering','recovered','healthy','empty','loading','error','stale','unavailable','wallet-slow','error-after']:
                page.goto(f'http://127.0.0.1:{server.server_port}/?case={case}')
                expect(page.get_by_text('Sales reliability',exact=True)).to_be_visible()
                if case=='loading': expect(page.get_by_text('Loading checkout evidence…')).to_be_visible()
                elif case=='error': expect(page.get_by_text('Checkout evidence could not be loaded. Health is unknown.',exact=True)).to_be_visible()
                elif case=='active' or case=='wallet-slow': expect(page.get_by_text('Supplier-backed checkout checks failing',exact=True)).to_be_visible()
                elif case=='error-after':
                    expect(page.get_by_text('Incident history',exact=True)).to_be_visible()
                    page.get_by_role('button',name='Check again').click()
                    expect(page.get_by_text('Checkout health uncertain',exact=True)).to_be_visible()
                elif case=='recovering': expect(page.get_by_text('Recovery observed · confirmation pending',exact=True)).to_be_visible()
                elif case=='recovered': expect(page.get_by_text('Recent recovery confirmed',exact=True)).to_be_visible()
                elif case=='healthy': expect(page.get_by_text('Recent fresh preflight checks passed',exact=True)).to_be_visible()
                else: expect(page.get_by_text('Checkout health uncertain',exact=True)).to_be_visible()
                assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),f'Horizontal overflow: {width}/{case}'
                assert not errors,errors
                page.screenshot(path=str(OUT/f'{width}-{case}.png'),full_page=True)
                results.append({'width':width,'case':case,'passed':True})
            page.close()
        browser.close()
finally:
    server.shutdown();server.server_close()
(OUT/'results.json').write_text(json.dumps(results,indent=2))
print(json.dumps({'passed':len(results),'artifacts':str(OUT)}))
