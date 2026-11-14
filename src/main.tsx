import {captureCampaignToken} from './utils/campaignTracking';
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

captureCampaignToken();
const shortCode=!isolatedTemplateId && window.location.pathname.match(/^\/c\/([^/]+)\/?$/)?.[1];
// Mystery Greetings: the recipient page (/g/…, the same paths the server answers with greeting metadata) and the creator.
const greetingPath = /^\/g(?:\/|$)/i.test(window.location.pathname);
const creatorPath = /^\/greetings\/?$/i.test(window.location.pathname);
const surface: Promise<ReactElement> = shortCode ? import('./components/common/CampaignRedirect').then(({CampaignRedirect})=><CampaignRedirect code={shortCode}/>)
  : greetingPath ? Promise.all([import('./greetings/RecipientPage'), import('./greetings/greetings.css')]).then(([{RecipientPage}]) => <RecipientPage path={window.location.pathname} />)
  : creatorPath ? Promise.all([import('./greetings/CreatorPage'), import('./greetings/greetings.css')]).then(([{CreatorPage}]) => <CreatorPage search={window.location.search} />)
  : isolatedTemplateId
  ? import('./components/website/IsolatedTemplatePreview').then(({IsolatedTemplatePreview}) => <IsolatedTemplatePreview templateId={isolatedTemplateId} />)
  : siteSlug
    ? import('./components/website/PublicPublishedSite').then(({PublicPublishedSite}) => <PublicPublishedSite slug={siteSlug} />)
    : import('./App.tsx').then(({default: App}) => <App />);

void surface.then(element => createRoot(document.getElementById('root')!).render(element));
