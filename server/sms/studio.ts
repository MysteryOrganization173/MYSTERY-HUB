import {SMS_PRESETS,SMS_LEGACY_PRESETS} from '../../shared/smsCommunications.js';
import {SMS_STUDIO_TEMPLATES} from '../../shared/smsStudio.js';
import {BUSINESS_CONFIG} from '../../src/config/business.js';

/** Virtual reviewed presets need no startup writes; Admin saves the first audited version. */
export function studioTemplates(rows:any[]) {
  const result=rows.map(row=>{
    const legacy=SMS_LEGACY_PRESETS.find(t=>t.id===row.id),current=SMS_STUDIO_TEMPLATES.find(t=>t.id===row.id);
    return legacy&&current&&row.body===legacy.body&&row.title===legacy.title?{...row,title:current.title,body:current.body,recommendedBuiltIn:true}:row;
  });
  for(const preset of SMS_PRESETS)if(!result.some(r=>r.id===preset.id))result.push({...preset,version:0,enabled:true,persisted:false});
  return result.sort((a,b)=>Number(a.locked)-Number(b.locked));
}
export function studioPreview(body:string) {
  return body.replaceAll('{{site}}',BUSINESS_CONFIG.domain).replaceAll('{{channel_url}}',BUSINESS_CONFIG.contact.whatsappChannelUrl);
}
