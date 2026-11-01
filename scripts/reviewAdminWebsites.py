"""Local-only browser interactions at mobile/tablet/desktop widths using synthetic APIs.
Requires npm build, Python Playwright and Chromium. No outbound messages/mutations.
ADMIN_WEBSITE_BASE_SHA optionally substitutes the original Admin component to reproduce
the metric-card failure. Artifacts default to /tmp/mystery-admin-website-review.
"""
import functools
import http.server
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import threading
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parent.parent
OUT=Path(os.environ.get('ADMIN_WEBSITE_REVIEW_DIR','/tmp/mystery-admin-website-review'))
OUT.mkdir(parents=True,exist_ok=True)
subprocess.run(['node','--input-type=module','-'],cwd=ROOT,check=True,text=True,env={**os.environ,'ADMIN_WEBSITE_REVIEW_DIR':str(OUT)},input="""
import {build} from 'esbuild';import {execFileSync} from 'node:child_process';import {dirname} from 'node:path';
const baseline=process.env.ADMIN_WEBSITE_BASE_SHA;
await build({entryPoints:['server/suppliers/__tests__/fixtures/adminWebsite.browser.tsx'],bundle:true,format:'esm',outfile:process.env.ADMIN_WEBSITE_REVIEW_DIR+'/fixture.js',define:{'import.meta.env':'{}'},plugins:baseline?[{name:'baseline',setup(b){b.onLoad({filter:/AdminWebsiteBuilderSection\\.tsx$/},args=>({contents:execFileSync('git',['show',baseline+':src/components/admin/sections/AdminWebsiteBuilderSection.tsx'],{encoding:'utf8'}),loader:'tsx',resolveDir:dirname(args.path)}));}}]:[]});
""")
shutil.copy(next((ROOT/'dist/assets').glob('index-*.css')),OUT/'style.css')
(OUT/'index.html').write_text('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body class="bg-slate-950 text-white"><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>')
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(OUT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
results=[]
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
        for width in [320,360,390,430,768,1440]:
            page=browser.new_page(viewport={'width':width,'height':900});page.emulate_media(reduced_motion='reduce')
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.route('**/*',lambda route:route.continue_() if route.request.url.startswith(f'http://127.0.0.1:{server.server_port}/') else route.abort())
            page.goto(f'http://127.0.0.1:{server.server_port}/')
            metric=lambda label:page.get_by_role('button',name=re.compile(label))
            expect(metric('Published Sites')).to_be_visible()
            search=page.get_by_role('textbox',name='Search websites');template=page.get_by_label('Website template');status=page.get_by_label('Website status');region=page.get_by_role('region',name='Website project results')
            if os.environ.get('ADMIN_WEBSITE_BASE_SHA'):
                search.fill('No matching business');template.select_option('tmpl-boutique')
                expect(page.get_by_text('No websites match these filters.',exact=True)).to_be_visible()
                metric('Published Sites').click()
                page.screenshot(path=str(OUT/f'{width}-baseline-metric.png'),full_page=True)
                expect(search).to_have_value('')
            page.get_by_role('button',name='Next',exact=True).click();expect(region.get_by_text('26–30 of 30',exact=True)).to_be_visible()
            search.fill('No matching business');template.select_option('tmpl-boutique');expect(page.get_by_text('No websites match these filters',exact=True)).to_be_visible()
            metric('Published Sites').click();expect(search).to_have_value('');expect(template).to_have_value('');expect(status).to_have_value('published')
            expect(region.get_by_text('15 matching websites',exact=True)).to_be_visible()
            assert region.evaluate('(el)=>document.activeElement===el'),'Metric must focus results'
            assert 64<=region.bounding_box()['y']<200,'Metric must reveal results below the sticky Admin header'
            assert region.locator('article').count()==15
            page.screenshot(path=str(OUT/f'{width}-published-results.png'),full_page=True)
            metric('Draft Sites').click();expect(status).to_have_value('draft');expect(region.get_by_text('15 matching websites',exact=True)).to_be_visible()
            metric('Total Website Projects').click();expect(status).to_have_value('');expect(region.get_by_text('30 matching websites',exact=True)).to_be_visible()
            assert page.get_by_text('Free Sites',exact=True).evaluate('(el)=>el.closest("button")===null')
            page.get_by_label('Website date range').select_option('all');expect(region.get_by_text('31 matching websites',exact=True)).to_be_visible()
            results.append({'width':width,'case':'metrics/filter/pagination/date/reveal','passed':True})
            region.locator('article').first.get_by_role('button',name='Inspect Site').click()
            dialog=page.get_by_role('dialog');expect(dialog.get_by_role('heading',name='Registered owner account')).to_be_visible()
            assert page.evaluate('window.__websiteFixture.requests.some(p=>p==="/api/admin/website-builder/site_review_0")')
            owner=dialog.locator('section[aria-label="Registered owner account"]')
            expect(owner.get_by_text('private-owner-0@fixture.test',exact=True)).to_be_visible()
            expect(dialog.get_by_role('link',name='Open Public Site')).to_have_attribute('href','https://mysterybundlehub.com/sites/review-site-0')
            expect(dialog.get_by_role('link',name='Open business WhatsApp')).to_have_attribute('href','https://wa.me/233200000000')
            expect(dialog.get_by_role('link',name='Try owner phone on WhatsApp')).to_have_attribute('href','https://wa.me/233590000000')
            dialog.get_by_role('button',name='Copy owner phone',exact=True).click();expect(dialog.get_by_text('Owner phone copied.',exact=True)).to_be_visible();assert page.evaluate('window.__websiteFixture.clipboard')=='+233590000000'
            page.evaluate('window.__websiteFixture.copyFails=true');dialog.get_by_role('button',name='Copy owner email',exact=True).click();expect(dialog.get_by_text('Copy failed. Select the saved value and copy it manually.',exact=True)).to_be_visible()
            assert dialog.evaluate('(el)=>el.scrollWidth<=el.clientWidth'),'Dialog overflow'
            page.screenshot(path=str(OUT/f'{width}-inspect.png'),full_page=True)
            confirmation=dialog.get_by_role('textbox',name='Type review-site-0 to confirm')
            if width<768:
                page.set_viewport_size({'width':width,'height':420});confirmation.scroll_into_view_if_needed();confirmation.focus();expect(confirmation).to_be_focused();assert confirmation.bounding_box()['y']<420
                page.set_viewport_size({'width':width,'height':900})
            confirmation.fill('review-site-0')
            page.evaluate('window.__websiteFixture.failUnpublish=true')
            dialog.get_by_role('button',name='Confirm Force Unpublish',exact=True).click()
            expect(dialog.get_by_text('Synthetic unpublish unavailable',exact=True)).to_be_visible()
            page.evaluate('window.__websiteFixture.failUnpublish=false')
            dialog.get_by_role('button',name='Confirm Force Unpublish',exact=True).evaluate('(el)=>{el.click();el.click();}')
            expect(dialog).to_have_count(0);expect(page.get_by_text('Website unpublished.',exact=True)).to_be_visible();assert page.evaluate('window.__websiteFixture.mutations')==2
            results.append({'width':width,'case':'inspect/contacts/copy/public-link/keyboard/moderation','passed':True})
            search.fill('Owner 1');expect(region.get_by_text('11 matching websites',exact=True)).to_be_visible()
            region.locator('article').first.get_by_role('button',name='Inspect Site').click();expect(page.get_by_role('dialog').get_by_text('private-owner-1@fixture.test',exact=True)).to_be_visible()
            assert page.get_by_role('dialog').get_by_text('Not provided',exact=True).count()==2
            assert page.get_by_role('dialog').get_by_role('link',name='Open Public Site').count()==0
            assert page.get_by_role('dialog').get_by_role('link',name='Try owner phone on WhatsApp').count()==0
            page.keyboard.press('Escape');expect(page.get_by_role('dialog')).to_have_count(0)
            search.fill('slow');page.wait_for_timeout(300);search.fill('Owner 2');expect(region.get_by_text('11 matching websites',exact=True)).to_be_visible();page.wait_for_timeout(650);assert region.locator('article').count()==11
            page.evaluate('window.__websiteFixture.rename()');search.fill('');page.get_by_role('button',name='Refresh',exact=True).click();expect(region.get_by_role('heading',name='Refreshed business',exact=True)).to_be_visible()
            page.evaluate('window.__websiteFixture.failSummary=true');page.get_by_role('button',name='Refresh',exact=True).click();expect(page.get_by_text('Synthetic list unavailable',exact=True)).to_be_visible()
            page.evaluate('window.__websiteFixture.failSummary=false');page.get_by_role('button',name='Refresh',exact=True).click();expect(region.get_by_role('heading',name='Refreshed business',exact=True)).to_be_visible()
            page.evaluate('window.__websiteFixture.failDetail=true');region.locator('article').first.get_by_role('button',name='Inspect Site').click();expect(page.get_by_role('dialog').get_by_text('Website details could not be loaded. Please retry.',exact=True)).to_be_visible()
            page.get_by_role('dialog').get_by_role('button',name='Try again').click();expect(page.get_by_role('dialog').get_by_text('private-owner-0@fixture.test',exact=True)).to_be_visible()
            page.keyboard.press('Escape');page.evaluate('window.__websiteFixture.holdNextDetail=true');region.locator('article').first.get_by_role('button',name='Inspect Site').click()
            page.evaluate('window.__websiteFixture.switchToken("changed-session")');expect(page.get_by_role('dialog')).to_have_count(0);assert page.get_by_text('private-owner-0@fixture.test',exact=True).count()==0
            page.wait_for_timeout(650);assert page.get_by_text('private-owner-0@fixture.test',exact=True).count()==0
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'Page overflow {width}'
            assert not errors,errors
            page.screenshot(path=str(OUT/f'{width}-after.png'),full_page=True)
            results.append({'width':width,'case':'missing/empty/stale/refresh/error/session','passed':True})
            page.close()
        browser.close()
finally:
    server.shutdown();server.server_close()
(OUT/'results.json').write_text(json.dumps(results,indent=2));print(json.dumps({'passed':len(results),'artifacts':str(OUT)}))
