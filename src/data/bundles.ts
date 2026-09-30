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
};

/**
 * Live Data Bundle Catalog
 * Exactly matches current Success Biz Hub supplier availability and Mystery Hub retail prices.
 */
export const DATA_BUNDLES: DataBundle[] = [
  // ==========================================
  // MTN EXPRESS (Ghana)
  // ==========================================
  {
    id: 'mtn-1gb',
    network: 'mtn',
    dataAmount: '1GB',
    dataBytesValue: 1024,
    validity: 'Direct Credit',
    validityCategory: 'Monthly',
    priceGhc: 4.99,
    isPopular: true,
    description: 'Fast 4G/5G data for regular social & browsing',
  },
  {
    id: 'mtn-2gb',
    network: 'mtn',
    dataAmount: '2GB',
    dataBytesValue: 2048,
    validity: 'Direct Credit',
    validityCategory: 'Monthly',
    priceGhc: 9.99,
    description: 'Essential data for social apps & messaging',
  },
  {
    id: 'mtn-3gb',
    network: 'mtn',
    dataAmount: '3GB',
    dataBytesValue: 3072,
    validity: 'Direct Credit',
    validityCategory: 'Monthly',
    priceGhc: 14.99,
    isPopular: true,
    description: 'Great for weekly streaming, TikTok, and browsing',
  },
  {
    id: 'mtn-4gb',
    network: 'mtn',
    dataAmount: '4GB',
    dataBytesValue: 4096,
    validity: 'Direct Credit',
    validityCategory: 'Monthly',
    priceGhc: 19.49,
    description: 'Comfortable allocation for daily video & social media',
  },
  {
    id: 'mtn-5gb',
    network: 'mtn',
    dataAmount: '5GB',
    dataBytesValue: 5120,
    validity: 'Direct Credit',
    validityCategory: 'Monthly',
    priceGhc: 23.99,
    isPopular: true,
    isBestValue: true,
    description: 'Our most chosen student and work bundle',
  },
  {
    id: 'mtn-6gb',
    network: 'mtn',
    dataAmount: '6GB',
    dataBytesValue: 6144,
    validity: 'Direct Credit',
    validityCategory: 'Monthly',
    priceGhc: 28.49,
    description: 'Smooth streaming, calls, and daily downloads',
  },
  {
    id: 'mtn-8gb',
    network: 'mtn',
    dataAmount: '8GB',
    dataBytesValue: 8192,
    validity: 'Direct Credit',
    validityCategory: 'Monthly',
    priceGhc: 37.99,
    description: 'Generous data volume for active social & work use',
  },
  {
    id: 'mtn-10gb',
    network: 'mtn',
    dataAmount: '10GB',
    dataBytesValue: 10240,
    validity: 'Direct Credit',
    validityCategory: 'Monthly',
    priceGhc: 46.99,
    isPopular: true,
    isBestValue: true,
    description: 'Heavy browsing, YouTube, gaming, and remote work',
  },
  {
    id: 'mtn-15gb',
    network: 'mtn',
    dataAmount: '15GB',
    dataBytesValue: 15360,
    validity: 'Direct Credit',
    validityCategory: 'Monthly',
    priceGhc: 69.99,
    description: 'High capacity monthly allocation for power users',
  },
  {
    id: 'mtn-20gb',
    network: 'mtn',
    dataAmount: '20GB',
    dataBytesValue: 20480,
    validity: 'Direct Credit',
    validityCategory: 'Monthly',
    priceGhc: 92.99,
    description: 'Heavy monthly streaming & hotspot bundle',
  },
  {
    id: 'mtn-25gb',
    network: 'mtn',
    dataAmount: '25GB',
    dataBytesValue: 25600,
    validity: 'Direct Credit',
    validityCategory: 'Monthly',
    priceGhc: 114.99,
    description: 'Power user bundle for home and office sharing',
  },
  {
    id: 'mtn-30gb',
    network: 'mtn',
    dataAmount: '30GB',
    dataBytesValue: 30720,
    validity: 'Direct Credit',
    validityCategory: 'Monthly',
    priceGhc: 137.99,
    description: 'High volume data bundle for creators and families',
  },
  {
    id: 'mtn-40gb',
    network: 'mtn',
    dataAmount: '40GB',
    dataBytesValue: 40960,
    validity: 'Direct Credit',
    validityCategory: 'Monthly',
    priceGhc: 182.99,
    description: 'Maximum capacity MTN data bundle',
  },

  // ==========================================
  // AIRTELTIGO (AT) iShare
  // ==========================================
  {
    id: 'at-1gb',
    network: 'airteltigo',
    dataAmount: '1GB',
    dataBytesValue: 1024,
    validity: 'Direct Credit',
    validityCategory: 'Monthly',
    priceGhc: 4.79,
    isPopular: true,
    description: 'Instant direct delivery to your AT number.',
  },
  {
    id: 'at-2gb',
    network: 'airteltigo',
    dataAmount: '2GB',
    dataBytesValue: 2048,
    validity: 'Direct Credit',
    validityCategory: 'Monthly',
    priceGhc: 8.99,
    description: 'Instant direct delivery to your AT number.',
  },
  {
    id: 'at-3gb',
    network: 'airteltigo',
    dataAmount: '3GB',
    dataBytesValue: 3072,
    validity: 'Direct Credit',
    validityCategory: 'Monthly',
    priceGhc: 13.49,
    isPopular: true,
    description: 'Instant direct delivery to your AT number.',
  },
  {
    id: 'at-4gb',
    network: 'airteltigo',
    dataAmount: '4GB',
    dataBytesValue: 4096,
    validity: 'Direct Credit',
    validityCategory: 'Monthly',
    priceGhc: 17.99,
    description: 'Instant direct delivery to your AT number.',
  },
  {
    id: 'at-5gb',
    network: 'airteltigo',
    dataAmount: '5GB',
    dataBytesValue: 5120,
    validity: 'Direct Credit',
    validityCategory: 'Monthly',
    priceGhc: 22.49,
    isPopular: true,
    isBestValue: true,
    description: 'Instant direct delivery to your AT number.',
  },

  // ==========================================
  // TELECEL GHANA Expiry
  // ==========================================
  {
    id: 'telecel-10gb',
    network: 'telecel',
    dataAmount: '10GB',
    dataBytesValue: 10240,
    validity: 'Direct Credit',
    validityCategory: 'Monthly',
    priceGhc: 44.99,
    isPopular: true,
    description: 'Stream seamlessly across your devices on Telecel 4G',
  },
  {
    id: 'telecel-15gb',
    network: 'telecel',
    dataAmount: '15GB',
    dataBytesValue: 15360,
    validity: 'Direct Credit',
    validityCategory: 'Monthly',
    priceGhc: 63.99,
    description: 'Reliable Telecel connectivity for remote work & study',
  },
  {
    id: 'telecel-20gb',
    network: 'telecel',
    dataAmount: '20GB',
    dataBytesValue: 20480,
    validity: 'Direct Credit',
    validityCategory: 'Monthly',
    priceGhc: 83.99,
    isBestValue: true,
    description: 'Pro monthly bundle for home office and creators',
  },
  {
    id: 'telecel-25gb',
    network: 'telecel',
    dataAmount: '25GB',
    dataBytesValue: 25600,
    validity: 'Direct Credit',
    validityCategory: 'Monthly',
    priceGhc: 103.99,
    description: 'Heavy monthly allocation for multi-device hotspots',
  },
  {
    id: 'telecel-30gb',
    network: 'telecel',
    dataAmount: '30GB',
    dataBytesValue: 30720,
    validity: 'Direct Credit',
    validityCategory: 'Monthly',
    priceGhc: 123.99,
    description: 'High capacity Telecel data allocation',
  },
  {
    id: 'telecel-40gb',
    network: 'telecel',
    dataAmount: '40GB',
    dataBytesValue: 40960,
    validity: 'Direct Credit',
    validityCategory: 'Monthly',
    priceGhc: 164.99,
    description: 'Extensive data capacity for families and developers',
  },
  {
    id: 'telecel-50gb',
    network: 'telecel',
    dataAmount: '50GB',
    dataBytesValue: 51200,
    validity: 'Direct Credit',
    validityCategory: 'Monthly',
    priceGhc: 203.99,
    description: 'Super high capacity Telecel package',
  },
  {
    id: 'telecel-100gb',
    network: 'telecel',
    dataAmount: '100GB',
    dataBytesValue: 102400,
    validity: 'Direct Credit',
    validityCategory: 'Monthly',
    priceGhc: 399.99,
    isBestValue: true,
    description: 'Ultimate 100GB Telecel monthly connectivity bundle',
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
