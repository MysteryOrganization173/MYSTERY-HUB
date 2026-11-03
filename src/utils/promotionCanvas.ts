import { PROMO_FORMATS, PROMO_NETWORK_COLOR, promoBundlesFor, promoDisplayUrl, promoFromMinor, promoNetworkList, promoNetworkName, promoNetworksIn, promoPalette, promoPrice, type PromoBundle, type PromoChoice, type PromoFacts, type PromoPalette } from './promotionKit.js';
import { websiteActionText } from './websiteBrand.js';

/**
 * Promotion Kit V1 drawing: Canvas 2D at the export size (1080 wide), so the preview and the PNG are the same
 * pixels and text stays sharp. Only the page's own fonts and the owner's logo are used. The logo is requested with
 * CORS; if it cannot be read the advert uses the business initials instead, so an export never fails or taints.
 */
type Ctx = CanvasRenderingContext2D;
const DISPLAY = "Outfit, 'Plus Jakarta Sans', system-ui, sans-serif";
const BODY = "'Plus Jakarta Sans', system-ui, sans-serif";

export async function loadPromoFonts(): Promise<void> {
  try { await Promise.all(['800 96px Outfit', '700 48px Outfit', '600 34px "Plus Jakarta Sans"', '500 34px "Plus Jakarta Sans"'].map(spec => document.fonts.load(spec))); } catch { /* system fonts are fine */ }
}

/** A Cloudinary logo is asked for as a bounded PNG (keeps transparency, small download). */
export function promoLogoSource(url?: string): string | null {
  const value = (url || '').trim();
  if (!/^https:\/\//.test(value) && !value.startsWith('/')) return null;
  return value.includes('res.cloudinary.com/') && value.includes('/image/upload/') && !value.includes('/image/upload/f_') ? value.replace('/image/upload/', '/image/upload/f_png,w_480,h_480,c_limit/') : value;
}
export function loadPromoLogo(url?: string): Promise<HTMLImageElement | null> {
  const src = promoLogoSource(url);
  if (!src) return Promise.resolve(null);
  return new Promise(resolve => {
    const img = new Image(); let done = false; const finish = (value: HTMLImageElement | null) => { if (!done) { done = true; resolve(value); } };
    img.crossOrigin = 'anonymous'; img.decoding = 'async';
    img.onload = () => finish(img.naturalWidth > 0 ? img : null); img.onerror = () => finish(null);
    setTimeout(() => finish(null), 8000);
    img.src = src;
  });
}

const font = (ctx: Ctx, weight: number, size: number, family = DISPLAY) => { ctx.font = `${weight} ${Math.round(size)}px ${family}`; };
function rounded(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr); ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath();
}
function wrap(ctx: Ctx, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean), lines: string[] = [];
  let line = '';
  for (let word of words) {
    while (ctx.measureText(word).width > maxWidth && word.length > 1) {
      // A single word longer than the line (a long brand name) breaks where it must.
      let cut = word.length - 1; while (cut > 1 && ctx.measureText(word.slice(0, cut) + '-').width > maxWidth) cut--;
      if (line) { lines.push(line); line = ''; }
      lines.push(word.slice(0, cut) + '-'); word = word.slice(cut);
    }
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next; else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}
/** The largest size (down to `min`) at which the text fits in `maxLines`; at `min` the last line ends with "…". */
export function fitText(ctx: Ctx, text: string, maxWidth: number, maxLines: number, start: number, min: number, weight: number, family = DISPLAY) {
  for (let size = start; size >= min; size -= 2) {
    font(ctx, weight, size, family);
    const lines = wrap(ctx, text, maxWidth);
    if (lines.length <= maxLines) return { lines, size, lh: size * 1.08 };
  }
  font(ctx, weight, min, family);
  const lines = wrap(ctx, text, maxWidth).slice(0, maxLines);
  let last = lines[maxLines - 1] || '';
  while (last && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
  if (lines.length === maxLines) lines[maxLines - 1] = last.trimEnd() + '…';
  return { lines, size: min, lh: min * 1.08 };
}
function drawText(ctx: Ctx, fit: ReturnType<typeof fitText>, x: number, y: number, color: string, weight: number, align: CanvasTextAlign = 'left', family = DISPLAY): number {
  font(ctx, weight, fit.size, family); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'top';
  fit.lines.forEach((line, i) => ctx.fillText(line, x, y + i * fit.lh));
  return fit.lines.length * fit.lh;
}
const initials = (name: string) => name.split(/\s+/).filter(w => /[a-z0-9]/i.test(w)).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || 'MY';

function drawMark(ctx: Ctx, x: number, y: number, size: number, logo: HTMLImageElement | null, name: string, pal: PromoPalette) {
  rounded(ctx, x, y, size, size, size * 0.26);
  if (logo) {
    ctx.fillStyle = '#ffffff'; ctx.fill();
    const pad = size * 0.12, box = size - pad * 2, ratio = Math.min(box / logo.naturalWidth, box / logo.naturalHeight);
    const w = logo.naturalWidth * ratio, h = logo.naturalHeight * ratio;
    ctx.save(); rounded(ctx, x, y, size, size, size * 0.26); ctx.clip(); ctx.drawImage(logo, x + (size - w) / 2, y + (size - h) / 2, w, h); ctx.restore();
  } else {
    ctx.fillStyle = pal.accent; ctx.fill();
    font(ctx, 800, size * 0.4); ctx.fillStyle = pal.onAccent; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(initials(name), x + size / 2, y + size / 2 + size * 0.02);
  }
}
/** Logo and name on one line at the top. Returns the height used. */
function brandRow(ctx: Ctx, x: number, y: number, maxWidth: number, logo: HTMLImageElement | null, name: string, pal: PromoPalette, mark = 104): number {
  drawMark(ctx, x, y, mark, logo, name, pal);
  const fit = fitText(ctx, name, maxWidth - mark - 28, 2, 46, 30, 700);
  const h = fit.lines.length * fit.lh;
  drawText(ctx, fit, x + mark + 28, y + (mark - h) / 2 + 2, pal.ink, 700);
  return mark;
}
/** The link people type: a full-width pill in the accent colour, with a short lead-in. */
function urlPill(ctx: Ctx, x: number, y: number, w: number, url: string, pal: PromoPalette, lead = 'Shop now at'): number {
  const h = 150, lines = promoUrlLines(ctx, promoDisplayUrl(url), w - 88);
  rounded(ctx, x, y, w, h, 40); ctx.fillStyle = pal.accent; ctx.fill();
  ctx.fillStyle = pal.onAccent; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  if (lines.lines.length === 1) {
    font(ctx, 600, 30, BODY); ctx.globalAlpha = 0.85; ctx.fillText(lead, x + 44, y + 26); ctx.globalAlpha = 1;
    drawText(ctx, lines, x + 44, y + 70 + (50 - lines.size) / 2, pal.onAccent, 700);
  } else drawText(ctx, lines, x + 44, y + (h - lines.lines.length * lines.lh) / 2, pal.onAccent, 700);
  return h;
}
/**
 * A link must stay exactly as typed: never a hyphen added, never cut. One line when it fits at a readable size,
 * otherwise two lines broken after "/sites/" (or the last "/"), each line as large as both allow.
 */
export function promoUrlLines(ctx: Ctx, display: string, maxWidth: number) {
  for (let size = 50; size >= 34; size -= 2) { font(ctx, 700, size); if (ctx.measureText(display).width <= maxWidth) return { lines: [display], size, lh: size * 1.08 }; }
  const cut = display.includes('/sites/') ? display.indexOf('/sites/') + 7 : display.lastIndexOf('/') + 1;
  const parts = cut > 0 && cut < display.length ? [display.slice(0, cut), display.slice(cut)] : [display];
  for (let size = 46; size > 16; size -= 2) { font(ctx, 700, size); if (parts.every(p => ctx.measureText(p).width <= maxWidth)) return { lines: parts, size, lh: size * 1.12 }; }
  return { lines: parts, size: 16, lh: 18 };
}
function smallNote(ctx: Ctx, text: string, x: number, y: number, pal: PromoPalette, align: CanvasTextAlign = 'left', size = 28) {
  font(ctx, 500, size, BODY); ctx.fillStyle = pal.muted; ctx.textAlign = align; ctx.textBaseline = 'top'; ctx.fillText(text, x, y);
}
function networkDot(ctx: Ctx, x: number, y: number, r: number, network: PromoBundle['network']) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = PROMO_NETWORK_COLOR[network]; ctx.fill();
}
function glow(ctx: Ctx, x: number, y: number, r: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'transparent');
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}

/** Draw one advert at full size into a canvas of PROMO_FORMATS[choice.format]. */
export function drawPromo(ctx: Ctx, choice: PromoChoice, facts: PromoFacts, logo: HTMLImageElement | null) {
  const { width: W, height: H } = PROMO_FORMATS[choice.format];
  const story = choice.format === 'story', pal = promoPalette(facts.colors, choice.treatment);
  const P = story ? 88 : 72, inner = W - P * 2;
  const name = facts.name.trim() || 'My Data Store';
  const networks = promoNetworksIn(facts.bundles);
  const bundles = promoBundlesFor(choice, facts);
  ctx.save();
  ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, W, H);
  const pillY = H - P - 150;
  const securely = 'Pay securely on my store with Paystack';

  if (choice.design === 'launch') {
    glow(ctx, W * 0.92, H * 0.08, W * 0.9, pal.accent, 0.35);
    ctx.save(); ctx.strokeStyle = pal.accent; ctx.globalAlpha = 0.35; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(W * 0.92, story ? H * 0.12 : H * 0.1, W * 0.36, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    const mark = story ? 160 : 120;
    drawMark(ctx, P, P, mark, logo, name, pal);
    // A poster: the mark at the top, the announcement set low above the link, the glow filling the space between.
    const chip = fitText(ctx, choice.headline, inner - 80, 1, story ? 52 : 40, 28, 700);
    const title = fitText(ctx, name, inner, story ? 3 : 2, story ? 168 : 120, 64, 800);
    const line = fitText(ctx, networks.length ? `Data bundles for ${promoNetworkList(networks)}` : 'Data bundles, bought and paid for online', inner, 2, story ? 52 : 40, 28, 500, BODY);
    const gaps = story ? [48, 36, 44] : [32, 20, 28], dots = networks.length ? 48 : 0;
    const block = chip.size + 44 + gaps[0] + title.lines.length * title.lh + gaps[1] + line.lines.length * line.lh + gaps[2] + dots;
    let y = story ? Math.max(P + mark + 120, pillY - (story ? 140 : 60) - block) : P + mark + 56;
    font(ctx, 700, chip.size); const chipW = Math.min(inner, ctx.measureText(chip.lines[0] || '').width + 80);
    rounded(ctx, P, y, chipW, chip.size + 44, 999); ctx.fillStyle = pal.accent; ctx.fill();
    drawText(ctx, chip, P + 40, y + 24, pal.onAccent, 700); y += chip.size + 44 + gaps[0];
    y += drawText(ctx, title, P, y, pal.ink, 800) + gaps[1];
    y += drawText(ctx, line, P, y, pal.muted, 500, 'left', BODY) + gaps[2];
    if (networks.length && (story || y + 60 < pillY - 60)) { let x = P; for (const n of networks) { networkDot(ctx, x + 22, y + 22, 22, n); font(ctx, 700, 34, BODY); ctx.fillStyle = pal.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(promoNetworkName(n), x + 58, y + 24); x += 58 + ctx.measureText(promoNetworkName(n)).width + 44; } }
    urlPill(ctx, P, pillY, inner, facts.url, pal);
  }

  else if (choice.design === 'bundles') {
    glow(ctx, 0, H, W, pal.accent, 0.22);
    let y = P;
    y += brandRow(ctx, P, y, inner, logo, name, pal, story ? 104 : 88) + (story ? 80 : 40);
    const head = fitText(ctx, choice.headline, inner, 2, story ? 112 : 84, 56, 800);
    y += drawText(ctx, head, P, y, pal.ink, 800) + (story ? 36 : 22);
    if (bundles[0]) { networkDot(ctx, P + 18, y + 20, 18, bundles[0].network); font(ctx, 700, 36, BODY); ctx.fillStyle = pal.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(`${promoNetworkName(bundles[0].network)} bundles`, P + 50, y + 22); }
    y += story ? 76 : 58;
    const rowH = story ? 168 : 112, cardH = bundles.length * rowH;
    rounded(ctx, P, y, inner, cardH, 36); ctx.fillStyle = pal.panel; ctx.fill();
    bundles.forEach((b, i) => {
      const ry = y + i * rowH;
      if (i) { ctx.fillStyle = pal.line; ctx.fillRect(P + 40, ry, inner - 80, 2); }
      const size = fitText(ctx, b.dataAmount, inner * 0.45, 1, story ? 84 : 64, 40, 800);
      drawText(ctx, size, P + 44, ry + (story ? 30 : 20), pal.ink, 800);
      if (b.validity && story) smallNote(ctx, b.validity, P + 46, ry + 30 + size.size + 8, pal, 'left', 26);
      const price = fitText(ctx, promoPrice(b.priceMinor), inner * 0.45, 1, story ? 64 : 52, 34, 800);
      drawText(ctx, price, P + inner - 44, ry + (rowH - price.size) / 2, pal.accent, 800, 'right');
    });
    y += cardH + 28;
    smallNote(ctx, 'Prices as shown on my store. The store always shows the current price.', P, y, pal, 'left', story ? 28 : 24);
    urlPill(ctx, P, pillY, inner, facts.url, pal);
  }

  else if (choice.design === 'networks') {
    let y = P;
    y += brandRow(ctx, P, y, inner, logo, name, pal, story ? 104 : 88) + (story ? 84 : 40);
    const head = fitText(ctx, choice.headline, inner, story ? 3 : 2, story ? 108 : 78, 52, 800);
    y += drawText(ctx, head, P, y, pal.ink, 800) + (story ? 56 : 30);
    const area = pillY - (story ? 64 : 36) - y, gap = story ? 28 : 20;
    if (story) {
      const tileH = Math.min(300, (area - gap * (networks.length - 1)) / Math.max(networks.length, 1));
      networks.forEach((n, i) => networkTile(ctx, n, P, y + i * (tileH + gap), inner, tileH, facts, true));
    } else {
      const tileW = (inner - gap * (networks.length - 1)) / Math.max(networks.length, 1);
      networks.forEach((n, i) => networkTile(ctx, n, P + i * (tileW + gap), y, tileW, area, facts, false));
    }
    urlPill(ctx, P, pillY, inner, facts.url, pal);
  }

  else if (choice.design === 'featured') {
    const b = bundles[0];
    glow(ctx, W / 2, H * 0.45, W * 0.8, b ? PROMO_NETWORK_COLOR[b.network] : pal.accent, 0.28);
    let y = P;
    y += brandRow(ctx, P, y, inner, logo, name, pal, story ? 104 : 88) + (story ? 96 : 40);
    const head = fitText(ctx, choice.headline, inner, 1, story ? 64 : 52, 36, 700);
    y += drawText(ctx, head, P, y, pal.accent, 700) + (story ? 40 : 24);
    if (b) {
      const cardH = pillY - (story ? 80 : 40) - y, color = PROMO_NETWORK_COLOR[b.network];
      rounded(ctx, P, y, inner, cardH, 48); ctx.fillStyle = pal.panel; ctx.fill();
      ctx.save(); rounded(ctx, P, y, inner, cardH, 48); ctx.clip(); ctx.fillStyle = color; ctx.fillRect(P, y, inner, story ? 120 : 86); ctx.restore();
      font(ctx, 800, story ? 48 : 38, BODY); ctx.fillStyle = websiteActionText(color); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(promoNetworkName(b.network), P + 48, y + (story ? 60 : 43));
      const size = fitText(ctx, b.dataAmount, inner - 96, 1, story ? 300 : 190, 90, 800);
      const sizeY = y + (story ? 120 : 86) + (cardH - (story ? 120 : 86) - size.size - (story ? 150 : 100)) / 2;
      drawText(ctx, size, P + inner / 2, sizeY, pal.ink, 800, 'center');
      const price = fitText(ctx, promoPrice(b.priceMinor), inner - 96, 1, story ? 104 : 76, 48, 800);
      drawText(ctx, price, P + inner / 2, sizeY + size.size + (story ? 24 : 12), pal.accent, 800, 'center');
      if (b.validity) smallNote(ctx, b.validity, P + inner / 2, y + cardH - (story ? 70 : 50), pal, 'center', story ? 32 : 26);
    }
    urlPill(ctx, P, pillY, inner, facts.url, pal);
  }

  else if (choice.design === 'identity') {
    ctx.save(); ctx.strokeStyle = pal.accent; ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) { ctx.globalAlpha = 0.24 - i * 0.035; ctx.beginPath(); ctx.arc(W / 2, story ? H * 0.36 : H * 0.34, (story ? 250 : 190) + i * (story ? 70 : 52), 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
    const mark = story ? 360 : 250, my = (story ? H * 0.36 : H * 0.34) - mark / 2;
    drawMark(ctx, (W - mark) / 2, my, mark, logo, name, pal);
    let y = my + mark + (story ? 120 : 56);
    const title = fitText(ctx, name, inner, story ? 3 : 2, story ? 120 : 84, 52, 800);
    y += drawText(ctx, title, W / 2, y, pal.ink, 800, 'center') + (story ? 28 : 14);
    const line = fitText(ctx, choice.headline, inner, 2, story ? 52 : 40, 30, 500, BODY);
    drawText(ctx, line, W / 2, y, pal.muted, 500, 'center', BODY);
    urlPill(ctx, P, pillY, inner, facts.url, pal, 'Visit');
  }

  else {
    glow(ctx, W, 0, W * 0.9, pal.accent, 0.3);
    let y = P + (story ? 40 : 0);
    const head = fitText(ctx, choice.headline, inner, 3, story ? 140 : 96, 64, 800);
    y += drawText(ctx, head, P, y, pal.ink, 800) + (story ? 80 : 36);
    const steps = ['Open my store link', 'Choose your bundle', 'Pay securely with Paystack'];
    const stepH = story ? 136 : 92;
    steps.forEach((step, i) => {
      const cy = y + i * stepH, r = story ? 40 : 30;
      ctx.beginPath(); ctx.arc(P + r, cy + r, r, 0, Math.PI * 2); ctx.fillStyle = pal.accent; ctx.fill();
      font(ctx, 800, r * 1.1); ctx.fillStyle = pal.onAccent; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), P + r, cy + r + 2);
      font(ctx, 600, story ? 46 : 36, BODY); ctx.fillStyle = pal.ink; ctx.textAlign = 'left'; ctx.fillText(step, P + r * 2 + 32, cy + r + 2);
    });
    y += steps.length * stepH + (story ? 40 : 10);
    if (story) {
      // The store's own card: a large mark and name, so the link below reads as theirs.
      const box = pillY - 100 - y;
      if (box > 320) {
        rounded(ctx, P, y, inner, box, 40); ctx.fillStyle = pal.panel; ctx.fill();
        const mark = Math.min(240, box - 220), title = fitText(ctx, name, inner - 96, 2, 84, 44, 800);
        const content = mark + 36 + title.lines.length * title.lh, top = y + (box - content) / 2;
        drawMark(ctx, (W - mark) / 2, top, mark, logo, name, pal);
        drawText(ctx, title, W / 2, top + mark + 36, pal.ink, 800, 'center');
      }
    }
    else brandRow(ctx, P, pillY - 40 - 88, inner, logo, name, pal, 88);
    urlPill(ctx, P, pillY, inner, facts.url, pal, 'Open');
  }

  if (story && choice.design !== 'bundles') smallNote(ctx, securely, W / 2, pillY - 56, pal, 'center', 28);
  ctx.restore();

  function networkTile(c: Ctx, n: PromoBundle['network'], x: number, y: number, w: number, h: number, f: PromoFacts, wide: boolean) {
    const color = PROMO_NETWORK_COLOR[n], ink = websiteActionText(color), from = promoFromMinor(f.bundles, n);
    rounded(c, x, y, w, h, 36); c.fillStyle = color; c.fill();
    const label = fitText(c, promoNetworkName(n), w - 80, 1, wide ? 96 : 64, 34, 800);
    drawText(c, label, x + 40, y + (wide ? (h - label.size) / 2 - (from !== null ? 24 : 0) : 40), ink, 800);
    if (from !== null) {
      const text = fitText(c, `from ${promoPrice(from)}`, w - 80, 1, wide ? 44 : 34, 22, 600, BODY);
      drawText(c, text, wide ? x + w - 40 : x + 40, wide ? y + (h - text.size) / 2 + (wide ? 0 : 0) : y + h - 40 - text.size, ink, 600, wide ? 'right' : 'left', BODY);
    }
  }
}

/** Render to a fresh canvas and return the PNG. If the logo made the canvas unreadable, redraw with initials. */
export async function promoPng(choice: PromoChoice, facts: PromoFacts, logo: HTMLImageElement | null): Promise<Blob> {
  const { width, height } = PROMO_FORMATS[choice.format];
  const toBlob = (img: HTMLImageElement | null) => new Promise<Blob>((resolve, reject) => {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d'); if (!ctx) { reject(new Error('Canvas is not available in this browser.')); return; }
    drawPromo(ctx, choice, facts, img);
    try { canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The picture could not be created.')), 'image/png'); } catch (error) { reject(error); }
  });
  try { return await toBlob(logo); } catch (error) { if (logo) return toBlob(null); throw error; }
}
