import { DigitalService } from '../types';

export const DIGITAL_SERVICES: DigitalService[] = [
  {
    id: 'srv-data',
    title: 'High-Speed Data Bundles',
    category: 'Connectivity',
    description: 'Reliable, affordable data bundles for MTN, AirtelTigo, and Telecel. Delivered directly to your SIM.',
    status: 'active',
    iconName: 'Wifi',
    accentColor: '#00C365',
    targetPage: 'data',
  },
  {
    id: 'srv-website',
    title: 'Website Builder for Business',
    category: 'Digital Presence',
    description: 'Launch a professional website for your business, shop, church, or portfolio in minutes with zero coding required.',
    status: 'beta',
    iconName: 'Layout',
    accentColor: '#38BDF8',
    targetPage: 'website',
  },
  {
    id: 'srv-airtime',
    title: 'Airtime Top-Up',
    category: 'Connectivity',
    description: 'Top up airtime on MTN, AirtelTigo, and Telecel with secure Mobile Money payment and direct delivery to the selected number.',
    status: 'active',
    iconName: 'Smartphone',
    accentColor: '#F59E0B',
    targetPage: 'data',
  },
  {
    id: 'srv-afa',
    title: 'AFA Registration',
    category: 'Connectivity',
    description: 'Register your MTN number for eligible AFA offers securely through Mystery Hub.',
    status: 'active',
    iconName: 'Smartphone',
    accentColor: '#00C365',
    targetPage: 'afa',
  },
  {
    id: 'srv-ecg',
    title: 'ECG Prepaid & Postpaid Bills',
    category: 'Utilities',
    description: 'Pay Electricity Company of Ghana power tokens and post-paid accounts seamlessly without visiting a vendor.',
    status: 'coming_soon',
    iconName: 'Zap',
    accentColor: '#EF4444',
    artworkUrl: 'https://res.cloudinary.com/da6oeat7m/image/upload/v1791120377/ChatGPT_Image_Oct_4_2026_01_25_37_PM-1_hc026e.png',
  },
  {
    id: 'srv-water',
    title: 'Ghana Water (GWCL) Bills',
    category: 'Utilities',
    description: 'Settle municipal water bills directly from your mobile wallet with verifiable digital receipt generation.',
    status: 'coming_soon',
    iconName: 'Droplet',
    accentColor: '#0EA5E9',
    artworkUrl: 'https://res.cloudinary.com/da6oeat7m/image/upload/v1791120377/ChatGPT_Image_Oct_4_2026_01_25_42_PM-2_igylic.png',
  },
  {
    id: 'srv-tv',
    title: 'DStv, GOtv & StarTimes Pay',
    category: 'Entertainment',
    description: 'Renew your TV bouquets immediately to avoid broadcast interruption. Quick online renewals for DSTV, GOtv, and StarTimes.',
    status: 'coming_soon',
    iconName: 'Tv',
    accentColor: '#8B5CF6',
    artworkUrl: 'https://res.cloudinary.com/da6oeat7m/image/upload/v1791120377/ChatGPT_Image_Oct_4_2026_01_25_50_PM-3_pnzq7z.png',
  },
  {
    id: 'srv-results',
    title: 'WAEC Results Checker PINs',
    category: 'Education',
    description: 'Official scratch card PINs and serial numbers for BECE, WASSCE, Nov/Dec, and CSSPS school placement lookups.',
    status: 'coming_soon',
    iconName: 'GraduationCap',
    accentColor: '#10B981',
  },
  {
    id: 'srv-bizreg',
    title: 'Business Registration & TIN Support',
    category: 'Business Services',
    description: 'Guided assistance for Registrar General (ORC) company names, sole proprietorship filing, and GRA TIN verification.',
    status: 'coming_soon',
    iconName: 'FileCheck2',
    accentColor: '#6366F1',
  },
  {
    id: 'srv-ai',
    title: 'AI Business Creator Suite',
    category: 'Productivity',
    description: 'Generate marketing copy, local social media captions, flyers, and logo concepts tailored to the Ghanaian market.',
    status: 'coming_soon',
    iconName: 'Sparkles',
    accentColor: '#EC4899',
  },
  {
    id: 'srv-esim',
    title: 'Digital eSIM Activation',
    category: 'Connectivity',
    description: 'Download digital eSIM profiles onto compatible iPhone and Android devices without a physical plastic card.',
    status: 'coming_soon',
    iconName: 'Cpu',
    accentColor: '#14B8A6',
  },
  {
    id: 'srv-wallet',
    title: 'Mystery Wallet',
    category: 'Fintech Utility',
    description: 'Add money and spend instantly across eligible Data, Airtime and AFA services.',
    status: 'active',
    targetPage: 'wallet',
    iconName: 'Wallet',
    accentColor: '#EAB308',
  },
  {
    id: 'srv-rewards',
    title: 'Mystery Earn',
    category: 'Rewards',
    description: 'Share your referral link and earn rewards from qualifying purchases under the active reward rules.',
    status: 'active',
    iconName: 'Gift',
    accentColor: '#F43F5E',
  },
];

export interface ServiceArtworkConfig {
  url: string;
  alt: string;
  objectPosition: string;
  opacity: string;
}

export const SAMPLE_SERVICE_ARTWORK: Record<string, ServiceArtworkConfig> = {
  'srv-ecg': {
    url: 'https://res.cloudinary.com/da6oeat7m/image/upload/v1791120377/ChatGPT_Image_Oct_4_2026_01_25_37_PM-1_hc026e.png',
    alt: 'ECG electricity meter and mobile power token top-up interface',
    objectPosition: 'object-[85%_center]',
    opacity: 'opacity-52 sm:opacity-62',
  },
  'srv-water': {
    url: 'https://res.cloudinary.com/da6oeat7m/image/upload/v1791120377/ChatGPT_Image_Oct_4_2026_01_25_42_PM-2_igylic.png',
    alt: 'Ghana Water GWCL smart meter and municipal bill payment',
    objectPosition: 'object-[85%_center]',
    opacity: 'opacity-55 sm:opacity-65',
  },
  'srv-tv': {
    url: 'https://res.cloudinary.com/da6oeat7m/image/upload/v1791120377/ChatGPT_Image_Oct_4_2026_01_25_50_PM-3_pnzq7z.png',
    alt: 'DStv, GOtv and StarTimes TV bouquet renewal and entertainment screen',
    objectPosition: 'object-[85%_center]',
    opacity: 'opacity-50 sm:opacity-60',
  },
};

