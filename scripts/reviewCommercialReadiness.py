"""Actual Admin pricing/readiness components, synthetic read-only responses. No production requests.
READINESS_REVIEW_BASE_SHA substitutes the old commercial component to demonstrate the missing workspace.
"""
import functools,http.server,threading,json,shutil,subprocess,os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent;os.chdir(ROOT)
out=Path(os.environ.get('READINESS_REVIEW_DIR','/tmp/v31-readiness-browser'));out.mkdir(parents=True,exist_ok=True)
subprocess.run(['node','--input-type=module','-'],check=True,text=True,env={**os.environ,'READINESS_REVIEW_DIR':str(out)},input=r'''
import{build}from'esbuild';import{execFileSync}from'node:child_process';import{dirname}from'node:path';
await build({entryPoints:['server/suppliers/__tests__/fixtures/commercialReadiness.browser.tsx'],bundle:true,format:'esm',outfile:process.env.READINESS_REVIEW_DIR+'/fixture.js',define:{'import.meta.env':'{}'},plugins:[{name:'api',setup(b){
b.onLoad({filter:/\/services\/commercialApi\.ts$/},()=>({loader:'ts',contents:`export const commercialRequest=async(path,token,body)=>{if(body)throw Error('Mutations forbidden in review');if(path!=='admin/commercial/readiness')throw Error('Synthetic pricing unavailable');const c=window.__readiness;c.requests++;if(c.hold)await new Promise(r=>c.pending.push(r));if(token!=='synthetic-admin'||c.fail)throw Error('Synthetic unavailable');const result={readOnly:true,observedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+(c.stale?-1000:60000)).toISOString(),livePaymentConfigured:false,accountFingerprint:'abcdef123456',services:['orders','airtime','instant_bundles','afa','vouchers'].map((id,i)=>({id,name:['Regular Data','Airtime','Instant Bundles','AFA registration','Results Checkers'][i],state:i===4?'disabled':i===0?'unverified':'checks_passed',supplierConfigured:true,keyPermission:true,keyGranted:i===0?false:true,available:true,reportedProducts:i===1?0:2,catalogue:{state:i===3?'not_applicable':'verified',count:i===3?null:c.count,products:i===3?[]:[{id:'synthetic-product',name:'Synthetic product',costMinor:1800,stock:i===4?8:null}]},pricing:i===1?'Server service fee: 0%.':'Existing server pricing applies; not net profit.',blockers:i===0?['Permission flags disagree; supplier clarification is required.']:i===4?['Checker commercial flag is disabled.']:[],...(i===4?{checkers:[{name:'BECE Results Checker',mapping:'ok',retailMinor:2399,costMinor:1800,stock:8,grossSpreadMinor:599}]}:{})}))};if(c.malformed)result.services[0].catalogue.products=[null];return result;};`}));
if(process.env.READINESS_REVIEW_BASE_SHA)b.onLoad({filter:/AdminCommercialSection\.tsx$/},args=>({contents:execFileSync('git',['show',process.env.READINESS_REVIEW_BASE_SHA+':src/components/admin/sections/AdminCommercialSection.tsx'],{encoding:'utf8'}),resolveDir:dirname(args.path),loader:'tsx'}));
}}]});
''')
shutil.copy(next(Path('dist/assets').glob('index-*.css')),out/'style.css')
(out/'index.html').write_text('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body class="bg-slate-950"><div id="root"></div><script type="module" src="/fixture.js"></script>')
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(out)));threading.Thread(target=server.serve_forever,daemon=True).start()
results=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [320,360,390,430,768,1440]:
   page=browser.new_page(viewport={'width':width,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(f'http://127.0.0.1:{server.server_port}/') else r.abort())
   page.goto(f'http://127.0.0.1:{server.server_port}/')
   expect(page.get_by_role('heading',name='Service readiness & commercial operations')).to_be_visible()
   expect(page.get_by_role('button',name='Retry commercial settings')).to_be_visible()
   expect(page.get_by_text('Checker commercial flag is disabled.',exact=True)).to_be_visible()
   expect(page.get_by_text('Permission flags disagree; supplier clarification is required.',exact=True)).to_be_visible()
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.get_by_role('region',name='Results Checkers').get_by_text('Catalogue evidence (verified)',exact=True).click()
   expect(page.get_by_role('region',name='Results Checkers').get_by_text('Synthetic product',exact=True)).to_be_visible()
   page.screenshot(path=str(out/f'{width}-readiness.png'),full_page=True)
   page.evaluate('window.__readiness.fail=true')
   page.get_by_role('button',name='Refresh readiness').click()
   expect(page.get_by_text('Readiness could not be loaded. Wait a moment, then refresh. No service settings were changed.',exact=True)).to_be_visible()
   expect(page.get_by_role('region',name='Results Checkers')).to_have_count(0)
   page.evaluate('window.__readiness.fail=false;window.__readiness.malformed=true')
   page.get_by_role('button',name='Refresh readiness').click()
   expect(page.get_by_text('Readiness could not be loaded. Wait a moment, then refresh. No service settings were changed.',exact=True)).to_be_visible()
   expect(page.get_by_role('region',name='Results Checkers')).to_have_count(0)
   page.evaluate('window.__readiness.malformed=false;window.__readiness.stale=true')
   page.get_by_role('button',name='Refresh readiness').click()
   expect(page.get_by_text('Evidence is stale. Refresh before making an operational decision.',exact=True)).to_be_visible()
   page.evaluate('window.__readiness.hold=true')
   before=page.evaluate('window.__readiness.requests')
   page.get_by_role('button',name='Refresh readiness').evaluate('(el)=>{el.click();el.click()}')
   page.wait_for_function('window.__readiness.pending.length===1')
   assert page.evaluate('window.__readiness.requests')==before+1
   page.evaluate("window.__readinessSession('expired-session')")
   expect(page.get_by_role('region',name='Results Checkers')).to_have_count(0)
   page.wait_for_function('window.__readiness.pending.length===2')
   page.evaluate('for(const r of window.__readiness.pending)r();window.__readiness.hold=false')
   expect(page.get_by_text('Readiness could not be loaded. Wait a moment, then refresh. No service settings were changed.',exact=True)).to_be_visible()
   expect(page.get_by_role('region',name='Results Checkers')).to_have_count(0)
   assert not errors,errors
   results.append({'width':width,'passed':'pricing independence, evidence, details, errors, stale, session/late response, double click, overflow'})
   page.close()
  browser.close()
finally:server.shutdown()
print(json.dumps(results))
