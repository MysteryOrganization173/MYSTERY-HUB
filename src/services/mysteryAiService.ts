import { ActivePage } from '../types';
import { DATA_BUNDLES, GHANA_NETWORKS } from '../data/bundles';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  quickAction?: {
    type: 'navigate';
    targetPage: ActivePage;
    label: string;
  };
}

export interface SuggestedQuestion {
  id: string;
  text: string;
  category?: string;
}

/**
 * Returns strictly page-aware suggested question chips based on the active page
 */
export function getSuggestedQuestionsForPage(page: ActivePage): SuggestedQuestion[] {
  switch (page) {
    case 'data':
      return [
        { id: 'data-buy', text: 'How do I buy data on MTN, Telecel or AT?' },
        { id: 'data-speed', text: 'How fast is the delivery to my SIM?' },
        { id: 'data-pricing', text: 'What are the current bundle rates?' },
        { id: 'data-momo', text: 'Can I pay with Mobile Money (MoMo)?' },
      ];
    case 'website':
      return [
        { id: 'web-free', text: 'Can I create a website for free?' },
        { id: 'web-templates', text: 'Which business templates are available?' },
        { id: 'web-momo', text: 'Do websites support Ghana MoMo & WhatsApp?' },
        { id: 'web-nocode', text: 'Do I need any coding skills to build one?' },
      ];
    case 'services':
      return [
        { id: 'srv-soon', text: 'Which utilities are launching next?' },
        { id: 'srv-ecg', text: 'Will I be able to buy ECG power tokens?' },
        { id: 'srv-waec', text: 'Can I buy WAEC results checker PINs?' },
        { id: 'srv-waitlist', text: 'How do I get notified at launch?' },
      ];
    case 'orders':
      return [
        { id: 'ord-track', text: 'How do I track my active order?' },
        { id: 'ord-delayed', text: 'What happens if my bundle is delayed?' },
        { id: 'ord-support', text: 'How do I connect with WhatsApp support?' },
      ];
    case 'about':
      return [
        { id: 'abt-mission', text: 'What is Mystery Hub’s mission in Ghana?' },
        { id: 'abt-who', text: 'Who is Mystery Hub built for?' },
        { id: 'abt-location', text: 'Where is the Mystery Hub team based?' },
      ];
    case 'home':
    default:
      return [
        { id: 'home-who', text: 'Who are you and what is Mystery Hub?' },
        { id: 'home-buy', text: 'How do I buy data in Ghana?' },
        { id: 'home-web', text: 'Can I create a website for free?' },
        { id: 'home-services', text: 'What services are coming soon?' },
      ];
  }
}

/**
 * Sends a message to the server-side Gemini API route.
 * Falls back to the grounded local responder if the network is unavailable.
 */
export async function sendMysteryAiMessage(
  userMessage: string,
  activePage: ActivePage,
  history: ChatMessage[]
): Promise<{ reply: string; quickAction?: ChatMessage['quickAction'] }> {
  try {
    const res = await fetch('/api/mystery-ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage,
        activePage,
        history: history.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.reply && !data.fallback) {
        return {
          reply: data.reply,
          quickAction: inferQuickAction(userMessage, data.reply, activePage),
        };
      }
    }
  } catch (err) {
    console.warn('Mystery AI backend unavailable, using grounded local knowledge:', err);
  }

  // Grounded local response fallback
  return getGroundedLocalResponse(userMessage, activePage);
}

/**
 * Determines the best redirection action button to display with the answer
 */
function inferQuickAction(
  userQuery: string,
  reply: string,
  activePage: ActivePage
): ChatMessage['quickAction'] | undefined {
  const q = userQuery.toLowerCase();
  const r = reply.toLowerCase();

  // Navigation commands
  if (q.includes('go to data') || q.includes('take me to data') || q.includes('buy data') || q.includes('bundle') || q.includes('network') || q.includes('mtn') || q.includes('telecel') || q.includes('airteltigo')) {
    return { type: 'navigate', targetPage: 'data', label: '👉 Go to Data Bundles' };
  }
  if (q.includes('go to website') || q.includes('take me to website') || q.includes('create a website') || q.includes('template') || q.includes('website builder')) {
    return { type: 'navigate', targetPage: 'website', label: '👉 Explore Website Builder' };
  }
  if (q.includes('order') || q.includes('track') || q.includes('receipt') || q.includes('delay') || r.includes('orders page')) {
    return { type: 'navigate', targetPage: 'orders', label: '👉 View Order Tracking' };
  }
  if (q.includes('utility') || q.includes('ecg') || q.includes('water') || q.includes('coming soon') || q.includes('future') || q.includes('waitlist')) {
    return { type: 'navigate', targetPage: 'services', label: '👉 Browse Future Utilities' };
  }
  if (q.includes('who are you') || q.includes('what is mystery hub') || q.includes('tell me about you')) {
    // If on home, direct to data or website
    return activePage === 'website'
      ? { type: 'navigate', targetPage: 'website', label: '👉 Explore Website Builder' }
      : { type: 'navigate', targetPage: 'data', label: '👉 Browse Live Data Offers' };
  }

  // Fallback to active page redirect if mentioned in reply
  if (r.includes('data page') || r.includes('data bundle')) {
    return { type: 'navigate', targetPage: 'data', label: '👉 Go to Data Page' };
  }
  if (r.includes('website builder') || r.includes('templates')) {
    return { type: 'navigate', targetPage: 'website', label: '👉 Go to Website Builder' };
  }
  if (r.includes('orders page') || r.includes('track')) {
    return { type: 'navigate', targetPage: 'orders', label: '👉 Go to Orders' };
  }

  return undefined;
}

/**
 * High-fidelity local response engine with exact handling for identity,
 * redirects, pricing, networks, and features.
 */
function getGroundedLocalResponse(
  query: string,
  activePage: ActivePage
): { reply: string; quickAction?: ChatMessage['quickAction'] } {
  const q = query.toLowerCase().trim();

  // 1. Identity questions ("Who are you", "What's your name", "Are you AI?", "Tell me about you")
  if (
    q.includes('who are you') ||
    q.includes('who r u') ||
    q.includes('who you') ||
    q.includes('whats your name') ||
    q.includes('what is your name') ||
    q.includes('what’s your name') ||
    q.includes('tell me about you') ||
    q.includes('tell me eabout you') ||
    q.includes('tell me about urself') ||
    q.includes('are you ai') ||
    q.includes('are u ai') ||
    q.includes('are you an ai') ||
    q.includes('what are you')
  ) {
    return {
      reply:
        "I am Mystery AI, the official digital assistant for Mystery Hub in Ghana! 🇬🇭\n\nI'm here to help you get the most out of our platform — whether that's purchasing cheap data for MTN, Telecel, and AirtelTigo, creating a professional website for your business without coding, or tracking your order status.",
      quickAction:
        activePage === 'website'
          ? { type: 'navigate', targetPage: 'website', label: '👉 Explore Website Builder' }
          : { type: 'navigate', targetPage: 'data', label: '👉 Buy Data Bundles' },
    };
  }

  // 2. What is Mystery Hub / What can I do here?
  if (
    q.includes('what is mystery hub') ||
    q.includes('what’s mystery hub') ||
    q.includes('whats mystery hub') ||
    q.includes('what can i do here') ||
    q.includes('what do you do') ||
    q.includes('tell me about mystery hub')
  ) {
    return {
      reply:
        "Mystery Hub is Ghana's all-in-one digital utility platform. Right now, our active service lets you buy discounted data bundles for MTN, Telecel, and AirtelTigo delivered in 30–60 seconds via Mobile Money. We also provide a Website Builder so Ghanaian businesses can launch online in minutes, with utilities like ECG tokens and WAEC checkers coming soon!",
      quickAction: { type: 'navigate', targetPage: 'data', label: '👉 Browse Data Offers' },
    };
  }

  // 3. Navigation Direct Requests ("Take me to...", "Go to...")
  if (q.includes('take me to data') || q.includes('go to data') || q.includes('open data')) {
    return {
      reply: "Taking you to our Data & Airtime page where you can choose bundles for MTN, Telecel, and AirtelTigo.",
      quickAction: { type: 'navigate', targetPage: 'data', label: '👉 Go to Data Page' },
    };
  }
  if (q.includes('take me to website') || q.includes('go to website') || q.includes('open website builder')) {
    return {
      reply: "Taking you to our Website Builder page where you can explore templates for construction, restaurants, salons, churches, and more.",
      quickAction: { type: 'navigate', targetPage: 'website', label: '👉 Go to Website Builder' },
    };
  }
  if (q.includes('take me to services') || q.includes('go to services') || q.includes('more services')) {
    return {
      reply: "Taking you to our More Services page where you can preview upcoming utilities like ECG tokens and WAEC PINs.",
      quickAction: { type: 'navigate', targetPage: 'services', label: '👉 Go to More Services' },
    };
  }
  if (q.includes('take me to orders') || q.includes('go to orders') || q.includes('track order')) {
    return {
      reply: "Taking you to our Order Tracking page where you can check the live delivery status of your data purchases.",
      quickAction: { type: 'navigate', targetPage: 'orders', label: '👉 Go to Order Tracking' },
    };
  }

  // 4. Buying Data & How it Works
  if (
    q.includes('how do i buy data') ||
    q.includes('how does buying data work') ||
    q.includes('buy data') ||
    q.includes('purchase data') ||
    q.includes('buy bundle')
  ) {
    return {
      reply:
        "Buying data takes just 3 simple steps:\n1. Head to our Data page and select your network (MTN, Telecel, or AirtelTigo).\n2. Choose your bundle (e.g. 1GB for GH₵4.99 or 5GB for GH₵24.99).\n3. Enter your Ghana phone number and approve the prompt on your phone with your MoMo PIN.\n\nYour data is credited automatically within 30 to 60 seconds!",
      quickAction: { type: 'navigate', targetPage: 'data', label: '👉 Buy Data on Data Page' },
    };
  }

  // 5. Supported Networks & Payment
  if (
    q.includes('network') ||
    q.includes('mtn') ||
    q.includes('telecel') ||
    q.includes('airteltigo') ||
    q.includes('vodafone') ||
    q.includes('momo') ||
    q.includes('mobile money')
  ) {
    return {
      reply:
        "We support all 3 major telecommunications networks in Ghana: MTN Ghana, Telecel Ghana, and AirtelTigo (AT). We accept payment through MTN MoMo, Telecel Cash, and AT Money with zero extra deductions or hidden fees.",
      quickAction: { type: 'navigate', targetPage: 'data', label: '👉 Select Your Network' },
    };
  }

  // 6. Pricing & Rates
  if (
    q.includes('price') ||
    q.includes('cost') ||
    q.includes('rate') ||
    q.includes('how much') ||
    q.includes('cheap')
  ) {
    const mtn1 = DATA_BUNDLES.find((b) => b.id === 'mtn-1gb-7d')?.priceGhc || 4.99;
    const mtn5 = DATA_BUNDLES.find((b) => b.id === 'mtn-5gb-30d')?.priceGhc || 24.99;
    const mtn10 = DATA_BUNDLES.find((b) => b.id === 'mtn-10gb-30d')?.priceGhc || 44.99;

    return {
      reply: `Our data bundles offer genuine wholesale value for Ghanaian Cedis:\n• 1GB (7 Days) is GH₵${mtn1.toFixed(2)}\n• 5GB (30 Days) is GH₵${mtn5.toFixed(2)}\n• 10GB (30 Days) is GH₵${mtn10.toFixed(2)}\n\nWe also offer non-expiring Jumbo bundles up to 30GB. Check out all live options on our Data page!`,
      quickAction: { type: 'navigate', targetPage: 'data', label: '👉 View All Bundle Prices' },
    };
  }

  // 7. Website Builder & Free Website
  if (
    q.includes('website') ||
    q.includes('free website') ||
    q.includes('create a website') ||
    q.includes('build a website') ||
    q.includes('template') ||
    q.includes('business website')
  ) {
    return {
      reply:
        "Yes! Mystery Hub offers a free website starter for every Ghanaian entrepreneur, church, restaurant, salon, and contractor. Every site is 100% mobile-friendly and comes with built-in WhatsApp ordering and Ghana Mobile Money integration. You can preview all templates right now on our Website Builder page!",
      quickAction: { type: 'navigate', targetPage: 'website', label: '👉 Open Website Builder' },
    };
  }

  // 8. Coming Soon / Utilities
  if (
    q.includes('coming soon') ||
    q.includes('future') ||
    q.includes('ecg') ||
    q.includes('water') ||
    q.includes('electricity') ||
    q.includes('waec') ||
    q.includes('dstv') ||
    q.includes('tv') ||
    q.includes('esim') ||
    q.includes('wallet')
  ) {
    return {
      reply:
        "We are actively connecting directly with local authorities in Ghana to bring you ECG prepaid power tokens, Ghana Water bills, WAEC Results Checker PINs, DStv/GOtv subscriptions, and business registration. You can join the free VIP waitlist on our More Services page to receive an SMS or WhatsApp notification when they launch!",
      quickAction: { type: 'navigate', targetPage: 'services', label: '👉 View Upcoming Services' },
    };
  }

  // 9. Orders & Delivery
  if (
    q.includes('order') ||
    q.includes('delay') ||
    q.includes('track') ||
    q.includes('status') ||
    q.includes('where is my data')
  ) {
    return {
      reply:
        "Data bundles are delivered automatically within 30 to 60 seconds after Mobile Money authorization. You can track your purchase live on our Orders page using your Order ID (e.g. #MH849201). If you ever need personal assistance, our 24/7 Accra WhatsApp helpdesk is ready to help!",
      quickAction: { type: 'navigate', targetPage: 'orders', label: '👉 Track Your Order' },
    };
  }

  // 10. WhatsApp & Contact Support
  if (
    q.includes('support') ||
    q.includes('contact') ||
    q.includes('whatsapp') ||
    q.includes('phone') ||
    q.includes('help')
  ) {
    return {
      reply:
        "Our support team is based in Accra, Ghana 🇬🇭. You can reach out directly via WhatsApp for quick assistance with order status, questions, or partnerships using the WhatsApp link on our website.",
      quickAction: { type: 'navigate', targetPage: 'orders', label: '👉 View Orders & Support' },
    };
  }

  // Page-specific contextual answer if none of the above matched
  if (activePage === 'data') {
    return {
      reply:
        "You are on our Data & Airtime page. You can choose between MTN, Telecel, and AirtelTigo, filter by validity (7 Days, 30 Days, or No Expiry), and click 'Buy Now' to have data credited to your phone in under a minute.",
      quickAction: { type: 'navigate', targetPage: 'data', label: '👉 Select a Bundle Now' },
    };
  }

  if (activePage === 'website') {
    return {
      reply:
        "You are currently viewing our Website Builder. You can browse industry templates for Construction, Chop Bars & Restaurants, Salons, Churches, and Fashion ateliers, and click 'Interactive Preview' to test how they look on mobile and desktop.",
      quickAction: { type: 'navigate', targetPage: 'website', label: '👉 Preview Templates' },
    };
  }

  if (activePage === 'services') {
    return {
      reply:
        "You are on the More Services page. These utilities (ECG power, Ghana Water, WAEC PINs, etc.) are in active development. Click 'Notify Me at Launch' on any card to get early access.",
      quickAction: { type: 'navigate', targetPage: 'services', label: '👉 Join Service Waitlist' },
    };
  }

  // Default friendly welcome
  return {
    reply:
      "I'm Mystery AI, your guide to Mystery Hub! I can help you buy discounted data for MTN, Telecel, or AirtelTigo, guide you in creating a free website for your business, or explain our upcoming digital utilities in Ghana. What would you like to explore?",
    quickAction: { type: 'navigate', targetPage: 'data', label: '👉 Browse Data Bundles' },
  };
}
