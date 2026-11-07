"""Actual checker component, synthetic sessions/supplier-free APIs. No payments or outbound traffic.
CHECKER_REVIEW_BASE_SHA can reproduce the logout privacy defect against original main.
"""
import functools,http.server,threading,json,shutil,subprocess,os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent;os.chdir(ROOT)
out=Path(os.environ.get('CHECKER_REVIEW_DIR','/tmp/v31-checkers-browser'));out.mkdir(parents=True,exist_ok=True)
subprocess.run(['node','--input-type=module','-'],check=True,text=True,env={**os.environ,'CHECKER_REVIEW_DIR':str(out)},input=r'''
import {build} from 'esbuild';import {execFileSync} from 'node:child_process';import {dirname} from 'node:path';
await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{ResultsCheckersPage}from'./src/components/checkers/ResultsCheckersPage';
window.__checker={hold:false,pending:[],payments:0};createRoot(document.getElementById('root')).render(<ResultsCheckersPage/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,format:'esm',outfile:process.env.CHECKER_REVIEW_DIR+'/fixture.js',plugins:[{name:'synthetic',setup(b){
 b.onLoad({filter:/\/context\/AppContext\.tsx$/},()=>({loader:'tsx',contents:`import {useSyncExternalStore} from'react';let state={user:{id:'buyer',email:'buyer@example.test',phone:'0240000000'},sessionToken:'synthetic-buyer'};let listeners=new Set();window.__checkerSession=(id)=>{state=id?{user:{id,email:id+'@example.test',phone:'0200000000'},sessionToken:'synthetic-'+id}:{user:null,sessionToken:null};for(const f of listeners)f();};const openAuth=()=>{};export const useApp=()=>({...useSyncExternalStore(f=>{listeners.add(f);return()=>listeners.delete(f)},()=>state),openAuth});`}));
 b.onLoad({filter:/\/services\/resultsCheckerApi\.ts$/},()=>({loader:'ts',contents:`export const getCheckerConfig=async()=>({available:false,message:'Results checkers are not on sale yet.',maxQty:5,products:[{key:'bece',name:'BECE Results Checker',short:'BECE',priceMinor:2399,available:false,stock:null},{key:'wassce',name:'WASSCE Results Checker',short:'WASSCE',priceMinor:2499,available:false,stock:null}]});export const getCheckerReceipt=async(ref,token)=>{if(window.__checker.hold)await new Promise(r=>window.__checker.pending.push(r));if(token!=='synthetic-buyer')throw Error('Order not found.');return {orderRef:'SYNTHETIC-ONLY',productName:'BECE Results Checker',qty:1,status:'delivered',paid:true,manualReview:false,pins:[{pin:'PRIVATEFIXTURE1234',serial:'SYNTHETIC1234'}],pinsExpected:1,state:'ready'};};export const initializeCheckerPayment=async()=>{window.__checker.payments++;throw Error('No real payments in review');};`}));
 b.onLoad({filter:/\/services\/apiClient\.ts$/},()=>({loader:'ts',contents:`export const verifyPaymentOnServer=async()=>{throw Error('No payment verification in review')};`}));
 if(process.env.CHECKER_REVIEW_BASE_SHA)b.onLoad({filter:/ResultsCheckersPage\.tsx$/},args=>({contents:execFileSync('git',['show',process.env.CHECKER_REVIEW_BASE_SHA+':src/components/checkers/ResultsCheckersPage.tsx'],{encoding:'utf8'}),resolveDir:dirname(args.path),loader:'tsx'}));
}}]});
''')
shutil.copy(next(Path('dist/assets').glob('index-*.css')),out/'style.css')
(out/'index.html').write_text('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/fixture.css"><body class="bg-slate-950 text-white"><div id="root"></div><script type="module" src="/fixture.js"></script>')
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
   page.goto(f'http://127.0.0.1:{server.server_port}/?order=synthetic')
   expect(page.get_by_text('PRIVATEFIXTURE1234',exact=True)).to_be_visible()
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.screenshot(path=str(out/f'{width}-private-receipt.png'),full_page=True)
   page.evaluate('window.__checkerSession(null)')
   expect(page.get_by_text('PRIVATEFIXTURE1234',exact=True)).to_have_count(0)
   page.evaluate("window.__checker.hold=true;window.__checkerSession('buyer')")
   page.wait_for_function('window.__checker.pending.length>0')
   page.evaluate("window.__checkerSession('other');for(const r of window.__checker.pending)r();window.__checker.pending=[];window.__checker.hold=false")
   expect(page.get_by_text('Order not found.',exact=True)).to_be_visible()
   expect(page.get_by_text('PRIVATEFIXTURE1234',exact=True)).to_have_count(0)
   expect(page.get_by_role('button',name='Pay securely')).to_have_count(0)
   assert page.evaluate('window.__checker.payments')==0
   assert not errors,errors
   page.screenshot(path=str(out/f'{width}-dormant.png'),full_page=True)
   results.append({'width':width,'passed':'receipt, logout, late previous response, account switch, dormant, no payment, overflow'})
   page.close()
  browser.close()
finally:server.shutdown()
print(json.dumps(results))
