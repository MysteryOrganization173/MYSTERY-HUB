export interface AfaPackageInfo {
  id: string;
  name: string;
  period: 'monthly' | 'weekly';
  hasData: boolean;
  priceGhc: number;
  validity: string;
  onNetMins: number;
  offNetMins: number;
  cugMins: number;
  /**
   * null = included, but the amount is not confirmed. The previous monthly value (255) is not supported by any
   * source checked on 2026-10-28: current AFA guides list 25, MTN's undated Help Center article lists 1,000 on-net
   * and 50 off-net. Set the number here once the founder confirms it with the registration provider or MTN.
   */
  sms: number | null;
  dataMb?: number;
}

export interface AfaConfig {
  serviceId: string;
  title: string;
  tagline: string;
  disclaimer: string;
  privacyStatement: string;
  howItWorks: Array<{
    step: number;
    title: string;
    desc: string;
  }>;
}

export const AFA_CONFIG: AfaConfig = {
  serviceId: 'srv-afa',
  title: 'AFA Registration',
  tagline: 'Register your MTN line once to access eligible AFA call and data packages. You buy the packages separately from MTN after you register.',
  disclaimer:
    'Package examples reported for AFA lines; MTN sets the packages and can change them, and its AFA menu shows the current ones before you pay. Registration gives access to eligible AFA offers; package purchase and availability remain subject to MTN.',
  privacyStatement:
    'Registration details are encrypted and handled securely by Mystery Hub. Never share your Ghana Card PIN or account passwords.',
  howItWorks: [
    {
      step: 1,
      title: 'Enter your details',
      desc: 'Enter your legal details & MTN line.',
    },
    {
      step: 2,
      title: 'Pay the one-time fee',
      desc: 'Pay registration fee via Paystack or Mystery Wallet.',
    },
    {
      step: 3,
      title: 'We submit your registration',
      desc: 'After verified payment, our supplier processes registration.',
    },
    {
      step: 4,
      title: 'Track it in Orders',
      desc: 'Track status in your Orders tab.',
    },
  ],
};

/**
 * Package examples reported for AFA lines. They are information only: Mystery Hub sells the registration, and
 * registered lines buy these packages from MTN, which sets and can change them. Minutes, CUG minutes and data below
 * match the AFA package guides checked on 2026-10-28 (asetenapa.com, unorthodoxdigital.com); MTN's own undated
 * Help Center article shows an older GH₵6 version.
 */
export const AFA_PACKAGES: AfaPackageInfo[] = [
  {
    id: 'afa-monthly-nodata',
    name: 'Monthly No-Data',
    period: 'monthly',
    hasData: false,
    priceGhc: 10,
    validity: '30 days',
    onNetMins: 250,
    offNetMins: 30,
    cugMins: 500,
    sms: null,
  },
  {
    id: 'afa-monthly-data',
    name: 'Monthly With Data',
    period: 'monthly',
    hasData: true,
    priceGhc: 10,
    validity: '30 days',
    onNetMins: 180,
    offNetMins: 30,
    cugMins: 500,
    sms: null,
    dataMb: 250,
  },
  {
    id: 'afa-weekly-nodata',
    name: 'Weekly No-Data',
    period: 'weekly',
    hasData: false,
    priceGhc: 3,
    validity: '7 days',
    onNetMins: 60,
    offNetMins: 7,
    cugMins: 200,
    sms: 10,
  },
  {
    id: 'afa-weekly-data',
    name: 'Weekly With Data',
    period: 'weekly',
    hasData: true,
    priceGhc: 3,
    validity: '7 days',
    onNetMins: 45,
    offNetMins: 7,
    cugMins: 200,
    sms: 10,
    dataMb: 100,
  },
];
