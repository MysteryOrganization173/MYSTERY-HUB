/**
 * Planned-service previews for All Services (/services?service=<slug>).
 *
 * This is product intent, not commerce data: nothing here is a price, biller list, supplier, delivery time or launch
 * date, and every line is written as a plan. Live services never read from this file; their status and flows come
 * from the catalogue (data/services.ts) and their own pages.
 */
export interface ServicePreviewContent {
  /** One or two sentences: what the planned service is. */
  intro: string;
  /** Everyday jobs it is meant to help with. */
  helpsWith: string[];
  /** Features being planned. Shown under "What we're planning", with a note that plans can change. */
  planned: string[];
  /** An illustrative journey (3-4 steps). Shown as an illustration, never as a form. */
  journey: string[];
  /** Extra honesty where the service touches an official body. */
  note?: string;
}

export const SERVICE_PREVIEWS: Record<string, ServicePreviewContent> = {
  'srv-ecg': {
    intro: 'A planned way to pay for ECG electricity from your phone, in the same place you already buy data and airtime.',
    helpsWith: [
      'Buying prepaid electricity without going to a vending point',
      'Paying a postpaid ECG bill from wherever you are',
      'Keeping a record of what you paid',
    ],
    planned: [
      'Prepaid and postpaid payments in one place',
      'Checking the meter or account details before you pay',
      'A receipt saved with your Mystery Hub orders',
    ],
    journey: ['Choose prepaid or postpaid', 'Enter your meter or account number', 'Check the details shown', 'Pay and keep your receipt'],
  },
  'srv-water': {
    intro: 'A planned way to settle your Ghana Water (GWCL) bill from your phone, without a trip to an office or a queue.',
    helpsWith: [
      'Paying a household or shop water bill on time',
      'Paying a bill for a family member’s account',
      'Keeping your payment records together',
    ],
    planned: [
      'Bill payment using your GWCL account number',
      'Checking the account details before you pay',
      'A receipt saved with your Mystery Hub orders',
    ],
    journey: ['Enter your GWCL account number', 'Check the account details shown', 'Choose how much to pay', 'Pay and keep your receipt'],
  },
  'srv-tv': {
    intro: 'Planned renewals for DStv, GOtv and StarTimes subscriptions, so the TV stays on without a trip to an agent.',
    helpsWith: [
      'Renewing a subscription before it runs out',
      'Paying for a parent’s or relative’s decoder',
      'Keeping track of renewals you have paid for',
    ],
    planned: [
      'Renewals for DStv, GOtv and StarTimes in one place',
      'Checking the smartcard or decoder details before you pay',
      'A receipt saved with your Mystery Hub orders',
    ],
    journey: ['Choose DStv, GOtv or StarTimes', 'Enter the smartcard or IUC number', 'Choose the package to renew', 'Pay and keep your receipt'],
  },
  'srv-results': {
    intro: 'Planned results-checker PINs for supported exams, so students and parents can check results without hunting for a vendor.',
    helpsWith: [
      'Checking exam results from home',
      'Buying a checker for a child, sibling or student',
      'Finding your PIN again if you lose the message',
    ],
    planned: [
      'Results-checker PINs for supported exams',
      'Your PIN and serial kept with your Mystery Hub orders',
      'Clear guidance on where to use the PIN',
    ],
    journey: ['Choose the exam checker you need', 'Confirm your contact details', 'Pay for the checker', 'Use the PIN and serial on the results website'],
  },
  'srv-bizreg': {
    intro: 'Planned support for people registering a business or asking about a TIN in Ghana, in plain language and from your phone.',
    helpsWith: [
      'Understanding what is usually needed to register',
      'Getting your details ready before you apply',
      'Knowing where a TIN enquiry stands',
    ],
    planned: [
      'Step-by-step guidance for common business types',
      'Help preparing your details and documents',
      'Updates on the progress of your support request',
    ],
    journey: ['Tell us about your business', 'See what you are likely to need', 'Get help with the next steps'],
    note: 'Mystery Hub is not a government agency. Registration and TINs are issued by the responsible authorities.',
  },
  'srv-ai': {
    intro: 'Planned AI tools that help small businesses write and plan marketing, built around the businesses that use Mystery Hub.',
    helpsWith: [
      'Writing a clear description of your business',
      'Drafting social media posts faster',
      'Getting design ideas for flyers and your website',
    ],
    planned: [
      'Business descriptions and product copy',
      'Social post drafts you can edit before you share',
      'Design ideas that work with Website Builder',
    ],
    journey: ['Describe your business', 'Choose what you need help with', 'Review and edit the drafts'],
    note: 'This planned suite is separate from Mystery AI, the assistant already in the app.',
  },
  'srv-esim': {
    intro: 'Planned help activating an eSIM on a compatible phone, so you can get connected without a physical SIM card.',
    helpsWith: [
      'Checking whether your phone supports eSIM',
      'Adding a second line to one phone',
      'Getting connected without visiting a shop',
    ],
    planned: [
      'A quick eSIM compatibility check',
      'Clear activation steps for supported networks',
      'Help if activation does not complete',
    ],
    journey: ['Check that your phone supports eSIM', 'Choose a supported network', 'Follow the activation steps'],
  },
};
