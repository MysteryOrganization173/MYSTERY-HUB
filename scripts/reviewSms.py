"""Real React + real Admin/customer SMS APIs against an empty disposable PostgreSQL DB. No provider calls."""
import os,subprocess,shutil,json,select,re,time
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parent.parent;os.chdir(root);out=Path('/tmp/sms-browser');out.mkdir(exist_ok=True)
subprocess.run(['node','--input-type=module','-e',"import{build}from'esbuild';await build({entryPoints:['server/suppliers/__tests__/fixtures/sms.browser.tsx'],bundle:true,format:'esm',outfile:'/tmp/sms-browser/fixture.js',define:{'import.meta.env':'{}'}});"],check=True)
shutil.copy(next(Path('dist/assets').glob('index-*.css')),out/'style.css');(out/'index.html').write_text('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script type="module" src="/fixture.js"></script>')
env={**os.environ,'NODE_ENV':'test','DATABASE_SSL':'false','MYSTERY_TEST_DATABASE_OPT_IN':'true'};assert env.get('DATABASE_URL','').startswith('postgresql://app_owner:local-owner-only@127.0.0.1:55434/mystery_sms_browser_test')
server=subprocess.Popen(['node','--import','tsx','scripts/smsPreviewServer.ts'],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
 deadline=time.time()+35;port=None
 while time.time()<deadline:
  assert select.select([server.stdout],[],[],10)[0],'Preview server did not start'
  line=server.stdout.readline()
  if not line:raise RuntimeError(server.stderr.read()[-1500:])
  if line.startswith('{"port":'):port=json.loads(line)['port'];break
 assert port;origin=f'http://127.0.0.1:{port}'
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [360,390,430,768,1280]:
   context=browser.new_context(viewport={'width':width,'height':900},permissions=['clipboard-read','clipboard-write']);page=context.new_page();page.on('dialog',lambda dialog:dialog.accept());page.route('**/*',lambda route:route.continue_() if route.request.url.startswith(origin) else route.abort())
   reset=context.request.put(origin+'/api/sms/preferences',headers={'Authorization':'Bearer token-sms-browser-customer'},data={'marketing':False,'transactional':True,'confirmed':True});assert reset.status==200
   page.goto(origin);expect(page.get_by_role('heading',name='Audience & Contacts')).to_be_visible();expect(page.get_by_role('button',name='Prepare SMS audience')).to_be_visible()
   page.get_by_role('combobox',name='Contact source').select_option('registered');expect(page.get_by_role('button',name='Registered buyers',exact=False)).to_be_visible()
   page.get_by_role('button',name='Registered buyers',exact=False).click();expect(page.get_by_role('combobox',name='Contact source')).to_have_value('registered')
   page.get_by_role('button',name='Prepare SMS audience').click();expect(page.get_by_role('heading',name='SMS Center',exact=True)).to_be_visible();expect(page.get_by_role('textbox',name='Editable SMS message')).to_be_visible()
   page.get_by_role('textbox',name='Editable SMS message').fill('Mystery Hub service notice. Current support contacts are at {{site}}/help.')
   page.get_by_role('button',name='Ask Gemini for a proposal').click();expect(page.get_by_role('button',name='Accept proposed wording')).to_be_visible();page.get_by_role('button',name='Accept proposed wording').click();expect(page.get_by_role('textbox',name='Editable SMS message')).to_contain_text('professional Mystery Hub')
   page.get_by_role('button',name='Copy draft (not sent)').click();page.wait_for_function("navigator.clipboard.readText().then(v=>v.includes('professional Mystery Hub'))")
   page.get_by_role('button',name='Review audience and credits').click();dialog=page.get_by_role('dialog');expect(dialog.get_by_role('heading',name='Review SMS audience')).to_be_visible();expect(dialog.get_by_text('1 eligible unique numbers',exact=False)).to_be_visible();expect(dialog.get_by_role('button',name='Send approved SMS')).to_be_disabled()
   dialog.get_by_role('checkbox',name=re.compile('I reviewed purpose')).check();dialog.get_by_role('button',name='Save prepared draft (no sending)').click();expect(page.get_by_text('Prepared draft saved. Nothing was sent.',exact=True)).to_be_visible()
   # Editing or an obsolete AI result cannot silently keep an approved audience.
   page.get_by_role('textbox',name='Editable SMS message').fill('An updated service notice for review.');page.get_by_role('button',name='Review audience and credits').click();dialog=page.get_by_role('dialog');expect(dialog.get_by_role('checkbox',name=re.compile('I reviewed purpose'))).not_to_be_checked();dialog.get_by_role('button',name='Close',exact=True).click()
   page.get_by_role('button',name='Templates',exact=True).click();expect(page.get_by_text('Order Payment Confirmed',exact=False).first).to_be_visible()
   page.get_by_role('button',name='Campaign History',exact=True).click();expect(page.get_by_text('Prepared Draft',exact=False).first).to_be_visible();page.get_by_role('button',name='View message outcomes').first.click();expect(page.get_by_role('button',name='Inspect message').first).to_be_visible();page.get_by_role('button',name='Inspect message').first.click();expect(page.get_by_role('dialog').get_by_text('professional Mystery Hub',exact=False)).to_be_visible();page.get_by_role('dialog').get_by_role('button',name='Close',exact=True).click()
   page.get_by_role('button',name='Settings / Readiness',exact=True).click();expect(page.get_by_role('button',name='Resume authorized mode')).to_be_disabled();page.get_by_role('button',name='Automatic Messages',exact=True).click();expect(page.get_by_role('button',name='Enable selected automatic updates')).to_be_disabled();expect(page.get_by_text('Your 3GB MTN data',exact=False).first).to_be_visible();page.screenshot(path=str(out/f'{width}-automatic.png'),full_page=True);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');delivered=page.get_by_role('checkbox',name='Order delivered',exact=True);delivered.uncheck();page.get_by_role('button',name='Save selected policy').click();expect(delivered).not_to_be_checked();delivered.check();page.get_by_role('button',name='Save selected policy').click();expect(delivered).to_be_checked()
   page.get_by_role('button',name='Overview',exact=True).click();page.screenshot(path=str(out/f'{width}-overview.png'));assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.get_by_role('button',name='SMS Permissions',exact=True).click();expect(page.get_by_role('button',name='Review permission registration')).to_be_visible()
   page.get_by_label('Permission obtained date').fill('2026-11-01T12:00');page.get_by_role('textbox',name='Permission evidence').fill('Synthetic permission obtained through an earlier support conversation')
   page.get_by_role('button',name='Review permission registration').click();expect(page.get_by_text('eligible unique numbers',exact=False).first).to_be_visible();page.screenshot(path=str(out/f'{width}-permissions.png'));assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.get_by_role('checkbox',name=re.compile('I attest')).check();page.get_by_role('button',name='Confirm permission records').click();expect(page.get_by_text('Permission records saved',exact=False)).to_be_visible()
   page.get_by_role('button',name='Overview',exact=True).click();page.get_by_role('button',name='Official channel announcement',exact=True).click();page.get_by_role('textbox',name='Official channel URL').fill('https://whatsapp.com/channel/0029SyntheticChannel');page.get_by_role('checkbox',name=re.compile('I verified this is')).check();page.get_by_role('button',name='Review audience and credits').click();dialog=page.get_by_role('dialog');expect(dialog.get_by_text('https://whatsapp.com/channel/0029SyntheticChannel',exact=False).first).to_be_visible();expect(dialog.get_by_role('button',name='Send approved SMS')).to_be_disabled();dialog.get_by_role('button',name='Close',exact=True).click()
   page.get_by_role('button',name='Compose SMS',exact=True).click();page.get_by_role('textbox',name='Editable SMS message').fill('An updated service notice for review.');page.screenshot(path=str(out/f'{width}-compose.png'));assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   # Separate SMS choices never modify push preferences; no provider traffic occurs.
   page.get_by_role('button',name='Customer SMS settings',exact=True).click();checkbox=page.get_by_role('checkbox',name='I choose occasional Mystery Hub SMS news and offers');expect(checkbox).to_be_visible();checked=checkbox.is_checked();checkbox.click();expect(page.get_by_text('SMS choice saved. This does not send a message.',exact=True)).to_be_visible();expect(checkbox).to_be_checked() if not checked else expect(checkbox).not_to_be_checked()
   page.get_by_role('button',name='SMS Center',exact=True).click();expect(page.get_by_role('heading',name='SMS Center',exact=True)).to_be_visible();page.evaluate('window.__smsFixture.logout()');expect(page.get_by_text('Signed out',exact=False)).to_be_visible();expect(page.get_by_role('textbox',name='Editable SMS message')).to_have_count(0)
   context.close();print(width,'passed: contact audience, AI proposal, reviewed draft, disabled sending, templates, history, prior permission registration, confirmed channel notice, SMS consent, logout and overflow',flush=True)
  browser.close()
finally:
 server.terminate()
 try:server.wait(timeout=10)
 except subprocess.TimeoutExpired:server.kill()
