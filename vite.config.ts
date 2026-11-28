import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';
import {publicPageHead} from './src/utils/socialMetadata';
import {injectSocialHead} from './src/utils/socialHtml';
import {startupHintsScript, type SeasonPart, type StartupAssets} from './src/utils/startupHints';
import {SEASONAL_SERIF_HREF} from './src/seasonal/christmas/font';

/**
 * main.tsx loads the Mystery Hub app on demand so business websites (/sites/:slug), Greetings and the Countdown skip
 * it. The first script in <head> (src/utils/startupHints.ts) starts the app's download in parallel with the entry
 * script on every other page, so the split adds no wait, and on the homepage asks for the seasonal status at once.
 * 3.7.3: it now runs before the stylesheets (a script after a stylesheet waits for it), so these downloads start
 * sooner; Greetings pages no longer download the app; and on the homepage, when a
 * seasonal pack applies, the seasonal homepage starts downloading as soon as the server says so.
 */
function startupHints(apiBase: string): Plugin {
  return {
    name: 'mh-startup-hints',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const chunks = Object.values(ctx.bundle || {}).filter((c: any) => c.type === 'chunk') as any[];
        const byFile = new Map(chunks.map(c => [c.fileName, c]));
        const entryOf = (suffix: string) => chunks.find(c => c.facadeModuleId?.endsWith(suffix));
        // A chunk, every chunk it imports statically (transitively) and their stylesheets, minus what is already warm.
        // The entry script and its stylesheet are already in the page.
        const closure = (chunk: any, skip: Set<string> = new Set()): StartupAssets => {
          const js: string[] = [], css = new Set<string>();
          const visit = (c: any) => {
            if (!c || c.isEntry || js.includes(c.fileName)) return;
            js.push(c.fileName);
            for (const f of c.viteMetadata?.importedCss || []) css.add(f);
            for (const i of c.imports) visit(byFile.get(i));
          };
          visit(chunk);
          return { js: js.filter(f => !skip.has(f)), css: [...css].filter(f => !skip.has(f)) };
        };
        const appChunk = entryOf('/src/App.tsx');
        if (!appChunk) return html;
        const app = closure(appChunk);
        const known = new Set<string>([...app.js, ...app.css]);
        const parts: Record<SeasonPart, string> = {
          shell: '/src/seasonal/christmas/shell/ChristmasShell.tsx', pack: '/src/seasonal/christmas/ChristmasPack.tsx',
          home: '/src/seasonal/christmas/home/ChristmasHome.tsx', member: '/src/seasonal/christmas/member/ChristmasMemberHome.tsx',
        };
        const christmas: Partial<Record<SeasonPart, StartupAssets>> = {};
        for (const [part, file] of Object.entries(parts) as [SeasonPart, string][]) {
          const chunk = entryOf(file);
          if (chunk) christmas[part] = closure(chunk, known);
        }
        const script = `<script>${startupHintsScript({ app, seasons: { 'christmas-2026': christmas }, serifHref: SEASONAL_SERIF_HREF, apiBase })}</script>\n    `;
        // Before the first stylesheet, so nothing holds it up.
        const at = html.search(/<link\b[^>]*\brel=["']?stylesheet\b/i);
        return at < 0 ? html.replace('</head>', `${script}</head>`) : html.slice(0, at) + script + html.slice(at);
      },
    },
  };
}

/**
 * WhatsApp and other link previews read the first HTML response and never run JavaScript. The Render static site
 * answers every route with the same index.html, so /app gets its own copy carrying the app's title, description and
 * preview image. render.yaml (and public/_redirects) rewrite /app to it ahead of the SPA catch-all. Express serves the
 * same tags from the same publicPageHead('app') when it answers the request instead.
 */
function appSharePage(): Plugin {
  return {
    name: 'mh-app-share-page',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const index = bundle['index.html'];
      if (!index || index.type !== 'asset') return;
      this.emitFile({type: 'asset', fileName: 'app/index.html', source: injectSocialHead(String(index.source), publicPageHead('app'))});
    },
  };
}

export default defineConfig(({mode}) => {
  return {
    plugins: [react(), tailwindcss(), startupHints(loadEnv(mode, process.cwd(), 'VITE_').VITE_API_BASE_URL || ''), appSharePage()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
