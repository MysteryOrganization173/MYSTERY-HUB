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
  sms: number;
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
  tagline: 'Register your MTN number for eligible AFA offers securely through Mystery Hub.',
  disclaimer:
    'Package information may change. Registration gives access to eligible AFA offers; package purchase and availability remain subject to MTN.',
  privacyStatement:
    'Registration details are encrypted and handled securely by Mystery Hub. Never share your Ghana Card PIN or account passwords.',
  howItWorks: [
    {
      step: 1,
      title: 'Enter registration details',
      desc: 'Enter your legal details & MTN line.',
    },
    {
      step: 2,
      title: 'Pay securely',
      desc: 'Pay registration fee via Paystack.',
    },
    {
      step: 3,
      title: 'Mystery Hub submits registration',
      desc: 'After verified payment, our supplier processes registration.',
    },
    {
      step: 4,
      title: 'Track progress in Orders',
      desc: 'Track status in your Orders tab.',
    },
  ],
};

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
    sms: 255,
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
    sms: 255,
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
