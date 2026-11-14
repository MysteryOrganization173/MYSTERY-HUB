import {randomInt} from 'node:crypto';
import {ExperienceStore} from '../db/experienceStore.js';
import {seasonalState,countdownState,EXPERIENCE_ID,CALENDAR,EXPERIENCE_END,PHASES,GREETING_TEMPLATES,type ExperiencePhase} from '../../shared/mysteryExperiences.js';
import {ExperienceError,greetingInput,objectInput} from './experienceValidation.js';
import { BUSINESS_CONFIG } from '../../src/config/business.js';
const PUBLIC_ORIGIN = `https://${BUSINESS_CONFIG.domain}`;
export const seasonalDeploymentEnabled=()=>process.env.MYSTERY_EXPERIENCES_ENABLED==='true';
export const greetingLinksEnabled=()=>process.env.MYSTERY_GREETING_LINKS_ENABLED==='true';
export const greetingCreationEnabled=()=>greetingLinksEnabled()&&process.env.MYSTERY_GREETINGS_ENABLED==='true';
export const greetingUrl=(id:string)=>`${PUBLIC_ORIGIN}/g/${id}`;
export class ExperienceService {
 static async state(now=new Date()){
  if(!seasonalDeploymentEnabled())return seasonalState(null,now,false);
  try{return seasonalState(await ExperienceStore.configuration(),now,true);}catch{return {...seasonalState(null,now,true),availability:'unavailable' as const};}
 }
 static async admin(now=new Date()){
  const config=await ExperienceStore.configuration();
  return {experience:{id:EXPERIENCE_ID,name:'Christmas 2026 / New Year 2027',version:1,timeZone:'Africa/Accra',calendar:CALENDAR,end:EXPERIENCE_END},config,effective:seasonalState(config,now,seasonalDeploymentEnabled()),countdown:countdownState(now),blockers:[...(!seasonalDeploymentEnabled()?['Seasonal deployment gate is off.']:[]),...(!greetingCreationEnabled()?['Greeting creation deployment gate is off.']:[]),'Frontend, canonical dynamic HTML routing and final gift artwork require integration acceptance.'],audit:await ExperienceStore.audit()};
 }
 static async preview(input:unknown,now=new Date()){
  const v=objectInput(input,['phase']);if(!PHASES.includes(v.phase))throw new ExperienceError('INVALID_PHASE');
  const config=await ExperienceStore.configuration();if(!config.preview_enabled)throw new ExperienceError('PREVIEW_DISABLED',409);
  return {...seasonalState({...config,lifecycle:'approved',enabled:true,override_phase:v.phase as ExperiencePhase,override_until:new Date(now.getTime()+900000).toISOString()},now,true),preview:true};
 }
 static templates(occasion?:unknown,random=false){
  if(occasion!==undefined&&(typeof occasion!=='string'||!['christmas-2026','new-year-2027'].includes(occasion)))throw new ExperienceError('INVALID_OCCASION');
  const choices=GREETING_TEMPLATES.filter(t=>!occasion||t.occasion===occasion);
  return {schemaVersion:1,templates:random?[choices[randomInt(choices.length)]]:choices,creationConfigured:greetingCreationEnabled()};
 }
 static async create(input:unknown,peer:string,analytics:boolean){
  if(!greetingCreationEnabled())throw new ExperienceError('CREATION_DISABLED',503);
  const source=!analytics&&input&&typeof input==='object'&&!Array.isArray(input)?{...input,parentShareId:undefined}:input;
  const {value,creatorToken,idempotencyKey}=greetingInput(source);
  const result=await ExperienceStore.create(value,creatorToken,idempotencyKey,peer,analytics);
  return {schemaVersion:1,shareId:result.greeting.shareId,url:greetingUrl(result.greeting.shareId),expiresAt:result.greeting.expiresAt,duplicate:result.duplicate};
 }
 static async greeting(id:string){if(!greetingLinksEnabled())throw new ExperienceError('GREETING_UNAVAILABLE',404);return ExperienceStore.greeting(id);}
 static async exists(id:string){if(!greetingLinksEnabled())return false;return ExperienceStore.exists(id);}
}
