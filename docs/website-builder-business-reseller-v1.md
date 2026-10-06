# Website Builder Business Layer and Managed Data Reseller V1

## Scope and checkpoint base

Built from remote main `e4c01d1148ae4740f468f81b9cf4f90dd62ff7ca` on
`feat/website-builder-business-reseller-v1`. The reviewed Data Purchase polish
commit `1cd8054bf00dd54618ad56cc61ddf9b0cad70a45` was integrated into this feature
branch before implementation. Main was not changed. No new dependencies.

The Free one-project restriction, existing templates/media/publishing/migration,
customer authentication, Paystack integration, provider abstraction and manual
withdrawals remain the foundation. This pass adds business dashboards and managed
Data Reseller commerce. Other templates retain contact-based business websites.

## Owner experience

- Overview, Analytics, Activity, Website and Settings use actual site/event records.
- Data Reseller adds Orders, Bundles & Pricing and Store Earnings.
- Published links, edit, copy, publish/unpublish and deletion retain existing controls.
- Selecting a different template opens the existing migration preview with an
  explicit one-Free-site explanation and confirmation. No silent switch or second
  project. ID, slug, owner, publication, compatible content, branding and media
  survive according to existing migration rules; incompatible layouts/items reset.
- Image fields show thumbnails, Upload Image / Media Library, Replace and Remove.
  The existing signed Cloudinary intent, browser upload and independently verified
  finalization are reused. Progress/errors/retry and authoritative asset limits
  remain in the existing library. External image URL support is secondary.
- Legacy template bundle-price editing is replaced by a link to authoritative
  business pricing. Template/demo item prices cannot control managed payment.

## Managed storefront and economics

The public Data Reseller renderer preserves business branding and uses the current
Mystery Hub Data catalog, BundleCard, delivery guidance, payment hook, order store
and supplier client. Resellers supply no API or Paystack credentials and do not
pre-fund customer orders. There is no paid manual-fulfilment mode.

Three versioned records in existing `finance_config` govern commerce:

1. `store-policy`: enabled, reserve basis points/fixed pesewas, Store withdrawal
   minimum/fee, revision.
2. `store-wholesale`: explicit Admin price/availability per authoritative product,
   revision, actor and timestamp. Enabling requires known current supplier cost
   covered by wholesale.
3. `store:<siteId>`: seller-enabled products and retail prices, revision.

Defaults are **checkout disabled, wholesale unconfigured**. Processing reserve
defaults to zero/unconfigured; enabling requires an explicit nonzero policy.
No Paystack fee assumption or wholesale amount is seeded. This integration's
verified Paystack result does not provide a dependable fee field for accounting,
so V1 uses the explicit central reserve rather than inventing a gateway field.
Reserve is a configured allowance, not a claim about actual gateway fees; Admin
must choose and periodically reconcile an adequate allowance.

All stored money is integer pesewas. Existing half-up basis-point helpers apply:

`reserve = rounded(retail × reserveBps / 10000) + fixedReserve`

`earning = retail − wholesale − reserve`

The online floor is the smallest integer retail for which earning is nonnegative.
Seller UI shows cost, floor, authoritative current platform retail for reference,
selling price and estimate at the typed price. Seller may charge above the floor.
Save-all uses expected revision; disabled/unconfigured products are not saleable.

## Payment and fulfilment

1. Customer selects network/bundle, recipient and receipt email, reviews the total.
2. Server accepts only product, recipient, canonical `customerEmail` and request ID.
   Owner/site price/purpose/referral/payment method/amount cannot be supplied as
   trusted financial inputs.
3. Server checks published Data Reseller site, current catalog/preflight/cost and
   current policy/wholesale/seller price under financial/config/site locks.
4. Order and checkout latch commit in one transaction. `orders.store_context`
   snapshots channel, site/owner/product, retail, wholesale, reserve, earning,
   supplier cost, GHS and all config revisions. SQL prevents later snapshot edits.
5. Server initializes existing Paystack merchant after commit, using exact order
   total and receipt email, with purpose/store/order/product metadata.
6. Browser checks initialized amount against its displayed total before opening
   payment. A stale displayed price blocks the popup and requires refreshed review.
   The created reference is retained, including uncertain initialization.
7. Existing signed webhook/server verification checks successful payment,
   reference, exact amount, GHS and purpose/store/order/product identity.
   A browser callback alone never releases earnings or dispatches a supplier order.
8. Verified payment creates pending Store Earnings and atomically claims paid →
   queued. Review-held orders cannot dispatch. Current supplier cost is checked
   again against the snapshotted wholesale; unknown or higher cost holds review.
9. Uncertainty is persisted **before** supplier POST. A crash, timeout, missing ID
   or ambiguous 5xx cannot cause blind resubmission/refund/spendable earning.
10. Supplier public ID is persisted before secondary state writes. Known-ID
    uncertainty recovers via authenticated supplier GET. Existing normal Data
    uncertain orders without the newer review flag remain pollable.
11. Confirmed supplier delivery makes the earning available exactly once.
    Definitive failure follows existing refund/review handling; no success credit.
12. The existing reconciler repairs missing financial effects, recovers known-ID
    status, and dispatches only unclaimed paid orders. Queued ambiguous POSTs are
    never automatically purchased again. Without an ID, Admin/provider investigation
    is required; merely clearing a review checkbox is not proof of delivery.

Public tracking uses an unguessable public reference scoped to the store ID and
the existing safe customer order projection, including review state. It exposes
no private economics, owner identity, email, supplier ID/response or credentials.
Existing orders can still be tracked after site unpublication/deletion; a matching
historical store reference is required. Owner Orders are recipient-masked and
show historical amount/earning/reserve/wholesale, actual status and review guidance.

## Store Earnings, refunds and withdrawals

Existing finance operations/immutable ledger are extended with `store_checkout`,
`store_sale` and ledger bucket `store`. There is no editable site balance.

- Pending: verified paid sale awaiting confirmed delivery.
- Available: confirmed delivery credit less reservations and compensating reversals.
- Reserved: requested/approved Store withdrawals.
- Withdrawn: manual requests marked paid.
- Lifetime: delivered earning history, retained when later reversed.

Sale uniqueness and owner transactions protect duplicate callback/webhook/status
updates. Store credit never credits Wallet or ordinary Mystery Earn. Store orders
have no ordinary referral attribution, and reward processing explicitly skips
this channel, including owner self-purchase. No extra referral reward is enabled.

Definitive failed/cancelled/refunded orders cancel pending earnings or append
compensating ledger reversals. If already-reserved/paid funds prevent recovery,
the operation is held for Admin reconciliation and financial actions are blocked;
no impossible balance or deleted history. Payout reads lock credited orders and
check durable refund/review truth, protecting delayed reversal-effect races.
Admin may reconcile only a definitive recovered reversal, with confirmation and
reason; unresolved cases prevent clearing account restrictions.

Store withdrawals reuse manual Ghana MoMo review with a distinct source and
versioned policy: initial **GH₵5 minimum / 3% fee**. Request snapshots amount,
fee, net, provider, destination, recipient and policy revision and reserves only
available Store Earnings. Rejection appends a reservation release. Approval and
Mark Paid require expected state; Mark Paid records an actual manual payout
reference and sends no money. Customer history masks destination. Admin Financial
Control Room displays source and the corresponding earnings, not referral funds.
Store revenue remains accessible after template migration or site replacement
through the owner's financial account; historical site/order snapshots survive.

## Analytics, privacy and operations

Public ingestion accepts only site view, WhatsApp/call/email/explicit primary CTA,
product interaction and checkout-start events with random visitor/session UUIDs.
No URL, contact value, form content, token, fingerprint or payment metadata is
stored. Navigation/network/close/tracking buttons are not generic CTA clicks.
Ingestion is rate-limited; session views deduplicate for 24 hours, other matching
interactions for one minute, with PostgreSQL advisory locking. Unique visitors
count anonymous browser IDs, not identifiable people or a forensic exact total.
Financial records supply paid/delivered/sales values; clients cannot fabricate them.
UTC trends and 7/30/90/all windows start from real events, with no invented backfill.
Conversion compares verified paid orders to observed starts; blocking analytics,
deduplication and missing visits can affect that ratio (including >100%). Analytics
is informational and never controls money. Activity combines recorded site and
financial events without exposing checkout PII.

Admin Website Builder includes confirmed/stale-revision protected policy and
wholesale controls, site business metrics, masked orders, immutable economic
revisions, ledger and reversal reconciliation. Existing Admin Orders supplies
provider investigation/status refresh; finance supplies payout approval/rejection.
Owner/site ID comes from authenticated ownership checks; Admin routes require
server RBAC. Public sites never receive a supplier credential or private catalog.

## Schema and deployment

`websiteBusinessSchema.ts` and appended `schema.sql` agree. Repeatable application
initialization adds nullable order JSONB, site-order index, sale-order unique index,
snapshot immutability trigger, and extends existing finance kind/bucket checks.
No existing order/reward/hash/media rewrite or manual production migration was run.
PostgreSQL bindings/transactions were tested with the pool fully mocked, not with
a live database. Deployment must use the existing normal schema initialization;
review staging PostgreSQL initialization/permissions before financial activation.

**No new environment variables.** Existing `DATABASE_URL`, live
`PAYSTACK_SECRET_KEY`, frontend Paystack setup, supplier configuration/fulfilment
switch and signed webhook configuration remain required. Existing signed
Cloudinary variables and Website Free limits remain authoritative (see the Free
V1 operational document). No environment values, credentials or production config
were changed here. Actual wholesale/reserve policy must be approved/configured by
Admin after deployment; defaults do not activate stores automatically.

## Verification and concrete fixes

- Targeted Website business/media/migration/finance/Marketplace SQL/integrity:
  **410/410 passed**; includes supplier timeout/5xx/missing-ID/latch failure,
  ID-preserving local-write failure/GET recovery, definitive success/failure,
  payment tampering/races, price floor/revisions, reversal/payout races,
  withdrawal source separation, privacy/ownership/RBAC and schema checks.
- Full isolated regression: **1,034/1,038 passed**. Four failures independently
  reproduce on unchanged base: `memberHomeAuth` Coming Soon expectation,
  two `mobileNavEarnServices` stale Earn expectations, and `websiteBuilderV1`
  aggregate stopping at QuickByte/Ghana Data Express expectation. They were not
  fixed by changing unrelated features. Baseline subset: 13/17 passed.
- TypeScript, production build and diff check passed. Existing Vite native-config
  and large-chunk warnings remain non-blocking.
- Existing signed media tests cover intent/finalization/replay/limits/invalid files/
  ownership/external URLs/reuse/remove; migration tests cover confirmed change,
  content/media/identity preservation, stale revisions and one-site safety.
- Isolated browser journey: upload synthetic hero, choose same library image for
  logo, save/publish, public view/contact click reflected in analytics, confirmed
  template change; customer mocked payment → provider processing → GET delivery →
  GH₵6.60 earning → GH₵5 reservation → Admin queue with GH₵0.15 fee/GH₵4.85 net.
  These amounts were disposable fixtures, not production pricing decisions.
- All specified areas were checked at 360/390/430/768/1024/1280/1440, with no
  document horizontal overflow. Native dialogs, labels, status/error messages,
  disabled busy actions and 44px primary controls are used. This is not a formal
  screen-reader certification.
- Concrete review fixes: scoped customer tracking; manual-review projection;
  excluded navigation from CTA metrics; retained uncertain payment reference;
  stale displayed-price block; supplier cost fail-closed; pre-POST durable review;
  public ID recovery; available/review reversal recovery; preserved normal legacy
  uncertain polling; removed misleading template price controls. Marketplace SQL
  tests were updated for the additional null column and delimited schema section;
  Marketplace product behavior was unchanged.

## Controlled post-deploy smoke plan — NOT executed here

### Harmless / no financial provider mutation

1. Confirm deployed revision and normal schema initialization on approved staging
   PostgreSQL; do not run ad hoc production mutation scripts.
2. With a designated test owner, upload a small non-sensitive PNG as logo/hero,
   observe signed upload and finalized thumbnail, choose/replace/remove from
   library, save/reopen and publish. Confirm existing authoritative limits and no
   credential in responses. Delete only that owner's disposable media through UI.
3. Open its public URL in a fresh browser, refresh repeatedly, use a test contact
   link without sending a message. Verify one anonymous visitor/session view and
   CTA, change period, check draft URL after unpublish is unavailable.
4. Preview a second template, cancel and verify unchanged. Preview/confirm it,
   verify same ID/slug/publication/owner/logo/library and documented reset fields;
   confirm only one Free project exists.
5. Keep store payments disabled while inspecting catalog/costs. In staging Admin,
   enter approved explicit reserve and wholesale for one selected bundle covering
   current supplier cost; save with confirmation. Owner saves below-floor price
   (must fail), safe floor (must pass), higher approved price, disable/re-enable.
   Verify public catalog hides disabled/unconfigured products. Verify a different
   owner cannot read/update it. Never copy fixture prices into production.
6. In isolated/staging mocks only, exercise duplicate callback/webhook, uncertain
   POST without ID, ID/GET recovery, refund and concurrent withdrawal tests.

### Real financial smoke — founder authorization, bounded budget and test recipient required

7. Before enabling any production store, founder approves exact bundle, wholesale,
   conservative reserve, seller retail, merchant, test recipient and maximum total
   spend. Confirm live merchant, sufficient supplier wallet, enabled fulfilment and
   signed Paystack/supplier webhooks. Do not use a real customer's recipient.
8. Enable only that approved bundle/store. Buy **once** through its published URL;
   enter test recipient/receipt email. Verify review total equals Paystack total,
   receipt email and recorded snapshot. Keep both order/payment references. If
   initialization/submission is uncertain, stop; inspect/reconcile the existing
   order and never blindly purchase it again.
9. Confirm server-verified amount/currency/purpose/store/order/product and one
   supplier public ID. Observe customer tracking, owner masked Orders and Admin
   Orders. Confirm pending earning before definitive delivery, then exactly one
   available credit equal to retail − saved wholesale − saved reserve. Verify
   Wallet/referral balances did not receive this store earning. Change current
   seller price and confirm historical snapshot remains unchanged.
10. If available revenue meets the approved minimum, request one bounded test
    withdrawal to founder-approved MoMo destination. Confirm amount/fee/net/masked
    history, separate source, reserved balance and Admin queue. Approve, perform
    the real payout manually only when separately authorized, then Mark Paid with
    its real reference. Never mark paid before actual payment. Alternatively
    reject the test request and verify reservation release. No automated payout.
11. Disable the test bundle or unpublish the disposable storefront after review.
    Retain order/earning/audit history. Do not fabricate a financial refund solely
    for testing; refund races belong in mocks/staging and existing business rules.

## Limits and deferred work

No live payment, supplier order, payout, external PostgreSQL mutation, Cloudinary
production mutation, Render change or deployment occurred. Production economics
and real provider smoke remain founder decisions. A full database outage before
public ID persistence cannot manufacture an ID; durable review/no-retry is the
safe fallback. Gateway initiation uncertainty is retained for investigation, not
blindly reinitialized. Status refresh uses the existing throttle/reconciler.

Anonymous analytics is approximate. All-time analytics reads a site's period rows;
high-volume aggregation/retention is future work. Orders paginate by 25; owner
ledger/withdrawal history currently presents a bounded recent slice. Shared owner
Store Earnings survives site changes, rather than pretending deleted-site revenue
disappears. No scheduled/automated MoMo, customer accounts on generated sites,
generic ecommerce, reseller API keys, custom domains, AI site generation, teams,
Plus/Pro billing, Store → Wallet transfers or subsidized promotions were added.

## Reviewed implementation file manifest

- `docs/website-builder-business-reseller-v1.md`
- `server/db/connection.ts`
- `server/db/financeStore.ts`
- `server/db/ordersStore.ts`
- `server/db/schema.sql`
- `server/db/websiteAnalyticsStore.ts`
- `server/db/websiteBusinessSchema.ts`
- `server/routes/api.ts`
- `server/routes/financeApi.ts`
- `server/routes/websiteApi.ts`
- `server/routes/websiteBusinessApi.ts`
- `server/routes/websiteFreeApi.ts`
- `server/services/financeService.ts`
- `server/services/fulfilmentService.ts`
- `server/services/paymentValidation.ts`
- `server/services/referralService.ts`
- `server/services/websiteBusinessService.ts`
- `server/suppliers/__tests__/marketplaceFlexibilityDatabase.test.ts`
- `server/suppliers/__tests__/websiteBusinessDatabase.test.ts`
- `server/suppliers/__tests__/websiteBusinessV1.test.ts`
- `server/types/orders.ts`
- `shared/storeEconomics.ts`
- `src/components/admin/sections/AdminFinanceSection.tsx`
- `src/components/admin/sections/AdminResellerControls.tsx`
- `src/components/admin/sections/AdminWebsiteBuilderSection.tsx`
- `src/components/website/ManagedDataStorefront.tsx`
- `src/components/website/PublicPublishedSite.tsx`
- `src/components/website/SectionSiteRenderer.tsx`
- `src/components/website/TemplatePreviewModal.tsx`
- `src/components/website/WebsiteBuilderPage.tsx`
- `src/components/website/WebsiteBusinessDashboard.tsx`
- `src/components/website/WebsiteSettingsControls.tsx`
- `src/components/website/editor/WebsiteEditor.tsx`
- `src/components/website/editor/WebsiteImageField.tsx`
- `src/components/website/templates/DataResellerTemplateView.tsx`
- `src/hooks/usePaystack.ts`
- `src/services/websiteBusinessApi.ts`
