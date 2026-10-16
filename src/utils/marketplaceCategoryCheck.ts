/**
 * Category check for admins. Reads a product's own name and tagline and, when they
 * clearly name a different kind of product than its saved category, suggests the
 * category that fits. It never changes anything: the admin opens the product, decides
 * and saves through the normal editor (so the change is audited like any other edit).
 */
import type { MarketplaceProduct } from '../types';

export interface CategoryRef { slug: string; label: string; active?: boolean }
export interface CategorySuggestion { productId: string; productName: string; current: string; suggested: string; suggestedLabel: string; reason: string }

// Ordered: the first rule that matches the product's own title wins, mirroring the AI importer.
const RULES: { slug: string; pattern: RegExp }[] = [
  { slug: 'laptops_computers', pattern: /\b(laptop|notebook|mac ?book|desktop|chromebook|elitebook|thinkpad|probook|latitude|ideapad|zenbook|vivobook)\b/i },
  { slug: 'phones_accessories', pattern: /\b(smartphone|iphone|phone|power ?bank|charger|earbuds|airpods|phone case)\b/i },
  { slug: 'creator_tools', pattern: /\b(microphone|mic|webcam|camera|ring light|tripod|gimbal)\b/i },
  { slug: 'business_essentials', pattern: /\b(printer|barcode scanner|pos terminal|receipt printer)\b/i },
  { slug: 'business_software', pattern: /\b(software|licen[sc]e|antivirus|microsoft office|office 365)\b/i },
  { slug: 'digital_products', pattern: /\b(subscription|icloud|cloud storage|gift card|digital code)\b/i },
];

function firstMatch(text: string): { slug: string; word: string } | null {
  let best: { slug: string; word: string; at: number } | null = null;
  for (const rule of RULES) {
    const match = rule.pattern.exec(text);
    if (match && (!best || match.index < best.at)) best = { slug: rule.slug, word: match[0], at: match.index };
  }
  return best;
}

/** Products whose name clearly points at another active category. */
export function categoryMismatches(products: Pick<MarketplaceProduct, 'id' | 'name' | 'tagline' | 'category' | 'archived'>[], categories: CategoryRef[]): CategorySuggestion[] {
  const active = new Map(categories.filter(c => c.active !== false).map(c => [c.slug, c.label]));
  return products.flatMap(p => {
    if (p.archived) return [];
    // The name decides; the tagline is only consulted when the name names nothing.
    const hit = firstMatch(p.name) || firstMatch(p.tagline || '');
    if (!hit || hit.slug === p.category || !active.has(hit.slug)) return [];
    return [{ productId: p.id, productName: p.name, current: p.category, suggested: hit.slug, suggestedLabel: active.get(hit.slug)!, reason: `The ${firstMatch(p.name) ? 'name' : 'tagline'} says “${hit.word}”` }];
  });
}
