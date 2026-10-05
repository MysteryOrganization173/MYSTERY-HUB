import { ActivePage, SafeEditorAiContext } from '../types';
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
 * Deterministic builder help resolver for common website editor navigation questions.
 * Returns an instant response before calling remote AI models (0ms latency, guaranteed accurate).
 */
export function resolveInstantBuilderHelp(
  query: string,
  editorContext?: SafeEditorAiContext | null
): { reply: string; quickAction?: ChatMessage['quickAction'] } | null {
  const q = query.toLowerCase().trim();
  const isEditor = editorContext?.experienceMode === 'website_editor';

  // 1. Business details & Name / Tagline / Location (including exact query "How do I add my business details and phone?")
  if (
    q.includes('add my business details and phone') ||
    q.includes('business details and phone') ||
    (q.includes('business') && (q.includes('phone') || q.includes('contact') || q.includes('name') || q.includes('detail')))
  ) {
    return {
      reply:
        "Open the **Business** tab to edit your business name, tagline and location. Then open **Contact** to add your phone or WhatsApp number. Your changes are saved automatically and will appear in Preview.",
    };
  }

  // 2. Business Details general
  if (
    q.includes('business details') ||
    q.includes('change my business') ||
    q.includes('edit business') ||
    q.includes('business name') ||
    q.includes('change name') ||
    q.includes('tagline') ||
    q.includes('subtext') ||
    q.includes('operating hours') ||
    (isEditor && (q.includes('my details') || q.includes('change details')))
  ) {
    return {
      reply:
        "To edit your business info, open the **Business** tab in the editor. You can update your business name, tagline, subtext, city, address, and operating hours. Your changes will update automatically in the live preview.",
    };
  }

  // 3. Phone / WhatsApp general
  if (
    q.includes('add phone') ||
    q.includes('add whatsapp') ||
    q.includes('change phone') ||
    q.includes('change whatsapp') ||
    q.includes('contact details') ||
    q.includes('phone number') ||
    q.includes('whatsapp number') ||
    (isEditor && (q.includes('phone') || q.includes('whatsapp') || q.includes('contact')))
  ) {
    return {
      reply:
        "Open the **Contact** tab to add your phone number and WhatsApp number. In the **Business** tab you can also set your city and physical address.",
    };
  }

  // 4. Hero Image / Banner / Logo
  if (
    q.includes('hero image') ||
    q.includes('change image') ||
    q.includes('banner image') ||
    q.includes('replace image') ||
    q.includes('upload image') ||
    q.includes('logo')
  ) {
    return {
      reply:
        "Open the **Branding** tab in the editor. Paste your image link into the **Hero Banner Image URL** field to update the hero background. You can also paste an optional **Brand Logo URL**.",
    };
  }

  // 5. Colours / Theme Accent
  if (
    q.includes('colour') ||
    q.includes('color') ||
    q.includes('theme') ||
    q.includes('accent') ||
    q.includes('dark mode') ||
    q.includes('light mode')
  ) {
    return {
      reply:
        "Open the **Branding** tab. Choose your Primary Colour Accent (Emerald, Amber, Sky Blue, Violet, Rose, or Coral) and switch between Dark and Light theme styling.",
    };
  }

  // 6. Call to Action (CTA) Button
  if (
    q.includes('cta') ||
    q.includes('button') ||
    q.includes('call to action') ||
    q.includes('order button')
  ) {
    return {
      reply:
        "Open the **Call To Action** tab. You can customize your main button label (e.g. 'Order via WhatsApp', 'Book a Table', 'Get Quote') and define the target phone number or link.",
    };
  }

  // 7. Social Media Links
  if (
    q.includes('social') ||
    q.includes('instagram') ||
    q.includes('facebook') ||
    q.includes('tiktok')
  ) {
    return {
      reply:
        "Open the **Social** tab to add your Instagram handle, Facebook page URL, or TikTok handle. These will appear linked in the footer of your live website.",
    };
  }

  // 8. Bundle Editing (for Data Reseller template)
  if (
    q.includes('bundle') ||
    q.includes('package') ||
    q.includes('data packages') ||
    q.includes('change price') ||
    q.includes('bundle prices') ||
    q.includes('add bundle') ||
    q.includes('edit bundle')
  ) {
    return {
      reply:
        "For Data Reseller websites, open the **Bundles** tab. Click **Add Bundle** to choose the network (MTN, Telecel, or AT), enter the package name, price, and tag. You can edit or delete existing packages anytime.",
    };
  }

  // 9. Preview
  if (
    q.includes('how do i preview') ||
    q.includes('preview my website') ||
    q.includes('see my website') ||
    q.includes('test on mobile') ||
    q.includes('full preview')
  ) {
    return {
      reply:
        "Tap the **Preview** button in the header toolbar to view your reactive website. Use the Desktop, Tablet, and Mobile buttons to test responsive layouts, or tap **Full Preview** for an edge-to-edge private preview.",
    };
  }

  // 10. Publish
  if (
    q.includes('how do i publish') ||
    q.includes('publish my website') ||
    q.includes('publish website') ||
    q.includes('make it live') ||
    q.includes('go live')
  ) {
    return {
      reply:
        "When you're ready, tap the green **Publish** button in the top header. Your website will immediately go live with a shareable public link (`/sites/:slug`).",
    };
  }

  // 11. Unpublish
  if (
    q.includes('unpublish') ||
    q.includes('take offline') ||
    q.includes('revert to draft')
  ) {
    return {
      reply:
        "In the top header toolbar, tap the **Unpublish** button next to the Live status. Your site will revert to Draft mode and will no longer be accessible publicly.",
    };
  }

  // 12. Delete Website
  if (
    q.includes('delete website') ||
    q.includes('delete my site') ||
    q.includes('delete project') ||
    q.includes('remove website') ||
    q.includes('start over')
  ) {
    return {
      reply:
        "Open the **Danger Zone** tab at the bottom of the editor controls and click **Delete Website**. Type DELETE to confirm. Deleting permanently removes the project and releases your 1-site free allocation so you can start a new site.",
    };
  }

  return null;
}

/**
 * Returns strictly page-aware suggested question chips based on the active page
 */
export function getSuggestedQuestionsForPage(page: ActivePage): SuggestedQuestion[] {
  switch (page) {
    case 'data':
      return [
        { id: 'data-buy', text: 'How do I buy data on MTN, AirtelTigo or Telecel?' },
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
  history: ChatMessage[],
  editorContext?: SafeEditorAiContext | null
): Promise<{ reply: string; quickAction?: ChatMessage['quickAction'] }> {
  // 1. Instant deterministic resolver for known builder questions (0ms latency, guaranteed accurate)
  if (editorContext?.experienceMode === 'website_editor' || activePage === 'website') {
    const instantHelp = resolveInstantBuilderHelp(userMessage, editorContext);
    if (instantHelp) {
      if (import.meta.env.DEV) {
        console.log('[Mystery AI] source=deterministic_builder_help');
      }
      return instantHelp;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s safety timeout

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
        editorContext: editorContext || undefined,
      }),
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.reply && !data.fallback) {
        if (import.meta.env.DEV) {
          console.log(`[Mystery AI] source=gemini model=${data.model || 'gemini-3.8-flash'} routing=${data.routingClass || 'simple'} latency=${data.latencyMs || 0}ms`);
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
  return getGroundedLocalResponse(userMessage, activePage, editorContext);
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
    q.includes('airtime') ||
    q.includes('recharge') ||
    q.includes('credit') ||
    q.includes('top up') ||
    q.includes('top-up')
  ) {
    return { type: 'navigate', targetPage: 'data', label: '👉 Top Up Airtime' };
  }
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
  activePage: ActivePage,
  editorContext?: SafeEditorAiContext | null
): { reply: string; quickAction?: ChatMessage['quickAction'] } {
  const q = query.toLowerCase().trim();

  // 0. If in website editor or on website page, check builder help FIRST
  if (editorContext?.experienceMode === 'website_editor' || activePage === 'website') {
    const builderHelp = resolveInstantBuilderHelp(query, editorContext);
    if (builderHelp) {
      return builderHelp;
    }
  }

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
        "I am Mystery AI, the official digital assistant for Mystery Hub in Ghana! 🇬🇭\n\nI'm here to help you get the most out of our platform — whether that's purchasing discounted data for MTN, AirtelTigo, and Telecel, creating a professional website for your business without coding, or tracking your order status.",
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
        "Mystery Hub is Ghana's all-in-one digital utility platform. Our live service provides discounted data bundles for MTN, AirtelTigo, and Telecel delivered directly to your SIM via Mobile Money. We also provide an interactive Website Builder for Ghanaian businesses, with utilities like ECG tokens and WAEC checkers coming soon!",
      quickAction: { type: 'navigate', targetPage: 'data', label: '👉 Browse Data Offers' },
    };
  }

  // 3. Navigation Direct Requests
  if (q.includes('take me to data') || q.includes('go to data') || q.includes('open data')) {
    return {
      reply: "Taking you to our Data page where you can choose bundles for MTN, AirtelTigo, and Telecel.",
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
    q.includes('airtime') ||
    q.includes('buy airtime') ||
    q.includes('recharge airtime') ||
    q.includes('top up airtime') ||
    q.includes('top-up airtime') ||
    q.includes('phone credit')
  ) {
    return {
      reply:
        "Airtime Top-Up is live on Mystery Hub! ⚡\n1. Go to our Data & Airtime page and select 'Airtime Top-Up'.\n2. Choose your network (MTN, AirtelTigo, or Telecel).\n3. Enter your phone number and amount (GH₵1.00 – GH₵1,000.00).\n4. Pay via Mobile Money or Card. There is no checkout surcharge, and your airtime is credited directly to your SIM immediately!",
      quickAction: { type: 'navigate', targetPage: 'data', label: '👉 Top Up Airtime Now' },
    };
  }

  if (
    q.includes('how do i buy data') ||
    q.includes('how does buying data work') ||
    q.includes('buy data') ||
    q.includes('purchase data') ||
    q.includes('buy bundle')
  ) {
    const mtn1 = DATA_BUNDLES.find((b) => b.id === 'mtn-1gb')?.priceGhc || 4.99;
    return {
      reply: `Buying data takes just 3 simple steps:\n1. Go to our Data page and select your network (MTN, AirtelTigo, or Telecel).\n2. Pick your bundle (e.g. 1GB for GH₵${mtn1.toFixed(2)}).\n3. Enter your recipient phone number and authorize the Mobile Money prompt on your phone.\n\nYour data is credited directly to your SIM!`,
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
        "We support Ghana's major networks: MTN Ghana (Express Data), AirtelTigo (AT), and Telecel Ghana. We accept payments via MTN MoMo, AT Money, Telecel Cash, and Bank Card via Paystack with transparent pricing and no hidden charges.",
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
        "Delivery depends on your network:\n• ⚡ AirtelTigo (AT iShare): Instant Delivery directly to your AT number.\n• MTN Ghana: Fast direct processing under normal telecom conditions (usually 15–45 minutes). Network congestion can sometimes cause delays, up to 48 hours in exceptional cases. Please note that MTN allows only one active order per recipient number at a time.\n• Telecel Ghana: Standard direct SIM credit delivery as configured.\n\nAll orders remain continuously trackable on our Orders page!",
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
        "To check your order, head to our Orders page or click 'Track Order' in the header. Enter your public Order Reference (e.g. MH-20260930-...) to see real-time delivery status. If you need manual help, our Accra WhatsApp helpdesk link is right on that page!",
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
  const isGenericSupportQuery =
    q.includes('mystery hub support') ||
    q.includes('contact support') ||
    q.includes('customer service') ||
    q.includes('talk to support') ||
    q.includes('help desk') ||
    (!editorContext && activePage !== 'website' && (q.includes('support') || q.includes('contact') || q.includes('whatsapp') || q.includes('phone') || q.includes('help')));

  if (isGenericSupportQuery) {
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
        "You are on our Data page! You can choose between MTN, AirtelTigo, and Telecel, browse in Card or Compact view, and click 'Buy Now' to have data credited to your phone quickly via Mobile Money.",
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
      "I'm Mystery AI, your guide to Mystery Hub! I can help you with discounted data for MTN, AirtelTigo, or Telecel, guide you in creating a website for your business, or explain our digital services in Ghana. What would you like to explore?",
    quickAction: { type: 'navigate', targetPage: 'data', label: '👉 Browse Data Bundles' },
  };
}
