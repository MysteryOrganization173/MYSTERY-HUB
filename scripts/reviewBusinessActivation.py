"""Actual Admin components + synthetic read-only APIs; never production owner data.
Requires npm run build, Python Playwright and Chromium. Screenshots/results saved locally.
Run: python3 scripts/reviewBusinessActivation.py
"""
import functools,http.server,json,os,re,shutil,subprocess,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent
OUT=Path(os.environ.get('ACTIVATION_REVIEW_DIR','/tmp/mystery-business-activation-review'));OUT.mkdir(parents=True,exist_ok=True)
subprocess.run(['node','--input-type=module','-'],cwd=ROOT,check=True,text=True,env={**os.environ,'ACTIVATION_REVIEW_DIR':str(OUT)},input="""
import {build} from 'esbuild';
await build({entryPoints:['server/suppliers/__tests__/fixtures/businessActivation.browser.tsx'],bundle:true,format:'esm',outfile:process.env.ACTIVATION_REVIEW_DIR+'/fixture.js',define:{'import.meta.env':'{}'}});
""")
shutil.copy(next((ROOT/'dist/assets').glob('index-*.css')),OUT/'style.css')
(OUT/'index.html').write_text('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body class="bg-slate-950 text-white"><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>')
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(OUT)))
threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}/';results=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
  for width in [320,360,390,430,768,1440]:
   page=browser.new_page(viewport={'width':width,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/*',lambda route:route.continue_() if route.request.url.startswith(base) else route.abort());page.goto(base)
   snapshot=page.get_by_role('region',name='Business owner activation');expect(snapshot).to_be_visible()
   assert snapshot.get_by_text('30',exact=True).count()==1;assert snapshot.get_by_text('15',exact=True).count()==2
   expect(snapshot.get_by_text(re.compile('not verified businesses'))).to_be_visible()
   search=page.get_by_role('textbox',name='Search websites');date=page.get_by_role('combobox',name='Website date range');owner=page.get_by_role('combobox',name='Owner activation');status=page.get_by_role('combobox',name='Website status');region=page.get_by_role('region',name='Website project results')
   snapshot.screenshot(path=str(OUT/f'{width}-snapshot.png'))
   search.fill('Owner 30');expect(region.get_by_text('1 matching website',exact=True)).to_be_visible()
   page.get_by_role('button',name='Show projects for draft-only customer owners across all time').click()
   expect(date).to_have_value('all');expect(owner).to_have_value('draft_only');expect(search).to_have_value('');expect(region.get_by_text('15 matching websites',exact=True)).to_be_visible();expect(region).to_be_focused();page.wait_for_function("document.querySelector('[aria-label=\"Website project results\"]').getBoundingClientRect().top>=64 && document.querySelector('[aria-label=\"Website project results\"]').getBoundingClientRect().top<200")
   assert region.bounding_box()['y']>=64 and region.bounding_box()['y']<900
   page.screenshot(path=str(OUT/f'{width}-draft-only.png'),full_page=False)
   search.fill('Owner 30');expect(page.get_by_text('No websites match these filters',exact=True)).to_be_visible()
   page.get_by_role('button',name='Show published sites for customer owners across all time').click();expect(status).to_have_value('published');expect(region.get_by_text('15 matching websites',exact=True)).to_be_visible()
   page.get_by_role('button',name='Show projects for active customer owners across all time').click();expect(region.get_by_text('31 matching websites',exact=True)).to_be_visible()
   page.get_by_role('button',name='Next',exact=True).click();expect(region.get_by_text('31 matching websites',exact=True)).to_be_visible()
   owner.select_option('draft_only');expect(page.get_by_role('button',name='Previous',exact=True)).to_be_disabled()
   page.get_by_role('button',name='Show total website projects in the selected date range').click();expect(owner).to_have_value('');expect(region.get_by_text('32 matching websites',exact=True)).to_be_visible()
   search.fill('Owner 0');expect(region.get_by_text('1 matching website',exact=True)).to_be_visible();region.get_by_role('button',name='Inspect Site').click()
   sheet=page.get_by_role('dialog',name='Inspect Site');expect(sheet.get_by_role('heading',name='Registered owner account')).to_be_visible()
   assert not page.evaluate('window.__websiteFixture.requests.some(p=>p.endsWith("/engagement"))')
   expect(sheet.get_by_text('Latest successful publication',exact=True)).to_be_visible();expect(sheet.get_by_text('Last project change',exact=True)).to_be_visible()
   expect(sheet.get_by_role('link',name='Open Public Site')).to_have_attribute('href','https://mysterybundlehub.com/sites/review-site-0')
   sheet.get_by_role('button',name='Load public engagement').click();expect(sheet.get_by_text('12',exact=True)).to_be_visible();expect(sheet.get_by_text('WhatsApp handoff clicks',exact=True)).to_be_visible()
   expect(sheet.get_by_text(re.compile('not proof a message was sent'))).to_be_visible()
   sheet.get_by_role('region',name='Public engagement evidence').scroll_into_view_if_needed();page.screenshot(path=str(OUT/f'{width}-engagement.png'),full_page=False)
   page.evaluate('window.__websiteFixture.failEngagement=true');sheet.get_by_role('button',name='Refresh engagement').click();expect(sheet.get_by_text(re.compile('Public engagement could not be loaded'))).to_be_visible();expect(sheet.get_by_text('private-owner-0@fixture.test',exact=True)).to_be_visible()
   sheet.get_by_role('button',name='Retry engagement').click();expect(sheet.get_by_text('12',exact=True)).to_be_visible()
   page.evaluate('window.__websiteFixture.badEngagement=true');sheet.get_by_role('button',name='Refresh engagement').click();expect(sheet.get_by_role('button',name='Retry engagement')).to_be_visible()
   sheet.get_by_role('button',name='Close',exact=True).click()
   search.fill('Owner 1');expect(region.get_by_text('11 matching websites',exact=True)).to_be_visible();region.get_by_role('button',name='Inspect Site').first.click()
   sheet=page.get_by_role('dialog',name='Inspect Site');sheet.get_by_role('button',name='Load public engagement').click();expect(sheet.get_by_text(re.compile('No recorded public views or contact actions'))).to_be_visible()
   assert sheet.get_by_role('link',name='Open Public Site').count()==0
   page.set_viewport_size({'width':width,'height':480});button=sheet.get_by_role('button',name='Copy owner email');button.scroll_into_view_if_needed();expect(button).to_be_visible();button.focus();expect(button).to_be_focused();page.set_viewport_size({'width':width,'height':900})
   page.evaluate('window.__websiteFixture.holdEngagement=true');sheet.get_by_role('button',name='Refresh engagement').click();sheet.get_by_role('button',name='Close',exact=True).click()
   search.fill('Owner 0');expect(region.get_by_text('1 matching website',exact=True)).to_be_visible();region.get_by_role('button',name='Inspect Site').click();sheet=page.get_by_role('dialog',name='Inspect Site');sheet.get_by_role('button',name='Load public engagement').click();expect(sheet.get_by_text('12',exact=True)).to_be_visible();page.wait_for_timeout(800);expect(sheet.get_by_text('12',exact=True)).to_be_visible();assert sheet.get_by_text(re.compile('No recorded public views or contact actions')).count()==0
   page.evaluate('window.__websiteFixture.holdEngagement=true');sheet.get_by_role('button',name='Refresh engagement').click();page.evaluate('window.__websiteFixture.switchToken("expired-session")');expect(page.get_by_role('dialog')).to_have_count(0);page.wait_for_timeout(800);assert page.get_by_text('private-owner-0@fixture.test',exact=True).count()==0
   page.evaluate('window.__websiteFixture.switchToken("synthetic-admin")');expect(snapshot).to_be_visible();page.evaluate('window.__websiteFixture.oldBackend=true');page.get_by_role('button',name='Refresh',exact=True).click();expect(page.get_by_text('Owner snapshot unavailable. Project records below remain available.',exact=True)).to_be_visible()
   page.evaluate('window.__websiteFixture.oldBackend=false;window.__websiteFixture.empty=true');page.get_by_role('button',name='Refresh',exact=True).click();expect(snapshot.get_by_text('0',exact=True)).to_have_count(3)
   assert page.evaluate('window.__websiteFixture.mutations')==0;assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
   results.append({'width':width,'passed':True,'cases':'owner snapshot/definitions, mixed-owner filtering, card scope/reset/reveal, pagination, privacy, lazy engagement, latest publication, missing/error/malformed observations, contacts, mobile panel, stale site/session responses, rolling backend, empty state, no writes'})
   page.close()
  browser.close()
 (OUT/'results.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
finally:server.shutdown()
