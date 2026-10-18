/** Choose readable action text for an existing owner/template hex color. */
export function websiteActionText(color: string): '#000000' | '#ffffff' {
  let hex = typeof color === 'string' ? color.replace(/^#/, '') : '';
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return '#ffffff';
  const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return luminance > 0.179 ? '#000000' : '#ffffff';
}

/** Opaque hex colors used by saved website themes. No saved colors are mutated. */
function luminance(color: string): number {
  let hex = typeof color === 'string' ? color.replace(/^#/, '') : '';
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(hex)) hex = 'ffffff';
  const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
}

export function websiteContrast(foreground: string, background: string): number {
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

export function readableWebsiteColor(preferred: string, backgrounds: string[], minimum = 4.5): string {
  preferred = normalizeWebsiteColor(preferred, '#0f172a');
  backgrounds = backgrounds.map(bg => normalizeWebsiteColor(bg, '#ffffff'));
  if (backgrounds.every(bg => websiteContrast(preferred, bg) >= minimum)) return preferred;
  const candidates = ['#000000', '#ffffff', '#767676'];
  return candidates.sort((a, b) => Math.min(...backgrounds.map(bg => websiteContrast(b, bg)))
    - Math.min(...backgrounds.map(bg => websiteContrast(a, bg))))[0];
}

/** Reseller-only presentation tokens: background and card surface may differ in brightness. */
export function resolveResellerTheme(colors: {
  primary: string; secondary: string; background: string; surface: string;
  text: string; mutedText: string; accent: string; border: string;
}) {
  colors = normalizeWebsitePalette(colors);
  return {
    ...colors,
    text: readableWebsiteColor(colors.text, [colors.background]),
    mutedText: readableWebsiteColor(colors.mutedText, [colors.background]),
    surfaceText: readableWebsiteColor(colors.text, [colors.surface]),
    surfaceMutedText: readableWebsiteColor(colors.mutedText, [colors.surface]),
    accentText: readableWebsiteColor(colors.accent, [colors.background]),
    surfaceAccentText: readableWebsiteColor(colors.accent, [colors.surface]),
    border: readableWebsiteColor(colors.border, [colors.background, colors.surface], 3),
    focus: readableWebsiteColor(colors.accent, [colors.background, colors.surface], 3),
  };
}

/** Normalize partial/legacy inputs for presentation only; never mutate persisted drafts. */
export function normalizeWebsiteColor(value: unknown, fallback: string): string {
  const hex = typeof value === 'string' ? value.trim() : '';
  if (/^#[0-9a-f]{3}$/i.test(hex)) return '#' + [...hex.slice(1)].map(c => c + c).join('');
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex : fallback;
}
export function normalizeWebsitePalette(colors: Partial<{
  primary:string;secondary:string;background:string;surface:string;text:string;mutedText:string;accent:string;border:string;
}> = {}) {
  const defaults = {primary:'#0f172a',secondary:'#2563eb',background:'#ffffff',surface:'#f8fafc',text:'#0f172a',mutedText:'#64748b',accent:'#2563eb',border:'#e2e8f0'};
  return Object.fromEntries(Object.entries(defaults).map(([key,fallback])=>[key,normalizeWebsiteColor(colors[key as keyof typeof colors],fallback)])) as typeof defaults;
}

/** Blend two opaque hex colours; t=0 gives `a`, t=1 gives `b`. */
export function mixWebsiteColor(a: string, b: string, t: number): string {
  const parse = (hex: string) => [1, 3, 5].map(i => parseInt(normalizeWebsiteColor(hex, '#000000').slice(i, i + 2), 16));
  const [x, y] = [parse(a), parse(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/**
 * Data storefront tokens derived from the owner's background, so cards, borders and text always belong to the
 * owner's chosen colour (a white store gets light cards, a dark store dark ones). Saved colours are not changed.
 */
export function resolveStoreTheme(colors: Partial<{primary:string;secondary:string;background:string;surface:string;text:string;mutedText:string;accent:string;border:string}>) {
  const base = normalizeWebsitePalette(colors);
  const dark = luminance(base.background) < 0.18;
  const ink = dark ? '#ffffff' : '#0f172a';
  const surface = mixWebsiteColor(base.background, ink, dark ? 0.06 : 0.035);
  // Controls need a 3:1 boundary; cards only need a quiet hairline in the same family.
  let t = 0.12, border = mixWebsiteColor(base.background, ink, t);
  while (t < 1 && [base.background, surface].some(bg => websiteContrast(border, bg) < 3)) border = mixWebsiteColor(base.background, ink, t = Math.min(1, t + 0.02));
  return {
    ...resolveResellerTheme({ ...base, surface, border, text: dark ? '#f8fafc' : '#0f172a', mutedText: dark ? '#a3b1c6' : '#526072' }),
    hairline: mixWebsiteColor(base.background, ink, dark ? 0.13 : 0.1),
  };
}
