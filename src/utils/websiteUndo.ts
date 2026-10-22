/**
 * Field-level undo for the website editor. Each entry remembers, per top-level draft field, the value before
 * and after one change. Undo restores only fields that still hold the "after" value, so it can never wipe out
 * a later edit to another field (or a later edit to the same field that is no longer on top of the stack).
 */
export type UndoScope = 'content' | 'settings';
export interface UndoField { scope: UndoScope; key: string; before: unknown; after: unknown }
export interface UndoEntry { fields: UndoField[]; at: number }
export interface UndoDraft { content: Record<string, any>; settings: Record<string, any> }

export const UNDO_LIMIT = 50, UNDO_COALESCE_MS = 1500;
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

export function undoDiff(from: UndoDraft, to: UndoDraft): UndoField[] {
  const fields: UndoField[] = [];
  for (const scope of ['content', 'settings'] as const) {
    const keys = new Set([...Object.keys(from[scope] || {}), ...Object.keys(to[scope] || {})]);
    for (const key of keys) if (!same(from[scope]?.[key], to[scope]?.[key])) fields.push({ scope, key, before: structuredClone(from[scope]?.[key]), after: structuredClone(to[scope]?.[key]) });
  }
  return fields;
}

/** Adds a change. Typing into one field within a moment of the last keystroke extends the same entry. */
export function pushUndo(stack: UndoEntry[], fields: UndoField[], now: number): UndoEntry[] {
  if (!fields.length) return stack;
  const top = stack[stack.length - 1];
  if (top && fields.length === 1 && top.fields.length === 1 && top.fields[0].scope === fields[0].scope && top.fields[0].key === fields[0].key && now - top.at < UNDO_COALESCE_MS)
    return [...stack.slice(0, -1), { fields: [{ ...top.fields[0], after: fields[0].after }], at: now }];
  return [...stack, { fields, at: now }].slice(-UNDO_LIMIT);
}

/** Reverts the newest change that is still in place. Stale entries (already overwritten) are dropped. */
export function applyUndo(stack: UndoEntry[], draft: UndoDraft): { stack: UndoEntry[]; draft: UndoDraft; entry: UndoEntry | null } {
  const rest = [...stack];
  while (rest.length) {
    const entry = rest.pop()!;
    const live = entry.fields.filter(f => same(draft[f.scope]?.[f.key], f.after));
    if (!live.length) continue;
    const next: UndoDraft = { content: { ...draft.content }, settings: { ...draft.settings } };
    for (const f of live) { if (f.before === undefined) delete next[f.scope][f.key]; else next[f.scope][f.key] = structuredClone(f.before); }
    return { stack: rest, draft: next, entry: { ...entry, fields: live } };
  }
  return { stack: [], draft, entry: null };
}

const LABELS: Record<string, string> = {
  businessName: 'business name', tagline: 'headline', aboutText: 'description', location: 'location', phone: 'phone number', whatsapp: 'WhatsApp number',
  email: 'email', heroImage: 'main photo', logoUrl: 'logo', ctaLabel: 'main button', ctaTarget: 'button link', social: 'social links', items: 'items',
  copy: 'wording', hours: 'opening hours', policies: 'policies', sections: 'page sections', imageMeta: 'photo details', gallery: 'gallery',
  composition: 'sections', primaryColor: 'colours', accentColor: 'colours', backgroundColor: 'colours',
};
export function undoLabel(entry?: UndoEntry | null): string {
  if (!entry) return '';
  const names = [...new Set(entry.fields.map(f => LABELS[f.key] || 'change'))];
  return names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : 'several changes';
}
