/**
 * Mystery Hub Business & Platform Configuration
 * Central source of truth for public business information, contact links,
 * service availability flags, and truthful operational settings.
 */

export const BUSINESS_CONFIG = {
  brandName: 'Mystery Hub',
  tagline: 'Everything Digital. One Trusted Place.',
  legalName: 'Mystery Hub Digital (Ghana)',
  domain: 'mysteryhub.site',
  country: 'Ghana',
  currency: 'GHS',
  currencySymbol: 'GH₵',

  // Official Public Contact Information
  contact: {
    supportEmail: 'aryeeteyemmanuel852@gmail.com',
    supportPhone: '0592066298',
    supportPhoneIntl: '+233592066298',
    phoneLink: 'tel:+233592066298',
    emailLink: 'mailto:aryeeteyemmanuel852@gmail.com',
    supportWhatsAppUrl: 'https://wa.me/233592066298',
    whatsappChannelUrl: 'https://whatsapp.com/channel/0029VbBt1MGC6ZvlDJ8Biz3l',
    supportLocation: 'Accra, Ghana 🇬🇭',
    supportHours: 'Mon – Sat: 8:00 AM – 8:00 PM GMT',
  },

  socials: {
    whatsappChannel: 'https://whatsapp.com/channel/0029VbBt1MGC6ZvlDJ8Biz3l',
    twitter: 'https://x.com/mysteryhubgh',
    instagram: 'https://instagram.com/mysteryhubgh',
    facebook: 'https://facebook.com/mysteryhubgh',
  },

  // Service Truth & Availability Flags
  services: {
    data: {
      status: 'active',
      isAvailableForPurchase: true,
      label: 'Live',
      deliveryNotice: 'Automated telecom dispatch directly to your SIM following Mobile Money authorization.',
    },
    websiteBuilder: {
      status: 'beta',
      isAvailableForPurchase: false,
      label: 'Beta Preview',
      notice:
        'Interactive template browsing and device previews are live. Publishing and domain management will launch with open beta.',
    },
    marketplace: {
      status: 'active',
      isAvailableForPurchase: true,
      label: 'Live Sourcing',
      notice:
        'Curated tech hardware, creator tools, and productivity software sourced on request with verified Ghana dispatch.',
    },
    airtime: {
      status: 'beta',
      isAvailableForPurchase: false,
      label: 'In Testing',
      notice:
        'Airtime top-up is undergoing direct telecom gateway testing. Live checkout is paused until full fulfillment is enabled.',
    },
    wallet: {
      status: 'coming_soon',
      isAvailableForPurchase: false,
      label: 'Coming Soon',
      notice:
        'Mystery Hub Wallet is in architectural development with multi-tier ledger security and auto-renewals.',
    },
    utilities: {
      status: 'coming_soon',
      isAvailableForPurchase: false,
      label: 'Coming Soon',
      notice:
        'Municipal bills (ECG, GWCL), TV renewals, and WAEC PINs are in active development. Join the early-access waitlist.',
    },
  },

  // Generate contextual WhatsApp helpdesk links (Direct 1-on-1 Support)
  getOrderSupportWhatsAppUrl: (orderId: string, phone: string) => {
    const text = encodeURIComponent(
      `Hello Mystery Hub Support, I am inquiring about Order #${orderId} for recipient ${phone}.`
    );
    return `https://wa.me/233592066298?text=${text}`;
  },

  getGeneralWhatsAppUrl: (message?: string) => {
    const defaultMsg = 'Hello Mystery Hub team, I would like to inquire about your digital services in Ghana.';
    const text = encodeURIComponent(message || defaultMsg);
    return `https://wa.me/233592066298?text=${text}`;
  },

  getCheckoutSupportWhatsAppUrl: (dataAmount: string, networkName: string) => {
    const text = encodeURIComponent(
      `Hello Mystery Hub, I am currently purchasing a ${dataAmount} bundle for ${networkName} and have a quick question.`
    );
    return `https://wa.me/233592066298?text=${text}`;
  },

  getMarketplaceInquiryWhatsAppUrl: (productName: string, notes?: string) => {
    const text = encodeURIComponent(
      `Hello Mystery Hub, I'm interested in ${productName}. Please send me the current price and availability.${
        notes ? ` Notes: ${notes}` : ''
      }`
    );
    return `https://wa.me/233592066298?text=${text}`;
  },

  getWhatsAppChannelUrl: () => {
    return 'https://whatsapp.com/channel/0029VbBt1MGC6ZvlDJ8Biz3l';
  },
};
