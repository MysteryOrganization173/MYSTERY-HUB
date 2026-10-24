import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';
import {publicPageHead} from './src/utils/socialMetadata';
import {injectSocialHead} from './src/utils/socialHtml';

/**
 * main.tsx loads the Mystery Hub app on demand so business websites (/sites/:slug) skip it. This inline hint
 * starts the app's download in parallel with the entry script on every other page, so the split adds no wait.
 * The style preload is crossorigin like the stylesheet Vite later inserts; otherwise Chrome downloads it twice.
 */
function preloadMainApp(): Plugin {
  return {
    name: 'mh-preload-main-app',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const app = Object.values(ctx.bundle || {}).find((c: any) => c.type === 'chunk' && c.facadeModuleId?.endsWith('/src/App.tsx')) as any;
        if (!app) return html;
        const files = [app.fileName, ...app.imports], css = [...(app.viteMetadata?.importedCss || [])];
        const script = `if(!/^\\/sites\\//.test(location.pathname)&&!/[?&](isolated_template_preview|preview_template_id)=/.test(location.search)){${JSON.stringify(files)}.forEach(function(f){var l=document.createElement('link');l.rel='modulepreload';l.crossOrigin='';l.href='/'+f;document.head.appendChild(l)});${JSON.stringify(css)}.forEach(function(f){var l=document.createElement('link');l.rel='preload';l.as='style';l.crossOrigin='';l.href='/'+f;document.head.appendChild(l)})}`;
        return [{tag: 'script', children: script, injectTo: 'head'}];
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

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), preloadMainApp(), appSharePage()],
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
