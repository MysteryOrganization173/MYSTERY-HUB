import { ActivePage, SafeEditorAiContext } from '../types';
import { API_BASE_URL } from './apiClient';
import {mysteryHubGuide} from '../../shared/mysteryAiKnowledge';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  source?: 'scripted' | 'gemini';
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
        "Open the **Branding** tab in the editor. Choose **Upload Image / Media Library** to upload or select your hero image or logo. If uploads are not configured, use only the image options currently available in the editor.",
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
export function getSuggestedQuestionsForPage(page: ActivePage, options: { signedIn?: boolean } = {}): SuggestedQuestion[] {
  // Signed-in Home opens the chat from the member card: lead with what members come back for.
  if (page === 'home' && options.signedIn) {
    return [
      { id: 'member-track', text: 'How do I track my order?' },
      { id: 'member-delayed', text: 'What should I do if my bundle is delayed?' },
      { id: 'member-wallet', text: 'How do I add money to my Wallet?' },
      { id: 'member-web', text: 'Can I create a free website?' },
    ];
  }
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

/** Why a question got no answer, so the chat can say what happened and what to do next. */
export type MysteryAiFailureKind = 'busy' | 'limits' | 'timeout' | 'offline' | 'unavailable';
export const MYSTERY_AI_TIMEOUT_MESSAGE = 'Mystery AI is taking too long to answer. Check your connection, then try again.';
export const MYSTERY_AI_OFFLINE_MESSAGE = 'You seem to be offline. Reconnect to the internet, then try again.';
export class MysteryAiError extends Error {
  constructor(message: string, readonly kind: MysteryAiFailureKind, readonly retryable = kind !== 'limits') { super(message); }
}
const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/**
 * Sends a message to the server-side Gemini API route.
 * Includes a 12-second AbortController timeout around the backend's bounded request budget.
 * Falls back to the grounded local responder if the backend is unreachable or times out.
 */
export async function sendMysteryAiMessage(
  userMessage: string,
  activePage: ActivePage,
  history: ChatMessage[],
  editorContext?: SafeEditorAiContext | null,
  signal?: AbortSignal,
  timeoutMs = 12000
): Promise<{ reply: string; quickAction?: ChatMessage['quickAction']; source: 'scripted' | 'gemini' }> {
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  if (editorContext?.experienceMode === 'website_editor' || activePage === 'website') {
    const help = resolveInstantBuilderHelp(userMessage, editorContext);
    if (help) return { ...help, source: 'scripted' };
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  let timedOut = false;
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(() => { timedOut = true; abort(); }, timeoutMs);
  try {
    const res = await fetch(`${API_BASE_URL}/api/mystery-ai/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({
        message: userMessage, activePage,
        history: history.filter(m=>!m.id.startsWith('welcome-')).slice(-8).map(m => ({ role: m.role, content: m.content })),
        editorContext: editorContext || undefined,
      }),
    });
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (res.status === 429) {
      const data = await res.json().catch(() => ({}));
      const seconds = Math.min(300, Math.max(1, Number(res.headers.get('Retry-After') || data.retryAfterSeconds) || 60));
      throw new MysteryAiError(`Mystery AI is busy. Please wait ${Math.ceil(seconds)} seconds and try again.`, 'busy', data.retryable !== false);
    }
    if (res.status === 400) throw new MysteryAiError('The message or conversation exceeds chat limits. Shorten your message or reset the conversation and try again.', 'limits');
    if (res.ok) {
      const data = await res.json();
      if (typeof data.reply === 'string' && data.reply.trim()) {
        if (data.source === 'guide' && data.fallback === true) {
          return {reply:data.reply,quickAction:getGroundedLocalResponse(userMessage,activePage,editorContext)?.quickAction??inferQuickAction(userMessage,data.reply,activePage),source:'scripted'};
        }
        if (!data.fallback && data.source === 'gemini') {
          return { reply: data.reply, quickAction: inferQuickAction(userMessage, data.reply, activePage), source: 'gemini' };
        }
      }
    } else if (res.status === 503) {
      const data = await res.json().catch(() => ({}));
      if (data.code === 'TIMEOUT') throw new MysteryAiError(MYSTERY_AI_TIMEOUT_MESSAGE,'timeout');
      if (data.retryable === false) throw new MysteryAiError("Mystery AI is unavailable. You can still use Mystery Hub's services and help guides.",'unavailable',false);
    }
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (error instanceof MysteryAiError) throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  const help = getGroundedLocalResponse(userMessage, activePage, editorContext);
  if (help) return { ...help, source: 'scripted' };
  if (isOffline()) throw new MysteryAiError(MYSTERY_AI_OFFLINE_MESSAGE, 'offline');
  if (timedOut) throw new MysteryAiError(MYSTERY_AI_TIMEOUT_MESSAGE, 'timeout');
  throw new MysteryAiError("Couldn't reach Mystery AI just now. Try again.", 'unavailable');
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
 * Used when backend/Gemini is unavailable; explicit quota/validation errors remain failures.
 * Kept concise, grounded in current facts, and free of stale pricing/validity.
 */
export function getGroundedLocalResponse(
  query: string,
  activePage: ActivePage,
  editorContext?: SafeEditorAiContext | null
): { reply: string; quickAction?: ChatMessage['quickAction'] } | null {
  if (editorContext?.experienceMode === 'website_editor' || activePage === 'website') {
    const help=resolveInstantBuilderHelp(query,editorContext);if(help)return help;
  }
  const help=mysteryHubGuide(query);
  return help ? {reply:help.reply,quickAction:{type:'navigate',targetPage:help.page,label:help.page==='orders'?'Open Orders & Support':'Open '+({services:'All Services',data:'Data & Airtime',wallet:'Wallet',website:'Website Builder',afa:'AFA Registration',earn:'Mystery Earn',marketplace:'Marketplace'}[help.page]||help.page)}} : null;
}
