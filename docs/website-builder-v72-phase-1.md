# Website Builder V7.2 Phase 1: mobile business workspace, Design mode, styles and palettes

Base: `ae964473a3d19801ade7842ffe849e12411faddb` (V7.1, PR #74). Supplier draft PR #69 is excluded and untouched. Presentation only: no change to Paystack initialization or verification, supplier submission or retries, wholesale or retail price authority, reseller margins, Store Earnings, withdrawals, refunds, reconciliation, idempotency or webhooks. No schema change.

## What was weak, and what already worked

Worked: the dedicated editor page, tap-to-edit, draft saving and recovery, Undo, publish snapshots, the V7.1 style registry with server validation, the managed checkout and the workspace's own addresses (`/my-business/...`).

Weak on phones: the consumer tab bar (Home, Data, Website, Earn, Orders) stayed under My Business, so a customer "Orders" tab sat beside store orders; business areas hid behind an "Overview ▾" menu. In the editor, style switching lived inside a dock button labelled "Look" whose sheet covered half the canvas and mixed four cramped style cards with eight small colour strips. Analytics used native `<progress>` bars per day and an undifferentiated 20-row activity list that repeated "You opened the editor".

## A. Business mode (phones and tablets, < 1024px)

While an owner manages a website, `BusinessWorkspacePage` sets `html[data-business-mode]`; the consumer bar steps aside (CSS) and a business dock takes its place: up to four areas plus **More**. A Data Store gets Overview · Orders · Pricing · Earnings · More (Analytics, Website & settings, Edit website, View live site, Explore designs, **Back to Mystery Hub**). Other websites get Overview · Analytics · Website · More. More is highlighted while showing an area that lives in it. The identity header carries a direct **Edit** button (hidden on the Overview, whose website card already has it).

Dock links are real addresses using the existing in-app `go()` navigation: no reloads; Back, refresh and deep links land on the same area. Leaving with unsaved bundle prices asks first. Sign-in, loading and "no website yet" screens keep the consumer bar. Same 64px height and safe-area padding as the consumer bar, 44px+ targets, reduced-motion respected. Desktop keeps its sidebar unchanged.

## B. Editor: Design mode

The phone dock is now **Edit · Design · Bundles · Preview · More** for Data Stores (All settings moves into More on phones) and **Edit · Design · Settings · Preview · More** for other designs. Desktop's toolbar button reads **Design**. The canvas hint says "Tap any text or photo to change it · Design changes the whole look".

`WebsiteDesignPanel` replaces the old colour/look sheet with three tabs: **Style** (Data Stores), **Colours**, **Fine-tune** (the site's own colour fields). On phones and tablets the panel sits *in the layout* (`[data-design-open]` turns the editor row into a column), so the canvas shrinks above it instead of being covered: at 390×844 the live draft keeps ~396px and the panel ~311px. **More room** grows the panel for browsing; **Less** gives the canvas back. Style cards and palettes are one swipeable row in the compact height and a grid with more room or on desktop. Style sketches are drawn in the draft's own colours. Escape (from anywhere in the editor) or Done returns to the canvas.

Every choice remains an ordinary draft edit: `changeContent({styleVariant})` and `applyPalette` (unchanged) mark the draft dirty, save through the normal autosave, are undoable, and reach the public site only through the existing publish flow. The panel subtitle states "Draft only until you publish"; the toolbar status shows unsaved/saved/live.

## C. Three new Data Store styles

Registry order: Horizon, Market, Studio, **Compact**, **Editorial**, **Signature**, Classic. Shared hero copy, edit markers, catalogue, checkout and help; only composition differs (`storeStyles.ts`, scoped to `[data-store-style=…]`).

- **Compact**: commerce first. Short heading, no banner download, facts as small chips, network tabs stick under the header while scrolling, bundles in one framed price list with hairline rows (two columns on wide screens).
- **Editorial**: magazine spread. System serif display type (no extra font download), a caps rule line, headline beside a framed photo with an italic caption (portrait 4:5 on desktop), underline tabs, numbered bundle rows on hairlines with outline Buy pills, double rules on header and footer.
- **Signature**: brand first. A block in the owner's accent colour carries the logo or initials medallion and the promise, with text in the accent's own readable ink (black or white); the banner sits in an arch above (beside, on desktop). Bundles are tickets: network stub, side notches, perforated price stub.

Compatibility: a store with no saved style still renders Classic exactly (no style attribute or CSS); unknown ids remain rejected server-side (the registry drives `WEBSITE_STYLE_VARIANT_IDS`); no migration.

## D. Colour library

`WEBSITE_PALETTES` keeps the eight existing sets unchanged and adds twelve: Navy and gold, Graphite teal, Steel and cyan, Charcoal copper, Ivory and forest, Monochrome, Slate and coral, Burgundy cream, Sandstone olive, Aubergine gold, Royal indigo, Ocean mint. Each set is grouped (Dark & bold, Light & minimal, Warm, Colourful). Same token model (background, main, accent); the Data Store renderer derives surface, borders and text from them, which is what keeps every style × palette combination readable. Verified for all twenty: button ink on accent ≥ 5.1:1, accent on background ≥ 4.7:1 (new sets), and page text, muted text and card text ≥ 4.5:1 through `resolveStoreTheme`.

## E. Analytics presentation

`BusinessAnalytics` (Analytics area only; the Overview is unchanged) shows the same server figures in four groups: Reach (Views, Visitors), Customer actions, Sales (Checkout starts "Not a payment", Paid, Delivered, Sales) and Store Earnings (Available "Can be withdrawn", Pending "Not withdrawable yet"). The daily chart is a small SVG column chart (busiest day highlighted, accessible summary, collapsible daily table); days between the first and last recorded day with no record show as zero, nothing beyond is extrapolated. Customer activity is grouped by day with back-to-back repeats collapsed and shows eight rows until "Show all". The owner's own builder actions are summarised separately ("Your own visits · 7"), never mixed into customer activity.

Verified backend contract (not changed): the count helper prefixes `website_public_`, so Views and Visitors both use `website_public_site_view` (event count versus distinct visitor IDs). Public visit/contact events are excluded from the separate activity-history projection; its empty state now points owners to the totals rather than claiming no visits occurred. `conversion` divides paid orders by recorded checkout starts and can exceed 100% when starts are missed (the page says so).

## Verification

- TypeScript: passed. Production build: passed.
- Full regression (LF checkout): 2,832 passed, 0 failed, 37 skipped (2,869 total), including the new `builderV72.test.ts` (10 tests). Updated assertions: V7.1 style count, the V1 "no fixed bottom bar" rule (now: exactly one bottom bar, the dock, with the consumer bar hidden in business mode) and the editor harness module list.
- Windows note: with `core.autocrlf=true` and no `.gitattributes`, four inherited source-text tests fail on a CRLF checkout of main as well; check out with `git -c core.autocrlf=false`.
- Browser (Playwright 1.64 driving installed Chrome against a local in-memory server, synthetic account, no Paystack or supplier keys): 57/57 checks. Workspace at 320/360/390/430/768/1024/1280 (dock replaces consumer bar below 1024, sidebar above, no overflow, dock targets ≥ 44px); dock navigation, Back, refresh, More, exit to Mystery Hub; editor at 360 and 390: Design second in the dock, canvas not covered, all seven styles update the draft, palettes apply, Undo restores the previous palette, Escape closes; save → reload keeps Signature; publish → `/sites/…` shows Signature with no owner controls; desktop Design panel.
- Offline style fixtures (real template, example bundles labelled as such) for Compact, Editorial, Signature, Horizon, Market, Studio and Classic × Signal blue, Ivory and forest, Burgundy cream at 320–1280px: no horizontal overflow. Only flag: the footer "Help" link is narrower than 44px in every style including Classic (pre-existing; meets the 24px WCAG 2.2 minimum).
- Not claimed: a real Android device, software keyboard on hardware, or live bundles with managed checkout (the local server has no wholesale catalogue, and configuring one would query the supplier provider).
