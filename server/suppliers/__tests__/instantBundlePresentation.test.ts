/**
 * Instant Bundle Labeling and Presentation Verification Suite
 * Validates requirements for customer-safe product labeling:
 * - Clear distinction for Midnight, Video, Social Media, IDD, and Standard Data
 * - Explicit 🌙 Midnight-only data safety warning
 * - Accurate IDD minutes formatting (never MB/GB)
 * - Video and Social Media categorization
 * - Dynamic category extraction
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getInstantBundlePresentation,
  InstantBundleSource,
} from '../../../src/utils/instantBundleUtils.js';

describe('Instant Bundle Labeling & Safety Presentation', () => {
  it('1. Correctly identifies and labels Midnight Bundles with safety warning', () => {
    const pkg: InstantBundleSource = {
      name: 'MTN 8.48 GB Midnight Special',
      dataAmount: '8.48 GB',
      category: 'Midnight Bundles',
    };

    const info = getInstantBundlePresentation(pkg);
    assert.equal(info.categoryKey, 'midnight');
    assert.equal(info.categoryLabel, 'Midnight Bundle');
    assert.equal(info.filterLabel, 'Midnight');
    assert.equal(info.formattedAmount, '8.48 GB');
    assert.equal(info.restrictionNote, 'Midnight-only data');
    assert.equal(info.badgeEmoji, '🌙');
    assert.equal(info.isMidnight, true);
  });

  it('2. Correctly identifies and labels Flexi Midnight Bundles', () => {
    const pkg: InstantBundleSource = {
      name: 'Midnight Flexi Package',
      category: 'Midnight Bundles',
      isFlexi: true,
    };

    const info = getInstantBundlePresentation(pkg);
    assert.equal(info.categoryKey, 'midnight');
    assert.equal(info.categoryLabel, 'Midnight Flexi Bundle');
    assert.equal(info.restrictionNote, 'Midnight-only data');
    assert.equal(info.isFlexi, true);
  });

  it('3. Correctly identifies Video Bundles and attaches supported usage label', () => {
    const pkg: InstantBundleSource = {
      name: 'MTN 158.05 MB Video Bundle',
      dataAmount: '158.05 MB',
      category: 'Video Bundles',
    };

    const info = getInstantBundlePresentation(pkg);
    assert.equal(info.categoryKey, 'video');
    assert.equal(info.categoryLabel, 'Video Bundle');
    assert.equal(info.filterLabel, 'Video');
    assert.equal(info.formattedAmount, '158.05 MB');
    assert.equal(info.restrictionNote, 'For supported video usage');
    assert.equal(info.isVideo, true);
  });

  it('4. Correctly identifies Social Media Bundles without fabricating apps', () => {
    const pkg: InstantBundleSource = {
      name: 'MTN 82.57 MB Social Media Bundle',
      dataAmount: '82.57 MB',
      category: 'Social Media Bundles',
    };

    const info = getInstantBundlePresentation(pkg);
    assert.equal(info.categoryKey, 'social');
    assert.equal(info.categoryLabel, 'Social Media Bundle');
    assert.equal(info.filterLabel, 'Social Media');
    assert.equal(info.formattedAmount, '82.57 MB');
    assert.equal(info.isSocial, true);
  });

  it('5. Correctly formats IDD International Calls as minutes (not data GB/MB)', () => {
    const pkg: InstantBundleSource = {
      name: 'MTN IDD International Calls 30.4 Mins',
      dataAmount: '30.4 Mins',
      category: 'IDD Bundles',
    };

    const info = getInstantBundlePresentation(pkg);
    assert.equal(info.categoryKey, 'idd');
    assert.equal(info.categoryLabel, 'International Calls');
    assert.equal(info.filterLabel, 'International Calls');
    assert.equal(info.formattedAmount, '30.4 mins');
    assert.equal(info.restrictionNote, 'International voice calls');
    assert.equal(info.isIdd, true);
  });

  it('6. Correctly identifies and labels Standard Data Bundles', () => {
    const pkg: InstantBundleSource = {
      name: 'MTN 406.89 MB Data Bundle',
      dataAmount: '406.89 MB',
      category: 'Data Bundles',
    };

    const info = getInstantBundlePresentation(pkg);
    assert.equal(info.categoryKey, 'data');
    assert.equal(info.categoryLabel, 'Standard Data');
    assert.equal(info.filterLabel, 'Standard Data');
    assert.equal(info.formattedAmount, '406.89 MB');
    assert.equal(info.isMidnight, false);
    assert.equal(info.isVideo, false);
    assert.equal(info.isIdd, false);
  });
});
