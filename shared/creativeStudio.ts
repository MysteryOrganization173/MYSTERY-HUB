/**
 * Mystery Creative Studio V1: the service catalogue and the brief rules, shared by the page and the server.
 *
 * Creative Studio sells human-delivered design work on quote. Nothing here is a price, a turnaround or a guarantee:
 * every project is scoped and priced by the team after they read the brief. A brief becomes an ordinary Marketplace
 * enquiry (inquiry_type "creative_studio"), so Admin follows it up with the existing Lead Operations workflow.
 */

export type CreativeServiceId = 'flyers' | 'social' | 'logo' | 'banners';

export interface CreativeField {
  id: string;
  label: string;
  kind: 'text' | 'choice' | 'date';
  required?: boolean;
  max?: number;
  choices?: readonly string[];
  placeholder?: string;
}

export interface CreativeService {
  id: CreativeServiceId;
  name: string;
  /** One line for the service card. */
  short: string;
  summary: string;
  uses: readonly string[];
  /** What a customer can ask for. Exact files, sizes and changes are agreed in the quote, never promised here. */
  options: readonly string[];
  /** Placeholder for the shared "Tell us what you need" box. */
  detailsHint: string;
  fields: readonly CreativeField[];
}

export const CREATIVE_SERVICES: readonly CreativeService[] = [
  {
    id: 'flyers',
    name: 'Flyers & posters',
    short: 'For events, programmes, sales and announcements.',
    summary: 'A flyer or poster designed around your message, sized for WhatsApp, social media or print.',
    uses: ['Church programmes and announcements', 'Events, parties and funerals', 'Shop sales and new arrivals', 'School and community notices'],
    options: ['A design sized for WhatsApp Status or social media', 'A print-ready version for A4, A5 or larger', 'The same design in more than one size'],
    detailsHint: 'What should the flyer say? Include the main message, times, venue and who to contact.',
    fields: [
      { id: 'title', label: 'Event or business name', kind: 'text', required: true, max: 120, placeholder: 'e.g. Harvest Thanksgiving 2026' },
      { id: 'date', label: 'Event date, if there is one', kind: 'date' },
      { id: 'format', label: 'Where will it be used?', kind: 'choice', choices: ['WhatsApp Status', 'Square social post', 'A4 print', 'A5 handbill', 'Not sure yet'] },
    ],
  },
  {
    id: 'social',
    name: 'Social media graphics',
    short: 'Posts and Status designs that promote what you sell.',
    summary: 'Promotional posts for WhatsApp Status, Instagram, Facebook or TikTok, built around one product, offer or message.',
    uses: ['Product promotions', 'Sales and price announcements', 'Opening and launch posts', 'A set of posts for one campaign'],
    options: ['A single post or Status design', 'A matching set for one campaign', 'Versions for different platforms'],
    detailsHint: 'What do you want people to know or do? Include prices or offers exactly as they should appear.',
    fields: [
      { id: 'promoting', label: 'What are you promoting?', kind: 'text', required: true, max: 160, placeholder: 'e.g. New Ankara collection, December sale' },
      { id: 'platform', label: 'Main platform', kind: 'choice', choices: ['WhatsApp Status', 'Instagram', 'Facebook', 'TikTok', 'Several platforms'] },
      { id: 'count', label: 'How many designs?', kind: 'choice', choices: ['1 design', '2 to 5 designs', '6 or more', 'Not sure yet'] },
    ],
  },
  {
    id: 'logo',
    name: 'Logo & brand identity',
    short: 'A new logo or a refresh, with colours and fonts to match.',
    summary: 'A logo for a new business, or a cleaner version of the one you have, plus the colours and fonts to use with it.',
    uses: ['A new business or brand', 'Refreshing an old or blurry logo', 'Colours and fonts to use everywhere', 'Profile pictures and cover images'],
    options: ['A logo with versions for light and dark backgrounds', 'Your brand colours and font choices', 'Profile and cover images that match'],
    detailsHint: 'Tell us about the business, who it serves and how you want it to feel. Mention any logos you like.',
    fields: [
      { id: 'businessName', label: 'Business or brand name', kind: 'text', required: true, max: 120, placeholder: 'Exactly as it should appear' },
      { id: 'businessType', label: 'What does the business do?', kind: 'text', required: true, max: 160, placeholder: 'e.g. Catering for events in Kumasi' },
      { id: 'logoStatus', label: 'New or refresh?', kind: 'choice', choices: ['A new logo', 'Refresh my current logo'] },
      { id: 'style', label: 'A style you like', kind: 'choice', choices: ['Bold', 'Elegant', 'Friendly', 'Minimal', 'Traditional'] },
      { id: 'colours', label: 'Colours you like', kind: 'text', max: 80, placeholder: 'e.g. Green and gold' },
    ],
  },
  {
    id: 'banners',
    name: 'Banners & web graphics',
    short: 'Headers and banners for your website, store or page.',
    summary: 'Banner artwork for a website, online store, social page cover, catalogue or signboard, designed to the size you need.',
    uses: ['Website and online store banners', 'Facebook and YouTube covers', 'Catalogue and menu artwork', 'Signboard and roll-up designs'],
    options: ['One banner in the size you need', 'A set of banners for a website or store', 'A print-ready file for signboards'],
    detailsHint: 'What should the banner say and show? Mention your website or page if it already exists.',
    fields: [
      { id: 'placement', label: 'Where will it appear?', kind: 'choice', required: true, choices: ['Website or online store', 'Facebook or YouTube cover', 'Catalogue or menu', 'Signboard or roll-up', 'Somewhere else'] },
      { id: 'size', label: 'Size, if you know it', kind: 'text', max: 80, placeholder: 'e.g. 1920 × 600 px, or 6 ft × 3 ft' },
    ],
  },
];

export const CREATIVE_LIMITS = { name: 80, phone: 20, email: 128, details: 800, detailsMin: 10, budget: 60, link: 200, links: 3 } as const;
export const CREATIVE_INQUIRY_TYPE = 'creative_studio';

export function creativeService(id: unknown): CreativeService | undefined {
  return CREATIVE_SERVICES.find(service => service.id === id);
}

export interface CreativeBriefInput {
  requestId: string;
  service: CreativeServiceId;
  name: string;
  phone: string;
  email?: string;
  details: string;
  neededBy?: string;
  budget?: string;
  links?: string[];
  fields?: Record<string, string>;
  /** Left empty by people. Anything here is a form-filling bot. */
  website?: string;
}

export interface CreativeBrief {
  requestId: string;
  reference: string;
  service: CreativeService;
  name: string;
  phone: string;
  email: string;
  details: string;
  neededBy: string;
  budget: string;
  links: string[];
  fields: { field: CreativeField; value: string }[];
}

export class CreativeBriefError extends Error {
  constructor(message: string, public field = '') { super(message); }
}

const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UNSAFE = /[<>\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
/** Invisible characters that can disguise text in Admin (zero-width and direction overrides). Removed, never stored. */
const INVISIBLE = /[​-‏‪-‮⁠-⁩﻿]/g;
const KEYS = ['requestId', 'service', 'name', 'phone', 'email', 'details', 'neededBy', 'budget', 'links', 'fields', 'website'];

/** Plain text only: no markup characters or control characters (new lines are allowed only where `multiline`). */
function text(value: unknown, field: string, label: string, max: number, required = false, multiline = false): string {
  if (value === undefined || value === null || value === '') {
    if (required) throw new CreativeBriefError(`${label} is required.`, field);
    return '';
  }
  if (typeof value !== 'string') throw new CreativeBriefError(`${label} must be text.`, field);
  const clean = value.replace(INVISIBLE, '').replace(/\r\n?/g, '\n').trim();
  if (required && !clean) throw new CreativeBriefError(`${label} is required.`, field);
  if (clean.length > max) throw new CreativeBriefError(`${label} can be up to ${max} characters.`, field);
  if (UNSAFE.test(clean) || (!multiline && /[\n\t]/.test(clean))) throw new CreativeBriefError(`${label} can't include < or > or special characters.`, field);
  return clean;
}

/** A Ghana number (0XX XXX XXXX or +233 XX XXX XXXX), kept as 0XXXXXXXXX; other countries keep their + form. */
export function creativePhone(value: string): string | null {
  const raw = value.replace(/[\s().-]/g, '').replace(/^00(?=[1-9])/, '+');
  if (!/^\+?\d+$/.test(raw)) return null;
  const digits = raw.replace(/^\+/, '').replace(/^00/, '');
  if (/^233\d{9}$/.test(digits)) return /^0[235]\d{8}$/.test('0' + digits.slice(3)) ? '0' + digits.slice(3) : null;
  if (!raw.startsWith('+') && /^0[235]\d{8}$/.test(digits)) return digits;
  if (raw.startsWith('+') && /^[1-9]\d{7,14}$/.test(digits) && !digits.startsWith('233')) return '+' + digits;
  return null;
}

export function creativeEmail(value: string): boolean {
  return /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i.test(value);
}

/** A reference link the team can open later: http(s) only, a real host name, no credentials. Stored as text. */
export function creativeLink(value: string): string | null {
  const clean = value.trim();
  if (!clean || clean.length > CREATIVE_LIMITS.link || UNSAFE.test(clean) || /\s/.test(clean)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(clean) ? clean : `https://${clean}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !/^[a-z0-9.-]+\.(?:[a-z]{2,}|xn--[a-z0-9-]+)$/i.test(url.hostname)) return null;
    return url.href.length > CREATIVE_LIMITS.link ? null : url.href;
  } catch { return null; }
}

/** A calendar date from today (Accra time is UTC) up to two years ahead. */
function futureDate(value: unknown, field: string, label: string, today: string): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || !/^20\d\d-\d\d-\d\d$/.test(value) || !Number.isFinite(Date.parse(value + 'T00:00:00Z')) || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) throw new CreativeBriefError(`Choose a valid ${label.toLowerCase()}.`, field);
  const latest = new Date(Date.parse(today + 'T00:00:00Z') + 731 * 86_400_000).toISOString().slice(0, 10);
  if (value < today) throw new CreativeBriefError(`${label} can't be in the past.`, field);
  if (value > latest) throw new CreativeBriefError(`${label} must be within two years.`, field);
  return value;
}

export function creativeReference(requestId: string): string {
  return 'CS-' + requestId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

/**
 * Every problem in a brief, in the order the form shows its fields (service, service questions, the brief, contact).
 * The form shows them all at once; structural problems (unknown keys, a bot field, a bad request id) come first and alone.
 */
export function creativeBriefProblems(input: unknown, today = new Date().toISOString().slice(0, 10)): CreativeBriefError[] {
  try { return check(input, today).problems; } catch (error) { if (error instanceof CreativeBriefError) return [error]; throw error; }
}

/** The one validation used by the form (for instant feedback) and the server (the rule that counts). */
export function validateCreativeBrief(input: unknown, today = new Date().toISOString().slice(0, 10)): CreativeBrief {
  const { brief, problems } = check(input, today);
  if (problems.length) throw problems[0];
  return brief!;
}

function check(input: unknown, today: string): { brief?: CreativeBrief; problems: CreativeBriefError[] } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new CreativeBriefError('Send the brief as a form.');
  const v = input as Record<string, unknown>;
  if (Object.keys(v).some(key => !KEYS.includes(key))) throw new CreativeBriefError('This brief has fields we do not accept.');
  if (v.website) throw new CreativeBriefError('We could not send this brief.');
  if (typeof v.requestId !== 'string' || !REQUEST_ID.test(v.requestId)) throw new CreativeBriefError('Reload the page and try again.');
  const given = v.fields ?? {};
  if (!given || typeof given !== 'object' || Array.isArray(given)) throw new CreativeBriefError('This brief has fields we do not accept.');
  const raw = given as Record<string, unknown>;
  const problems: CreativeBriefError[] = [];
  const attempt = <T,>(fn: () => T, fallback: T): T => { try { return fn(); } catch (error) { if (error instanceof CreativeBriefError) { problems.push(error); return fallback; } throw error; } };

  const service = creativeService(v.service);
  if (!service) problems.push(new CreativeBriefError('Choose a service.', 'service'));
  else if (Object.keys(raw).some(key => !service.fields.some(field => field.id === key))) throw new CreativeBriefError('This brief has fields we do not accept.');
  const fields = (service?.fields || []).flatMap(field => {
    const id = `fields.${field.id}`;
    const value = attempt(() => {
      if (field.kind === 'date') return futureDate(raw[field.id], id, field.label.replace(/, if there is one$/, ''), today);
      const answer = text(raw[field.id], id, field.label, field.kind === 'choice' ? 80 : field.max || 120, field.required);
      if (field.kind === 'choice' && answer && !field.choices!.includes(answer)) throw new CreativeBriefError(`Choose one of the options for “${field.label}”.`, id);
      return answer;
    }, '');
    return value ? [{ field, value }] : [];
  });
  const details = attempt(() => {
    const value = text(v.details, 'details', 'What you need', CREATIVE_LIMITS.details, true, true);
    if (value.length < CREATIVE_LIMITS.detailsMin) throw new CreativeBriefError('Tell us a little more about what you need (at least 10 characters).', 'details');
    return value;
  }, '');
  const neededBy = attempt(() => futureDate(v.neededBy, 'neededBy', 'Date you need it', today), '');
  const budget = attempt(() => text(v.budget, 'budget', 'Budget', CREATIVE_LIMITS.budget), '');
  const links: string[] = [];
  if (v.links !== undefined && (!Array.isArray(v.links) || v.links.length > CREATIVE_LIMITS.links)) problems.push(new CreativeBriefError(`Add up to ${CREATIVE_LIMITS.links} links.`, 'links'));
  else ((v.links as unknown[]) || []).forEach((link, i) => attempt(() => {
    if (typeof link !== 'string') throw new CreativeBriefError('Links must be web addresses.', `links.${i}`);
    if (!link.trim()) return;
    const safe = creativeLink(link);
    if (!safe) throw new CreativeBriefError('Use a web address like https://instagram.com/yourpage.', `links.${i}`);
    if (!links.includes(safe)) links.push(safe);
  }, undefined));
  const name = attempt(() => {
    const value = text(v.name, 'name', 'Your name', CREATIVE_LIMITS.name, true);
    if (value.length < 2) throw new CreativeBriefError('Your name is required.', 'name');
    return value;
  }, '');
  const phone = attempt(() => {
    const phoneText = text(v.phone, 'phone', 'Your WhatsApp or phone number', CREATIVE_LIMITS.phone, true);
    const value = creativePhone(phoneText);
    if (!value) throw new CreativeBriefError('Enter a phone number like 024 123 4567 or +233 24 123 4567.', 'phone');
    return value;
  }, '');
  const email = attempt(() => {
    const value = text(v.email, 'email', 'Email', CREATIVE_LIMITS.email);
    if (value && !creativeEmail(value)) throw new CreativeBriefError('Enter an email like name@example.com, or leave it empty.', 'email');
    return value;
  }, '');
  if (problems.length || !service) return { problems };
  return { problems, brief: { requestId: v.requestId.toLowerCase(), reference: creativeReference(v.requestId), service, name, phone, email, details, neededBy, budget, links, fields } };
}

/** The plain-text summary Admin reads in the enquiry card (its message box keeps line breaks). Up to 2,000 characters. */
export function creativeLeadMessage(brief: CreativeBrief): string {
  const build = (links: string[], details: string) => {
    const omitted = brief.links.length - links.length;
    const lines = [
      `Creative Studio brief ${brief.reference}`,
      `Service: ${brief.service.name}`,
      ...brief.fields.map(({ field, value }) => `${field.label.replace(/, if there is one$|\?$/g, '')}: ${value}`),
      brief.neededBy ? `Needed by: ${brief.neededBy}` : '',
      '',
      'What they need:',
      details,
      ...(brief.links.length ? ['', 'Reference links (not checked, open with care):', ...links.map(link => `- ${link}`),
        ...(omitted ? [`(${omitted} more ${omitted === 1 ? 'link' : 'links'} not shown: ask the customer)`] : [])] : []),
      '',
      'Quote required: no price or delivery date has been promised.',
    ];
    return lines.filter((line, i) => line !== '' || (i > 0 && lines[i - 1] !== '')).join('\n');
  };
  // Whole links are left out before anything is shortened, so an address is never cut into a different one,
  // and the opening lines and the quote line always stay.
  let links = [...brief.links], message = build(links, brief.details);
  while (message.length > 2000 && links.length) { links = links.slice(0, -1); message = build(links, brief.details); }
  if (message.length > 2000) message = build(links, brief.details.slice(0, Math.max(0, brief.details.length - (message.length - 2000) - 1)).trimEnd() + '…');
  return message;
}

/** The line Admin sees next to "About": the service, clearly marked as Creative Studio. */
export function creativeLeadSubject(brief: CreativeBrief): string {
  return `Creative Studio · ${brief.service.name}`;
}
