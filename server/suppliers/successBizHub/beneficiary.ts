import {validateAndNormalizeGhanaPhone} from '../../utils/phone.js';
export interface BeneficiaryEligibility {eligible:boolean;outcome?:'eligible'|'ineligible'|'unknown';failure?:'invalid_response'|'timeout'|'connection'|'permission'|'unavailable';reason?:string}
export const unknownBeneficiary=(failure:BeneficiaryEligibility['failure']='invalid_response'):BeneficiaryEligibility=>({eligible:false,outcome:'unknown',failure,reason:'Recipient eligibility could not be confirmed.'});
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
/** Supported legacy shapes remain compatible, but conflicting or mismatched identity never establishes eligibility. */
export function parseBeneficiaryEligibility(body:unknown,phone:string,selector?:{offerSlug?:string;offerId?:string}):BeneficiaryEligibility {
 const target=validateAndNormalizeGhanaPhone(phone).normalized;
 if(!target||!object(body)||'success' in body&&body.success!==true||body.status==='error'||body.status==='failed'||body.error)return unknownBeneficiary();
 const identity=(row:Record<string,unknown>)=>{
  for(const key of ['offerSlug','offerId'] as const)if(selector?.[key]&&key in row&&row[key]!==selector[key])return false;
  for(const key of ['phone','msisdn'])if(key in row&&(typeof row[key]!=='string'||validateAndNormalizeGhanaPhone(row[key] as string).normalized!==target))return false;
  return true;
 };
 if(!identity(body))return unknownBeneficiary();
 const data=body.data;let rows:unknown[];
 if(Array.isArray(data))rows=data;
 else if(object(data)&&'results' in data){if(!identity(data)||!Array.isArray(data.results))return unknownBeneficiary();rows=data.results;}
 else if(object(data))rows=[data];
 else if(data===undefined&&typeof body.eligible==='boolean')rows=[body];
 else return unknownBeneficiary();
 if(!rows.length||rows.length>2000||rows.some(r=>!object(r)))return unknownBeneficiary();
 if(('eligible' in body&&typeof body.eligible!=='boolean')||(object(data)&&'eligible' in data&&typeof data.eligible!=='boolean'))return unknownBeneficiary();
 if((rows as Record<string,unknown>[]).some(r=>['phone','msisdn'].some(k=>typeof r[k]==='string'&&validateAndNormalizeGhanaPhone(r[k] as string).normalized===target)&&!identity(r)))return unknownBeneficiary();
 const matches=(rows as Record<string,unknown>[]).filter(r=>{
  if(rows.length===1)return identity(r);
  return ('phone' in r||'msisdn' in r)&&identity(r);
 });
 if(!matches.length||matches.some(r=>typeof r.eligible!=='boolean'))return unknownBeneficiary();
 const eligible=matches[0].eligible as boolean;
 if(matches.some(r=>r.eligible!==eligible)||typeof body.eligible==='boolean'&&body.eligible!==eligible||object(data)&&typeof data.eligible==='boolean'&&data.eligible!==eligible)return unknownBeneficiary();
 return {eligible,outcome:eligible?'eligible':'ineligible',reason:eligible?'Recipient eligibility confirmed.':'Recipient is not eligible for this bundle.'};
}
