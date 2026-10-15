import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {WEBSITE_TEMPLATES} from '../../../src/data/templates';
import {mergeSiteWithTemplate,renderTemplateLayout,getTemplateById} from '../../../src/utils/templateRendererUtils';
import {visualTargets,applyVisualValue} from '../../../src/utils/websiteVisualEditing';
import {templateCopySlots,TEMPLATE_COPY} from '../../../src/config/websiteTemplateCopy';
import {websiteStarter,websiteStarterWording} from '../../../src/config/websiteStarters';
import {validateWebsiteContentPatch} from '../../services/websiteValidation';
import {publicWebsiteContent} from '../../services/websitePublication';

const base={businessName:'Owner',tagline:'',aboutText:'',location:'',phone:'',whatsapp:'',email:'',heroImage:'',ctaLabel:'',ctaTarget:'',items:[]};
const settings={primaryColor:'#123456',accentColor:'#7c3aed'};
const designed=WEBSITE_TEMPLATES.filter(t=>!['tmpl-data-reseller','tmpl-start-blank'].includes(t.id));

test('every designed template starts with suggested wording and owner-safe design labels',()=>{
  for(const t of designed){
    const starter=websiteStarter(t.id,'Owner').content,wording=websiteStarterWording(t.id)!;
    assert.ok(wording,t.id);assert.equal(starter.tagline,wording.tagline);assert.equal(starter.aboutText,wording.aboutText);
    assert.ok(templateCopySlots(mergeSiteWithTemplate(t,starter,settings)).length>=4,t.id);
    // Suggested wording never carries prices, ratings, hours, phone numbers or statistics.
    for(const text of [wording.tagline,wording.aboutText])assert.doesNotMatch(text,/GH₵|\d|★|%/,t.id);
  }
});
test('owner sites replace demo claims with neutral design wording',()=>{
  const salon=renderToStaticMarkup(renderTemplateLayout(mergeSiteWithTemplate(getTemplateById('tmpl-glow-salon'),base,settings)));
  assert.ok(!salon.includes('Transparent Pricing in Ghana Cedis'));assert.ok(!salon.includes('Luxury Hair'));assert.ok(salon.includes('Hair &amp; Grooming Menu'));
  const demo=renderToStaticMarkup(renderTemplateLayout(getTemplateById('tmpl-glow-salon')));
  assert.ok(demo.includes('Transparent Pricing in Ghana Cedis'),'the gallery demo keeps its own wording');
});
test('a tapped design label saves only the owner override, and emptying it restores the design wording',()=>{
  const t=mergeSiteWithTemplate(getTemplateById('tmpl-akwaaba-hotel'),base,settings);
  const target=visualTargets(t).find(x=>x.id==='copy:hotel.itemsHeading')!;assert.equal(target.value,'Rooms & Stays');
  const next=applyVisualValue(base as any,settings,t,target.id,'Our chalets')!;assert.deepEqual(next.content.copy,{'hotel.itemsHeading':'Our chalets'});
  assert.ok(renderToStaticMarkup(renderTemplateLayout(mergeSiteWithTemplate(t,next.content,settings))).includes('Our chalets'));
  const reset=applyVisualValue(next.content,settings,mergeSiteWithTemplate(t,next.content,settings),target.id,'')!;assert.deepEqual(reset.content.copy,{});
  assert.equal(applyVisualValue(base as any,settings,t,target.id,'<b>x</b>'),null);
});
test('template wording is a finite validated map that reaches the public snapshot',()=>{
  validateWebsiteContentPatch({copy:{'salon.itemsHeading':'Our menu'}});
  for(const copy of [{'salon.unknown':'x'},{'nope.itemsHeading':'x'},{'__proto__.constructor':'x'},{'salon.itemsHeading.extra':'x'},{'salon.itemsHeading':'x'.repeat(TEMPLATE_COPY.salon.itemsHeading.max+1)},{'salon.itemsHeading':'<script>'}])
    assert.throws(()=>validateWebsiteContentPatch({copy}),undefined,JSON.stringify(copy));
  assert.deepEqual(publicWebsiteContent({...base,copy:{'salon.itemsHeading':'Our menu'}}).copy,{'salon.itemsHeading':'Our menu'});
});
test('with a WhatsApp number the enquiry form writes a WhatsApp message and never submits',()=>{
  const html=renderToStaticMarkup(renderTemplateLayout(mergeSiteWithTemplate(getTemplateById('tmpl-glow-salon'),{...base,whatsapp:'024 123 4567',items:[{id:'a',name:'Box braids'}]},settings)));
  assert.ok(html.includes('https://wa.me/233241234567?text='));assert.ok(html.includes('Box braids'));assert.ok(!html.includes('<form'));assert.ok(!html.includes('type="submit"'));
});
