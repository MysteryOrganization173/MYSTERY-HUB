/** Shared presentation-only contracts. No business/financial state is derived here. */
export const EXPERIENCE_ID = 'christmas-2026';
export const EXPERIENCE_VERSION = 1;
export const PHASES = ['christmas_season','christmas_day','boxing_day','new_year_transition','new_year_eve','new_year_day','new_year_celebration'] as const;
export type ExperiencePhase = typeof PHASES[number];
export const CALENDAR = [
  ['2026-12-01T00:00:00.000Z','christmas_season'], ['2026-12-25T00:00:00.000Z','christmas_day'],
  ['2026-12-26T00:00:00.000Z','boxing_day'], ['2026-12-27T00:00:00.000Z','new_year_transition'],
  ['2026-12-31T00:00:00.000Z','new_year_eve'], ['2027-01-01T00:00:00.000Z','new_year_day'],
  ['2027-01-02T00:00:00.000Z','new_year_celebration'],
] as const;
export const EXPERIENCE_END = '2027-01-06T00:00:00.000Z';
export const COUNTDOWN_TARGET = '2027-01-01T00:00:00.000Z';
export interface ExperienceConfig { id: string; revision: number; definition_version: number; starts_at: string; ends_at: string; time_zone: string; lifecycle: 'draft'|'approved'|'archived'; enabled: boolean; preview_enabled: boolean; override_phase: ExperiencePhase|null; override_until: string|null; updated_at: string }
export interface SeasonalState { schemaVersion: 1; active: boolean; appearance: 'normal'|'seasonal'; experienceId: string|null; themeVersion: number|null; phase: ExperiencePhase|null; timeZone: 'Africa/Accra'; serverTime: string; nextTransitionAt: string|null; availability: 'ok'|'disabled'|'unavailable'; preview: boolean }
export function seasonalState(config: ExperienceConfig|null, now = new Date(), deployed = false): SeasonalState {
  const time = now.getTime();
  const base: SeasonalState = {schemaVersion:1,active:false,appearance:'normal',experienceId:null,themeVersion:null,phase:null,timeZone:'Africa/Accra',serverTime:now.toISOString(),nextTransitionAt:null,availability:deployed?'ok':'disabled',preview:false};
  if (!deployed || !config?.enabled || config.lifecycle !== 'approved') return base;
  if (config.definition_version !== EXPERIENCE_VERSION || config.starts_at !== CALENDAR[0][0] || config.ends_at !== EXPERIENCE_END || config.time_zone !== 'Africa/Accra') return {...base,availability:'unavailable'};
  const overrideEnd = config.override_until ? Date.parse(config.override_until) : 0;
  const override = config.override_phase && overrideEnd > time;
  let phase: ExperiencePhase|null = null;
  if (override) phase = config.override_phase;
  else if (time < Date.parse(EXPERIENCE_END)) for (const [start, name] of CALENDAR) if(time>=Date.parse(start)) phase=name;
  const next = override ? overrideEnd : [...CALENDAR.map(p=>Date.parse(p[0])), Date.parse(EXPERIENCE_END)].find(t=>t>time);
  return {...base,active:phase!==null,appearance:phase?'seasonal':'normal',experienceId:phase?EXPERIENCE_ID:null,themeVersion:phase?EXPERIENCE_VERSION:null,phase,nextTransitionAt:next?new Date(next).toISOString():null};
}
export function countdownState(now=new Date()) {
  const remainingMs=Math.max(0,Date.parse(COUNTDOWN_TARGET)-now.getTime());
  return {schemaVersion:1,timeZone:'Africa/Accra',target:COUNTDOWN_TARGET,serverTime:now.toISOString(),remainingMs,passed:remainingMs===0};
}
export const GREETING_TEMPLATES = [
  {id:'christmas-warm-v1',occasion:'christmas-2026',category:'heartwarming',message:'May your Christmas be filled with warmth, peace and little moments of joy.'},
  {id:'christmas-love-v1',occasion:'christmas-2026',category:'romantic',message:'You make ordinary days feel special. Wishing you a Christmas as lovely as you are.'},
  {id:'christmas-friend-v1',occasion:'christmas-2026',category:'friendship',message:'Here is to friendship, good laughs and beautiful memories. Merry Christmas!'},
  {id:'christmas-family-v1',occasion:'christmas-2026',category:'family',message:'Near or far, you are close to my heart. Wishing our family a joyful Christmas.'},
  {id:'christmas-funny-v1',occasion:'christmas-2026',category:'funny',message:'May your Christmas plate be full and your chores mysteriously disappear!'},
  {id:'newyear-playful-v1',occasion:'new-year-2027',category:'playful',message:'New year, fresh energy! Here is to more laughter and fewer alarm snoozes.'},
  {id:'newyear-elegant-v1',occasion:'new-year-2027',category:'elegant',message:'Wishing you a peaceful beginning and a year filled with possibility.'},
  {id:'newyear-hope-v1',occasion:'new-year-2027',category:'inspirational',message:'May 2027 bring courage for new beginnings and joy in every step forward.'},
] as const;
export const GREETING_VARIANTS = ['gift-classic-v1','gift-starlight-v1'] as const;
export const EXPERIENCE_EVENTS = ['greeting_open','greeting_reveal','greeting_remix_started','countdown_open','discovery_open','platform_navigation'] as const;
export type ExperienceEvent = typeof EXPERIENCE_EVENTS[number];
export interface GreetingInput { occasion:'christmas-2026'|'new-year-2027'; recipientName:string; senderName:string|null; showSender:boolean; templateId:string|null; message:string; variant:typeof GREETING_VARIANTS[number]; parentShareId:string|null }
export interface PublicGreeting { schemaVersion:1; shareId:string; occasion:string; recipientName:string; senderName:string|null; message:string; variant:string; expiresAt:string }
