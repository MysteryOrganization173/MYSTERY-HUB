import functools,http.server,threading,json,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import subprocess,os
ROOT=Path(__file__).resolve().parent.parent
os.chdir(ROOT)
out=Path(os.environ.get('FOOTER_REVIEW_DIR','/tmp/v31-footer-browser'));out.mkdir(parents=True,exist_ok=True)
subprocess.run(['node','--input-type=module','-'],check=True,text=True,input="""
import {build} from 'esbuild';
await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {Footer} from './src/components/common/Footer';createRoot(document.getElementById('root')).render(<Footer/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,format:'esm',outfile:process.env.FOOTER_REVIEW_DIR+'/fixture.js',plugins:[{name:'context',setup(b){b.onLoad({filter:/\\/context\\/AppContext\\.tsx$/},()=>({contents:'export const useApp=()=>({setActivePage:()=>{},openDataPage:()=>{}});',loader:'tsx'}));}}]});
""",env={**os.environ,'FOOTER_REVIEW_DIR':str(out)})
shutil.copy(next(Path('dist/assets').glob('index-*.css')),out/'style.css')
(out/'index.html').write_text('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body class="bg-slate-950"><div id="root"></div><script type="module" src="/fixture.js"></script>')
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(out)))
threading.Thread(target=server.serve_forever,daemon=True).start()
results=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [320,360,390,430,768,1440]:
   page=browser.new_page(viewport={'width':width,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(f'http://127.0.0.1:{server.server_port}/') else r.abort())
   page.goto(f'http://127.0.0.1:{server.server_port}')
   expect(page.get_by_role('link',name='Join WhatsApp Channel')).to_have_attribute('href','https://whatsapp.com/channel/0029VbBt1MGC6ZvlDJ8Biz3l')
   expect(page.get_by_role('link',name='Join Telegram Channel')).to_have_attribute('href','https://t.me/mysteryhubapp')
   expect(page.get_by_role('link',name='WhatsApp support',exact=True)).to_have_attribute('href','https://wa.me/233594521108')
   expect(page.get_by_role('link',name='0594521108')).to_have_attribute('href','tel:+233594521108')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'overflow {width}'
   page.get_by_role('link',name='Join Telegram Channel').focus();expect(page.get_by_role('link',name='Join Telegram Channel')).to_be_focused()
   page.screenshot(path=str(out/f'{width}-footer.png'),full_page=True)
   assert not errors,errors
   results.append({'width':width,'checks':'channels/support/no overflow/keyboard focus','passed':True})
   page.close()
  browser.close()
finally:server.shutdown()
print(json.dumps(results))
