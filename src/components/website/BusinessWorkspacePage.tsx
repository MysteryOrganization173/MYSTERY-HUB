import './websiteBuilder.css';
import './businessWorkspace.css';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChartColumn, ChevronDown, ChevronRight, Compass, Copy, Eye, Globe, LayoutDashboard, PenLine, PiggyBank, ReceiptText, RefreshCw, Share2, Tags, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { WebsiteSiteRecord } from '../../types';
import { useOwnerWebsites } from '../../hooks/useOwnerWebsites';
import { WebsiteBusinessDashboard, type BusinessDashboardSummary } from './WebsiteBusinessDashboard';
import { WEBSITE_LIVE_LABELS, websiteLiveState } from '../../utils/websiteReadiness';
import { WEBSITE_TEMPLATES, templateDesignLabel } from '../../data/templates';
import { websiteItemVocabulary } from '../../config/websiteStarters';
import { unpublishWebsiteOnServer } from '../../services/apiClient';
import { formatGhs } from '../../../shared/money';
import { lazyPage } from '../../utils/lazyPage';
import { initialWorkspaceTabs, sectionForTab, workspacePath, workspaceRangeLabel, workspaceSectionFromPath, workspaceSections, WORKSPACE_SECTIONS, type WorkspaceSection } from '../../utils/businessWorkspace';

// The design-switch sheet (which renders whole templates) downloads only when an owner opens it, so the workspace
// itself stays light on a phone. Builder V6: the editor is its own page and download (/website-builder/edit/:id).
const WebsiteSettingsControls = lazyPage(() => import('./WebsiteSettingsControls'), 'WebsiteSettingsControls', { fallback: <p role="status" className="text-sm text-slate-400">Loading website settings…</p> });

const ICONS: Record<WorkspaceSection, React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>> = { overview: LayoutDashboard, orders: ReceiptText, products: Tags, earnings: PiggyBank, analytics: ChartColumn, website: Globe };

/**
 * Business Workspace V1 (/my-business): the place an owner runs an existing website from. The Website Builder stays
 * the place to discover designs and start a website; the full-screen editor stays the place to change the site itself.
 */
export const BusinessWorkspacePage: React.FC = () => {
  const { user, sessionToken, isAuthChecking, openAuth, showToast, openWebsiteEditor, openTemplatePreview, setActivePage } = useApp();
  const { sites, setSites, loading, error, reload } = useOwnerWebsites(sessionToken);
  const site = sites[0] || null;
  const reseller = site?.template_id === 'tmpl-data-reseller';

  // Each area has its own address, so Back, refresh and bookmarks land where the owner was.
  const [section, setSection] = useState<WorkspaceSection>(() => workspaceSectionFromPath(window.location.pathname));
  useEffect(() => {
    const sync = () => setSection(workspaceSectionFromPath(window.location.pathname));
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  const heading = useRef<HTMLHeadingElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const go = (next: WorkspaceSection, { replace = false } = {}) => {
    setMenuOpen(false);
    const path = workspacePath(next);
    if (window.location.pathname !== path) window.history[replace ? 'replaceState' : 'pushState']({ page: 'business' }, '', path);
    if (next === section) return;
    setSection(next);
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
  };

  const [summary, setSummary] = useState<BusinessDashboardSummary | null>(null);
  useEffect(() => { setSummary(null); }, [site?.id, site?.template_id, sessionToken]);
  const available = workspaceSections(summary?.tabs || initialWorkspaceTabs(reseller));
  // A link to an area this website does not have (e.g. Orders on a new salon site) opens the Overview instead.
  useEffect(() => { if (site && summary?.loaded && !available.includes(section)) go('overview', { replace: true }); }, [site?.id, summary?.loaded, available.join(), section]);
  const refreshRef = useRef<(() => void) | null>(null);

  const [pricingDirty, setPricingDirty] = useState(false);
  const confirmPricingLeave = () => !pricingDirty || window.confirm('You have unsaved bundle prices. Leave without saving them?');
  // Builder V6: Edit website opens the editor's own page; Back or its arrow returns here, to the same area, and
  // the website is re-read from the server when the workspace opens again.
  const editSite = (target: WebsiteSiteRecord, publish = false) => { if (!confirmPricingLeave()) return; setPricingDirty(false); setMenuOpen(false); openWebsiteEditor(target, { publish }); };
  const updateSite = (updated: WebsiteSiteRecord) => setSites(prev => prev.map(item => item.id === updated.id ? updated : item));

  const [unpublishing, setUnpublishing] = useState(false);
  const unpublish = async (): Promise<boolean> => {
    if (!sessionToken || !site) return false;
    setUnpublishing(true);
    try {
      const res = await unpublishWebsiteOnServer(sessionToken, site.id, site.updated_at);
      if (res.success && res.site) { updateSite(res.site); showToast('Your website is now a draft and is no longer public.', 'info'); return true; }
      return false;
    } catch (err: any) { showToast(err.message || 'Action failed.', 'warning'); return false; }
    finally { setUnpublishing(false); }
  };
  const confirmUnpublish = () => { if (window.confirm(reseller ? 'Unpublish your store? Customers won’t be able to open it or buy until you publish again. Your orders, prices and Store Earnings stay.' : 'Unpublish your website? Visitors won’t be able to open it until you publish again. Your draft stays.')) void unpublish(); };
  const handleDeleted = (siteId: string) => {
    setSites(prev => prev.filter(item => item.id !== siteId)); setPricingDirty(false);
    showToast('Website deleted. Choose a design to start a new website.', 'success');
    setActivePage('website');
  };

  const publicUrl = site ? `${window.location.origin}/sites/${site.slug}` : '';
  const copyLink = () => {
    // Some in-app browsers block the clipboard; say so instead of failing silently.
    Promise.resolve().then(() => navigator.clipboard.writeText(publicUrl)).then(
      () => showToast('Website link copied to clipboard!', 'success'),
      () => showToast(`Copy didn’t work here. Your link is ${publicUrl.replace(/^https?:\/\//, '')}`, 'info'),
    );
  };
  const name = site?.content_json?.businessName || site?.name || 'My Business Website';
  // Phones open the native share sheet (WhatsApp, SMS…); elsewhere the link is copied.
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: name, url: publicUrl }); return; } catch (error: any) { if (error?.name === 'AbortError') return; } }
    copyLink();
  };
  const preview = async () => {
    if (!site) return;
    const { mergeSiteWithTemplate } = await import('../../utils/templateRendererUtils');
    const base = WEBSITE_TEMPLATES.find(t => t.id === site.template_id) || WEBSITE_TEMPLATES[0];
    openTemplatePreview({ ...mergeSiteWithTemplate(base, site.content_json, site.settings_json), previewSiteId: site.id });
  };

  // ---------- States before there is a website to manage ----------
  if (!user && !isAuthChecking) return <WorkspaceGate title="Sign in to manage your business" detail="Your Business Workspace shows your website, orders, prices and earnings in one place.">
    <button type="button" className="bw-button" data-primary onClick={() => openAuth('login', 'Sign in to open your Business Workspace.')}>Sign in</button>
    <a className="bw-button" href="/website-builder" onClick={event => { event.preventDefault(); setActivePage('website'); }}>Explore website designs</a>
  </WorkspaceGate>;
  if (!site && (loading || isAuthChecking)) return <div className="bw-gate" role="status" aria-label="Loading your business"><div className="bw-loading" data-loading><span /><span /><span /></div></div>;
  if (!site && error) return <WorkspaceGate title="Your business didn’t load" detail={/fetch|network/i.test(error) ? 'We couldn’t reach Mystery Hub. Check your connection, then try again.' : error} alert>
    <button type="button" className="bw-button" data-primary onClick={reload}>Try again</button>
  </WorkspaceGate>;
  if (!site) return <WorkspaceGate title="You don’t have a business website yet" detail="Choose a free design, add your details and publish. Your Business Workspace opens here once your website exists.">
    <button type="button" className="bw-button" data-primary onClick={() => setActivePage('website')}>Choose a free design</button>
  </WorkspaceGate>;

  const live = websiteLiveState(site), published = site.status === 'published';
  const template = WEBSITE_TEMPLATES.find(t => t.id === site.template_id) || null;
  const exampleCount = (site.content_json?.items || []).filter(item => item.isExample).length;
  const itemWord = websiteItemVocabulary(site.template_id);
  const info = WORKSPACE_SECTIONS[section];
  const showRefresh = !['website', 'products'].includes(section);
  const badge = (target: WorkspaceSection) => target === 'orders' && summary?.ordersNeedingCheck ? <span className="bw-badge" data-tone="warn" aria-label={`${summary.ordersNeedingCheck} need a check`}>{summary.ordersNeedingCheck}</span> : null;
  const detail = (target: WorkspaceSection): string => {
    const s = summary, range = s ? workspaceRangeLabel(s.range) : '';
    if (target === 'orders' && s?.ordersNeedingCheck) return `${s.ordersNeedingCheck === 1 ? '1 order needs' : `${s.ordersNeedingCheck} orders need`} a check`;
    if (target === 'orders' && s?.paidOrders != null) return `${s.paidOrders} paid · ${range}`;
    if (target === 'products' && s?.sellable != null) return s.sellable ? `${s.sellable} ${s.sellable === 1 ? 'bundle' : 'bundles'} on sale` : 'No bundles on sale yet';
    if (target === 'earnings' && s?.availableMinor != null) return `${formatGhs(s.availableMinor)} available`;
    if (target === 'analytics' && s?.views != null) return `${s.views} ${s.views === 1 ? 'visit' : 'visits'} · ${range}`;
    if (target === 'website') return WEBSITE_LIVE_LABELS[live].short;
    return WORKSPACE_SECTIONS[target].hint;
  };
  const navLink = (target: WorkspaceSection, withHint: boolean) => {
    const Icon = ICONS[target];
    return <li key={target}><a href={workspacePath(target)} aria-current={section === target ? 'page' : undefined} onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return; event.preventDefault(); go(target); }}>
      <Icon size={18} aria-hidden={true} /><span className="bw-nav-text"><strong>{WORKSPACE_SECTIONS[target].label}</strong>{withHint && <small>{detail(target)}</small>}</span>{badge(target)}
    </a></li>;
  };

  const siteCard = <section className="bw-site" aria-label="Your website" data-live={live}>
    <div className="bw-site-meta">
      <span className="bw-pill" data-live={live}><span aria-hidden="true" />{WEBSITE_LIVE_LABELS[live].short}</span>
      <span>{templateDesignLabel(template)} · Free plan</span>
    </div>
    <div className="website-owner-address">
      <Globe className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
      <span className="min-w-0 truncate" title={publicUrl}>{publicUrl.replace(/^https?:\/\//, '')}</span>
      {published && <button type="button" className="website-owner-icon" aria-label="Copy website link" onClick={copyLink}><Copy className="w-4 h-4" /></button>}
    </div>
    <p className="bw-site-note">{!published ? 'Not public yet. This address starts working once you publish.' : live === 'live-changes' ? 'Your newer edits are saved as a draft. Visitors see them after you update the live site.' : site.published_at ? `Visitors see your latest version. Last published ${new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(site.published_at))}.` : 'Visitors see your latest version.'}</p>
    {exampleCount > 0 && <button type="button" className="website-owner-review" onClick={() => editSite(site, true)}><span aria-hidden="true">{exampleCount}</span><span><strong>{exampleCount} example {exampleCount === 1 ? itemWord.singular.toLowerCase() : itemWord.many} to review</strong><small>Keep the ones that fit your business and remove the rest before publishing.</small></span></button>}
    <div className="website-owner-actions">
      <button type="button" className="website-owner-primary" onClick={() => editSite(site)}><PenLine className="w-4 h-4 inline -mt-0.5 mr-2" aria-hidden="true" />Edit website</button>
      {published ? <a className="website-owner-secondary" href={`/sites/${encodeURIComponent(site.slug)}`} target="_blank" rel="noopener noreferrer"><Eye className="w-4 h-4" aria-hidden="true" />View live site</a> : <button type="button" className="website-owner-secondary" onClick={() => void preview()}><Eye className="w-4 h-4" aria-hidden="true" />Preview</button>}
      {published && live === 'live' ? <button type="button" className="website-owner-secondary" onClick={() => void share()}><Share2 className="w-4 h-4" aria-hidden="true" />Share</button> : <button type="button" className="website-owner-secondary" onClick={() => editSite(site, true)}><Globe className="w-4 h-4" aria-hidden="true" />{published ? 'Update live site' : 'Publish'}</button>}
    </div>
  </section>;

  const websiteArea = (policy: { withdrawalMinimumMinor?: number }) => <div className="space-y-4" data-website-area>
    {siteCard}
    <div className="website-settings-list">
      {published && live !== 'live' && <section className="website-settings-row" aria-labelledby="bw-share-title"><div className="min-w-0"><h3 id="bw-share-title">Share your website</h3><p>Your link already works. Visitors see the last published version until you update the live site.</p></div><button type="button" onClick={() => void share()}>Share link</button></section>}
      {published && live === 'live-changes' && <section className="website-settings-row" aria-labelledby="bw-draft-title"><div className="min-w-0"><h3 id="bw-draft-title">Preview your saved draft</h3><p>See your newer edits exactly as visitors will once you update the live site.</p></div><button type="button" onClick={() => void preview()}>Preview draft</button></section>}
      <WebsiteSettingsControls site={site} token={sessionToken!} withdrawalMinimumMinor={policy.withdrawalMinimumMinor} onUnpublish={published ? unpublish : undefined}
        onUpdated={(updated: WebsiteSiteRecord) => { updateSite(updated); editSite(updated); }} onDeleted={handleDeleted} onResolve={(tab: string) => go(sectionForTab(tab))}
        beforeDanger={published && <section className="website-settings-row" aria-labelledby="bw-offline-title"><div className="min-w-0"><h3 id="bw-offline-title">Take your website offline</h3><p>{reseller ? 'Customers can’t open your store or buy until you publish again. Your orders, prices and Store Earnings stay.' : 'Visitors can’t open your website until you publish again. Your draft stays.'}</p></div><button type="button" disabled={unpublishing} onClick={confirmUnpublish}>{unpublishing ? 'Unpublishing…' : 'Unpublish…'}</button></section>} />
    </div>
  </div>;

  const hub = (s: BusinessDashboardSummary) => <nav className="bw-hub" aria-labelledby="bw-hub-title"><h2 id="bw-hub-title">Manage your business</h2><ul>{workspaceSections(s.tabs).filter(target => target !== 'overview').map(target => {
    const Icon = ICONS[target];
    return <li key={target}><a href={workspacePath(target)} onClick={event => { event.preventDefault(); go(target); }}><Icon size={20} aria-hidden={true} /><span className="bw-nav-text"><strong>{WORKSPACE_SECTIONS[target].label}</strong><small>{detail(target)}</small></span>{badge(target)}<ChevronRight size={18} aria-hidden={true} className="bw-hub-chevron" /></a></li>;
  })}</ul></nav>;

  const identity = <div className="bw-identity">
    <WorkspaceAvatar logo={site.content_json?.logoUrl} name={name} />
    <div className="min-w-0 flex-1"><p className="bw-name" title={name}>{name}</p><p className="bw-state" data-live={live}><span aria-hidden="true" /><span className="bw-state-text">{reseller && summary?.storeLabel ? summary.storeLabel : WEBSITE_LIVE_LABELS[live].short}</span></p></div>
    {/* Shows where the owner is, so it never reads as a second copy of the site menu above it. */}
    <button type="button" className="bw-menu-button" aria-haspopup="dialog" aria-expanded={menuOpen} aria-label={`Business areas. Now showing ${info.label}`} onClick={() => setMenuOpen(true)}><span>{info.short}</span><ChevronDown size={17} aria-hidden="true" /></button>
  </div>;

  return <div className="bw" data-section={section}>
    <aside className="bw-side" aria-label="Your business">
      {identity}
      <nav aria-label="Business workspace" className="bw-nav"><ul>{available.map(target => navLink(target, false))}</ul></nav>
      <div className="bw-side-foot">
        <button type="button" className="bw-button" data-primary onClick={() => editSite(site)}><PenLine size={16} aria-hidden="true" />Edit website</button>
        <a className="bw-quiet-link" href="/website-builder" onClick={event => { event.preventDefault(); setActivePage('website'); }}><Compass size={15} aria-hidden="true" />Explore designs in Website Builder</a>
      </div>
    </aside>

    <div className="bw-main">
      <header className="bw-head">
        {section !== 'overview' && <a className="bw-back" href={workspacePath('overview')} onClick={event => { event.preventDefault(); go('overview'); }}><ArrowLeft size={16} aria-hidden="true" />Overview</a>}
        <div className="bw-head-row">
          <h1 ref={heading} tabIndex={-1} data-overview={section === 'overview' ? 'yes' : undefined}>{section === 'overview' ? <><span className="bw-head-kicker">My business</span>{info.label}</> : info.label}</h1>
          {showRefresh && <button type="button" className="bw-icon-button" disabled={summary?.busy} onClick={() => refreshRef.current?.()} aria-label="Refresh business records"><RefreshCw size={17} aria-hidden="true" className={summary?.busy ? 'animate-spin' : ''} /><span>{summary?.busy ? 'Refreshing…' : 'Refresh'}</span></button>}
        </div>
      </header>
      {section === 'overview' && siteCard}
      <WebsiteBusinessDashboard site={site} token={sessionToken!} tab={info.tab} onTabChange={tab => go(sectionForTab(tab))} onEdit={() => editSite(site)} onPricingDirty={setPricingDirty}
        onPublish={() => editSite(site, true)} onShare={published ? () => void share() : undefined} onCopyLink={published ? copyLink : undefined}
        onSummary={setSummary} refreshRef={refreshRef} overviewHub={hub} settings={websiteArea} />
    </div>

    {menuOpen && <WorkspaceMenu onClose={() => setMenuOpen(false)} name={name}>
      <nav aria-label="Business workspace"><ul className="bw-nav" data-drawer>{available.map(target => navLink(target, true))}</ul></nav>
      <div className="bw-drawer-actions">
        <button type="button" className="bw-button" data-primary onClick={() => editSite(site)}><PenLine size={16} aria-hidden="true" />Edit website</button>
        {published && <a className="bw-button" href={`/sites/${encodeURIComponent(site.slug)}`} target="_blank" rel="noopener noreferrer"><Eye size={16} aria-hidden="true" />View live site</a>}
        <a className="bw-quiet-link" href="/website-builder" onClick={event => { event.preventDefault(); setMenuOpen(false); setActivePage('website'); }}><Compass size={15} aria-hidden="true" />Explore designs in Website Builder</a>
      </div>
    </WorkspaceMenu>}
  </div>;
};

function WorkspaceGate({ title, detail, alert, children }: { title: string; detail: string; alert?: boolean; children: React.ReactNode }) {
  return <div className="bw-gate"><section className="bw-gate-card" role={alert ? 'alert' : undefined} aria-labelledby="bw-gate-title">
    <p className="bw-head-kicker">My business</p><h1 id="bw-gate-title">{title}</h1><p>{detail}</p><div className="bw-gate-actions">{children}</div>
  </section></div>;
}

function WorkspaceAvatar({ logo, name }: { logo?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [logo]);
  const safe = !!logo && /^https:\/\//i.test(logo) && !failed;
  return <span className="bw-avatar" aria-hidden="true">{safe ? <img src={logo} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} /> : (name.trim()[0] || 'M').toUpperCase()}</span>;
}

/** Phone and tablet navigation: a sheet over the page (native dialog: focus, Escape and the scroll lock come with it). */
function WorkspaceMenu({ onClose, name, children }: { onClose: () => void; name: string; children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current; if (!element) return;
    const opener = document.activeElement as HTMLElement | null;
    element.showModal();
    const desktop = window.matchMedia('(min-width: 1024px)');
    const wide = () => { if (desktop.matches) onClose(); };
    desktop.addEventListener('change', wide);
    return () => { desktop.removeEventListener('change', wide); if (element.open) element.close(); opener?.focus?.({ preventScroll: true }); };
  }, []);
  return <dialog ref={dialog} className="website-sheet bw-drawer" aria-label="Business areas" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === dialog.current) onClose(); }}>
    <div className="website-sheet-head"><div className="min-w-0 flex-1"><h2 className="truncate">{name}</h2><p>Your business areas</p></div><button type="button" onClick={onClose} aria-label="Close" className="website-sheet-close"><X size={20} /></button></div>
    <div className="website-sheet-body">{children}</div>
  </dialog>;
}
