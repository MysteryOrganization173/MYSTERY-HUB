import {randomInt} from 'node:crypto';
import {ExperienceStore,abuseSecretConfigured} from '../db/experienceStore.js';
import {seasonalState,countdownState,EXPERIENCE_ID,CALENDAR,EXPERIENCE_END,PHASES,GREETING_TEMPLATES,type ExperiencePhase} from '../../shared/mysteryExperiences.js';
import {ExperienceError,greetingInput,objectInput} from './experienceValidation.js';
import { BUSINESS_CONFIG } from '../../src/config/business.js';
const PUBLIC_ORIGIN = `https://${BUSINESS_CONFIG.domain}`;
export const seasonalDeploymentEnabled=()=>process.env.MYSTERY_EXPERIENCES_ENABLED==='true';
export const greetingLinksEnabled=()=>process.env.MYSTERY_GREETING_LINKS_ENABLED==='true';
export const greetingCreationEnabled=()=>greetingLinksEnabled()&&process.env.MYSTERY_GREETINGS_ENABLED==='true';
/** What the site advertises: both gates on and the abuse secret present (without it every create is refused). */
export const greetingCreationOffered=()=>greetingCreationEnabled()&&abuseSecretConfigured();
export const greetingUrl=(id:string)=>`${PUBLIC_ORIGIN}/g/${id}`;
export class ExperienceService {
 static async state(now=new Date()){
  if(!seasonalDeploymentEnabled())return seasonalState(null,now,false);
  try{return seasonalState(await ExperienceStore.configuration(),now,true);}catch{return {...seasonalState(null,now,true),availability:'unavailable' as const};}
 }
 static async admin(now=new Date()){
  const config=await ExperienceStore.configuration();
  return {experience:{id:EXPERIENCE_ID,name:'Christmas 2026 / New Year 2027',version:1,timeZone:'Africa/Accra',calendar:CALENDAR,end:EXPERIENCE_END},config,effective:seasonalState(config,now,seasonalDeploymentEnabled()),countdown:countdownState(now),blockers:[...(!seasonalDeploymentEnabled()?['Seasonal deployment gate is off.']:[]),...(!greetingCreationEnabled()?['Greeting creation deployment gate is off.']:[]),'After enabling links, verify the live /g/ route, its head and the link card on the real domain.'],audit:await ExperienceStore.audit()};
 }
 static async preview(input:unknown,now=new Date()){
  const v=objectInput(input,['phase']);if(!PHASES.includes(v.phase))throw new ExperienceError('INVALID_PHASE');
  const config=await ExperienceStore.configuration();if(!config.preview_enabled)throw new ExperienceError('PREVIEW_DISABLED',409);
  return {...seasonalState({...config,lifecycle:'approved',enabled:true,override_phase:v.phase as ExperiencePhase,override_until:new Date(now.getTime()+900000).toISOString()},now,true),preview:true};
 }
 static templates(occasion?:unknown,random=false){
  if(occasion!==undefined&&(typeof occasion!=='string'||!['christmas-2026','new-year-2027'].includes(occasion)))throw new ExperienceError('INVALID_OCCASION');
  const choices=GREETING_TEMPLATES.filter(t=>!occasion||t.occasion===occasion);
  return {schemaVersion:1,templates:random?[choices[randomInt(choices.length)]]:choices,creationConfigured:greetingCreationOffered()};
 }
 static async create(input:unknown,peer:string,analytics:boolean){
  if(!greetingCreationEnabled())throw new ExperienceError('CREATION_DISABLED',503);
  const source=!analytics&&input&&typeof input==='object'&&!Array.isArray(input)?{...input,parentShareId:undefined}:input;
  const {value,creatorToken,idempotencyKey}=greetingInput(source);
  const result=await ExperienceStore.create(value,creatorToken,idempotencyKey,peer,analytics);
  return {schemaVersion:1,shareId:result.greeting.shareId,url:greetingUrl(result.greeting.shareId),expiresAt:result.greeting.expiresAt,duplicate:result.duplicate};
 }
 /** Admin readiness. Never throws: a missing schema or database is reported, not raised. Secret values are never read out. */
 static async readiness(now=new Date()){
  const gates={links:greetingLinksEnabled(),creation:greetingCreationEnabled(),seasonal:seasonalDeploymentEnabled()};
  const abuseSecret=abuseSecretConfigured();
  let storage:'installed'|'not_installed'|'unavailable'='unavailable',retentionDue:boolean|null=null,lastMaintenance:{at:string;counts:unknown}|null=null;
  try{const r=await ExperienceStore.readiness();storage=r.installed?'installed':'not_installed';retentionDue=r.retentionDue;lastMaintenance=r.lastMaintenance;}catch{/* reported as unavailable */}
  const blockers=[
   ...(storage==='not_installed'?['The optional greetings schema (server/db/mysteryExperiences.sql) is not installed.']:storage==='unavailable'?['Greetings storage could not be checked.']:[]),
   ...(!abuseSecret?['EXPERIENCES_ABUSE_SECRET is missing or invalid: creating, removing, reporting and counting are refused.']:[]),
   ...(!gates.links?['Greeting links are off (MYSTERY_GREETING_LINKS_ENABLED): shared links do not open.']:[]),
   ...(!gates.creation?['Greeting creation is off (MYSTERY_GREETINGS_ENABLED, which also needs links on).']:[]),
   ...(retentionDue?['Retention clean-up is due: new greetings are refused until it runs.']:[]),
  ];
  return {schemaVersion:1,checkedAt:now.toISOString(),gates,abuseSecret,storage,retentionDue,lastMaintenance,blockers};
 }
 static async greeting(id:string){if(!greetingLinksEnabled())throw new ExperienceError('GREETING_UNAVAILABLE',404);return ExperienceStore.greeting(id);}
 static async exists(id:string){if(!greetingLinksEnabled())return false;return ExperienceStore.exists(id);}
}
