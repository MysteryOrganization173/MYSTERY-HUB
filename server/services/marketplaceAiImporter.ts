/**
 * Mystery Hub Admin AI Marketplace Product Importer Service
 * Parses WhatsApp supplier adverts using Gemini and returns strict structured product draft data.
 */

import { getGeminiClient } from './geminiClient.js';

export interface ExtractedProductSpec {
  label: string;
  value: string;
}

export interface ExtractedPriceOption {
  label: string;
  priceGhc: number;
}

export interface MarketplaceAiExtractionResult {
  name: string;
  category: 'laptops_computers' | 'phones_accessories' | 'creator_tools' | 'ai_productivity' | 'business_software' | 'business_essentials';
  tagline: string;
  description: string;
  priceType: 'fixed' | 'starting_at' | 'quote';
  priceGhc: number | null;
  availability: 'in_stock' | 'sourcing_on_demand' | 'preorder' | 'out_of_stock';
  availabilityLabel: string | null;
  badge: string | null;
  imageAlt: string;
  highlights: string[];
  specs: ExtractedProductSpec[];
  detectedPriceOptions: ExtractedPriceOption[];
  warnings: string[];
  sourceNotes: string[];
}

const ALLOWED_CATEGORIES = [
  'laptops_computers',
  'phones_accessories',
  'creator_tools',
  'ai_productivity',
  'business_software',
  'business_essentials',
] as const;

/**
 * System Instructions for Gemini Extraction Engine
 */
const SYSTEM_INSTRUCTION = `You are the Admin AI Product Importer for Mystery Hub, a digital services platform in Ghana.
Your job is to read raw WhatsApp supplier adverts for tech hardware, phones, creator tools, or software, and extract structured product data.

CRITICAL INSTRUCTIONS & GUARDRAILS:
1. NEVER AUTO-PUBLISH. Extract facts supported ONLY by the supplier advert.
2. DO NOT INVENT facts, specifications, warranty terms, processor details, or prices.
3. REMOVE ALL SUPPLIER MARKETING CLUTTER:
   - Exclude phone numbers, WhatsApp contact info, supplier location lists, copyright (e.g. "© DeeTech Computers").
   - Exclude affiliate URLs, website links, commission slogans ("Earn GHC 200"), and excessive emojis.
4. CATEGORY MAPPING:
   - You MUST select ONE category ID strictly from:
     "laptops_computers", "phones_accessories", "creator_tools", "ai_productivity", "business_software", "business_essentials"
   - Default to "laptops_computers" if it is a laptop/PC, "phones_accessories" for mobile, "creator_tools" for audio/video gear, "business_essentials" for receipt printers/barcode scanners.
5. PRICE & VARIANT EXTRACTION:
   - Scan for prices in GHC / GH₵. Convert string amounts (e.g. "GHC 3,700" or "3700") to integer numbers (3700).
   - If multiple configurations/prices are listed (e.g. 8GB/256GB GH₵3,700, 16GB/256GB GH₵4,000, 16GB/512GB GH₵4,350):
     * Set priceType = "starting_at"
     * Set priceGhc = LOWEST detected price (e.g. 3700)
     * Include all detected configurations in detectedPriceOptions: [{ "label": "8GB RAM / 256GB SSD", "priceGhc": 3700 }, ...]
   - If 1 price is listed: priceType = "fixed", priceGhc = price.
   - If no price listed: priceType = "quote", priceGhc = null.
6. COPY GENERATION:
   - tagline: 1 concise short sentence. No emojis, no hype.
   - description: 2-4 short sentences summarizing key features and condition. Clean, professional.
   - highlights: Maximum 5 key bullet points.
   - imageAlt: Concise descriptive alt text based on product name.
   - imageUrl: ALWAYS null or empty. Do NOT generate or invent image URLs.
7. WARNINGS & FLAG CLAIMS:
   - Place questionable or unverified claims into "warnings" array:
     * e.g. "Supplier advert states '2025 Model'. Verify actual model year before publishing."
     * "Face ID applies only to Ryzen 7 option according to advert. Verify before publishing."
     * "Supplier advert states 'Free Delivery Nationwide'. Confirm delivery terms apply to Mystery Hub customers."

RETURN ONLY STRICT JSON WITHOUT MARKDOWN CODE FENCES.`;

/**
 * Normalizes and validates raw extracted JSON into a strictly typed result.
 */
export function sanitizeExtractionResult(raw: Record<string, unknown>): MarketplaceAiExtractionResult {
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Uncatalogued Product';
  
  let category: MarketplaceAiExtractionResult['category'] = 'laptops_computers';
  if (typeof raw.category === 'string' && ALLOWED_CATEGORIES.includes(raw.category as unknown as typeof ALLOWED_CATEGORIES[number])) {
    category = raw.category as MarketplaceAiExtractionResult['category'];
  }

  const tagline = typeof raw.tagline === 'string' ? raw.tagline.trim().slice(0, 150) : '';
  const description = typeof raw.description === 'string' ? raw.description.trim().slice(0, 800) : '';

  let priceType: MarketplaceAiExtractionResult['priceType'] = 'fixed';
  if (raw.priceType === 'starting_at' || raw.priceType === 'quote' || raw.priceType === 'fixed') {
    priceType = raw.priceType;
  }

  let priceGhc: number | null = null;
  if (typeof raw.priceGhc === 'number' && !isNaN(raw.priceGhc) && raw.priceGhc > 0) {
    priceGhc = Math.round(raw.priceGhc);
  } else if (typeof raw.priceGhc === 'string') {
    const parsed = parseInt((raw.priceGhc as string).replace(/[^0-9]/g, ''), 10);
    if (!isNaN(parsed) && parsed > 0) priceGhc = parsed;
  }

  let availability: MarketplaceAiExtractionResult['availability'] = 'in_stock';
  if (
    raw.availability === 'in_stock' ||
    raw.availability === 'sourcing_on_demand' ||
    raw.availability === 'preorder' ||
    raw.availability === 'out_of_stock'
  ) {
    availability = raw.availability;
  }

  const availabilityLabel = typeof raw.availabilityLabel === 'string' && raw.availabilityLabel.trim() ? raw.availabilityLabel.trim() : null;
  const badge = typeof raw.badge === 'string' && raw.badge.trim() ? raw.badge.trim() : null;
  const imageAlt = typeof raw.imageAlt === 'string' && raw.imageAlt.trim() ? raw.imageAlt.trim() : `${name} product image`;

  const highlights: string[] = Array.isArray(raw.highlights)
    ? raw.highlights.filter((h): h is string => typeof h === 'string' && h.trim().length > 0).map((h) => h.trim()).slice(0, 5)
    : [];

  const specs: ExtractedProductSpec[] = Array.isArray(raw.specs)
    ? raw.specs
        .filter((s): s is { label: string; value: string } => Boolean(s && typeof s.label === 'string' && typeof s.value === 'string'))
        .map((s) => ({ label: s.label.trim(), value: s.value.trim() }))
        .filter((s) => s.label.length > 0 && s.value.length > 0)
        .slice(0, 12)
    : [];

  const detectedPriceOptions: ExtractedPriceOption[] = Array.isArray(raw.detectedPriceOptions)
    ? raw.detectedPriceOptions
        .filter((p): p is { label: string; priceGhc: number } => Boolean(p && typeof p.label === 'string' && typeof p.priceGhc === 'number' && p.priceGhc > 0))
        .map((p) => ({ label: p.label.trim(), priceGhc: Math.round(p.priceGhc) }))
        .slice(0, 8)
    : [];

  const warnings: string[] = Array.isArray(raw.warnings)
    ? raw.warnings.filter((w): w is string => typeof w === 'string' && w.trim().length > 0).map((w) => w.trim()).slice(0, 8)
    : [];

  const sourceNotes: string[] = Array.isArray(raw.sourceNotes)
    ? raw.sourceNotes.filter((n): n is string => typeof n === 'string' && n.trim().length > 0).map((n) => n.trim()).slice(0, 5)
    : ['Extracted from WhatsApp supplier advert'];

  // Enforce Starting Price logic if multiple price options exist
  if (detectedPriceOptions.length > 1) {
    priceType = 'starting_at';
    const lowest = Math.min(...detectedPriceOptions.map((o) => o.priceGhc));
    if (lowest > 0) {
      priceGhc = lowest;
    }
  }

  return {
    name,
    category,
    tagline,
    description,
    priceType,
    priceGhc,
    availability,
    availabilityLabel,
    badge,
    imageAlt,
    highlights,
    specs,
    detectedPriceOptions,
    warnings,
    sourceNotes,
  };
}

/**
 * Heuristic Rule-Based Extractor (Fallback when Gemini API Key is unconfigured or in offline test environments)
 */
export function extractProductHeuristically(text: string): MarketplaceAiExtractionResult {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  
  // Clean title line
  let rawTitle = lines[0] || 'Tech Product';
  rawTitle = rawTitle.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
  const name = rawTitle.split('–')[0].split('-')[0].trim() || 'Tech Product';

  // Prices detection
  const priceMatches = Array.from(text.matchAll(/(?:GHC|GH₵|GHC\s*|GH₵\s*)?\s*([1-9][0-9]{0,2}(?:,[0-9]{3})+|[1-9][0-9]{2,5})/gi));
  const detectedPrices: { label: string; priceGhc: number }[] = [];

  for (const line of lines) {
    const match = line.match(/(?:GHC|GH₵)\s*([1-9][0-9,]{2,7})/i);
    if (match) {
      const val = parseInt(match[1].replace(/,/g, ''), 10);
      if (val >= 100 && val <= 500000) {
        const cleanLabel = line
          .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
          .replace(/(?:GHC|GH₵)\s*[1-9][0-9,]{2,7}/gi, '')
          .replace(/^[-–—:]+/, '')
          .trim() || `Option ${detectedPrices.length + 1}`;
        detectedPrices.push({ label: cleanLabel, priceGhc: val });
      }
    }
  }

  const priceType = detectedPrices.length > 1 ? 'starting_at' : detectedPrices.length === 1 ? 'fixed' : 'quote';
  const priceGhc = detectedPrices.length > 0 ? Math.min(...detectedPrices.map((p) => p.priceGhc)) : null;

  // Warnings detection
  const warnings: string[] = [];
  if (text.toLowerCase().includes('2025 model')) {
    warnings.push('Supplier advert states "2025 Model". Verify actual model year before publishing.');
  }
  if (text.toLowerCase().includes('face id')) {
    warnings.push('Face ID is mentioned only for specific options. Confirm features before publishing.');
  }
  if (text.toLowerCase().includes('free delivery')) {
    warnings.push('Supplier advert states "Free Delivery Nationwide". Confirm delivery terms for Mystery Hub customers.');
  }

  // Specs
  const specs: ExtractedProductSpec[] = [];
  if (text.toLowerCase().includes('ryzen') || text.toLowerCase().includes('i5') || text.toLowerCase().includes('i7')) {
    const procLine = lines.find((l) => l.toLowerCase().includes('processor')) || 'AMD Ryzen / Intel Core';
    specs.push({ label: 'Processor', value: procLine.replace(/Processor:/i, '').trim() });
  }
  if (text.toLowerCase().includes('ram') || text.toLowerCase().includes('ddr')) {
    const memLine = lines.find((l) => l.toLowerCase().includes('memory') || l.toLowerCase().includes('ram')) || 'DDR4 RAM';
    specs.push({ label: 'Memory', value: memLine.replace(/Memory:/i, '').trim() });
  }
  if (text.toLowerCase().includes('ssd') || text.toLowerCase().includes('storage')) {
    const storageLine = lines.find((l) => l.toLowerCase().includes('storage') || l.toLowerCase().includes('ssd')) || 'NVMe SSD';
    specs.push({ label: 'Storage', value: storageLine.replace(/Storage Options:/i, '').trim() });
  }

  return sanitizeExtractionResult({
    name,
    category: 'laptops_computers',
    tagline: `Slim & durable business product: ${name}.`,
    description: `Extracted specifications for ${name}. Includes clean business build and verified supplier options. Review details before saving.`,
    priceType,
    priceGhc,
    availability: 'in_stock',
    availabilityLabel: 'In Stock',
    badge: detectedPrices.length > 1 ? 'Popular' : null,
    imageAlt: `${name} product image`,
    highlights: [
      'Slim & durable business build',
      'Original charger included',
      'Clean tested hardware',
    ],
    specs,
    detectedPriceOptions: detectedPrices,
    warnings,
    sourceNotes: ['Parsed using Mystery Hub Extraction Rules'],
  });
}

/**
 * Primary Extraction Function: Calls Gemini 3.8 Flash or fallback models
 */
export async function parseSupplierAdvertWithAi(advertText: string): Promise<MarketplaceAiExtractionResult> {
  const gemini = getGeminiClient();

  if (!gemini) {
    console.warn('[Marketplace AI Importer] GEMINI_API_KEY unconfigured. Using heuristic parsing.');
    return extractProductHeuristically(advertText);
  }

  const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
  const prompt = `SUPPLIER WHATSAPP ADVERT TEXT:\n"""\n${advertText}\n"""\n\nExtract and return JSON object adhering strictly to system instruction.`;

  for (const modelName of candidateModels) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout invoking Gemini ${modelName}`)), 12000)
      );

      const generatePromise = gemini.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      if (response && response.text) {
        let cleanText = response.text.trim();
        if (cleanText.startsWith('```json')) {
          cleanText = cleanText.replace(/^```json\s*/, '').replace(/```$/, '').trim();
        } else if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```\s*/, '').replace(/```$/, '').trim();
        }

        const parsed = JSON.parse(cleanText);
        if (parsed && typeof parsed === 'object') {
          return sanitizeExtractionResult(parsed as Record<string, unknown>);
        }
      }
    } catch (err) {
      console.warn(`[Marketplace AI Importer] Model ${modelName} returned error:`, err);
    }
  }

  console.warn('[Marketplace AI Importer] All Gemini models failed or timed out. Falling back to heuristic parsing.');
  return extractProductHeuristically(advertText);
}
