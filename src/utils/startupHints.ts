/**
 * 3.7.3 · The first script in the page's <head>, written into index.html at build time (vite.config.ts).
 *
 * It runs while the HTML is still being read, before any stylesheet (a script placed after a stylesheet waits for it
 * to download), and only on pages that are served by the Mystery Hub app. There it:
 *
 * 1. Starts downloading the app (its JavaScript and styles, without running them) alongside the entry script, as the
 *    3.x preload did, now from the top of the head (in the lab this did not make ordinary pages appear sooner on a
 *    slow connection, which is already full at that moment; it costs nothing and helps where latency dominates).
 * 2. On the homepage, asks the server for the seasonal status straight away instead of after the app has downloaded.
 *    The answer is kept on `window` for SeasonProvider, which still decides everything (see `earlySeasonAnswer`), and
 *    is the same request the app would make (same URL and headers, so the browser's copy serves the app's own check).
 * 3. When that answer says a pack applies today, starts downloading the seasonal homepage (the guest or the member
 *    one, the seasonal header and footer, and the guest pack for signed-out visitors), which is the homepage's main
 *    content in season, so it appears with the app instead of replacing the ordinary homepage a second later; and
 *    requests the pack's serif stylesheet (a small file; the font itself downloads when seasonal text is drawn:
 *    asking for it earlier measured slower, see the release document).
 *
 * Other pages are left as they were: there the season only adds details that already wait for the page (the Data and
 * Orders artwork, the header and footer). In the lab, asking or downloading for them early competed with the page's
 * own download on a slow connection and made the page appear later, so this script does not.
 *
 * Business websites, template previews, Mystery Greetings and Mystery Countdown never use the app (main.tsx serves
 * them on their own), so on those paths the script does nothing at all. Campaign short links (/c/…) are served on their
 * own too, but they forward the visitor into the app, so the app download is kept there on purpose.
 *
 * Downloads only: nothing here runs app code, applies a style, shows anything or decides what a visitor sees.
 */
export interface StartupAssets { js: string[]; css: string[] }
export interface StartupHintsInput {
  /** The app chunk and the chunks it imports; its stylesheets. */
  app: StartupAssets;
  /** Per seasonal pack id, the parts its homepage shows. Missing parts are simply not warmed. */
  seasons: Record<string, Partial<Record<SeasonPart, StartupAssets>>>;
  /** The pack's serif stylesheet (the same element the pack itself adds, so it is never added twice). */
  serifHref: string;
  /** VITE_API_BASE_URL at build time ('' when the API is on the same origin). */
  apiBase: string;
}
export type SeasonPart = 'shell' | 'pack' | 'home' | 'member';

/** Paths main.tsx serves without the app. Kept in step with main.tsx (a test reads main.tsx for each of these rules). */
export const NO_APP_PATHS = {
  sites: /^\/sites\/[^\/?#]/,
  greeting: /^\/g(?:\/|$)/i,
  creator: /^\/greetings\/?$/i,
  countdown: /^\/countdown\/?$/i,
  // A value is required, as in main.tsx (an empty one is falsy there and the app is served).
  templatePreview: /[?&](isolated_template_preview|preview_template_id)=[^&#]/,
} as const;

/** Where SeasonProvider finds the early answer. */
export const EARLY_SEASON_KEY = '__mhSeasonEarly';

/** JSON that is safe inside an inline <script> (build-time values only, but `<` never reaches the HTML parser). */
const inline = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

export function startupHintsScript({ app, seasons, serifHref, apiBase }: StartupHintsInput): string {
  const base = apiBase.replace(/\/$/, '');
  // Written as plain ES5 so it runs in every browser that can open the page, before anything else.
  return `(function(){var p=location.pathname,q=location.search;`
    + `if(${NO_APP_PATHS.sites}.test(p)||${NO_APP_PATHS.greeting}.test(p)||${NO_APP_PATHS.creator}.test(p)||${NO_APP_PATHS.countdown}.test(p)||${NO_APP_PATHS.templatePreview}.test(q))return;`
    + `var h=document.head,seen={};`
    + `function add(rel,href,as,cors){if(seen[rel+href])return;seen[rel+href]=1;var l=document.createElement('link');l.rel=rel;if(as)l.as=as;if(cors)l.crossOrigin='';l.href=href;h.appendChild(l)}`
    // Module preloads and style preloads are crossorigin like the scripts and stylesheets Vite inserts later;
    // otherwise Chrome downloads each one twice.
    + `function warm(a){if(!a)return;a.js.forEach(function(f){add('modulepreload','/'+f,'',1)});a.css.forEach(function(f){add('preload','/'+f,'style',1)})}`
    + `warm(${inline(app)});`
    // The address as routing.ts normalizes it (lower case, single slashes, no trailing slash).
    + `var n=p.toLowerCase().replace(/\\/+/g,'/');if(n.length>1)n=n.replace(/\\/+$/,'');`
    // Only the homepage asks early: elsewhere the season adds details that wait for the page anyway, and asking early
    // there made the page itself later in the lab (see the release document).
    + `if(!window.fetch||(n!=='/'&&n!=='/index.html'))return;`
    // Signed in on this device: AppContext keeps the session in localStorage ("remember me") or in sessionStorage.
    + `var S=${inline(seasons)},k='mystery_hub_session_token',signedIn=false;`
    + `try{signedIn=!!localStorage.getItem(k)}catch(e){}if(!signedIn)try{signedIn=!!sessionStorage.getItem(k)}catch(e){}`
    + `window.${EARLY_SEASON_KEY}=fetch(${inline(base + '/api/seasonal/status')},{headers:{Accept:'application/json'}})`
    + `.then(function(r){return r.ok?r.json():null}).then(function(d){`
    + `if(!d||typeof d!=='object')return null;window.${EARLY_SEASON_KEY}Answer={data:d,at:Date.now()};`
    + `var s=d.active===true&&typeof d.scheduledPack==='string'&&Object.prototype.hasOwnProperty.call(S,d.scheduledPack)&&S[d.scheduledPack];if(!s)return d;`
    + `warm(s.shell);if(!signedIn)warm(s.pack);warm(signedIn?s.member:s.home);`
    + `add('stylesheet',${inline(serifHref)});return d})['catch'](function(){return null})})();`;
}

/** The early answer, if it arrived before the app started: `{ data, at }` as the page received it, else null. */
export function earlySeasonAnswer(win: unknown = typeof window === 'undefined' ? undefined : window): { data: unknown; at: number } | null {
  const answer = (win as Record<string, unknown> | undefined)?.[EARLY_SEASON_KEY + 'Answer'] as { data?: unknown; at?: unknown } | undefined;
  return answer && answer.data && typeof answer.data === 'object' && typeof answer.at === 'number' && Number.isFinite(answer.at) ? { data: answer.data, at: answer.at } : null;
}
