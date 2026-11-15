/**
 * Mystery Hub Business & Platform Configuration
 * Central source of truth for public business information, contact links,
 * service availability flags, and truthful operational settings.
 */

// Support lines in international digits (no "+"). Every link and label below derives from these, so a number changes in
// one place only. WhatsApp and SMS are temporary lines (PR #118, owner-approved Nov 2026); calls stay on the main line.
const CALL_SUPPORT_NUMBER_INTL = '233594521108';
const WHATSAPP_SUPPORT_NUMBER_INTL = '233242836323';
const SMS_SUPPORT_NUMBER_INTL = '233592066298';
/** 233XXXXXXXXX → 0XXXXXXXXX, the local form. */
const ghanaLocal = (intl: string) => `0${intl.slice(3)}`;
/** 233XXXXXXXXX → 0XX XXX XXXX, the readable form for labels. */
const ghanaDisplay = (intl: string) => ghanaLocal(intl).replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3');

export const BUSINESS_CONFIG = {
  brandName: 'Mystery Hub',
  tagline: 'Everything Digital. One Trusted Place.',
  legalName: 'Mystery Hub Digital (Ghana)',
  domain: 'mysterybundlehub.com',
  country: 'Ghana',
  currency: 'GHS',
  currencySymbol: 'GH₵',

  // Official Brand Assets
  brandMarkUrl:
    'https://res.cloudinary.com/da6oeat7m/image/upload/v1790859552/30338777-d9dc-4709-8603-b18a4dc8d0ca_tvptuc.png',
  marketplaceHeroImageUrl:
    'https://res.cloudinary.com/da6oeat7m/image/upload/v1790865356/Futuristic_Ghana_Tech_Marketplace_Banner_uvziku.png',

  // Official Public Contact Information
  contact: {
    supportEmail: 'aryeeteyemmanuel852@gmail.com',
    supportPhone: ghanaLocal(CALL_SUPPORT_NUMBER_INTL),
    supportPhoneIntl: `+${CALL_SUPPORT_NUMBER_INTL}`,
    supportPhoneDisplay: ghanaDisplay(CALL_SUPPORT_NUMBER_INTL),
    phoneLink: `tel:+${CALL_SUPPORT_NUMBER_INTL}`,
    emailLink: 'mailto:aryeeteyemmanuel852@gmail.com',
    supportWhatsAppUrl: `https://wa.me/${WHATSAPP_SUPPORT_NUMBER_INTL}`,
    supportWhatsAppDisplay: ghanaDisplay(WHATSAPP_SUPPORT_NUMBER_INTL),
    supportSms: ghanaLocal(SMS_SUPPORT_NUMBER_INTL),
    supportSmsIntl: `+${SMS_SUPPORT_NUMBER_INTL}`,
    supportSmsDisplay: ghanaDisplay(SMS_SUPPORT_NUMBER_INTL),
    smsLink: `sms:+${SMS_SUPPORT_NUMBER_INTL}`,
    telegramChannelUrl: 'https://t.me/mysteryhubapp',
    whatsappChannelUrl: 'https://whatsapp.com/channel/0029VbBt1MGC6ZvlDJ8Biz3l',
    supportLocation: 'Accra, Ghana 🇬🇭',
    supportHours: 'Mon – Sat: 8:00 AM – 8:00 PM GMT',
  },

  socials: {
    telegramChannel: 'https://t.me/mysteryhubapp',
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
      deliveryNotice: 'Fast automated delivery directly to your SIM following Mobile Money authorization.',
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
        'Curated tech hardware, creator tools, and productivity software sourced on request for customers in Ghana.',
    },
    airtime: {
      status: 'active',
      isAvailableForPurchase: true,
      label: 'Live',
      serviceFeePercent: 2,
      notice:
        'Instant automated airtime recharge directly to your SIM across MTN, AirtelTigo, and Telecel following Mobile Money authorization.',
    },
    wallet: {
      status: 'coming_soon',
      isAvailableForPurchase: false,
      label: 'Coming Soon',
      notice:
        'Mystery Hub Wallet is in development with multi-layer security and auto-renewals.',
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
    return `https://wa.me/${WHATSAPP_SUPPORT_NUMBER_INTL}?text=${text}`;
  },

  getGeneralWhatsAppUrl: (message?: string) => {
    const defaultMsg = 'Hello Mystery Hub team, I would like to inquire about your digital services in Ghana.';
    const text = encodeURIComponent(message || defaultMsg);
    return `https://wa.me/${WHATSAPP_SUPPORT_NUMBER_INTL}?text=${text}`;
  },

  getCheckoutSupportWhatsAppUrl: (dataAmount: string, networkName: string) => {
    const text = encodeURIComponent(
      `Hello Mystery Hub, I am currently purchasing a ${dataAmount} bundle for ${networkName} and have a quick question.`
    );
    return `https://wa.me/${WHATSAPP_SUPPORT_NUMBER_INTL}?text=${text}`;
  },

  getMarketplaceInquiryWhatsAppUrl: (productName: string, notes?: string) => {
    const text = encodeURIComponent(
      `Hello Mystery Hub, I'm interested in ${productName}. Please send me the current price and availability.${
        notes ? ` Notes: ${notes}` : ''
      }`
    );
    return `https://wa.me/${WHATSAPP_SUPPORT_NUMBER_INTL}?text=${text}`;
  },

  getWhatsAppChannelUrl: () => {
    return 'https://whatsapp.com/channel/0029VbBt1MGC6ZvlDJ8Biz3l';
  },
};
