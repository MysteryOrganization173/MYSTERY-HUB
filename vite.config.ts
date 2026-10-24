import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

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

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), preloadMainApp()],
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
