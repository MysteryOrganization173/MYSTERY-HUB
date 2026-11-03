import './websiteBuilder.css';
import './businessWorkspace.css';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChartColumn, ChevronLeft, ChevronRight, Compass, Copy, Eye, Globe, House, LayoutDashboard, Megaphone, Menu, PenLine, PiggyBank, ReceiptText, RefreshCw, Share2, Tags, UserRound, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { WebsiteSiteRecord } from '../../types';
import { useOwnerWebsites } from '../../hooks/useOwnerWebsites';
import { WebsiteBusinessDashboard, type BusinessDashboardSummary } from './WebsiteBusinessDashboard';
import { WEBSITE_LIVE_LABELS, websiteLiveState } from '../../utils/websiteReadiness';
import { WEBSITE_TEMPLATES, templateDesignLabel } from '../../data/templates';
import { websiteItemVocabulary } from '../../config/websiteStarters';
import { unpublishWebsiteOnServer } from '../../services/apiClient';
import { formatGhs } from '../../../shared/money';
import { StoreShareKit } from './StoreShareKit';
import { PromotionKit } from './PromotionKit';
import { BrandMark } from '../common/BrandLogo';
import { lazyPage } from '../../utils/lazyPage';
import { getPageFromPath } from '../../utils/routing';
import { businessDock, initialWorkspaceTabs, sectionForTab, workspacePath, workspaceRangeLabel, workspaceSectionFromPath, workspaceSections, WEBSITE_DESIGNS_PATH, WORKSPACE_SECTIONS, type WorkspaceSection } from '../../utils/businessWorkspace';

// The design-switch sheet (which renders whole templates) downloads only when an owner opens it, so the workspace
// itself stays light on a phone. Builder V6: the editor is its own page and download (/website-builder/edit/:id).
const WebsiteSettingsControls = lazyPage(() => import('./WebsiteSettingsControls'), 'WebsiteSettingsControls', { fallback: <p role="status" className="text-sm text-slate-400">Loading website settings…</p> });

const ICONS: Record<WorkspaceSection, React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>> = { overview: LayoutDashboard, orders: ReceiptText, products: Tags, earnings: PiggyBank, promote: Megaphone, analytics: ChartColumn, website: Globe };

/**
 * Business Workspace (/my-business): the place an owner runs an existing website from. V7.2.1: it is its own
 * application shell (App.tsx renders no consumer header, footer or tab bar here). One business bar names where the
 * owner is (Mystery Hub / My Business) and holds the account; one navigation system moves between areas (the sidebar
 * on desktops, the business dock on phones and tablets). The Website Builder stays the place to discover designs and
 * start a website; the full-screen editor stays the place to change the site itself.
 */
export const BusinessWorkspacePage: React.FC = () => {
  const { user, sessionToken, isAuthChecking, openAuth, showToast, openWebsiteEditor, openTemplatePreview, setActivePage, replacePath, openAccount } = useApp();
  const { sites, setSites, loading, error, reload } = useOwnerWebsites(sessionToken);
  const site = sites[0] || null;
  const reseller = site?.template_id === 'tmpl-data-reseller';

  // Each area has its own address, so Back, refresh and bookmarks land where the owner was.
  const [section, setSection] = useState<WorkspaceSection>(() => workspaceSectionFromPath(window.location.pathname));
  // The More sheet takes a history entry while open, so a phone's Back button closes it instead of leaving the area.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const sync = () => { setSection(workspaceSectionFromPath(window.location.pathname)); if (!window.history.state?.bwMenu) setMenuOpen(false); };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  const menuEntry = () => Boolean(window.history.state?.bwMenu);
  const openMenu = () => { if (!menuEntry()) window.history.pushState({ page: 'business', bwMenu: true }, '', window.location.pathname + window.location.search); setMenuOpen(true); };
  const closeMenu = () => { setMenuOpen(false); if (menuEntry()) window.history.back(); };
  const heading = useRef<HTMLHeadingElement>(null);
  const go = (next: WorkspaceSection, { replace = false } = {}) => {
    const fromMenu = menuEntry();
    setMenuOpen(false);
    const path = workspacePath(next);
    // Chosen from the More sheet: its history entry becomes the area, so Back returns to where the owner opened it.
    if (fromMenu && window.location.pathname === path) window.history.back();
    else if (window.location.pathname !== path || fromMenu) window.history[replace || fromMenu ? 'replaceState' : 'pushState']({ page: 'business' }, '', path);
    if (next === section) return;
    setSection(next);
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
  };
  /** Leave My Business for another part of Mystery Hub (the More sheet's entry is replaced, never left behind). */
  const leaveTo = (path: string) => {
    setMenuOpen(false);
    if (menuEntry()) { replacePath(path); return; }
    const page = getPageFromPath(path);
    window.history.pushState({ page }, '', path);
    setActivePage(page, false);
    window.scrollTo({ top: 0 });
  };

  const [summary, setSummary] = useState<BusinessDashboardSummary | null>(null);
  useEffect(() => { setSummary(null); }, [site?.id, site?.template_id, sessionToken]);
  const available = workspaceSections(summary?.tabs || initialWorkspaceTabs(reseller));
  // A link to an area this website does not have (e.g. Orders on a new salon site) opens the Overview instead.
  useEffect(() => { if (site && summary?.loaded && !available.includes(section)) go('overview', { replace: true }); }, [site?.id, summary?.loaded, available.join(), section]);
  const refreshRef = useRef<(() => void) | null>(null);

  const [pricingDirty, setPricingDirty] = useState(false);
  const confirmPricingLeave = () => !pricingDirty || window.confirm('You have unsaved bundle prices. Leave without saving them?');
  const leaveBusiness = (path = '/') => { if (!confirmPricingLeave()) return; setPricingDirty(false); leaveTo(path); };
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

  // The business bar is on every state of this page, so the way back to Mystery Hub and the account never move.
  const bar = <BusinessBar onHome={() => leaveBusiness('/')} account={user ? { name: user.name, open: openAccount } : null} />;

  // ---------- States before there is a website to manage ----------
  if (!user && !isAuthChecking) return <>{bar}<WorkspaceGate title="Sign in to manage your business" detail="My Business shows your website, orders, prices and earnings in one place.">
    <button type="button" className="bw-button" data-primary onClick={() => openAuth('login', 'Sign in to open My Business.')}>Sign in</button>
    <a className="bw-button" href="/website-builder" onClick={event => { event.preventDefault(); leaveTo('/website-builder'); }}>Explore website designs</a>
  </WorkspaceGate></>;
  if (!site && (loading || isAuthChecking)) return <>{bar}<div className="bw-gate" role="status" aria-label="Loading your business"><div className="bw-loading" data-loading><span /><span /><span /></div></div></>;
  if (!site && error) return <>{bar}<WorkspaceGate title="Your business didn’t load" detail={/fetch|network/i.test(error) ? 'We couldn’t reach Mystery Hub. Check your connection, then try again.' : error} alert>
    <button type="button" className="bw-button" data-primary onClick={reload}>Try again</button>
  </WorkspaceGate></>;
  if (!site) return <>{bar}<WorkspaceGate title="You don’t have a business website yet" detail="Choose a free design, add your details and publish. My Business opens here once your website exists.">
    <button type="button" className="bw-button" data-primary onClick={() => leaveTo('/website-builder')}>Choose a free design</button>
  </WorkspaceGate></>;

  const live = websiteLiveState(site), published = site.status === 'published';
  const template = WEBSITE_TEMPLATES.find(t => t.id === site.template_id) || null;
  const exampleCount = (site.content_json?.items || []).filter(item => item.isExample).length;
  const itemWord = websiteItemVocabulary(site.template_id);
  const info = WORKSPACE_SECTIONS[section];
  // One rule for both navigations: the dock holds the daily areas, More holds the rest (never both).
  const dock = businessDock(available, reseller);
  const secondary = available.filter(target => !dock.includes(target));
  const showRefresh = !['website', 'products', 'promote'].includes(section);
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
  const areaClick = (target: WorkspaceSection) => (event: React.MouseEvent) => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return; event.preventDefault(); go(target); };
  const navLink = (target: WorkspaceSection, withHint: boolean) => {
    const Icon = ICONS[target];
    return <li key={target}><a href={workspacePath(target)} aria-current={section === target ? 'page' : undefined} onClick={areaClick(target)}>
      <Icon size={18} aria-hidden={true} /><span className="bw-nav-text"><strong>{WORKSPACE_SECTIONS[target].label}</strong>{withHint && <small>{detail(target)}</small>}</span>{badge(target)}{withHint && <ChevronRight size={18} aria-hidden={true} className="bw-nav-chevron" />}
    </a></li>;
  };

  // Operational status and the website's own actions: the first thing the Overview answers.
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
      <section className="website-settings-row" aria-labelledby="bw-designs-title"><div className="min-w-0"><h3 id="bw-designs-title">Explore other designs</h3><p>Browse every Website Builder design. Switching always shows a preview first and keeps your business details.</p></div><button type="button" onClick={() => leaveBusiness(WEBSITE_DESIGNS_PATH)}>Explore designs</button></section>
      <WebsiteSettingsControls site={site} token={sessionToken!} withdrawalMinimumMinor={policy.withdrawalMinimumMinor} onUnpublish={published ? unpublish : undefined}
        onUpdated={(updated: WebsiteSiteRecord) => { updateSite(updated); editSite(updated); }} onDeleted={handleDeleted} onResolve={(tab: string) => go(sectionForTab(tab))}
        beforeDanger={published && <section className="website-settings-row" aria-labelledby="bw-offline-title"><div className="min-w-0"><h3 id="bw-offline-title">Take your website offline</h3><p>{reseller ? 'Customers can’t open your store or buy until you publish again. Your orders, prices and Store Earnings stay.' : 'Visitors can’t open your website until you publish again. Your draft stays.'}</p></div><button type="button" disabled={unpublishing} onClick={confirmUnpublish}>{unpublishing ? 'Unpublishing…' : 'Unpublish…'}</button></section>} />
    </div>
  </div>;

  // V7.1 share kit, now only while a store is open but has no paid orders in the period: an established store keeps
  // Share on its website card instead of a sharing lesson on every visit.
  const nextSteps = (s: BusinessDashboardSummary) => reseller && published && (s.sellable ?? 0) > 0 && s.paidOrders === 0 ? <StoreShareKit name={name} url={publicUrl} onPromote={() => go('promote')} /> : null;

  const identity = <div className="bw-identity">
    <WorkspaceAvatar logo={site.content_json?.logoUrl} name={name} />
    <div className="min-w-0 flex-1"><p className="bw-name" title={name}>{name}</p><p className="bw-state" data-live={live} data-tone={reseller && summary?.storeLabel ? summary.storeTone : undefined}><span aria-hidden="true" /><span className="bw-state-text">{reseller && summary?.storeLabel ? summary.storeLabel : WEBSITE_LIVE_LABELS[live].short}</span></p></div>
    {/* Phones and tablets: areas live in the business dock below, so the header keeps the owner's main action. */}
    <button type="button" className="bw-identity-edit" onClick={() => editSite(site)}><PenLine size={16} aria-hidden="true" />Edit<span className="sr-only"> website</span></button>
  </div>;

  return <>{bar}<div className="bw" data-section={section}>
    <aside className="bw-side" aria-label="Your business">
      {identity}
      <nav aria-label="Business areas" className="bw-nav"><ul>{available.map(target => navLink(target, false))}</ul></nav>
      <div className="bw-side-foot">
        <button type="button" className="bw-button" data-primary onClick={() => editSite(site)}><PenLine size={16} aria-hidden="true" />Edit website</button>
        <a className="bw-quiet-link" href={WEBSITE_DESIGNS_PATH} onClick={event => { event.preventDefault(); leaveBusiness(WEBSITE_DESIGNS_PATH); }}><Compass size={15} aria-hidden="true" />Explore designs</a>
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
        onSummary={setSummary} refreshRef={refreshRef} overviewNext={nextSteps} settings={websiteArea}
        promote={reseller && <PromotionKit site={site} name={name} url={publicUrl} published={published} onPublish={() => editSite(site, true)} />} />
    </div>

    {/* Business dock (phones and tablets): the most-used areas, everything else under More. */}
    <nav className="bw-dock" aria-label="Business areas" style={{ '--bw-dock-count': dock.length + 1 } as React.CSSProperties}>
      {dock.map(target => {
        const Icon = ICONS[target];
        return <a key={target} href={workspacePath(target)} aria-current={section === target ? 'page' : undefined} onClick={areaClick(target)}>
          <span className="bw-dock-icon" aria-hidden="true"><Icon size={21} aria-hidden={true} />{target === 'orders' && summary?.ordersNeedingCheck ? <i className="bw-dock-dot" /> : null}</span>
          <span className="bw-dock-label">{WORKSPACE_SECTIONS[target].short}{target === 'orders' && summary?.ordersNeedingCheck ? <span className="sr-only">, {summary.ordersNeedingCheck} need a check</span> : null}</span>
        </a>;
      })}
      <button type="button" aria-haspopup="dialog" aria-expanded={menuOpen} data-active={!dock.includes(section) ? '' : undefined} aria-label={!dock.includes(section) ? `More. Now showing ${info.label}` : 'More'} onClick={openMenu}>
        <span className="bw-dock-icon" aria-hidden="true"><Menu size={21} aria-hidden={true} /></span><span className="bw-dock-label">More</span>
      </button>
    </nav>

    {/* More: only what the dock does not already show, then the website's public link, designs, account and the way out. */}
    {menuOpen && <WorkspaceMenu onClose={closeMenu} name={name}>
      {secondary.length > 0 && <nav aria-label="More business areas"><ul className="bw-nav" data-drawer>{secondary.map(target => navLink(target, true))}</ul></nav>}
      <ul className="bw-menu-list" aria-label="Your website">
        {published ? <li><a href={`/sites/${encodeURIComponent(site.slug)}`} target="_blank" rel="noopener noreferrer" onClick={() => closeMenu()}><Eye size={18} aria-hidden="true" /><span>View live site</span></a></li>
          : <li><button type="button" onClick={() => { closeMenu(); void preview(); }}><Eye size={18} aria-hidden="true" /><span>Preview website</span></button></li>}
        {published && <li><button type="button" onClick={() => { closeMenu(); void share(); }}><Share2 size={18} aria-hidden="true" /><span>Share website link</span></button></li>}
        <li><a href={WEBSITE_DESIGNS_PATH} onClick={event => { event.preventDefault(); leaveBusiness(WEBSITE_DESIGNS_PATH); }}><Compass size={18} aria-hidden="true" /><span>Explore designs</span></a></li>
      </ul>
      <ul className="bw-menu-list" data-quiet aria-label="Account">
        <li><button type="button" onClick={() => { closeMenu(); openAccount(); }}><UserRound size={18} aria-hidden="true" /><span>My account<small>Profile, password and sign out</small></span></button></li>
        <li><a href="/" onClick={event => { event.preventDefault(); leaveBusiness('/'); }}><House size={18} aria-hidden="true" /><span>Back to Mystery Hub<small>Buy data, airtime and more as a customer</small></span></a></li>
      </ul>
    </WorkspaceMenu>}
  </div></>;
};

/**
 * The business bar: a breadcrumb that says where the owner is and is the way back to Mystery Hub, plus the account.
 * Quiet on purpose: the business's own name and areas sit below it, and nothing here competes with them.
 */
function BusinessBar({ onHome, account }: { onHome: () => void; account: { name: string; open: () => void } | null }) {
  const initial = (account?.name.trim()[0] || 'M').toUpperCase();
  return <header className="bw-bar">
    <nav aria-label="Breadcrumb" className="bw-crumbs"><ol>
      <li><a href="/" onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return; event.preventDefault(); onHome(); }}>
        <ChevronLeft size={16} aria-hidden="true" className="bw-crumbs-back" /><BrandMark size="xs" ariaHidden className="bw-crumbs-mark" /><span><span className="sr-only">Back to </span>Mystery Hub</span>
      </a></li>
      <li><span aria-current="page">My Business</span></li>
    </ol></nav>
    {account && <button type="button" className="bw-bar-account" onClick={account.open} aria-label={`My account, ${account.name}`}><span aria-hidden="true">{initial}</span></button>}
  </header>;
}

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

/** Phone and tablet More sheet (native dialog: focus, Escape and the scroll lock come with it). */
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
  return <dialog ref={dialog} className="website-sheet bw-drawer" aria-label="More" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === dialog.current) onClose(); }}>
    <div className="website-sheet-head"><div className="min-w-0 flex-1"><h2 className="truncate">More</h2><p className="truncate">{name}</p></div><button type="button" onClick={onClose} aria-label="Close" className="website-sheet-close"><X size={20} /></button></div>
    <div className="website-sheet-body">{children}</div>
  </dialog>;
}
