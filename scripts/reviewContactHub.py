"""Actual React + actual Admin API, synthetic memory records only. No outbound traffic allowed."""
import os,subprocess,shutil,json,re,select
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent;os.chdir(ROOT)
out=Path('/tmp/contact-hub-v2-browser');out.mkdir(exist_ok=True)
subprocess.run(['node','--input-type=module','-e',"import{build}from'esbuild';await build({entryPoints:['server/suppliers/__tests__/fixtures/contactHub.browser.tsx'],bundle:true,format:'esm',outfile:'/tmp/contact-hub-v2-browser/fixture.js',define:{'import.meta.env':'{}'}});"],check=True)
shutil.copy(next(Path('dist/assets').glob('index-*.css')),out/'style.css');(out/'index.html').write_text('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script type="module" src="/fixture.js"></script>')
env={**os.environ,'NODE_ENV':'test'};env.pop('DATABASE_URL',None);env.pop('MYSTERY_TEST_DATABASE_OPT_IN',None)
server=subprocess.Popen(['node','--import','tsx','scripts/contactHubPreviewServer.ts'],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
 assert select.select([server.stdout],[],[],30)[0],'Preview server did not start'
 first=server.stdout.readline();port=json.loads(first)['port'];origin=f'http://127.0.0.1:{port}'
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [360,390,430,768,1280]:
   context=browser.new_context(viewport={'width':width,'height':900},permissions=['clipboard-read','clipboard-write'],accept_downloads=True)
   page=context.new_page();page.route('**/*',lambda route:route.continue_() if route.request.url.startswith(origin) else route.abort())
   page.goto(f'{origin}/?width={width}');expect(page.get_by_role('heading',name='Audience & Contacts')).to_be_visible();expect(page.get_by_role('button',name='Inspect contact').first).to_be_visible()
   source_box=page.get_by_role('combobox',name='Contact source').bounding_box();sort_box=page.get_by_role('combobox',name='Sort',exact=True).bounding_box();assert source_box['x']+source_box['width']<=sort_box['x']+1,'Source and sort must not overlap'
   page.screenshot(path=str(out/f'{width}-directory.png'));assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   search0=page.get_by_role('textbox',name='Search name, phone or email');search0.fill('0599990002');expect(page.get_by_role('button',name='Inspect contact')).to_have_count(1)
   page.get_by_role('button',name='Inspect contact').click();expect(page.get_by_role('dialog').get_by_text('Registered-Order Recipient',exact=False).first).to_be_visible();page.get_by_role('dialog').get_by_role('button',name='Close',exact=True).click()
   search0.fill('0599990001');expect(page.get_by_text('No contacts match these filters.',exact=False)).to_be_visible();search0.fill('')
   page.get_by_role('combobox',name='Contact source').select_option('registered');expect(page.get_by_role('button',name='Next',exact=True)).to_be_enabled();page.get_by_role('button',name='Next',exact=True).click();expect(page.get_by_text(re.compile(r'^2 / \d+$'))).to_be_visible()
   search=page.get_by_role('textbox',name='Search name, phone or email');search.fill('Ama');expect(page.get_by_role('heading',name='Ama One')).to_be_visible();expect(page.get_by_role('button',name='Inspect contact')).to_have_count(1)
   page.get_by_role('button',name='Inspect contact').click();dialog=page.get_by_role('dialog');expect(dialog.get_by_role('heading',name='Ama One')).to_be_visible()
   if width==390:page.screenshot(path=str(out/'390-profile.png'))
   dialog.get_by_role('button',name='Copy international phone').click()
   page.wait_for_function("navigator.clipboard.readText().then(v=>v==='+233591234567')")
   dialog.get_by_role('button',name='Prepare SMS').click();dialog=page.get_by_role('dialog');expect(dialog.get_by_role('heading',name='Prepare manual SMS')).to_be_visible()
   dialog.get_by_role('textbox',name='Editable message').fill('Mystery Hub service notice. Visit https://mysterybundlehub.com/help for current contacts.')
   dialog.get_by_role('button',name='Copy message').click();page.wait_for_function("navigator.clipboard.readText().then(v=>v.includes('Mystery Hub service notice'))")
   dialog.get_by_role('checkbox',name=re.compile('I reviewed this as')).check();expect(dialog.get_by_role('link',name='Open phone SMS composer')).to_have_attribute('href',re.compile(r'^sms:\+233591234567\?body='))
   dialog.get_by_role('textbox',name='Editable message').fill('Revised operational draft');expect(dialog.get_by_role('checkbox',name=re.compile('I reviewed this as'))).not_to_be_checked();expect(dialog.get_by_role('link',name='Open phone SMS composer')).to_have_count(0)
   dialog.get_by_role('combobox',name='Message purpose').select_option('channel');expect(dialog.get_by_role('button',name='Copy message')).to_be_disabled();expect(dialog.get_by_role('link',name='Open phone SMS composer')).to_have_count(0)
   dialog.get_by_role('button',name='Close',exact=True).click()
   page.get_by_role('button',name='Clear filters').click();page.get_by_role('combobox',name='Contact source').select_option('registered');page.get_by_role('button',name='One-Time Buyers',exact=True).click();expect(page.get_by_role('button',name='One-Time Buyers',exact=True)).to_have_attribute('aria-pressed','true')
   page.get_by_role('button',name='Inactive Buyers',exact=True).click();expect(page.get_by_role('button',name='Inactive Buyers',exact=True)).to_have_attribute('aria-pressed','true')
   page.get_by_role('button',name='Clear filters').click();page.get_by_role('combobox',name='Contact source').select_option('registered');page.get_by_role('combobox',name='Sort',exact=True).select_option('spending');expect(page.get_by_role('heading',name='frequent',exact=True)).to_be_visible();page.get_by_role('combobox',name='Sort',exact=True).select_option('last')
   page.get_by_role('button',name='Export audience').click();dialog=page.get_by_role('dialog');dialog.get_by_role('button',name='Preview full audience').click();expect(dialog.get_by_text('Unique usable numbers',exact=True)).to_be_visible();dialog.get_by_role('checkbox',name=re.compile('I reviewed this source')).check()
   with page.expect_download() as d:dialog.get_by_role('button',name='Download CSV').click()
   csv=d.value;csv.save_as(out/f'{width}-synthetic.csv');assert 'Classification' in Path(csv.path()).read_text(encoding='utf-8-sig')
   with page.expect_download() as d:dialog.get_by_role('button',name='Download TXT').click()
   txt=Path(d.value.path()).read_text();numbers=txt.splitlines();assert len(numbers)>25 and len(numbers)==len(set(numbers)) and all(re.fullmatch(r'\+233[235]\d{8}',n) for n in numbers)
   dialog.get_by_role('button',name='Close',exact=True).click()
   # A response for an obsolete export purpose or closed dialog must never download/copy.
   obsolete=[];downloads=[];page.on('download',lambda d:downloads.append(d))
   page.get_by_role('button',name='Export audience').click();dialog=page.get_by_role('dialog');dialog.get_by_role('button',name='Preview full audience').click();dialog.get_by_role('checkbox',name=re.compile('I reviewed this source')).check()
   page.route('**/api/admin/contacts/export',lambda route:obsolete.append(route))
   dialog.get_by_role('button',name='Download TXT').click();page.wait_for_timeout(100);assert obsolete
   dialog.get_by_role('combobox',name='Export purpose').select_option('support_notice')
   for route in obsolete:
    try:route.fulfill(status=200,content_type='text/plain',body='+233599999999')
    except:pass
   page.wait_for_timeout(100);assert len(downloads)==0
   obsolete.clear();dialog.get_by_role('button',name='Preview full audience').click();dialog.get_by_role('checkbox',name=re.compile('I reviewed this source')).check()
   clipboard=page.evaluate('navigator.clipboard.readText()');dialog.get_by_role('button',name='Copy numbers (lines)').click();page.wait_for_timeout(100);assert obsolete
   dialog.get_by_role('button',name='Close',exact=True).click()
   page.get_by_role('button',name='Export audience').click();page.get_by_role('dialog').get_by_role('combobox',name='Export purpose').select_option('support_notice')
   for route in obsolete:
    try:route.fulfill(status=200,content_type='text/plain',body='+233599999999')
    except:pass
   page.wait_for_timeout(100);assert page.evaluate('navigator.clipboard.readText()')==clipboard;assert len(downloads)==0;expect(page.get_by_role('dialog').get_by_text('Unique usable numbers',exact=True)).to_have_count(0);page.get_by_role('dialog').get_by_role('button',name='Close',exact=True).click();page.unroute('**/api/admin/contacts/export')
   # A stale profile request cannot leave loading stuck or expose its old contents.
   old_profiles=[];page.route('**/api/admin/contacts/profile',lambda route:old_profiles.append(route));page.get_by_role('button',name='Inspect contact').first.click();page.wait_for_timeout(100);assert old_profiles
   page.get_by_role('button',name='Refresh contacts').click();expect(page.get_by_text('Loading contact details…',exact=True)).to_have_count(0)
   for route in old_profiles:
    try:route.fulfill(status=200,content_type='application/json',body='{"contact":{"name":"Stale synthetic contact"},"orders":[]}')
    except:pass
   page.unroute('**/api/admin/contacts/profile');expect(page.get_by_text('Stale synthetic contact')).to_have_count(0);expect(page.get_by_role('button',name='Inspect contact').first).to_be_visible()
   page.get_by_role('combobox',name='Contact source').select_option('guest');expect(page.get_by_role('heading',name='Direct Recipient',exact=True).first).to_be_visible();page.get_by_role('button',name='Inspect contact').first.click();expect(page.get_by_role('dialog').get_by_text('Recipient activity',exact=False)).to_be_visible();page.get_by_role('dialog').get_by_role('button',name='Close',exact=True).click()
   page.get_by_role('combobox',name='Contact source').select_option('registered');search.fill('no-such-synthetic-person');expect(page.get_by_text('No contacts match these filters.',exact=False)).to_be_visible();search.fill('')
   expect(page.get_by_role('button',name='Inspect contact').first).to_be_visible()
   page.evaluate('scrollTo(0,0)');page.screenshot(path=str(out/f'{width}-contacts.png')); assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   # Real server remains the source; intercept one response to test failure and stale/session handling.
   page.route('**/api/admin/contacts/query',lambda route:route.fulfill(status=503,content_type='application/json',body='{"error":"Synthetic API unavailable"}'))
   page.get_by_role('button',name='Refresh contacts').click();expect(page.get_by_role('alert')).to_contain_text('Synthetic API unavailable');page.unroute('**/api/admin/contacts/query')
   page.get_by_role('button',name='Refresh contacts').click();expect(page.get_by_role('button',name='Inspect contact').first).to_be_visible()
   held=[];page.route('**/api/admin/contacts/query',lambda route:held.append(route));search.fill('Ama');page.wait_for_timeout(350);assert held
   page.evaluate('window.__contactFixture.logout()');expect(page.get_by_role('heading',name='Ama One')).to_have_count(0)
   for route in held:
    try:route.continue_()
    except:pass
   page.unroute('**/api/admin/contacts/query');page.wait_for_timeout(300);expect(page.get_by_role('heading',name='Ama One')).to_have_count(0)
   context.close();print(width,'passed: real API, search/segments/sort, profiles/SMS/copy, full CSV/TXT, guests, errors/logout and overflow')
  browser.close()
finally:
 server.terminate()
 try:server.wait(timeout=10)
 except subprocess.TimeoutExpired:server.kill()
