# Mystery Creative Studio V2

`/creative-studio` becomes a storefront of fixed-price design packages. Custom work is still quoted.

**Status when merged: draft prices, no payments.**

- `shared/creativeCatalogue.ts` sets `CREATIVE_COMMERCE.pricing = 'draft'` and `payments = 'off'`.
- Every price is labelled as a draft.
- A customer can send an **order request** for a package. Nothing can be paid.
- The founder must approve the catalogue before `pricing` becomes `'approved'`.
- Online payment needs the work in "Checkout: remaining work" first.

## What a customer can do

1. **Hero.**
   - States the offer: "Great design, clearly priced."
   - Shows three Studio Concept pieces on a layered stage, plus a live catalogue offer card (Standard flyer, GH₵99, which opens that package).
   - Facts row: "Packages from GH₵69", "First draft in 2–8 days" and "Changes included 2–3 rounds". All three come from the catalogue.
2. **Catalogue.**
   - 11 packages in four categories: Flyers & print, Social media, Logo & brand, Banners & web.
   - Category tabs stay pinned under the header and their URL is shareable (`?service=logo`).
   - Each card shows the artwork on a quiet mat, the price, a one-line summary, the turnaround and the number of revision rounds.
3. **Package sheet** (`?package=<id>`, works as a shared link).
   - The artwork and its gallery.
   - The price, with a draft label.
   - Turnaround, revision rounds, exact deliverables and files.
   - Optional extras, with a live total.
   - "Good to know": what the customer provides and what is not included.
   - It is a bottom sheet on phones and a two-panel modal from 900px up.
   - Escape, the X, a backdrop tap (details step only) and the phone's Back button all close it.
4. **Order step.**
   - The service questions (from V1), the wording, an optional date, optional example links, and contact details.
   - Going back to change extras keeps everything typed.
5. **Confirmation.**
   - Shown only once the server has stored the request.
   - Shows a reference (`CS-…`), the package, extras and draft total, and "Paid so far: Nothing".
   - Lists the next steps and a WhatsApp link with the reference.
6. **Selected work.**
   - Harmattan Table, Indigo Hour and Lonzero, one at a time, through accessible tabs.
   - Each still says it is a fictional Studio Concept.
   - Each leads to its closest package. The lightbox's "Order something similar" opens the package that piece belongs to.
7. **Custom project.**
   - "Something bigger?" opens the V1 quoted brief (service, questions, budget) in the same sheet (`?brief=custom`).
   - WhatsApp and phone help, and links to the do-it-yourself tools, are in the same section.
8. **Good to know.**
   - Six short answers: revision rounds, when turnaround starts, what to send, how to pay, printing, and whether the samples are real clients.

V1 repeated "quoted per project" and "Request this" in four service cards, four process cards and three explainer boxes. All of that is replaced by the catalogue, one four-step strip and the answers above. Measured page height (Creative Studio content only, without the site header and footer): 10,667 → 6,116 px at 360 px wide (43% shorter), and 6,993 → 5,149 px at 1280 px (26% shorter), while adding 11 priced packages.

## How an order request reaches the team

It uses the V1 path, so nothing new is needed in Admin:

- It is posted to `POST /api/creative-studio/enquiries`, with the same rate limits, retry protection and honeypot.
- The body may add `packageId` and `extras` (ids only).
- The server prices the request with `priceCreativeOrder` from the catalogue. The browser never sends an amount, and an unknown key such as `totalMinor` is refused.
- These are refused:
  - an unknown package or extra;
  - an extra from another package, or the same extra twice;
  - a package from a different service;
  - a budget sent with a package.
- The request is stored as a `creative_studio` Marketplace enquiry:
  - `product_name`: `Creative Studio · <Package> order`.
  - The message starts with the package, extras, total and catalogue version. For example:

    ```
    Creative Studio order request CS-7C1D2E3F
    Service: Flyers & posters
    Package: Standard flyer (GH₵99)
    Extras: Print-ready PDF (+GH₵30)
    Total shown: GH₵129 (draft price, catalogue 2026-11-v2-draft)
    Includes: 2 revision rounds, 2 working days
    …
    Order request: no payment taken. Confirm the package, price and start date with the customer before any work or payment.
    ```

- The reply includes `order.paymentTaken: false`.
- Admin works these in **Admin → Marketplace → Enquiries**, as for V1 briefs.

Nothing in Creative Studio imports or calls Paystack, orders, wallets or fulfilment. A test checks this.

## Draft catalogue

Prices are integer pesewas in `shared/creativeCatalogue.ts`. Change `catalogueVersion` whenever a price, deliverable or extra changes.

The hours are production estimates for the founder to check against real designer cost. They are not market research.

| Package | Draft | Founder draft | First draft | Rounds | Delivered | Est. hours |
| --- | --- | --- | --- | --- | --- | --- |
| Standard flyer | GH₵99 | GH₵99 | 2 days | 2 | 1 design, 1 size, JPG + PNG | 1.5–2.5 |
| Premium flyer | GH₵179 | GH₵179 | 3 days | 3 | 3 formats incl. print PDF, retouch up to 4 photos | 3–4 |
| Menu or price list | GH₵249 | new | 4 days | 3 | 1 page, up to 40 items, print PDF + WhatsApp JPG | 4–6 |
| Single social post | GH₵69 | GH₵69 | 2 days | 2 | 1 graphic, 1 size | 1–1.5 |
| Campaign set of 5 | GH₵299 | GH₵299 | 4 days | 2 (set) | 5 matching posts | 5–7 |
| Logo design | **GH₵399** | GH₵349 | 5 days | 3 | 2 concepts; colour, mono, light/dark; PNG, JPG, SVG, PDF | 6–10 |
| Logo refresh | GH₵249 | new | 3 days | 2 | Redrawn sharp logo, light/dark, vector files | 3–5 |
| Product label | GH₵349 | new | 5 days | 3 | Front + back for 1 product, print PDF | 5–8 |
| Starter brand identity | **GH₵899** | GH₵749 | 8 days | 3 per part | Logo (2 concepts), palette, fonts, 1-page guide, business card, social kit | 14–20 |
| Cover or banner | GH₵129 | GH₵129 | 2 days | 2 | 1 placement | 1.5–2.5 |
| Website hero set | GH₵249 | new | 3 days | 2 | Desktop, mobile and social cover | 3–4 |

### Proposed changes from the founder's draft

- **Logo design GH₵349 → GH₵399.**
  - The package now promises two first concepts and vector files (SVG and PDF). Those are what separate a usable logo from a picture of one.
  - Concept work plus vector finishing is the largest single job after the identity. GH₵349 left little margin over about 8 hours.
- **Starter brand identity GH₵749 → GH₵899.**
  - The parts priced on their own already reach GH₵587: logo GH₵399, business card GH₵89 and social kit GH₵99. The palette, fonts and brand guide come on top.
  - GH₵749 would make the guide almost free. GH₵899 is still a clear saving against ordering the pieces separately.
- **Complex flyer / advanced poster (GH₵299): not listed yet.**
  - There is no poster-quality sample in the library, and a package card must not use a placeholder.
  - Add it at GH₵299 once a real poster sample exists. Use about 6 hours, a line-up of up to 8 photos, 3 sizes and an A2 print file.
- **Added:** Menu or price list, Logo refresh, Product label and Website hero set.
  - Each covers a frequent small-business request.
  - Each has its own real sample artwork.

Extras range from GH₵20 to GH₵150 and are listed per package. They include:

- express delivery;
- an extra size or placement;
- a print-ready PDF;
- an extra revision round;
- Status versions;
- an extra post;
- a business card and a social kit;
- a variant label;
- a letterhead and a launch post.

Rules that apply to every package (shown in the sheet or the answers):

- Turnaround counts working days, Monday to Saturday, from a confirmed order with a complete brief.
- Revisions are always a fixed number of rounds, never unlimited. A round is one consolidated list of changes. Fixing the Studio's own mistakes is always free. A new idea after a direction is approved is new work.
- The customer supplies the wording, photos and logo. Stock images are free-licence only.
- Printing, posting and advert management, trademark searches, barcodes and regulatory approval are not included.

## Founder approvals needed before anything is sold

1. **The catalogue:**
   - packages, prices, deliverables, turnarounds, revision rounds and extras;
   - in particular the two raised prices and the four new packages.
   - Then set `pricing: 'approved'` and bump `catalogueVersion`. The draft labels disappear on their own.
2. **How order requests are paid before online checkout exists.**
   - The page tells customers no payment is taken and that the team confirms the order first.
   - Decide whether order requests:
     - stay as leads until checkout is built, or
     - use an interim payment process that is recorded somewhere auditable.
   - Do not take payment for these requests through personal Mobile Money numbers without such a record.
3. **Refund and cancellation policy** (proposed, not shown anywhere yet):
   - full refund before design starts;
   - 50% after the first draft is delivered;
   - none after final files are delivered;
   - full refund if the Studio misses the turnaround by more than 2 working days.
4. **Who produces the work and how files are delivered** (the page says WhatsApp follow-up and final files).
5. **Additional sample artwork** for the poster package and any new categories.

## Checkout: remaining work (not built)

Paying online must not use a separate payment system, and it must not take money into an untracked workflow. The safe build is:

1. **Data.**
   - A `creative` `service_type` on `orders`.
   - A `creative_orders` table with these columns:
     - `order_id`;
     - `package_id`, `extras`, `catalogue_version` and the price snapshot;
     - `brief` (JSON);
     - `status`: `awaiting_brief → in_production → in_review → revising → delivered → completed`, or `cancelled` / `refund_review`;
     - `revisions_used`, `assigned_to`, `delivery_url`;
     - timestamps.
2. **Checkout.**
   - A Creative Studio checkout route prices the order with `priceCreativeOrder`.
   - It creates the order and the `creative_orders` row in one transaction.
   - It starts payment through the existing `paystackService`, keyed by the request id for idempotency.
   - The existing direct-checkout route must keep refusing `creative` products, as it does for results checkers today.
3. **Verification.**
   - The existing webhook or verify step confirms payment.
   - A `creative` branch in fulfilment moves the order to `awaiting_brief` or `in_production`.
   - **It never marks it delivered.** Paid is not fulfilled.
4. **Admin.**
   - A Creative Studio orders queue: assign, update status, record a revision round, attach the delivery link, complete.
   - Refunds go through the existing refund workflow. Every action is audited.
5. **Customer.**
   - In Orders: a status timeline, a revision request limited to the remaining rounds, and the delivery link.
   - Notifications on status changes, using the existing notification service.
6. **Uploads.**
   - Customer photos and logos need private storage (signed or authenticated Cloudinary uploads) and size and type checks.
   - Until then, files are collected on WhatsApp.
7. **Activation.**
   - Only after 1–6, a real end-to-end test payment and the founder's approval of the refund policy, set `payments: 'live'`.
   - The page copy ("How do I pay?", the notice and the order button) switches from the same flag.

These steps touch shared checkout, fulfilment and finance code. That is why they were kept out of this release, alongside the supplier work in PR #69.

## Assets

- All 18 Studio Concept originals in Cloudinary (`mysteryhub/creative-studio/concepts/*`) are reused. They were checked against the account and none were changed.
- Each package card uses a different piece, shown whole at its own proportions on a coloured mat. Nothing is cropped except the small thumbnails.
- No new artwork is published in this release.
  - Cloudinary image generation for the account was out of credits (50 of 50) during this work.
  - One church harvest flyer was generated in Canva as a candidate (Canva media `MAHaQyS5RII`). It is not exported or uploaded, and it is not referenced by the page.
  - To use new samples: export them, upload them to `mysteryhub/creative-studio/samples/`, then add a `CreativeWork` entry with its versioned URL and alt text.
  - Good first additions: a concert or event poster (which unlocks the poster package), a church programme, a retail sale flyer and a YouTube cover.

## Measurement

Existing events only:

- `page_view` (page `creative`);
- `creative_service`, sent once per category, when a category tab or a package is opened;
- `creative_brief_started`, when an order or custom form is first focused.

Saved order requests are counted in Admin → Marketplace → Enquiries (search "order request").

## Tests

- `server/suppliers/__tests__/creativeStudioV2.test.ts` covers:
  - the draft and payments-off flags;
  - catalogue integrity: real artwork, limited revisions, realistic turnarounds, no unlimited or guarantee claims;
  - server pricing and its refusals;
  - the Admin snapshot and its 2,000-character limit;
  - storage and retries over HTTP;
  - the custom quote path;
  - storefront honesty: draft and no-payment copy, no "Buy now", no invented proof;
  - that no Creative Studio code reaches payments.
- The V1 tests still run. Their quote-only assertions were updated to the V2 policy.
