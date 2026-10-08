/** Choose readable action text for an existing owner/template hex color. */
export function websiteActionText(color: string): '#000000' | '#ffffff' {
  let hex = color.replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return '#ffffff';
  const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return luminance > 0.179 ? '#000000' : '#ffffff';
}

/** Opaque hex colors used by saved website themes. No saved colors are mutated. */
function luminance(color: string): number {
  let hex = color.replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(hex)) throw new Error('Expected an opaque website hex color');
  const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
}

export function websiteContrast(foreground: string, background: string): number {
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

export function readableWebsiteColor(preferred: string, backgrounds: string[], minimum = 4.5): string {
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
