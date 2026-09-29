import { DataBundle, NetworkId, NetworkInfo } from '../types';

export const GHANA_NETWORKS: Record<NetworkId, NetworkInfo> = {
  mtn: {
    id: 'mtn',
    name: 'MTN Ghana',
    tagline: 'Everywhere You Go',
    brandColor: '#FFCC00',
    badgeBg: '#FFF9E6',
    textColor: '#8A6800',
    momoName: 'MTN MoMo',
    prefixes: ['024', '054', '055', '059', '025', '053'],
  },
  telecel: {
    id: 'telecel',
    name: 'Telecel Ghana',
    tagline: 'Connecting What Matters',
    brandColor: '#E60000',
    badgeBg: '#FFF0F0',
    textColor: '#B30000',
    momoName: 'Telecel Cash',
    prefixes: ['020', '050'],
  },
  airteltigo: {
    id: 'airteltigo',
    name: 'AirtelTigo (AT)',
    tagline: 'Life Is Simple',
    brandColor: '#004B93',
    badgeBg: '#EEF6FC',
    textColor: '#003366',
    momoName: 'AT Money',
    prefixes: ['027', '057', '026', '056'],
  },
};

/**
 * Centralized Data Bundle Catalog
 * Easily adjust prices, validity, or bundle sizes in this single file.
 */
export const DATA_BUNDLES: DataBundle[] = [
  // --- MTN GHANA ---
  {
    id: 'mtn-1gb-7d',
    network: 'mtn',
    dataAmount: '1GB',
    dataBytesValue: 1024,
    validity: '7 Days',
    validityCategory: 'Weekly',
    priceGhc: 4.99,
    isPopular: true,
    description: 'Fast 4G/5G data for regular social & browsing',
  },
  {
    id: 'mtn-2.5gb-7d',
    network: 'mtn',
    dataAmount: '2.5GB',
    dataBytesValue: 2560,
    validity: '7 Days',
    validityCategory: 'Weekly',
    priceGhc: 12.99,
    isPopular: true,
    description: 'Great for weekly streaming, TikTok, and video calls',
  },
  {
    id: 'mtn-5gb-30d',
    network: 'mtn',
    dataAmount: '5GB',
    dataBytesValue: 5120,
    validity: '30 Days',
    validityCategory: 'Monthly',
    priceGhc: 24.99,
    isPopular: true,
    isBestValue: true,
    description: 'Our most chosen monthly student and work bundle',
  },
  {
    id: 'mtn-10gb-30d',
    network: 'mtn',
    dataAmount: '10GB',
    dataBytesValue: 10240,
    validity: '30 Days',
    validityCategory: 'Monthly',
    priceGhc: 44.99,
    isPopular: true,
    isBestValue: true,
    description: 'Heavy browsing, YouTube, gaming, and remote work',
  },
  {
    id: 'mtn-500mb-1d',
    network: 'mtn',
    dataAmount: '500MB',
    dataBytesValue: 500,
    validity: '1 Day',
    validityCategory: 'Daily',
    priceGhc: 2.99,
    description: 'Quick daily boost for messaging and urgent lookups',
  },
  {
    id: 'mtn-15gb-30d',
    network: 'mtn',
    dataAmount: '15GB',
    dataBytesValue: 15360,
    validity: '30 Days',
    validityCategory: 'Monthly',
    priceGhc: 64.99,
    description: 'High capacity monthly allocation for power users',
  },
  {
    id: 'mtn-25gb-noexp',
    network: 'mtn',
    dataAmount: '25GB',
    dataBytesValue: 25600,
    validity: 'No Expiry',
    validityCategory: 'Non-Expiry',
    priceGhc: 99.99,
    isBestValue: true,
    description: 'Non-expiring Jumbo bundle — use at your own pace',
  },

  // --- TELECEL GHANA ---
  {
    id: 'tel-1gb-7d',
    network: 'telecel',
    dataAmount: '1GB',
    dataBytesValue: 1024,
    validity: '7 Days',
    validityCategory: 'Weekly',
    priceGhc: 4.80,
    isPopular: true,
    description: 'Telecel Red superfast weekly browsing',
  },
  {
    id: 'tel-2.5gb-7d',
    network: 'telecel',
    dataAmount: '2.5GB',
    dataBytesValue: 2560,
    validity: '7 Days',
    validityCategory: 'Weekly',
    priceGhc: 12.50,
    isPopular: true,
    description: 'Reliable weekly connectivity with Telecel speed',
  },
  {
    id: 'tel-5gb-30d',
    network: 'telecel',
    dataAmount: '5GB',
    dataBytesValue: 5120,
    validity: '30 Days',
    validityCategory: 'Monthly',
    priceGhc: 23.99,
    isPopular: true,
    isBestValue: true,
    description: 'Full 30-day package for everyday social & work',
  },
  {
    id: 'tel-10gb-30d',
    network: 'telecel',
    dataAmount: '10GB',
    dataBytesValue: 10240,
    validity: '30 Days',
    validityCategory: 'Monthly',
    priceGhc: 43.50,
    isPopular: true,
    description: 'Stream seamlessly across all your devices',
  },
  {
    id: 'tel-20gb-30d',
    network: 'telecel',
    dataAmount: '20GB',
    dataBytesValue: 20480,
    validity: '30 Days',
    validityCategory: 'Monthly',
    priceGhc: 79.99,
    isBestValue: true,
    description: 'Pro monthly bundle for home office and creators',
  },

  // --- AIRTELTIGO (AT) ---
  {
    id: 'at-1gb-7d',
    network: 'airteltigo',
    dataAmount: '1GB',
    dataBytesValue: 1024,
    validity: '7 Days',
    validityCategory: 'Weekly',
    priceGhc: 4.50,
    isPopular: true,
    description: 'Affordable AT Big Time data bundle',
  },
  {
    id: 'at-2.5gb-7d',
    network: 'airteltigo',
    dataAmount: '2.5GB',
    dataBytesValue: 2560,
    validity: '7 Days',
    validityCategory: 'Weekly',
    priceGhc: 11.99,
    isPopular: true,
    description: 'Best value 7-day bundle on the AT network',
  },
  {
    id: 'at-5gb-30d',
    network: 'airteltigo',
    dataAmount: '5GB',
    dataBytesValue: 5120,
    validity: '30 Days',
    validityCategory: 'Monthly',
    priceGhc: 22.50,
    isPopular: true,
    isBestValue: true,
    description: 'Monthly worry-free browsing with AT simple pricing',
  },
  {
    id: 'at-10gb-30d',
    network: 'airteltigo',
    dataAmount: '10GB',
    dataBytesValue: 10240,
    validity: '30 Days',
    validityCategory: 'Monthly',
    priceGhc: 39.99,
    isPopular: true,
    description: 'High speed 10GB allocation with no sudden cutoffs',
  },
  {
    id: 'at-30gb-noexp',
    network: 'airteltigo',
    dataAmount: '30GB',
    dataBytesValue: 30720,
    validity: 'No Expiry',
    validityCategory: 'Non-Expiry',
    priceGhc: 109.99,
    isBestValue: true,
    description: 'Big Time Non-Expiry AT bundle that stays until you finish',
  },
];

/**
 * Helper to auto-detect Ghanaian telecom network based on phone number prefix
 */
export function detectGhanaNetwork(phoneNumber: string): NetworkId | null {
  const clean = phoneNumber.replace(/[\s\-\+]/g, '');
  
  // Format check for +233 or 0 prefix
  let prefix = '';
  if (clean.startsWith('233') && clean.length >= 5) {
    prefix = '0' + clean.slice(3, 5);
  } else if (clean.startsWith('0') && clean.length >= 3) {
    prefix = clean.slice(0, 3);
  }

  for (const [netId, netInfo] of Object.entries(GHANA_NETWORKS)) {
    if (netInfo.prefixes.includes(prefix)) {
      return netId as NetworkId;
    }
  }

  return null;
}
