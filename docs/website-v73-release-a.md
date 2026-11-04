# Website Builder V7.3, Release A: working Classic Kitchen and Classic Shop, Data Store catalogue personalities

Base: `84ec60482a8d5341e4538f4aa6e4fe8dd4482f56` (main, V7.2.1 merged through PR #78). Frontend presentation only: no server, schema, API, Paystack, supplier, pricing, Store Earnings, withdrawal, refund, reconciliation or publication change. Releases B (palette-matched hero artwork) and C (Promotion Kit) are separate.

## What was there

- The WhatsApp order list (`websiteOrderList.ts`, `storefront/OrderList.tsx`) already powered Night Kitchen and Boutique: item sheet, options, quantities, an honest total only when every price is plain, a WhatsApp message in the buyer's voice, a "Contact the business" fallback, and nothing stored or paid.
- Classic Kitchen showed a menu with no way to order; its only action was a table-enquiry form whose "Ask about" list was the dishes.
- Classic Shop's buttons said "Enquire" and only opened the contact target. Websites created before starter versions showed five stars and "(48)" reviews on every product, and the gallery demo ran a fake cart counter. Its gallery card promised "Instant WhatsApp Cart Checkout", "12-Month Official Warranty Badges" and "Same-Day Dispatch Tracking".
- All seven Data Store styles rendered bundles with one component; only Market laid them out as a grid. Horizon, Studio and Signature were variations of the same horizontal row. The gallery preview showed rows without the Buy button live stores have.
- Server validation and publication already accept `options` and extra photos on every item, so no server change was needed.

## Classic Kitchen

- Each dish opens its sheet (photos, price, choices, a preview of the WhatsApp message). "Add" puts a plain dish straight on the list and opens the sheet first for a dish with choices. The pinned order bar shows the count and the listed total; the list sheet changes quantities, removes lines, clears, and sends one WhatsApp message.
- Table enquiries stay separate: the form asks about "a table", "a group or event" or "catering", with an optional date and party size, and still says any booking must be confirmed by the restaurant. The demo no longer says "Reserve Table" or "Reservations".
- Identity kept: serif headings, wine and gold, centred category pills, image-left cards. Long dish names wrap inside the card; every button is at least 40px tall and the dish tap area at least 44px.

## Classic Shop

- Product shelves: two products per row on phones, three on tablets, four on desktop, each with a contained photo, the name, the owner's price ("Ask for the price" when empty), its options and one clear action ("Add", or "Choose" when there are options).
- The header bag opens the order list and counts real items. The fake stars, review count, cart counter and "Checkout" label are gone, on old and new websites alike.
- Distinct from Boutique: Boutique keeps its editorial collage and full-bleed portrait photos; Classic Shop keeps its bright retail header, trust strip and product photos on a neutral well.

## Owner editing

Classic Kitchen and Classic Shop items now get the same "Options" and "More photos" fields as Night Kitchen and Boutique (`WebsiteItemPanel`). Owner's picks stay Night Kitchen only. Edits go through the existing draft and publish flow and Cloudinary upload field.

## Data Store catalogue personalities

One `BundleRow`, one checkout, one product list from the server. Only CSS composition changes by style:

| Style | Catalogue |
| --- | --- |
| Horizon | Roomy cards that glow in the network's colour; the owner's first featured bundle leads across the row |
| Market | Price tags in a shop grid (unchanged) |
| Studio | A type specimen: large tabular numerals in a hairline grid with a network dot |
| Signature | Upright tickets: network band, side notches at a dashed perforation, price stub |
| Compact | Dense framed price list (unchanged) |
| Editorial | Numbered serif list (unchanged) |
| Classic | The original rows (unchanged) |

Card styles show two bundles per row on phones, three or four on wider screens, and one per row below 340px. `BundleRow` gains an `is-featured` class (presentation only) and an `example` flag; the gallery now shows the same Buy layout as a live store and announces each bundle as "Example: …".

## Smaller changes

- Signed-out My Business: "My Business is where you edit and publish your website, see visitors and customer activity, and, for a Data Store, manage orders, prices and Store Earnings." The page description changed to match.
- Gallery copy for both designs now describes what they do; example tags no longer advertise discounts or best-sellers.

## Verification

- `websiteV73Templates.test.ts`: 9 tests (both designs on owner and gallery renders, the exact multi-item message, enquiry topics, editor fields, style CSS, one checkout, signed-out copy).
- Browser (Playwright on installed Chrome, local in-memory server, synthetic owners, WhatsApp links read but blocked, Data Store catalogue served as a synthetic fixture in the browser, checkout opened but never paid): Classic Kitchen and Classic Shop at 320/360/390/430/768/1024/1280; full order journeys with options, quantities, removal, clear, "Ask"/"From" prices and refresh; the table enquiry message; all seven Data Store styles at every width, each opening the same checkout sheet; the owner editor's Options field.
- Not covered locally: a live supplier catalogue (configuring wholesale prices calls the supplier), a physical Android device.
