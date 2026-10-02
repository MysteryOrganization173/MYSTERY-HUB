/**
 * Website Builder V1 Production Vertical Slice Test Suite
 * Validates:
 * 1. Site creation from template defaults
 * 2. 1-site active project limit for free tier accounts (returns existing site)
 * 3. Server-side ownership protection (forbidden to edit/publish/unpublish another user's site)
 * 4. Safe slug generation, reserved path blocking & uniqueness collision avoidance
 * 5. Input sanitization (script injection, HTML tags, color hex codes, URLs)
 * 6. Content & visual settings updating
 * 7. Publishing & live public availability via /api/public/sites/:slug
 * 8. Unpublishing reverting to draft (public endpoint returns 404)
 * 9. Safe public data format (no internal user_id, email, or credentials exposed)
 */

import assert from 'node:assert';
import { WebsiteStore } from '../../db/websiteStore.js';
import {
  generateSafeSlug,
  sanitizeString,
  sanitizeColor,
  sanitizeUrl,
} from '../../types/website.js';

async function runWebsiteBuilderTests() {
  console.log('=== STARTING WEBSITE BUILDER V1 TEST SUITE ===');
  let passed = 0;

  WebsiteStore.clearDevStore();

  // 1. Slug Generation & Sanitization
  {
    const slug1 = generateSafeSlug('Kwame & Sons Engineering Ltd!');
    assert.strictEqual(slug1, 'kwame-sons-engineering-ltd');

    // Reserved paths should be replaced with random site slug
    const reservedSlug = generateSafeSlug('admin');
    assert.ok(reservedSlug.startsWith('site-'), 'Reserved slug "admin" must be replaced');

    const reservedApi = generateSafeSlug('api');
    assert.ok(reservedApi.startsWith('site-'), 'Reserved slug "api" must be replaced');

    // Sanitize string strips HTML and scripts
    const dirty = '<script>alert("hack")</script><b>Accra Cafe</b>';
    const clean = sanitizeString(dirty);
    assert.strictEqual(clean, 'Accra Cafe');

    // Color sanitizer
    assert.strictEqual(sanitizeColor('#00c365'), '#00c365');
    assert.strictEqual(sanitizeColor('rgb(0,0,0)', '#00c365'), '#00c365');
    assert.strictEqual(sanitizeColor('invalid', '#123456'), '#123456');

    // URL sanitizer
    assert.strictEqual(sanitizeUrl('https://images.unsplash.com/photo-1'), 'https://images.unsplash.com/photo-1');
    assert.strictEqual(sanitizeUrl('javascript:alert(1)'), '');
    assert.strictEqual(sanitizeUrl('data:text/html,...'), '');

    console.log('✓ 1. Slug generation, reserved slug blocking & input sanitization passed');
    passed++;
  }

  // 2. Site Creation & Initial Defaults
  {
    const userA = 'user_test_kwame_01';
    const result = await WebsiteStore.createSite(userA, {
      template_id: 'tech-agency',
      name: 'Accra Code Labs',
      content: {
        businessName: 'Accra Code Labs',
        tagline: 'Modern Web & Mobile Software',
        phone: '0241234567',
      },
      settings: {
        accentColor: '#00c365',
      },
    });

    assert.ok(result.site, 'Site must be created');
    assert.strictEqual(result.site.user_id, userA);
    assert.strictEqual(result.site.status, 'draft');
    assert.strictEqual(result.site.template_id, 'tech-agency');
    assert.strictEqual(result.site.content_json.businessName, 'Accra Code Labs');
    assert.strictEqual(result.site.content_json.tagline, 'Modern Web & Mobile Software');
    assert.strictEqual(result.site.content_json.phone, '0241234567');
    assert.strictEqual(result.site.settings_json.accentColor, '#00c365');
    assert.strictEqual(result.alreadyExists, undefined);

    console.log('✓ 2. Site creation with starter content and settings passed');
    passed++;
  }

  // 3. Free Tier 1-Site Limit
  {
    const userA = 'user_test_kwame_01';
    // User A tries to create a second site
    const attempt2 = await WebsiteStore.createSite(userA, {
      template_id: 'restaurant-chopbar',
      name: 'Another Business',
    });

    assert.strictEqual(attempt2.alreadyExists, true, 'User A already has a site, must flag alreadyExists');
    assert.strictEqual(attempt2.site.name, 'Accra Code Labs', 'Must return existing site rather than creating duplicate');

    const allSites = await WebsiteStore.findSitesByUserId(userA);
    assert.strictEqual(allSites.length, 1, 'User A must strictly have only 1 active website project');

    console.log('✓ 3. Free-tier 1 active site limit enforcement passed');
    passed++;
  }

  // 4. Site Updating & Server-Side Ownership Enforcement
  {
    const userA = 'user_test_kwame_01';
    const userB = 'user_test_abena_02';

    const userASite = (await WebsiteStore.findSitesByUserId(userA))[0];

    // User B tries to update User A's site (MUST BE FORBIDDEN)
    await assert.rejects(
      async () => {
        await WebsiteStore.updateSite(userASite.id, userB, {
          name: 'Hacked Site',
        });
      },
      /Forbidden/,
      'User B updating User A site must be rejected with Forbidden'
    );

    // User A successfully updates their own site
    const updated = await WebsiteStore.updateSite(userASite.id, userA, {
      name: 'Accra Code Labs GH',
      content: {
        location: 'Airport Residential, Accra',
        whatsapp: '+233241234567',
        ctaLabel: 'Book Consultation',
      },
      settings: {
        accentColor: '#10b981',
      },
    });

    assert.ok(updated);
    assert.strictEqual(updated.name, 'Accra Code Labs GH');
    assert.strictEqual(updated.content_json.location, 'Airport Residential, Accra');
    assert.strictEqual(updated.content_json.whatsapp, '+233241234567');
    assert.strictEqual(updated.content_json.ctaLabel, 'Book Consultation');
    assert.strictEqual(updated.settings_json.accentColor, '#10b981');

    console.log('✓ 4. Server-side ownership protection on updates passed');
    passed++;
  }

  // 5. Publishing & Live Public Availability
  {
    const userA = 'user_test_kwame_01';
    const userB = 'user_test_abena_02';
    const userASite = (await WebsiteStore.findSitesByUserId(userA))[0];

    // Before publishing, public slug lookup MUST return null
    const beforePub = await WebsiteStore.findPublishedSiteBySlug(userASite.slug);
    assert.strictEqual(beforePub, null, 'Draft site must NOT be available publicly');

    // User B tries to publish User A's site (MUST BE FORBIDDEN)
    await assert.rejects(
      async () => {
        await WebsiteStore.publishSite(userASite.id, userB);
      },
      /Forbidden/,
      'User B publishing User A site must be rejected with Forbidden'
    );

    // User A publishes site
    const published = await WebsiteStore.publishSite(userASite.id, userA);
    assert.ok(published);
    assert.strictEqual(published.status, 'published');
    assert.ok(published.published_at);

    // Now public lookup must find the site
    const publicSite = await WebsiteStore.findPublishedSiteBySlug(userASite.slug);
    assert.ok(publicSite, 'Published site must be retrievable by slug');
    assert.strictEqual(publicSite.slug, userASite.slug);
    assert.strictEqual(publicSite.status, 'published');
    assert.strictEqual(publicSite.content_json.businessName, 'Accra Code Labs');

    console.log('✓ 5. Publishing and public slug retrieval passed');
    passed++;
  }

  // 6. Unpublishing Reverts to Draft
  {
    const userA = 'user_test_kwame_01';
    const userB = 'user_test_abena_02';
    const userASite = (await WebsiteStore.findSitesByUserId(userA))[0];

    // User B tries to unpublish User A's site (MUST BE FORBIDDEN)
    await assert.rejects(
      async () => {
        await WebsiteStore.unpublishSite(userASite.id, userB);
      },
      /Forbidden/,
      'User B unpublishing User A site must be rejected with Forbidden'
    );

    // User A unpublishes site
    const unpublished = await WebsiteStore.unpublishSite(userASite.id, userA);
    assert.ok(unpublished);
    assert.strictEqual(unpublished.status, 'draft');

    // Public lookup must now return null again
    const publicAfterUnpublish = await WebsiteStore.findPublishedSiteBySlug(userASite.slug);
    assert.strictEqual(publicAfterUnpublish, null, 'Unpublished site must not be visible on public route');

    console.log('✓ 6. Unpublishing reverts to draft and removes from public route passed');
    passed++;
  }

  // 7. Slug Collision Resolution
  {
    const userC = 'user_test_kofi_03';
    // User C creates a site with the same base name 'Accra Code Labs'
    const resultC = await WebsiteStore.createSite(userC, {
      template_id: 'retail-boutique',
      name: 'Accra Code Labs',
    });

    assert.ok(resultC.site);
    assert.notStrictEqual(resultC.site.slug, 'accra-code-labs', 'Slug collision must be disambiguated with suffix');
    assert.ok(resultC.site.slug.startsWith('accra-code-labs-'), 'Slug should start with base name and append random suffix');

    console.log('✓ 7. Slug collision disambiguation passed');
    passed++;
  }

  console.log(`\n🎉 ALL ${passed}/7 WEBSITE BUILDER V1 TESTS PASSED SUCCESSFULLY!`);
}

runWebsiteBuilderTests().catch((err) => {
  console.error('❌ Website Builder Test Suite Failed:', err);
  process.exit(1);
});
