/**
 * Marketplace V1 Categories & Client Configuration
 * Products are stored in PostgreSQL and managed by the owner via Admin.
 * Hardcoded demo products are strictly removed in production.
 */

import { MarketplaceCategory, MarketplaceProduct } from '../types';

export const MARKETPLACE_CATEGORIES: { id: MarketplaceCategory; label: string; description: string }[] = [
  { id: 'all', label: 'All Sourced Products', description: 'Browse all curated technology hardware, creator tools, and digital solutions.' },
  { id: 'laptops_computers', label: 'Laptops & Computers', description: 'Business ultrabooks, coding workstations, and student laptops.' },
  { id: 'phones_accessories', label: 'Phones & Accessories', description: 'Selected smartphones, multi-port GaN fast chargers, and durable accessories.' },
  { id: 'ai_productivity', label: 'AI & Productivity Tools', description: 'Legitimate productivity setups, cloud AI tools, and office workflow solutions.' },
  { id: 'creator_tools', label: 'Creator & Media Tools', description: 'Podcasting microphones, ring lights, 4K webcams, and mobile streaming setups.' },
  { id: 'business_software', label: 'Business Software', description: 'Accounting setups, invoicing software, and business automation utilities.' },
  { id: 'digital_products', label: 'Digital Products', description: 'Domain names, cloud hosting credits, and developer tools.' },
  { id: 'business_essentials', label: 'Business Hardware', description: 'Thermal receipt printers, barcode scanners, and retail checkout peripherals.' },
];

/**
 * Empty product catalogue baseline for production.
 * Live products are dynamically retrieved from the backend API (PostgreSQL database).
 */
export const MARKETPLACE_PRODUCTS: MarketplaceProduct[] = [];
