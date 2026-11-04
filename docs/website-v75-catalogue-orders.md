# Website Builder V7.5: Business catalogue and WhatsApp ordering

Base: `d55caf4` (main). Night Kitchen, Classic Kitchen, Classic Shop and Boutique.

Frontend only. No server, schema, API, publication-allowlist, payment, supplier, pricing-authorization or Data Store change. Nothing new is stored: the customer's note lives only in their browser and their WhatsApp message.

## What the investigation found

**Already working, so left alone:**
- Adding, renaming, describing, photographing and removing dishes and products.
- The example keep/remove gate before publishing.
- Options, extra photos, groups, saving, reopening and draft/live isolation.
- The publication allowlist (`id, name, price, category, tag, desc, image, images, label, pinned, alt, focal, options`) already carries everything the catalogue uses.
- The four designs already require a working WhatsApp number to publish.

**Confirmed and fixed:**

| Kind | Problem | Fix |
| --- | --- | --- |
| Wording | The editor said "Leave empty to hide the price". Customers actually saw "Price on request" on cards but "Ask for the price" in the sheets. | One rule and one wording. The editor hint shows exactly what customers will see for the value typed. |
| Pricing | A price typed as a bare number ("45") was shown as "45", with no currency. | Bare numbers show as cedis ("GH₵ 45.00"). Anything written in words is shown as typed and never added up. |
| Order message | "2 × Kente · GH₵ 650" read as GH₵650 for both. | "2 × Kente (M) · GH₵ 650 each (GH₵ 1,300.00)". |
| Order message | An unpriced item had no marker, and the known part of a mixed order was dropped silently. | Unpriced items say "price on request". A mixed order says "Listed prices so far: …, plus N items for you to price"; a total appears only when every price is known. |
| Order message | Sums printed "GH₵15180.00". | "GH₵ 15,180.00". |
| Order list | No clear way to remove a line, and 40px quantity buttons. | At one, the minus becomes Remove (bin icon); 44px buttons. |
| Order list | No place for "less pepper" or a delivery area. | An optional note (200 characters, plain text) that goes into the message. |
| Missing contact | The note said "Copy your order", but there was nothing to copy with. | "Copy my order", with a selectable fallback. No number is ever invented. |
| WhatsApp numbers | "24 123 4567" (no leading 0) made a broken wa.me link. Each design built links its own way. | One rule (`whatsappDigits`) for 024…, 24…, +233…, 233… and 00233…. Readiness accepts everything it did before. |
| Groups | Free text, so "Mains " and "Mains" became two look-alike filter tabs. Classic Kitchen built its tabs from different data than its filter. | Groups are trimmed. The editor suggests groups already in use, and Classic Kitchen builds tabs and filters from the same items. |
| Options | Nothing said that a choice doesn't change the price. | The editor and the customer sheet both say so. |
| Visual | Night Kitchen's "EXAMPLE" badge covered the dish name. | The badge sits on the photo corner. |
| Visual | The item sheet cropped portrait clothing photos to 4:3. | A square crop with a height cap. |
| Enquiry | Night Kitchen's group enquiry asked about dishes. | It asks about a table, a group or event, or catering, like Classic Kitchen. |
| Example content | Renaming an example kept the starter photo with no prompt. | The example note asks owners to change the name, price and photo. |

## Verification (local, not CI)

- `websiteV75Orders.test.ts`: 9 tests. They cover:
  - the price rule;
  - mixed, quantity, option and note messages;
  - wa.me encoding and number forms;
  - missing and invalid numbers rendering Copy, never a link;
  - group suggestions;
  - the publication allowlist;
  - older saved catalogues in all four designs.
- Two older tests pinned the previous message text and were updated to the new text (`websiteV5Flagships`, `websiteV73Templates`).
- Playwright on installed Chrome, local in-memory server, synthetic owners:
  - **Owner journey (390px), 16/16:** replace, remove, keep and add dishes; price, options and group; reopen; publish; filter; order from the live site to the owner's number; change a price in the draft (the live site is unchanged), then Update Live.
  - **Customer journeys, 20/20:** mixed-price Boutique order with an option, quantity, note and removal; Night Kitchen quantities and totals; order lists on Shop, Classic Kitchen, Night Kitchen and Boutique at 320 and 1280.
  - **V7.4 template journeys rerun, 96/96.**
- No real WhatsApp message, payment or supplier order was sent.
