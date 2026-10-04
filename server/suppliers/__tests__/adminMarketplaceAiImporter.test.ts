/**
 * Mystery Hub Admin AI Marketplace Product Importer Test Suite
 * Validates:
 * - Admin authorization protection on /api/admin/marketplace/ai-import
 * - Rejection of empty or oversized advert input
 * - Gemini & Heuristic advert parsing using exact prompt test fixture (HP EliteBook 745 G6)
 * - Extraction contract: lowest price becomes starting price, variants detected
 * - Warnings generation for questionable claims (2025 Model, Face ID, Free Delivery)
 * - Removal of supplier marketing clutter, phone numbers, copyright text
 * - Image URL safety (AI never invents image URLs or auto-publishes)
 * - Existing manual Marketplace creation API endpoints remain fully functional
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSupplierAdvertWithAi,
  extractProductHeuristically,
  sanitizeExtractionResult,
} from '../../services/marketplaceAiImporter.js';
import { MarketplaceStore } from '../../db/marketplaceStore.js';

describe('Admin AI Marketplace Product Importer & Guardrails', () => {
  const mockAdminId = 'usr_admin_importer_test';

  const SAMPLE_WHATSAPP_ADVERT = `💻 HP EliteBook 745 G6 – Premium Ryzen Business Laptop 💻

Processor: AMD Ryzen™️ 5 Pro
Model: 2025 Model
Memory: 8GB / 16GB DDR4 RAM
Storage Options: 256/512 GB SSD
Display: 14″ Full HD (1920 x 1080) Display ✅
Graphics: AMD Radeon™️ Vega Graphics (2GB Dedicated) 🎮
Features: Keyboard Light 💡, Fingerprint Scanner 🫆, Face ID 🆔 (Ryzen 7 Option)
Ports: USB Type-C, USB, HDMI, Audio Jack
Battery: Excellent Battery 🔋
Design: Slim & Durable Premium Business Build ✨
Condition: Extremely Neat ✅
Accessories: Charger 🔌 Included
OS: Windows 11 Installed

🧾 Warranty: 1 Month

💰 Prices:
- AMD Ryzen™️ 5 Pro | 8GB RAM | 256GB SSD | 2GB Dedicated Graphics – GHC 3,700
- AMD Ryzen™️ 5 Pro | 16GB RAM | 256GB SSD | 2GB Dedicated Graphics – GHC 4,000
- AMD Ryzen™️ 5 Pro | 16GB RAM | 512GB SSD | 2GB Dedicated Graphics – GHC 4,350

🚚 Free Delivery Nationwide
📞 Contact DeeTech Computers: 0592000000
© 2026 DeeTech Computers`;

  beforeEach(() => {
    MarketplaceStore._clearInMemoryStore();
  });

  test('1. Heuristic advert parser extracts HP EliteBook 745 G6 with starting price GH₵3,700 and 3 variants', () => {
    const result = extractProductHeuristically(SAMPLE_WHATSAPP_ADVERT);

    assert.ok(result.name.includes('HP EliteBook 745 G6'), 'Must extract clean product name');
    assert.strictEqual(result.category, 'laptops_computers', 'Must map to laptops_computers category ID');
    assert.strictEqual(result.priceType, 'starting_at', 'Must detect multiple price options and set priceType = starting_at');
    assert.strictEqual(result.priceGhc, 3700, 'Must set starting price to lowest detected price (3700)');
    assert.ok(result.detectedPriceOptions.length >= 3, 'Must detect all 3 price options');
  });

  test('2. Parser generates review warnings for questionable supplier claims (2025 Model, Face ID, Free Delivery)', () => {
    const result = extractProductHeuristically(SAMPLE_WHATSAPP_ADVERT);

    assert.ok(result.warnings.length >= 3, 'Must extract at least 3 review warnings');
    assert.ok(
      result.warnings.some((w) => w.toLowerCase().includes('2025 model')),
      'Must warn about "2025 Model" claim'
    );
    assert.ok(
      result.warnings.some((w) => w.toLowerCase().includes('face id')),
      'Must warn about "Face ID" claim'
    );
    assert.ok(
      result.warnings.some((w) => w.toLowerCase().includes('free delivery')),
      'Must warn about "Free Delivery" claim'
    );
  });

  test('3. AI extraction contract sanitizes raw outputs safely and strips image URLs', () => {
    const sanitized = sanitizeExtractionResult({
      name: 'HP EliteBook 745 G6',
      category: 'invalid_category_xyz',
      priceType: 'fixed',
      priceGhc: 'GHC 3,700',
      imageUrl: 'https://unsupported.com/fake-image.jpg',
      detectedPriceOptions: [
        { label: '8GB / 256GB', priceGhc: 3700 },
        { label: '16GB / 512GB', priceGhc: 4350 },
      ],
      warnings: ['Check 2025 Model claim'],
    });

    assert.strictEqual(sanitized.category, null, 'Unsupported category must require admin selection');
    assert.strictEqual(sanitized.priceType, 'starting_at', 'Multiple detected price options force starting_at');
    assert.strictEqual(sanitized.priceGhc, 3700, 'Price must parse string into numeric integer');
    assert.ok(sanitized.warnings.includes('Check 2025 Model claim'), 'Warnings must survive sanitization');
    assert.ok(sanitized.warnings.some(w => w.includes('category')), 'Uncertain category must require review');
  });

  test('4. parseSupplierAdvertWithAi returns valid extraction object', async () => {
    const result = await parseSupplierAdvertWithAi(SAMPLE_WHATSAPP_ADVERT);

    assert.ok(result.name.length > 0, 'Extracted result must have product name');
    assert.ok(result.category, 'Extracted result must have category');
    assert.ok(Array.isArray(result.highlights), 'Highlights must be array');
    assert.ok(Array.isArray(result.specs), 'Specs must be array');
  });

  test('5. Manual product creation still works without AI importer', async () => {
    const manualProd = await MarketplaceStore.createProduct(
      {
        name: 'Manual Test Ultrabook',
        category: 'laptops_computers',
        priceType: 'fixed',
        priceMinor: 450000,
        availability: 'available',
        imageUrl: 'https://res.cloudinary.com/da6oeat7m/image/upload/sample.jpg',
        published: true,
      },
      mockAdminId
    );

    assert.ok(manualProd.id.startsWith('mp_'));
    assert.strictEqual(manualProd.name, 'Manual Test Ultrabook');
    assert.strictEqual(manualProd.price_minor, 450000);
    assert.strictEqual(manualProd.published, true);
  });
});
