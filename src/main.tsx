import {createRoot} from 'react-dom/client';
import type {ReactElement} from 'react';
import './index.css';
import {captureInstallPrompt} from './pwa/installPrompt';

/**
 * Each surface downloads only its own code: a customer opening a business website at /sites/:slug never
 * loads the Mystery Hub app, Admin or the website editor. App.tsx keeps the same routing for the main app.
 */
const params = new URLSearchParams(window.location.search);
const isolatedTemplateId = params.get('isolated_template_preview') || params.get('preview_template_id');
const siteSlug = window.location.pathname.match(/^\/sites\/([^/?#]+)/)?.[1];

// Before any surface downloads: Chromium may offer installation before the app code has arrived.
captureInstallPrompt();

const surface: Promise<ReactElement> = isolatedTemplateId
  ? import('./components/website/IsolatedTemplatePreview').then(({IsolatedTemplatePreview}) => <IsolatedTemplatePreview templateId={isolatedTemplateId} />)
  : siteSlug
    ? import('./components/website/PublicPublishedSite').then(({PublicPublishedSite}) => <PublicPublishedSite slug={siteSlug} />)
    : import('./App.tsx').then(({default: App}) => <App />);

void surface.then(element => createRoot(document.getElementById('root')!).render(element));
