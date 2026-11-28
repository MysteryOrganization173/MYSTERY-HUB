import { accraDate } from '../../shared/seasonal';
import { COUNTDOWN_OVER_AFTER, type ClockView } from '../greetings/countdown';

/**
 * Mystery Countdown: what the page shows at each moment, worked out from the shared clock's view (never from the
 * device's own date). Pure, so every phase can be checked with a controlled clock.
 *
 * The dial zooms in as midnight approaches: the final day in hours, the final hour in minutes, the final minute in
 * seconds and the final ten seconds one by one. After midnight it is a calm Welcome 2027; from 8 January (the same day
 * the card under New Year greetings bows out) a quiet commemorative page that never suggests the countdown is still on.
 */
export type Stage = 'syncing' | 'unavailable' | 'confirming' | 'days' | 'eve' | 'hour' | 'minute' | 'final' | 'welcome' | 'commemorative';
export const COUNTING: readonly Stage[] = ['days', 'eve', 'hour', 'minute', 'final'];
export const isCounting = (stage: Stage) => COUNTING.includes(stage);
export const isAfter = (stage: Stage) => stage === 'welcome' || stage === 'commemorative';

/** Whole seconds shown (rounded up, so the display reaches 0 exactly at midnight and never goes negative). */
export const shownSeconds = (remainingMs: number) => Math.ceil(Math.max(0, remainingMs) / 1000);

export function stageOf(view: ClockView): Stage {
  switch (view.state) {
    case 'syncing': return 'syncing';
    case 'unavailable': return 'unavailable';
    case 'confirming': return 'confirming';
    case 'arrived': return view.serverNow >= COUNTDOWN_OVER_AFTER ? 'commemorative' : 'welcome';
    case 'running': {
      const total = shownSeconds(view.remainingMs);
      return total <= 10 ? 'final' : total <= 60 ? 'minute' : total <= 3600 ? 'hour' : total <= 86_400 ? 'eve' : 'days';
    }
  }
}

/**
 * The dial for a moment: how many marks it carries, how much of its ring is still lit (the time left in the dial's
 * span, ending at 12 o'clock, which is midnight), and where the seconds light sits. Angles grow without wrapping so the
 * light never sweeps backwards.
 */
export interface DialModel { ticks: number; major: number; lit: number; segments: number; litSegments: number; secondAngle: number | null }
export function dialModel(stage: Stage, remainingMs: number): DialModel {
  const total = shownSeconds(remainingMs);
  const exact = Math.max(0, remainingMs) / 1000;
  const secondAngle = -total * 6;
  switch (stage) {
    case 'days':
    case 'eve': return { ticks: 24, major: 6, lit: (exact % 86_400 || (exact > 0 ? 86_400 : 0)) / 86_400, segments: 0, litSegments: 0, secondAngle };
    case 'hour': return { ticks: 60, major: 5, lit: exact / 3600, segments: 0, litSegments: 0, secondAngle };
    case 'minute': return { ticks: 60, major: 5, lit: exact / 60, segments: 0, litSegments: 0, secondAngle: null };
    case 'final': return { ticks: 0, major: 0, lit: 0, segments: 10, litSegments: total, secondAngle: null };
    case 'welcome':
    case 'commemorative': return { ticks: 60, major: 5, lit: 1, segments: 0, litSegments: 0, secondAngle: null };
    default: return { ticks: 60, major: 5, lit: 0, segments: 0, litSegments: 0, secondAngle: null };
  }
}

export interface StageCopy { kicker: string; title: string; lede: string | null }
const ACCRA = 'Accra · Ghana time';

/** The words for each stage. Greetings and time only: no offers, prices, giveaways or promises. */
export function stageCopy(stage: Stage, serverNow: number | null = null): StageCopy {
  switch (stage) {
    case 'days': return { kicker: ACCRA, title: 'Counting down to 2027', lede: 'Midnight in Accra is on its way. Share the countdown with the people you’ll welcome the new year with.' };
    case 'eve': return { kicker: 'New Year’s Eve · Accra', title: 'Tonight we welcome 2027', lede: 'The final hours of 2026. Gather your people.' };
    case 'hour': return { kicker: 'The final hour', title: 'Almost 2027', lede: null };
    case 'minute': return { kicker: 'The final minute', title: 'Here comes 2027', lede: null };
    case 'final': return { kicker: 'The final seconds', title: 'Ten seconds to 2027', lede: null };
    case 'welcome': return { kicker: welcomeKicker(serverNow), title: 'Welcome, 2027', lede: 'Happy New Year from all of us at Mystery Hub. Afehyia pa!' };
    case 'commemorative': return { kicker: 'Accra · 1 January 2027', title: '2027 began here', lede: 'The countdown reached midnight in Accra on 1 January 2027, Ghana time. Thank you for counting down with Mystery Hub.' };
    case 'unavailable': return { kicker: ACCRA, title: 'Counting down to 2027', lede: 'We can’t check the time in Accra right now. The countdown appears as soon as we can. We never guess it from your device’s clock.' };
    default: return { kicker: ACCRA, title: 'Counting down to 2027', lede: null };
  }
}

/** "New Year’s Day · Accra", then "3 January 2027 · Accra": the real Accra date from the server's time. */
export function welcomeKicker(serverNow: number | null) {
  if (serverNow === null || !Number.isFinite(serverNow)) return 'Happy New Year · Accra';
  const day = accraDate(new Date(serverNow));
  if (day === '2027-01-01') return 'New Year’s Day · Accra';
  const [, , d] = day.split('-');
  return `${Number(d)} January 2027 · Accra`;
}

/** Screen-reader words, spoken once when the stage changes while someone is counting (never every second). */
export const STAGE_ANNOUNCEMENT: Partial<Record<Stage, string>> = {
  eve: 'It’s New Year’s Eve in Accra.',
  hour: 'One hour to go until 2027.',
  minute: 'One minute to go.',
  final: 'Ten seconds to go.',
  welcome: 'Happy New Year! It’s 2027 in Accra.',
};

/** A sentence for screen readers, at minute precision (it is read on demand, not announced). */
export function remainingSentence(remainingMs: number) {
  const total = shownSeconds(remainingMs);
  if (total <= 60) return `${total} ${total === 1 ? 'second' : 'seconds'} until midnight on 1 January 2027 in Accra.`;
  const minutesTotal = Math.ceil(total / 60);
  const days = Math.floor(minutesTotal / 1440), hours = Math.floor(minutesTotal / 60) % 24, minutes = minutesTotal % 60;
  const part = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
  const parts = [days ? part(days, 'day') : '', hours ? part(hours, 'hour') : '', minutes ? part(minutes, 'minute') : ''].filter(Boolean);
  const words = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  return `About ${words} until midnight on 1 January 2027 in Accra.`;
}
