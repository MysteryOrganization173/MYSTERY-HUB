import { ActivePage } from '../types';
import { DATA_BUNDLES, GHANA_NETWORKS } from '../data/bundles';
import { API_BASE_URL } from './apiClient';

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
        { id: 'data-speed', text: 'How long does delivery take?' },
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
        { id: 'ord-delayed', text: 'What should I do if my bundle is delayed?' },
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
 * Includes a 25-second AbortController timeout.
 * Falls back to the grounded local responder if the backend is unreachable or times out.
 */
export async function sendMysteryAiMessage(
  userMessage: string,
  activePage: ActivePage,
  history: ChatMessage[]
): Promise<{ reply: string; quickAction?: ChatMessage['quickAction'] }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

  try {
    const url = `${API_BASE_URL}/api/mystery-ai/chat`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        message: userMessage,
        activePage,
        history: history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.reply && !data.fallback) {
        if (import.meta.env.DEV) {
          console.log(`[Mystery AI] source=gemini model=${data.model || 'gemini-3.8-flash'}`);
        }
        return {
          reply: data.reply,
          quickAction: inferQuickAction(userMessage, data.reply, activePage),
        };
      } else {
        if (import.meta.env.DEV) {
          console.log(`[Mystery AI] source=fallback reason=${data?.reason || 'backend_fallback'}`);
        }
      }
    } else {
      if (import.meta.env.DEV) {
        console.log(`[Mystery AI] source=fallback reason=http_${res.status}`);
      }
    }
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    if (import.meta.env.DEV) {
      console.log(`[Mystery AI] source=fallback reason=${isTimeout ? 'timeout' : 'network_error'}`);
    }
  }

  // Emergency grounded local response fallback
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
  if (
    q.includes('go to data') ||
    q.includes('take me to data') ||
    q.includes('buy data') ||
    q.includes('bundle') ||
    q.includes('network') ||
    q.includes('mtn') ||
    q.includes('telecel') ||
    q.includes('airteltigo')
  ) {
    return { type: 'navigate', targetPage: 'data', label: '👉 Go to Data Bundles' };
  }
  if (
    q.includes('go to website') ||
    q.includes('take me to website') ||
    q.includes('create a website') ||
    q.includes('template') ||
    q.includes('website builder')
  ) {
    return { type: 'navigate', targetPage: 'website', label: '👉 Explore Website Builder' };
  }
  if (
    q.includes('order') ||
    q.includes('track') ||
    q.includes('receipt') ||
    q.includes('delay') ||
    r.includes('orders page')
  ) {
    return { type: 'navigate', targetPage: 'orders', label: '👉 View Order Tracking' };
  }
  if (
    q.includes('utility') ||
    q.includes('ecg') ||
    q.includes('water') ||
    q.includes('coming soon') ||
    q.includes('future') ||
    q.includes('waitlist')
  ) {
    return { type: 'navigate', targetPage: 'services', label: '👉 Browse Future Utilities' };
  }
  if (q.includes('who are you') || q.includes('what is mystery hub') || q.includes('tell me about you')) {
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
 * Emergency local fallback responder
 * Used strictly when backend/Gemini is unreachable, timed out, or quota exceeded.
 * Kept concise, grounded in current facts, and free of stale pricing/validity.
 */
export function getGroundedLocalResponse(
  query: string,
  activePage: ActivePage
): { reply: string; quickAction?: ChatMessage['quickAction'] } {
  const q = query.toLowerCase().trim();

  // 1. Identity & Introduction
  if (
    q.includes('who are you') ||
    q.includes('who r u') ||
    q.includes('who you') ||
    q.includes('whats your name') ||
    q.includes('what is your name') ||
    q.includes('what’s your name') ||
    q.includes('tell me about you') ||
    q.includes('tell me about urself') ||
    q.includes('are you ai') ||
    q.includes('are u ai') ||
    q.includes('are you an ai') ||
    q.includes('what are you')
  ) {
    return {
      reply:
        "I am Mystery AI, the official digital assistant for Mystery Hub in Ghana! 🇬🇭\n\nI'm here to help you get the most out of our platform — whether that's purchasing discounted data for MTN, Telecel, and AirtelTigo, creating a professional website for your business without coding, or tracking your order status.",
      quickAction:
        activePage === 'website'
          ? { type: 'navigate', targetPage: 'website', label: '👉 Explore Website Builder' }
          : { type: 'navigate', targetPage: 'data', label: '👉 Buy Data Bundles' },
    };
  }

  // 2. What is Mystery Hub
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
        "Mystery Hub is Ghana's all-in-one digital utility platform. Our live service provides discounted data bundles for MTN, Telecel, and AirtelTigo delivered directly to your SIM via Mobile Money. We also provide an interactive Website Builder for Ghanaian businesses, with utilities like ECG tokens and WAEC checkers coming soon!",
      quickAction: { type: 'navigate', targetPage: 'data', label: '👉 Browse Data Offers' },
    };
  }

  // 3. Navigation Direct Requests
  if (q.includes('take me to data') || q.includes('go to data') || q.includes('open data')) {
    return {
      reply: "Taking you to our Data page where you can choose bundles for MTN, Telecel, and AirtelTigo.",
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
      reply: "Taking you to our Order Tracking page where you can check the live delivery status of your purchases.",
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
    const mtn1 = DATA_BUNDLES.find((b) => b.id === 'mtn-1gb')?.priceGhc || 4.99;
    return {
      reply: `Buying data takes just 3 simple steps:\n1. Go to our Data page and select your network (MTN, Telecel, or AirtelTigo).\n2. Pick your bundle (e.g. 1GB for GH₵${mtn1.toFixed(2)}).\n3. Enter your recipient phone number and authorize the Mobile Money prompt on your phone.\n\nYour data is credited directly to your SIM!`,
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
        "We support Ghana's major networks: MTN Ghana (Express Data), Telecel Ghana, and AirtelTigo (AT). We accept payments via MTN MoMo, Telecel Cash, AT Money, and Bank Card via Paystack with transparent pricing and no hidden charges.",
      quickAction: { type: 'navigate', targetPage: 'data', label: '👉 Select Your Network' },
    };
  }

  // 6. Pricing & Current Rates
  if (
    q.includes('price') ||
    q.includes('cost') ||
    q.includes('rate') ||
    q.includes('how much') ||
    q.includes('cheap')
  ) {
    const mtn1 = DATA_BUNDLES.find((b) => b.id === 'mtn-1gb')?.priceGhc || 4.99;
    const mtn2 = DATA_BUNDLES.find((b) => b.id === 'mtn-2gb')?.priceGhc || 9.99;
    const mtn5 = DATA_BUNDLES.find((b) => b.id === 'mtn-5gb')?.priceGhc || 23.99;
    const mtn10 = DATA_BUNDLES.find((b) => b.id === 'mtn-10gb')?.priceGhc || 46.99;

    return {
      reply: `Our current data rates in Ghana include:\n• MTN 1GB: GH₵${mtn1.toFixed(2)}\n• MTN 2GB: GH₵${mtn2.toFixed(2)}\n• MTN 5GB: GH₵${mtn5.toFixed(2)}\n• MTN 10GB: GH₵${mtn10.toFixed(2)}\n\nPackages range up to 40GB for MTN and 100GB for Telecel. Check all live prices on our Data page!`,
      quickAction: { type: 'navigate', targetPage: 'data', label: '👉 View All Bundle Prices' },
    };
  }

  // 7. Delivery Time & Conditions
  if (
    q.includes('speed') ||
    q.includes('how long') ||
    q.includes('fast') ||
    q.includes('instant') ||
    q.includes('when will it arrive')
  ) {
    return {
      reply:
        "Many orders complete within roughly 15–45 minutes under normal telecom conditions. During network congestion, processing may take longer, in exceptional cases up to 48 hours. For MTN, please wait for an existing order to complete before placing another for the same number. All orders remain trackable on our Orders page!",
      quickAction: { type: 'navigate', targetPage: 'orders', label: '👉 Track Order Status' },
    };
  }

  // 8. Order Tracking & Specific Orders
  if (
    q.includes('order') ||
    q.includes('delay') ||
    q.includes('track') ||
    q.includes('status') ||
    q.includes('where is my data')
  ) {
    return {
      reply:
        "To check your order, head to our Orders page or click 'Track Order' in the header. Enter your public Order Reference (e.g. MH-20260930-...) to see real-time network dispatch progress. If you need manual help, our Accra WhatsApp helpdesk link is right on that page!",
      quickAction: { type: 'navigate', targetPage: 'orders', label: '👉 Track Your Order' },
    };
  }

  // 9. Website Builder
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
        "Mystery Hub offers an interactive Website Builder designed for Ghanaian businesses — from restaurants and chop bars to salons, churches, and contractors. Sites are mobile-friendly with WhatsApp ordering and MoMo payment integration. You can test live previews on our Website Builder page!",
      quickAction: { type: 'navigate', targetPage: 'website', label: '👉 Open Website Builder' },
    };
  }

  // 10. Coming Soon / Utilities
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
        "We are developing direct utility settlement for ECG power tokens, Ghana Water bills, and WAEC Results Checker PINs. You can join the free notification waitlist on our More Services page to be notified when each service goes live!",
      quickAction: { type: 'navigate', targetPage: 'services', label: '👉 View Upcoming Services' },
    };
  }

  // 11. Support & Contact
  if (
    q.includes('support') ||
    q.includes('contact') ||
    q.includes('whatsapp') ||
    q.includes('phone') ||
    q.includes('help')
  ) {
    return {
      reply:
        "Our support team is based in Accra, Ghana 🇬🇭. You can reach out directly via WhatsApp for quick assistance with order status or questions using the WhatsApp link on our Orders or checkout page.",
      quickAction: { type: 'navigate', targetPage: 'orders', label: '👉 View Orders & Support' },
    };
  }

  // Page-specific contextual answers
  if (activePage === 'data') {
    return {
      reply:
        "You are on our Data page! You can choose between MTN, Telecel, and AirtelTigo, browse in Card or Compact view, and click 'Buy Now' to have data credited to your phone quickly via Mobile Money.",
      quickAction: { type: 'navigate', targetPage: 'data', label: '👉 Select a Bundle' },
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

  // Default welcoming reply
  return {
    reply:
      "I'm Mystery AI, your guide to Mystery Hub! I can help you with discounted data for MTN, Telecel, or AirtelTigo, guide you in creating a website for your business, or explain our digital services in Ghana. What would you like to explore?",
    quickAction: { type: 'navigate', targetPage: 'data', label: '👉 Browse Data Bundles' },
  };
}
