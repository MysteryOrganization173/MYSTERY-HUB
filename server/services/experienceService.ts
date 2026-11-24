import {randomInt} from 'node:crypto';
import {ExperienceStore,abuseSecretConfigured} from '../db/experienceStore.js';
import {seasonalState,countdownState,EXPERIENCE_ID,CALENDAR,EXPERIENCE_END,PHASES,GREETING_TEMPLATES,type ExperiencePhase} from '../../shared/mysteryExperiences.js';
import {ExperienceError,greetingInput,objectInput} from './experienceValidation.js';
import {greetingVisitorTrustConfigured} from './greetingsVisitor.js';
import { BUSINESS_CONFIG } from '../../src/config/business.js';
const PUBLIC_ORIGIN = `https://${BUSINESS_CONFIG.domain}`;
export const seasonalDeploymentEnabled=()=>process.env.MYSTERY_EXPERIENCES_ENABLED==='true';
export const greetingLinksEnabled=()=>process.env.MYSTERY_GREETING_LINKS_ENABLED==='true';
export const greetingCreationEnabled=()=>greetingLinksEnabled()&&process.env.MYSTERY_GREETINGS_ENABLED==='true';
/** What the site advertises: both gates on and the abuse secret present (without it every create is refused). */
export const greetingCreationOffered=()=>greetingCreationEnabled()&&abuseSecretConfigured()&&greetingVisitorTrustConfigured();
/**
 * Whether a new greeting would really be accepted right now: both gates on, the abuse secret valid, the optional schema
 * installed and retention clean-up not overdue (the store refuses every create while it is). The season status and the
 * creator advertise only this, so no page offers a creator that would refuse the greeting.
 * - Gates off: answered from the environment alone, with no database access.
 * - Gates on: one small read-only check per process at most once a minute, shared by concurrent callers. Callers never
 *   wait on the database: an earlier answer is served at once while the check refreshes (stale-while-revalidate), and
 *   the very first answer in a process waits at most CREATION_AVAILABILITY_WAIT_MS.
 * - A momentary BUSY (the two-transaction cap) is never remembered as "closed": the last answer stands, or the next
 *   request simply asks again. Storage that answers with an error counts as unavailable for 15 seconds.
 */
let creationAvailability:{value:boolean;until:number}|null=null,creationAvailabilityFlight:Promise<boolean>|null=null;
export const CREATION_AVAILABILITY_TTL_MS=60_000,CREATION_AVAILABILITY_WAIT_MS=1_500;
export function resetGreetingCreationAvailability(){creationAvailability=null;creationAvailabilityFlight=null;}
export async function greetingCreationAvailable(now=Date.now()):Promise<boolean>{
 if(!greetingCreationOffered())return false;
 const known=creationAvailability;
 if(known&&known.until>now)return known.value;
 if(!creationAvailabilityFlight){
  const flight:Promise<boolean>=ExperienceStore.creationReadiness().then(
   value=>{if(creationAvailabilityFlight===flight)creationAvailability={value,until:Date.now()+CREATION_AVAILABILITY_TTL_MS};return value;},
   e=>{
    if(e instanceof ExperienceError&&e.code==='BUSY')return known?known.value:false;
    if(creationAvailabilityFlight===flight)creationAvailability={value:false,until:Date.now()+15_000};return false;
   },
  ).finally(()=>{if(creationAvailabilityFlight===flight)creationAvailabilityFlight=null;});
  creationAvailabilityFlight=flight;
 }
 if(known)return known.value;
 let timer:ReturnType<typeof setTimeout>|undefined;
 const waited=new Promise<boolean>(resolve=>{timer=setTimeout(()=>resolve(false),CREATION_AVAILABILITY_WAIT_MS);});
 try{return await Promise.race([creationAvailabilityFlight,waited]);}finally{clearTimeout(timer);}
}
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
 static async templates(occasion?:unknown,random=false,visitorEstablished=true){
  if(occasion!==undefined&&(typeof occasion!=='string'||!['christmas-2026','new-year-2027'].includes(occasion)))throw new ExperienceError('INVALID_OCCASION');
  const choices=GREETING_TEMPLATES.filter(t=>!occasion||t.occasion===occasion);
  return {schemaVersion:1,templates:random?[choices[randomInt(choices.length)]]:choices,creationConfigured:visitorEstablished&&await greetingCreationAvailable()};
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
  // creation: effective (needs links too); creationSwitch: what MYSTERY_GREETINGS_ENABLED itself says.
  const gates={links:greetingLinksEnabled(),creation:greetingCreationEnabled(),creationSwitch:process.env.MYSTERY_GREETINGS_ENABLED==='true',seasonal:seasonalDeploymentEnabled()};
  const abuseSecret=abuseSecretConfigured();
  const trustedVisitor=greetingVisitorTrustConfigured();
  let storage:'installed'|'not_installed'|'unavailable'='unavailable',retentionDue:boolean|null=null,lastMaintenance:{at:string;counts:unknown}|null=null;
  try{const r=await ExperienceStore.readiness();storage=r.installed?'installed':'not_installed';retentionDue=r.retentionDue;lastMaintenance=r.lastMaintenance;}catch{/* reported as unavailable */}
  const blockers=[
   ...(storage==='not_installed'?['The optional greetings schema (server/db/mysteryExperiences.sql) is not installed.']:storage==='unavailable'?['Greetings storage could not be checked.']:[]),
   ...(!abuseSecret?['EXPERIENCES_ABUSE_SECRET is missing or invalid: creating, removing, reporting and counting are refused.']:[]),
   ...(!trustedVisitor?['Greetings needs a verified proxy boundary before visitor-budgeted operations are available.']:[]),
   ...(!gates.links?['Greeting links are off (MYSTERY_GREETING_LINKS_ENABLED): shared links do not open.']:[]),
   ...(!gates.creation?['Greeting creation is off (MYSTERY_GREETINGS_ENABLED, which also needs links on).']:[]),
   ...(retentionDue?['Retention clean-up is due: new greetings are refused until it runs.']:[]),
  ];
  // What is actually working, not just switched on: the environment says what is allowed, the database what can run.
  const available={links:gates.links&&storage==='installed',creation:gates.creation&&abuseSecret&&trustedVisitor&&storage==='installed'&&retentionDue===false};
  // Anything switched on that is not actually working is "not working", never a calm "links only".
  const status=!gates.links&&!gates.creationSwitch?'off':(gates.links&&!available.links)||(gates.creationSwitch&&!available.creation)?'not-working':available.creation?'live':'links-only';
  return {schemaVersion:1,checkedAt:now.toISOString(),gates,abuseSecret,trustedVisitor,storage,retentionDue,lastMaintenance,available,status,blockers};
 }
 static async greeting(id:string){if(!greetingLinksEnabled())throw new ExperienceError('GREETING_UNAVAILABLE',404);return ExperienceStore.greeting(id);}
 static async exists(id:string){if(!greetingLinksEnabled())return false;return ExperienceStore.exists(id);}
}
