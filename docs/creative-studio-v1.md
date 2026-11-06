# Mystery Creative Studio V1

A customer-facing page for professional design work, sold on quote: `/creative-studio`.

## What a customer can do

1. Find Creative Studio from:
   - the Marketplace page (a band under the hero);
   - the guest homepage (after the Marketplace section);
   - All Services;
   - the footer;
   - a shared link.
2. Read four services:
   - Flyers & posters
   - Social media graphics
   - Logo & brand identity
   - Banners & web graphics

   Each card shows what it is good for, a "What you can ask for" disclosure, and "Price: quoted for your project".
3. See work samples. These are Mystery Hub's own brand and campaign artwork, labelled "Made for Mystery Hub", with a note that no client work is shown yet. Each sample opens in a full-screen viewer.
4. Send a brief without an account. The form asks:
   - service-specific questions;
   - "what you need";
   - an optional date, budget and up to three example links;
   - name, WhatsApp/phone (required) and email (optional).
5. Get a reference such as `CS-1A2B3C4D`, shown only after the server has stored the brief. The page says what happens next: the team reads the brief, contacts the customer, and quotes before any work starts.
6. Optionally message support on WhatsApp with that reference. This uses the verified support number from `BUSINESS_CONFIG`.

## How a brief reaches the team

- `POST /api/creative-studio/enquiries` (`server/routes/creativeStudioApi.ts`):
  - guests are allowed;
  - rate-limited to 8 per 10 minutes per visitor (first X-Forwarded-For address, because the API runs behind a proxy without `trust proxy`), plus a site-wide ceiling of 120 per 10 minutes;
  - the ordinary Marketplace enquiry route refuses the `creative_studio` type, so leads of that type only come from this form;
  - responses are `no-store`.
- `shared/creativeStudio.ts` validates the brief on both the page and the server:
  - plain text only;
  - unknown keys are refused;
  - a hidden honeypot field catches form bots;
  - Ghana and international phone formats are accepted;
  - links must be http(s) with no credentials;
  - dates run from today to two years ahead;
  - choice answers must be from the list.
- The brief is stored as an ordinary row in the existing `marketplace_inquiries` table:
  - `inquiry_type = 'creative_studio'`;
  - `product_name = 'Creative Studio · <service>'`;
  - `product_id = NULL`;
  - a plain-text summary in `message`, ending with "Quote required".
- No new table, migration or Admin screen. Admin finds briefs in **Admin → Marketplace → Enquiries** (search "Creative Studio" or the reference). There they can:
  - use the WhatsApp, call and email buttons;
  - set status, notes and follow-up dates;
  - see the change history, as for any Marketplace enquiry.
- Retries are safe. The page's request id becomes the enquiry id (`inq_cs_<uuid>`), and `MarketplaceControlStore.createInquiry` inserts with `ON CONFLICT (id) DO NOTHING`.
  - A brief re-sent after a lost reply is acknowledged without creating a second lead.
  - A changed brief gets a new id.
  - The public Marketplace enquiry endpoint does not pass an id and is unchanged.
- In production the brief is acknowledged only when the database is available; otherwise the reply is 503 and the form keeps everything typed.
- No notification is sent. Mystery Hub has no email, SMS or WhatsApp gateway for leads. New briefs appear in Admin's existing new-enquiry counts and alerts.

## Measurement

- `page_view` with page `creative` counts visits.
- `creative_service` counts a service chosen.
- `creative_brief_started` counts a brief started.
- These events appear in Admin → Analytics under "Observed service engagement". A visit or a started brief is not a lead: saved briefs are counted in Admin → Marketplace → Enquiries.

## Not in V1

- Prices
- File uploads (customers are asked to mention files, and the team requests them on WhatsApp)
- Customer self-service tracking of a brief
- Notifications
- Client portfolio
- Online payment
- Any automated or AI design tool

The page states that the team may use AI-assisted tools and that a person checks every design. The founder should confirm this policy.

## Adding real client work later

Add an entry to `src/data/creativeStudioWork.ts` with `owner: 'client'` only after the client has agreed in writing. Use a versioned Cloudinary URL and real alt text. The page labels each piece from `owner`.
