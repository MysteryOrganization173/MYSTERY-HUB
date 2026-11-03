# Business Workspace V7.2.1: one owner application

Base: `fd7df2adef30953e2b7125a57eece9a1d338d296` (main, V7.2 merged through PR #77). Presentation and navigation only: no change to Paystack initialization or verification, supplier integrations, order fulfillment, wholesale or retail price authority, Store Earnings, withdrawals, refunds, reconciliation, wallet balances, order ownership, RLS, authentication or publication semantics. No server, schema or API change.

## What was wrong

Verified in the browser on the starting commit (local server, synthetic accounts, screenshots in the evidence folder):

- My Business rendered inside the consumer shell. On a phone that meant the Mystery Hub header (service search, account menu, hamburger), the business identity, the business dock and the full marketing footer on one screen, plus a "Manage your business" list repeating every dock destination. The More sheet then repeated all six areas again.
- An owner's Website journey was Website Builder → Continue editing / My Business → Edit website: two entry points with overlapping jobs, and the editor offered before the business.
- Overview had no hierarchy: website card, store status, an "Everything looks good" filler box, the link directory, a period switch, six loose figures, activity and suggestions, in that order. Two of the six figures (checkout starts, delivered) are funnel detail that Analytics already explains.
- A non-store website saw its "not published" state twice (website card and an attention item that only said Publish).
- The editor's main button read "Update Live" while the status line said the live website was already up to date.
- Logged-in home: `.member-home-inner` kept 104px of bottom padding (once for the tab bar) on top of `main`'s 16px and the footer's 40px margin, an empty band of ~160px before the footer; the footer already clears the tab bar itself.
- Starting a website from a design link: leaving the new website's editor stepped back onto the design link, which reopened the design preview instead of reaching My Business.

Subjective, not defects: the Builder's owner card being large, More being a full list.

## Architecture

Three contexts, each with one navigation system:

| Context | Shell | Navigation |
| --- | --- | --- |
| Mystery Hub (consumer) | `mh-app`: header, footer, tab bar | unchanged |
| My Business (`/my-business/*`) | `mh-business-shell` (App.tsx): business bar, no consumer chrome | sidebar ≥1024px, business dock below |
| Website Editor (`/website-builder/edit/:id`) | `mh-editor-shell` (unchanged) | editor toolbar and dock |

The business shell keeps sign-in, My Account, toasts and design previews; it drops the assistant launcher (as the editor does) because it would float over the dock. Routing, addresses, Back/refresh and the owner-websites cache are the existing ones.

**Business bar.** A breadcrumb, `‹ Mystery Hub / My Business`, on every state of the page (signed out, loading, failed, no website, the workspace). The first crumb is the way back (accessible name "Back to Mystery Hub"), the second is the current place. The account avatar opens My Account (profile, password, sign out). Leaving through it respects unsaved bundle prices.

**Website entry.** The bare Website destination (`/website-builder`, the tab, the header link) opens My Business for anyone who owns a website: a `replaceState`, so Back never loops. When this session already knows the account owns a website (the member home or Builder read it), the Website tab goes straight to `/my-business`. The gallery is explicitly `/website-builder/designs` (same page, public Builder metadata); design links (`?template=`, `/website-builder/template/…`) keep opening their preview. Owners browsing designs see a slim strip ("← My Business", name, status) instead of a second management card. The redirect never fires while a design chosen before sign-in is being resumed or a design switch is open, so no second website and no lost choice. The account menu keeps both "My Business" and "Website Builder" (the gallery).

**Create → Editor → My Business.** A website created just now opens its editor marked `mhEditorCreated` (kept across a refresh); leaving replaces the editor's own entry with My Business. The back button says "Back to My Business".

## Navigation

- Dock and More come from one rule (`businessDock`): a Data Store keeps Overview · Orders · Pricing · Earnings · More; other websites show only their areas (Overview · Analytics · Website · More). More lists only areas the dock does not, then View live site / Preview, Share link, Explore designs, then My account and Back to Mystery Hub.
- More is a native modal dialog (focus moves in, Escape closes, page scroll locked, focus returns to More). It takes a history entry, so a phone's Back closes it; choosing an area replaces that entry, so Back afterwards returns to where More was opened.
- Removed: the consumer header/footer/tab bar inside My Business, the `data-business-mode` attribute and its CSS, the Overview's "Manage your business" directory, Edit website and duplicate areas inside More. Relocated: Explore designs also sits in Website & settings.

## Overview

Order: identity and status → website card (live state, address, Edit website, View live site / Preview, Share / Publish / Update live site) → store status and "Needs your attention" (only when something does) → "How your business is doing" → customer activity (digest, link to Analytics) → next steps.

The figures card groups server values by what they cover: the chosen period (Data Store: paid orders, sales, visitors; other websites: views, visitors, contact/WhatsApp actions) and "Right now" (Data Store only: Store Earnings available, pending, bundles on sale). Each figure opens the area that explains it. No figure is derived in the browser; checkout starts and delivered orders remain in Analytics. The identity dot follows the store's status (amber while checkout is paused or setup is left). The V7.1 share kit now shows only while an open store has no paid orders in the period; Share stays on the website card.

## Spacing

- Member home: bottom padding 104px → 8px on phones, 56/64px → 16px on larger screens (`member-home.css`). The footer, `main` and the tab bar clearance already provide the gap.
- My Business: no marketing footer; dock clearance is one rule (`.bw` 84px + safe area); the duplicate hub and filler box are gone. A Data Store Overview at 390px went from 3,114px (with footer) to 1,774px.
- Builder: owner strip replaces the large owner card; page padding and section gaps slightly reduced.
- Tablets (640–1023px): dock items keep phone-sized widths centred instead of stretching.

## Editor

Not redesigned. Only: the main button reads "Up to date" (disabled) when the site is published, every change is saved and nothing differs from the live snapshot (`p.published && !p.liveBehind && p.status==='saved'`); any edit makes it "Update Live" again. Publication itself, its handler and server checks are unchanged.

## V7.2.2 hero artwork

Nothing here touches `content.heroImage`, palettes or the Design panel. Points for that release: palette-matched defaults should be resolved at render time from the palette family whenever the saved hero is the starter artwork, not written into `heroImage` (which would make "custom" indistinguishable from "default" and break the never-overwrite rule); "no artwork" needs an explicit saved value distinct from "unset"; Compact intentionally shows no banner; the Overview website card and the Builder strip show no hero, so no navigation change is needed when the artwork arrives.

## Verification

- `npx tsc --noEmit`: passed. `npm run build`: passed. `git diff --check`: clean.
- Full regression (LF checkout): **2,904 tests; 2,866 passed, 0 failed, 38 skipped**; the V7.2 review recorded 2,894 / 2,856 / 0 / 38 on main, and this change adds 10 tests. Five existing tests encoded the replaced design and were updated (old "Continue editing" card, `data-business-mode`, the V7.2 dock source shape, an always-on share kit, funnel labels now read from Analytics as well). New `businessWorkspaceV721.test.ts`: 10 tests.
- Browser (Playwright, installed Chrome, local in-memory server, synthetic accounts, no payment or supplier keys): 142/142 checks. Both owners at 320/360/390/430/768/1024/1280 (one navigation system, no overflow, 44px targets, content clears the dock); Data Store journey (Website tab → Overview → Orders → Pricing → Earnings → More, phone Back and Escape on More, More → Analytics and Back, refresh, Edit → "Up to date" → draft change → "Update Live" → Undo → back to the same area, Mystery Hub crumb, Back into My Business, account); Builder entry (bare address, gallery, design link, Explore designs from settings and Back); non-store owner at 390 and 1280 (no store areas or figures, editor in and out, Analytics); new user (gallery, no-website screen, create from a design link, editor, My Business, Back without a loop); sign-out in another tab; failed business load; keyboard order and breadcrumb semantics with reduced motion.
- Not observed: a physical Android device, its gesture bar and keyboard; live bundles with managed checkout (the local server has no wholesale catalogue, and configuring one would query the supplier).
