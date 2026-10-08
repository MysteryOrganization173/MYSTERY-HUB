import { DigitalService } from '../types';

export const DIGITAL_SERVICES: DigitalService[] = [
  {
    id: 'srv-data',
    title: 'Data Bundles',
    category: 'Connectivity',
    description: 'Choose a bundle for MTN, AirtelTigo or Telecel, check the total and track delivery to your number.',
    status: 'active',
    iconName: 'Wifi',
    accentColor: '#00C365',
    targetPage: 'data',
  },
  {
    id: 'srv-website',
    title: 'Website Builder for Business',
    category: 'Digital Presence',
    description: 'Choose a design, add your details and photos, and publish a free business website. No coding needed.',
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
    description: 'Planned electricity bill payments. This service is not available yet.',
    status: 'coming_soon',
    iconName: 'Zap',
    accentColor: '#EF4444',
    artworkUrl: 'https://res.cloudinary.com/da6oeat7m/image/upload/v1791120377/ChatGPT_Image_Oct_4_2026_01_25_37_PM-1_hc026e.png',
  },
  {
    id: 'srv-water',
    title: 'Ghana Water (GWCL) Bills',
    category: 'Utilities',
    description: 'Planned Ghana Water bill payments. This service is not available yet.',
    status: 'coming_soon',
    iconName: 'Droplet',
    accentColor: '#0EA5E9',
    artworkUrl: 'https://res.cloudinary.com/da6oeat7m/image/upload/v1791120377/ChatGPT_Image_Oct_4_2026_01_25_42_PM-2_igylic.png',
  },
  {
    id: 'srv-tv',
    title: 'DStv, GOtv & StarTimes Pay',
    category: 'Entertainment',
    description: 'Planned TV subscription renewals for DStv, GOtv and StarTimes. Not available yet.',
    status: 'coming_soon',
    iconName: 'Tv',
    accentColor: '#8B5CF6',
    artworkUrl: 'https://res.cloudinary.com/da6oeat7m/image/upload/v1791120377/ChatGPT_Image_Oct_4_2026_01_25_50_PM-3_pnzq7z.png',
  },
  {
    id: 'srv-results',
    title: 'WAEC Results Checker PINs',
    category: 'Education',
    description: 'Planned results-checker PINs for supported exams and placement services. Not available yet.',
    status: 'coming_soon',
    iconName: 'GraduationCap',
    accentColor: '#10B981',
  },
  {
    id: 'srv-bizreg',
    title: 'Business Registration & TIN Support',
    category: 'Business Services',
    description: 'Planned help with business registration and TIN enquiries. Not available yet.',
    status: 'coming_soon',
    iconName: 'FileCheck2',
    accentColor: '#6366F1',
  },
  {
    id: 'srv-ai',
    title: 'AI Business Creator Suite',
    category: 'Productivity',
    description: 'Planned tools for business copy, social posts and design ideas. Not available yet.',
    status: 'coming_soon',
    iconName: 'Sparkles',
    accentColor: '#EC4899',
  },
  {
    id: 'srv-esim',
    title: 'Digital eSIM Activation',
    category: 'Connectivity',
    description: 'Planned eSIM activation for compatible phones. Not available yet.',
    status: 'coming_soon',
    iconName: 'Cpu',
    accentColor: '#14B8A6',
  },
  {
    id: 'srv-wallet',
    title: 'Mystery Wallet',
    category: 'Fintech Utility',
    description: 'Add money to pay for eligible Data, Airtime and AFA purchases. Wallet funds cannot be withdrawn.',
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

