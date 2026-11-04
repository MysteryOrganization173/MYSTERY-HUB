"""Actual chat component, synthetic APIs, Chromium (not an Android device).
Requires npm run build, Python Playwright and Chromium. No external requests allowed.
Run: python3 scripts/reviewMysteryAi.py. Screenshots/results in /tmp/mystery-ai-v2-review.
"""
import functools,http.server,json,os,re,shutil,subprocess,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent
OUT=Path(os.environ.get('AI_REVIEW_DIR','/tmp/mystery-ai-v2-review'));OUT.mkdir(parents=True,exist_ok=True)
subprocess.run(['node','--input-type=module','-'],cwd=ROOT,check=True,text=True,env={**os.environ,'AI_REVIEW_DIR':str(OUT)},input="""
import {build} from 'esbuild';
import path from 'node:path';
await build({entryPoints:['server/suppliers/__tests__/fixtures/mysteryAi.browser.tsx'],bundle:true,format:'esm',outfile:process.env.AI_REVIEW_DIR+'/fixture.js',define:{'import.meta.env':'{}'},loader:{'.css':'empty'},plugins:[{name:'synthetic-context',setup(b){b.onResolve({filter:/context\\/AppContext$/},()=>({path:path.resolve('server/suppliers/__tests__/fixtures/mysteryAi.context.tsx')}));}}]});
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
  for width in [360,390,430]:
   page=browser.new_page(viewport={'width':width,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/*',lambda route:route.continue_() if route.request.url.startswith(base) else route.abort());page.goto(base)
   box=page.locator('textarea');expect(box).to_be_visible()
   def send(text):box.fill(text);box.press('Enter')
   send('What is Mystery Hub?');expect(page.get_by_text(re.compile('^AI answer ·'))).to_have_count(1)
   assert page.get_by_role('button',name='Open Data Bundles',exact=True).count()==0
   count=page.evaluate('window.__aiFixture.requests.length');send('Thanks.');expect(page.get_by_text('You’re welcome!',exact=True)).to_be_visible();assert page.evaluate('window.__aiFixture.requests.length')==count
   send('Open Airtime');action=page.get_by_role('button',name='Open Airtime',exact=True);expect(action).to_be_visible();action.click()
   assert page.evaluate('window.__aiFixture.navigation')==[{'page':'data','mode':'airtime'}]
   expect(page.get_by_role('dialog')).to_have_count(0);page.get_by_role('button',name='Open test chat').click()
   page.get_by_role('button',name='New chat',exact=True).click()
   page.evaluate('window.__aiFixture.mode="quota"');count=page.evaluate('window.__aiFixture.requests.length');send('Explain a rainbow')
   retry=page.get_by_role('button',name='Retry in 2s',exact=True);expect(retry).to_be_disabled();page.screenshot(path=str(OUT/f'{width}-cooldown.png'))
   assert page.evaluate('window.__aiFixture.requests.length')==count+1
   page.evaluate('window.__aiFixture.mode="success"');retry=page.get_by_role('button',name='Retry',exact=True);expect(retry).to_be_enabled(timeout=5000);retry.click()
   expect(page.get_by_text(re.compile('^AI answer ·'))).to_have_count(1)
   assert page.locator('[role=log] .whitespace-pre-wrap').filter(has_text='Explain a rainbow').count()==1
   assert page.evaluate('window.__aiFixture.requests.at(-1).history.every(t=>t.content!=="Explain a rainbow")')
   page.evaluate('window.__aiFixture.mode="long"');send('Explain a longer idea');expect(page.get_by_text(re.compile('^AI answer ·'))).to_have_count(2)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.set_viewport_size({'width':width,'height':480});box.focus();expect(box).to_be_focused();assert box.bounding_box()['y']+box.bounding_box()['height']<=480
   before=page.evaluate('window.__aiFixture.requests.length');box.fill('Line one');box.press('Shift+Enter');assert '\n' in box.input_value();assert page.evaluate('window.__aiFixture.requests.length')==before
   page.screenshot(path=str(OUT/f'{width}-keyboard.png'));box.fill('');page.set_viewport_size({'width':width,'height':844})
   page.evaluate('window.__aiFixture.mode="slow"');send('Explain an unfinished reply');expect(page.get_by_role('button',name='Stop waiting for this reply')).to_be_visible();page.get_by_role('button',name='Stop waiting for this reply').click();page.evaluate('window.__aiFixture.release()');page.wait_for_timeout(100)
   expect(page.get_by_text(re.compile('^AI answer ·'))).to_have_count(2);expect(page.get_by_text('You stopped this reply. Send it again whenever you are ready.',exact=True)).to_be_visible()
   page.goto(base+'?editor');box=page.locator('textarea');expect(box).to_be_visible();send('Why is my phone so slow?');expect(page.get_by_text(re.compile('^AI answer ·'))).to_have_count(1)
   assert page.evaluate('window.__aiFixture.requests[0].editorContext.hasUnsavedChanges')
   count=page.evaluate('window.__aiFixture.requests.length');send('How do I publish my website?');expect(page.get_by_text(re.compile('^Help guide ·'))).to_have_count(1);assert page.evaluate('window.__aiFixture.requests.length')==count
   page.screenshot(path=str(OUT/f'{width}-editor.png'));assert not errors,errors
   results.append({'width':width,'passed':True,'cases':'intent actions, Airtime mode, no incidental actions, instant acknowledgment, quota cooldown, retry history, long reply, reduced viewport, Shift+Enter, stop/late result, editor context and publication guide'})
   page.close()
  browser.close()
 (OUT/'results.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
finally:server.shutdown()
