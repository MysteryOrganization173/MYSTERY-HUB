# Homepage V2: report

Branch `claude/homepage-v2-bl4bst`, based on verified `main` at `95c4fc0`. It is not merged and not deployed. All changes are in the public homepage frontend. There are no server, pricing, payment, auth, supplier, Website Builder or member-home changes.

## What changed and why

| Section | Before | After | Why |
| --- | --- | --- | --- |
| Hero | The art sat at 60% opacity under a 95% gradient, so it was barely visible on phones. The line under the buttons only covered the builder. The description mixed four messages. | Same headline, same two buttons and the same brand. The approved Accra artwork now dissolves into the dark page on every edge using a soft radial mask, with no hard boundary and no separate strip. On desktop it sits to the right of a dark text side. On phones it rises from behind the buttons and fades out before the next section, while the headline stays on the darkest area. A single line lists what is live today (Data & airtime, Free business website, Order tracking). The description is tighter. | Keeps the approved character. The art is clearly visible while the headline and buttons stay dominant, and the first screen states what is actually available. |
| Services | Four tiles in unrelated colours (amber, green, blue, violet). Builder and Marketplace were missing. | One directory of all six live services (Data, Airtime, Website Builder, Mystery Earn, AFA, Marketplace) in one green system with honest status labels: Available, Free plan, Check Status, Enquiry. | Visitors can find any service right after the hero. The colours read as one product. |
| Popular bundles | Four BundleCards, each with its own phone field (about 600px on phones). The welcome offer floated as a separate banner above the section. | One quick-buy panel: a network switch, the welcome offer inside the panel, and four compact rows from the Data page's existing `CompactBundleRow`, opening the same checkout. "View all" now carries the chosen network. | The purchase path is easier to scan. Checkout still asks for and checks the recipient's number. BundleCard is no longer used here, so the separate Data buying UX task owns it freely. |
| Trust | Three columns about 3,000px below the Buy buttons. | Moved next to the bundles as "How buying works": check the total and number, pay with MoMo through Paystack, track your order. | Reassurance appears where people decide to buy. |
| Website Builder | Good copy, but the preview was a small card. | Larger showcase that states the real design count (`{designs.length}`, currently 13), numbered steps, and chips that open real template previews. | The free builder looks like a substantial product. Everything shown is a real template. |
| Marketplace | Two-line headline, a large banner and four category rows (about 1,000px on phones). | A compact band. The banner is hidden on phones (lazy-loaded, so phones don't download it). Categories show as a 2×2 grid. Featured items, loading, error and retry states are unchanged. | Enquiry-only service, so it takes proportionate space. |
| Coming soon | List rows looked like live services. | A dashed panel labelled "Coming Soon · Not available yet" with launch-list chips. Phones show 4, the services page shows all. | Clearly separated from live services. |
| Help + FAQ | Support strip was mid-page and the FAQ came last. | A help card (Track an Order, WhatsApp Support, a never-share-your-PIN note) next to the FAQ. On tablets and phones it stacks above the FAQ. | Support sits where people look for answers. |

Simplified: the rainbow tiles, four duplicate phone fields, a floating offer banner, the Marketplace banner on phones, and a separate trust section. Emphasised: live-service clarity, the quick-buy path and the free builder. Rearranged: trust moved next to buying, and help moved next to the FAQ.

## Page length (full page, px)

| Width | Before | After |
| --- | --- | --- |
| 360 | 7,013 | 6,479 |
| 390 | 6,840 | 6,198 |
| 768 | 4,792 | 5,298 (longer: the service directory and the help card stack at tablet width) |
| 1024 | 4,368 | 4,160 |
| 1280 | 4,430 | 4,066 |
| 1440 | 4,444 | 4,087 |

## Data sources (verified in code)

- Prices come from `useDirectCatalog()`, which fetches `commercial/products`, as before. The homepage source contains no cedi amounts, and `homepageV2.test.ts` asserts this.
- The welcome offer comes from `useWelcomeOffer(DATA_BUNDLES)`, the server quote. It is passed to `WelcomeOfferNotice` and to each row, as before.
- Templates come from `orderedWebsiteTemplates()`. Marketplace items come from `getPublicMarketplaceProducts({ featured: true })`. Coming-soon items come from `DIGITAL_SERVICES` with status `coming_soon`.

## Verification

- `npx tsc --noEmit`: pass. `npm run build`: pass (only the existing chunk-size warning). `git diff --check`: pass.
- `npm test`: 1,822 tests, 1,816 pass, 2 fail, 4 skipped. Main had 1,818 tests, 1,812 pass, and the same 2 failures ("Mystery Hub Mobile Bundle Card Compression Verification" and `websiteBuilderV1.test.ts`), so nothing new fails. All existing homepage source assertions still pass unchanged. There are 4 new tests in `homepageV2.test.ts`.
- `scripts/reviewHomepage.py` (updated to the new composition) passes at 360, 390, 430, 768, 1024 and 1280px. It checks:
  - no horizontal overflow and no offscreen controls;
  - visible images load;
  - the Marketplace banner is not downloaded on phones;
  - header search, and the assistant opening and closing (from the header menu on phones);
  - the 1GB MTN row's Buy control is hit-testable at three scroll offsets and opens "Review your purchase";
  - Create a Free Website, Airtime, Website Builder, Marketplace, AFA and Earn tiles;
  - the template preview from the showcase and from a chip;
  - the AirtelTigo switch, and that "View all" keeps the network;
  - Track an Order, All Services and the coming-soon launch list;
  - the welcome offer hidden when disabled;
  - Marketplace empty, error, retry, featured and enquiry states;
  - no page errors.

  Results are in `review-results.json`.
- One inherited script issue was fixed: the script opened the assistant from a header button that only exists from 768px up. Phones open it from the header menu, so the old script failed at 360px on main as well.
- Accessibility:
  - Service tiles and chips are real `<button>`s with text names.
  - The network switch uses `aria-pressed` inside a labelled group.
  - Headings no longer sit inside buttons (they did before).
  - Focus uses the global `:focus-visible` ring.
  - Touch targets are 40px or more.
  - Reduced-motion is respected (the only motion is 150ms arrow nudges and colour transitions).

## Limits

- **Screenshots use stand-in images.** The sandbox cannot reach `res.cloudinary.com` or the live site, so the hero art, logo, Marketplace banner and template photos in the screenshots are labelled stand-ins. Code paths and URLs are unchanged.
- **API responses are synthetic.** Catalogue prices come from `src/data/bundles.ts`, and the offer is a guest GH₵1.00 offer. No backend was called.
- **Not checked here:** a real Android device, a screen reader, and live production offer and catalogue values.

## Not changed / follow-ups

- No changes to BundleCard, CompactBundleRow, Navbar, Footer, MobileNav, MemberHome, the checkout or any Website Builder file.
- Member home opportunity (not done, per brief): the logged-in dashboard could reuse the quick-buy panel and the service directory for consistency.
- The footer's "Coming soon" column duplicates the homepage strip. It could be trimmed in a later shared-chrome pass.

## Evidence

- Paired before/after images: `*-full-before-after.jpg` (whole page) and `*-top-before-after.jpg` (first screen) for widths 360, 390, 768, 1024, 1280 and 1440.
- Raw captures are in `raw/`.
