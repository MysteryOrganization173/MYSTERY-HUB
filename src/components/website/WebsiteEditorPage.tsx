import './editor/visualEditor.css';
import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { WebsiteSiteRecord } from '../../types';
import { getWebsiteByIdOnServer } from '../../services/apiClient';
import { editorSiteIdFromPath, safeEditorReturnPath } from '../../utils/routing';
import { isDeletedWebsite } from '../../utils/websiteDeletion';
import { rememberOwnerWebsite } from '../../hooks/useOwnerWebsites';
import { WebsiteEditor } from './editor/WebsiteEditor';

type Load =
  | { kind: 'loading' }
  | { kind: 'ready'; site: WebsiteSiteRecord }
  | { kind: 'missing' }
  | { kind: 'forbidden' }
  | { kind: 'error'; message: string };

const BUSINESS = '/my-business';

/**
 * Builder V6: the dedicated editor at /website-builder/edit/:siteId, in its own application shell (no Mystery Hub
 * header, footer or bottom bar). It is the only place `WebsiteEditor` renders. The website always comes from the
 * signed-in owner's server record: an in-app open may paint the record it was handed, but only when that record
 * was loaded with this same session; a refresh, a link or another account always asks the server, which checks
 * ownership (403) and hides deleted websites (404).
 */
export const WebsiteEditorPage: React.FC = () => {
  const { user, sessionToken, isAuthChecking, openAuth, showToast, activeEditorSite, editorLaunch, closeWebsiteEditor, setEditorSite, replacePath } = useApp();
  const [siteId, setSiteId] = useState(() => editorSiteIdFromPath(window.location.pathname));
  useEffect(() => {
    const sync = () => { const next = editorSiteIdFromPath(window.location.pathname); if (next) setSiteId(next); };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  // Where leaving returns to: the page the editor was opened from (kept in this history entry, so it survives a
  // refresh), otherwise My Business, where an owner runs the website.
  const from = useRef(safeEditorReturnPath(window.history.state?.mhEditorFrom));
  const seed = activeEditorSite && editorLaunch && activeEditorSite.id === siteId && editorLaunch.siteId === siteId && editorLaunch.token === sessionToken && sessionToken ? activeEditorSite : null;
  const [load, setLoad] = useState<{ key: string; state: Load }>(() => ({ key: `${sessionToken}:${siteId}`, state: seed ? { kind: 'ready', site: seed } : { kind: 'loading' } }));
  const loadKey = `${sessionToken}:${siteId}`;
  // A different account or website never sees the previous answer, not even for one render.
  const state: Load = load.key === loadKey ? load.state : { kind: 'loading' };
  const [attempt, setAttempt] = useState(0);
  const hadSession = useRef(Boolean(sessionToken));
  if (sessionToken) hadSession.current = true;

  useEffect(() => {
    if (!sessionToken || !siteId) return;
    if (isDeletedWebsite(siteId)) { setLoad({ key: loadKey, state: { kind: 'missing' } }); return; }
    if (seed) { setLoad(prev => prev.key === loadKey && prev.state.kind === 'ready' ? prev : { key: loadKey, state: { kind: 'ready', site: seed } }); return; }
    let live = true;
    setLoad({ key: loadKey, state: { kind: 'loading' } });
    getWebsiteByIdOnServer(sessionToken, siteId).then(res => {
      if (!live) return;
      if (!res?.site || res.site.id !== siteId) { setLoad({ key: loadKey, state: { kind: 'missing' } }); return; }
      setLoad({ key: loadKey, state: { kind: 'ready', site: res.site } });
    }).catch((error: any) => {
      if (!live) return;
      const status = Number(error?.status) || 0;
      // An expired session signs this device out through the existing event; the sign-in gate then shows.
      if (status === 401) { window.dispatchEvent(new CustomEvent('mystery-auth-invalid', { detail: { token: sessionToken } })); return; }
      setLoad({ key: loadKey, state: status === 404 ? { kind: 'missing' } : status === 403 ? { kind: 'forbidden' } : { kind: 'error', message: /fetch|network/i.test(String(error?.message)) ? 'We couldn’t reach Mystery Hub. Check your connection, then try again.' : 'Your website didn’t load. Try again.' } });
    });
    return () => { live = false; };
  }, [sessionToken, siteId, attempt]);

  // The rest of the app (assistant, install prompts) knows an editor is open; it is forgotten when the page closes.
  const site = state.kind === 'ready' ? state.site : null;
  useEffect(() => { if (site) setEditorSite(site); }, [site?.id]);
  useEffect(() => () => closeWebsiteEditor(), []);

  // Leaving: back to where the editor was opened from by stepping back through history, so Back afterwards never
  // reopens the editor. A direct entry (link, bookmark) or a different destination replaces the editor's entry.
  const leaving = useRef(false);
  const leave = (target?: string) => {
    if (leaving.current) return;
    leaving.current = true;
    const guard = Boolean(window.history.state?.mhEditor);
    const origin = from.current;
    if (origin && (!target || target === origin)) { window.history.go(guard ? -2 : -1); return; }
    const destination = target || origin || BUSINESS;
    if (!guard) { replacePath(destination); return; }
    let done = false;
    const finish = () => { if (done) return; done = true; window.removeEventListener('popstate', finish); window.clearTimeout(timer); replacePath(destination); };
    window.addEventListener('popstate', finish);
    const timer = window.setTimeout(finish, 800);
    window.history.back();
  };
  const exitTo = (path: string) => { if (!leaving.current) { leaving.current = true; replacePath(path); } };

  if (!siteId) return <EditorGate kicker="Website editor" title="This editor link is incomplete" detail="Open your website from My Business or the Website Builder.">
    <button type="button" data-primary onClick={() => exitTo(BUSINESS)}>Open My Business</button>
  </EditorGate>;
  if (!sessionToken) {
    if (isAuthChecking) return <EditorLoading label="Checking your account…" />;
    return <EditorGate kicker="Website editor" title={hadSession.current ? 'Your session ended' : 'Sign in to edit your website'} detail={hadSession.current ? 'Sign in again to keep editing. Changes that were not saved yet are kept on this device and offered when the editor opens.' : 'Your website editor opens as soon as you sign in.'}>
      <button type="button" data-primary onClick={() => openAuth('login', 'Sign in to open your website editor.')}>Sign in</button>
      <button type="button" onClick={() => exitTo('/website-builder')}>Explore website designs</button>
    </EditorGate>;
  }
  if (state.kind === 'missing') return <EditorGate kicker="Website editor" title="This website isn’t available" detail="It may have been deleted, or the link is wrong. Your other work is safe.">
    <button type="button" data-primary onClick={() => exitTo(BUSINESS)}>Open My Business</button>
    <button type="button" onClick={() => exitTo('/website-builder')}>Choose a design</button>
  </EditorGate>;
  if (state.kind === 'forbidden') return <EditorGate kicker="Website editor" title="You can’t edit this website" detail={`You are signed in as ${user?.name || 'another account'}. Only the website’s owner can open its editor.`}>
    <button type="button" data-primary onClick={() => exitTo(BUSINESS)}>Open my business</button>
  </EditorGate>;
  if (state.kind === 'error') return <EditorGate kicker="Website editor" title="Your website didn’t load" detail={state.message} alert>
    <button type="button" data-primary onClick={() => setAttempt(n => n + 1)}>Try again</button>
    <button type="button" onClick={() => exitTo(BUSINESS)}>Open My Business</button>
  </EditorGate>;
  if (!site) return <EditorLoading label={activeEditorSite?.id === siteId ? `Opening ${activeEditorSite.content_json?.businessName || activeEditorSite.name}…` : 'Opening your website…'} />;

  return <WebsiteEditor
    key={`${site.id}:${site.template_id}`} site={site} sessionToken={sessionToken}
    openPublish={Boolean(editorLaunch?.publish && editorLaunch.siteId === site.id)}
    onClose={() => leave()} onOpenBusiness={() => leave(BUSINESS)}
    onSiteUpdated={updated => { rememberOwnerWebsite(sessionToken, updated); }}
    showToast={showToast}
    backLabel={from.current?.startsWith('/website-builder') ? 'Back to Website Builder' : from.current && !from.current.startsWith(BUSINESS) ? 'Close the editor' : 'Back to My Business'} />;
};

function EditorGate({ kicker, title, detail, alert, children }: { kicker: string; title: string; detail: string; alert?: boolean; children: React.ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [title]);
  return <main className="mh-editor-gate"><section className="mh-editor-gate-card" role={alert ? 'alert' : undefined} aria-labelledby="mh-editor-gate-title">
    <p className="mh-editor-kicker">{kicker}</p>
    <h1 id="mh-editor-gate-title" ref={heading} tabIndex={-1}>{title}</h1>
    <p>{detail}</p>
    <div className="mh-editor-gate-actions">{children}</div>
  </section></main>;
}

function EditorLoading({ label }: { label: string }) {
  return <main className="mh-editor-gate"><div className="mh-editor-loading" role="status"><span aria-hidden="true" />{label}</div></main>;
}
