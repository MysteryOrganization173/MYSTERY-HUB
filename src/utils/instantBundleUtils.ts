/**
 * Instant Bundle Presentation & Labeling Utilities
 * 
 * Provides accurate categorization, customer-friendly labeling,
 * and safety restriction warnings for Success Biz Hub Instant Bundles:
 * - Midnight Bundles (with obvious 🌙 Midnight-only data warning)
 * - Video Bundles (with 'For supported video usage' label)
 * - Social Media Bundles
 * - IDD / International Calls (with minutes presentation instead of MB/GB)
 * - Standard Data Bundles
 */

export type InstantBundleCategoryType = 'midnight' | 'video' | 'social' | 'idd' | 'data';

export interface InstantBundlePresentation {
  categoryKey: InstantBundleCategoryType;
  categoryLabel: string;
  filterLabel: string;
  formattedAmount: string;
  restrictionNote?: string;
  isMidnight: boolean;
  isVideo: boolean;
  isSocial: boolean;
  isIdd: boolean;
  isFlexi: boolean;
  badgeEmoji?: string;
}

export interface InstantBundleSource {
  category?: string;
  name?: string;
  dataAmount?: string;
  validity?: string;
  isFlexi?: boolean;
}

/**
 * Derives authoritative customer-facing presentation for any Instant Bundle item
 */
export function getInstantBundlePresentation(bundle: InstantBundleSource): InstantBundlePresentation {
  const cat = (bundle.category || '').toLowerCase().trim();
  const rawName = (bundle.name || '').toLowerCase().trim();
  const rawData = (bundle.dataAmount || '').toLowerCase().trim();
  const isFlexi = Boolean(bundle.isFlexi);

  let categoryKey: InstantBundleCategoryType = 'data';
  let categoryLabel = isFlexi ? 'Standard Data Flexi Bundle' : 'Standard Data';
  let filterLabel = 'Standard Data';
  let restrictionNote: string | undefined = undefined;
  let badgeEmoji: string | undefined = undefined;

  // 1. Midnight Bundle (Safety check first)
  if (cat.includes('midnight') || cat.includes('night') || rawName.includes('midnight') || rawName.includes('night')) {
    categoryKey = 'midnight';
    categoryLabel = isFlexi ? 'Midnight Flexi Bundle' : 'Midnight Bundle';
    filterLabel = 'Midnight';
    restrictionNote = 'Midnight-only data';
    badgeEmoji = '🌙';
  }
  // 2. Video Bundle
  else if (cat.includes('video') || rawName.includes('video')) {
    categoryKey = 'video';
    categoryLabel = isFlexi ? 'Video Flexi Bundle' : 'Video Bundle';
    filterLabel = 'Video';
    restrictionNote = 'For supported video usage';
    badgeEmoji = '🎬';
  }
  // 3. Social Media Bundle
  else if (cat.includes('social') || rawName.includes('social')) {
    categoryKey = 'social';
    categoryLabel = isFlexi ? 'Social Media Flexi Bundle' : 'Social Media Bundle';
    filterLabel = 'Social Media';
    restrictionNote = undefined;
    badgeEmoji = '💬';
  }
  // 4. IDD / International Calls
  else if (
    cat.includes('idd') ||
    cat.includes('international') ||
    rawName.includes('idd') ||
    rawName.includes('international') ||
    rawData.includes('min')
  ) {
    categoryKey = 'idd';
    categoryLabel = isFlexi ? 'International Calls Flexi' : 'International Calls';
    filterLabel = 'International Calls';
    restrictionNote = 'International voice calls';
    badgeEmoji = '📞';
  }
  // 5. Standard Data
  else {
    categoryKey = 'data';
    categoryLabel = isFlexi ? 'Standard Data Flexi' : 'Standard Data';
    filterLabel = 'Standard Data';
    restrictionNote = undefined;
    badgeEmoji = undefined;
  }

  // Format amount or minutes cleanly
  let formattedAmount = bundle.dataAmount || bundle.name || 'Instant Bundle';

  if (categoryKey === 'idd') {
    // Normalise IDD minutes e.g. "30.4 Mins" -> "30.4 mins"
    const minMatch = formattedAmount.match(/([\d.]+)\s*(?:mins?|minutes?)/i);
    if (minMatch) {
      formattedAmount = `${minMatch[1]} mins`;
    } else {
      const numMatch = formattedAmount.match(/([\d.]+)/);
      if (numMatch) {
        formattedAmount = `${numMatch[1]} mins`;
      }
    }
  }

  return {
    categoryKey,
    categoryLabel,
    filterLabel,
    formattedAmount,
    restrictionNote,
    isMidnight: categoryKey === 'midnight',
    isVideo: categoryKey === 'video',
    isSocial: categoryKey === 'social',
    isIdd: categoryKey === 'idd',
    isFlexi,
    badgeEmoji,
  };
}
