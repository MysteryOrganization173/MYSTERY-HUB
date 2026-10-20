/**
 * Website Builder V5 additive content. Every field is optional: older websites without them render exactly
 * as before, and older clients that never send them keep working. The server validates shape and limits;
 * these normalizers are the single definition both the server and the renderers use.
 */
export const WEBSITE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export interface WebsiteDayHours { closed: boolean; open?: string; close?: string }
export interface WebsiteHours { days: WebsiteDayHours[]; note?: string }
export interface WebsitePolicies { delivery?: string; payment?: string; returns?: string }
export interface WebsiteSectionLayout { order?: string[]; hidden?: string[] }
export interface WebsiteFocal { x: number; y: number }
export interface WebsiteImageMeta { heroImage?: Partial<WebsiteFocal> & { alt?: string }; logoUrl?: { alt?: string } }

export const WEBSITE_V5_LIMITS = Object.freeze({
  hoursNote: 80, policy: 400, alt: 150, label: 30, option: 24, options: 6, itemImages: 2, gallery: 6, pinnedBundles: 6, sections: 16,
});
export const WEBSITE_POLICY_KEYS = ['delivery', 'payment', 'returns'] as const;
export const WEBSITE_POLICY_LABELS: Record<typeof WEBSITE_POLICY_KEYS[number], string> = { delivery: 'Delivery & pickup', payment: 'Payment', returns: 'Returns & exchanges' };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const isWebsiteTime = (value: unknown): value is string => typeof value === 'string' && TIME.test(value);
export const isFocal = (value: unknown): value is WebsiteFocal => !!value && typeof value === 'object'
  && Number.isInteger((value as any).x) && Number.isInteger((value as any).y) && (value as any).x >= 0 && (value as any).x <= 100 && (value as any).y >= 0 && (value as any).y <= 100;
/** CSS object-position for an owner focal point; the centre when none was chosen. */
export const focalPosition = (focal?: Partial<WebsiteFocal> | null) => focal && isFocal({ x: focal.x, y: focal.y }) ? `${focal.x}% ${focal.y}%` : undefined;

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
/** Ghana keeps UTC all year (no daylight saving), so Accra time is UTC. */
function accraParts(now: Date) { const day = (now.getUTCDay() + 6) % 7; return { day, minute: now.getUTCHours() * 60 + now.getUTCMinutes() }; }

export type WebsiteOpenState = { open: boolean; label: string } | null;
/**
 * "Open now" from the owner's own hours. Overnight hours (close earlier than open, e.g. 18:00–02:00)
 * continue into the next morning. Without complete hours it returns null and the badge is hidden.
 */
export function websiteOpenState(hours: WebsiteHours | undefined, now = new Date()): WebsiteOpenState {
  if (!hours || !Array.isArray(hours.days) || hours.days.length !== 7) return null;
  const valid = hours.days.every(d => d && (d.closed === true || (isWebsiteTime(d.open) && isWebsiteTime(d.close))));
  if (!valid || hours.days.every(d => d.closed)) return null;
  const { day, minute } = accraParts(now);
  const today = hours.days[day], yesterday = hours.days[(day + 6) % 7];
  if (!yesterday.closed && minutes(yesterday.close!) < minutes(yesterday.open!) && minute < minutes(yesterday.close!)) return { open: true, label: `Open now · until ${displayTime(yesterday.close!)}` };
  if (!today.closed) {
    const open = minutes(today.open!), close = minutes(today.close!);
    const overnight = close < open, all = close === open;
    if (all || (minute >= open && (overnight || minute < close))) return { open: true, label: all ? 'Open now' : `Open now · until ${displayTime(today.close!)}` };
    if (minute < open) return { open: false, label: `Closed now · opens ${displayTime(today.open!)}` };
  }
  for (let step = 1; step <= 7; step++) {
    const next = hours.days[(day + step) % 7];
    if (!next.closed) return { open: false, label: `Closed now · opens ${step === 1 ? 'tomorrow' : WEBSITE_DAYS[(day + step) % 7]} ${displayTime(next.open!)}` };
  }
  return null;
}
export function displayTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  const suffix = h < 12 ? 'am' : 'pm', hour = h % 12 || 12;
  return m ? `${hour}:${String(m).padStart(2, '0')} ${suffix}` : `${hour} ${suffix}`;
}
/** Groups consecutive days with identical hours: "Mon – Fri 11 am – 9 pm". */
export function websiteHoursRows(hours: WebsiteHours | undefined): Array<{ days: string; time: string }> {
  if (!hours || !Array.isArray(hours.days) || hours.days.length !== 7) return [];
  const text = (d: WebsiteDayHours) => d.closed ? 'Closed' : isWebsiteTime(d.open) && isWebsiteTime(d.close) ? (d.open === d.close ? 'Open 24 hours' : `${displayTime(d.open)} – ${displayTime(d.close)}`) : '';
  const rows: Array<{ start: number; end: number; time: string }> = [];
  hours.days.forEach((d, i) => { const t = text(d); const last = rows[rows.length - 1]; if (last && last.time === t) last.end = i; else rows.push({ start: i, end: i, time: t }); });
  const short = (i: number) => WEBSITE_DAYS[i].slice(0, 3);
  return rows.filter(r => r.time).map(r => ({ days: r.start === r.end ? WEBSITE_DAYS[r.start] : `${short(r.start)} – ${short(r.end)}`, time: r.time }));
}

/** Google Maps directions to the owner's written location; no coordinates are stored or guessed. */
export const websiteDirectionsUrl = (location?: string) => location?.trim() ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.trim())}` : null;

export function defaultWebsiteHours(): WebsiteHours {
  return { days: WEBSITE_DAYS.map((_, i) => i === 6 ? { closed: true } : { closed: false, open: '09:00', close: '18:00' }) };
}

/* ---------------------------------------------------------------------------------------------
 * Section visibility and order for designed templates. Each design declares its own sections.
 * Essential sections (the header, the way to buy or contact, the footer) are never hidden or moved.
 * Hidden sections keep their content; navigation only links to visible sections.
 * ------------------------------------------------------------------------------------------- */
export interface WebsiteSectionDef { id: string; label: string; essential?: boolean; nav?: string }
export const WEBSITE_SECTION_REGISTRY: Record<string, readonly WebsiteSectionDef[]> = {};
export function registerWebsiteSections(layout: string, sections: readonly WebsiteSectionDef[]) { WEBSITE_SECTION_REGISTRY[layout] = sections; }

/** The ordered, visible sections a renderer should draw. Unknown ids are ignored. */
export function resolveWebsiteSections(layout: string, layoutState?: WebsiteSectionLayout): Array<WebsiteSectionDef & { visible: boolean }> {
  const defs = WEBSITE_SECTION_REGISTRY[layout] || [];
  const movable = defs.filter(d => !d.essential).map(d => d.id);
  const order = [...new Set((layoutState?.order || []).filter(id => movable.includes(id)))];
  const ordered = [...order, ...movable.filter(id => !order.includes(id))];
  const hidden = new Set((layoutState?.hidden || []).filter(id => movable.includes(id)));
  let next = 0;
  // Essential sections keep their declared position; the movable ones fill the slots between them.
  return defs.map(def => def.essential ? { ...def, visible: true } : { ...defs.find(d => d.id === ordered[next++])!, visible: !hidden.has(ordered[next - 1]) });
}
export const websiteSectionVisible = (layout: string, id: string, layoutState?: WebsiteSectionLayout) => resolveWebsiteSections(layout, layoutState).find(s => s.id === id)?.visible ?? true;
