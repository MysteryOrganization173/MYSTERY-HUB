# Website Builder V7.3, Release C: Promotion Kit V1 (Data Stores)

Base: `84ec60482a8d5341e4538f4aa6e4fe8dd4482f56` (main). Independent of Release A. Frontend only: no server, schema, API, Paystack, supplier, pricing, Store Earnings, withdrawal, refund, reconciliation or publication change, and no new dependency.

## What it is

A **Promote your business** area in My Business (`/my-business/promote`) for Data Stores. It opens from More (the dock stays Overview · Orders · Pricing · Earnings · More), from the sidebar on desktop, and from "Make a picture advert" on the Overview's share kit. It is not a second dashboard.

The owner picks one of six designs, a size, a colour treatment and a message, sees the advert, and can:
- download one PNG;
- share the picture where the phone supports sharing files;
- copy a ready-made caption;
- copy the store link.

| Design | Job | Uses prices |
| --- | --- | --- |
| Store launch | Announce the store is open; name set large over a glow | No |
| Price list | Up to five (Status) or three (Square) real bundles for one network | Yes |
| Networks | A tile per network on sale with its real starting price | Yes |
| Featured bundle | One bundle the owner chooses, as a large ticket | Yes |
| Brand | Logo or initials, name and tagline, no prices | No |
| Straight to store | Three steps (open link, choose, pay with Paystack) and the store card | No |

- **Sizes:**
  - Status: 1080 × 1920, for WhatsApp Status and stories.
  - Square: 1080 × 1080.
  - Landscape is left for later.
- **Colours:** Your colours, Bold (accent background) or Light.
  - Every treatment is checked to keep text, prices and button text readable on all twenty palettes.
  - On a light palette with a dark main colour, cards fall back to a tint of the page, so they never put dark text on a dark card.

## Where the facts come from

- **Saved site content:** name, logo, tagline, colours and the public link.
- **Bundles and prices:** the public storefront endpoint (`GET /api/websites/:id/storefront`). That is exactly what customers can buy now, at the server's retail prices; it never reads the owner's draft prices.
  - Malformed products are dropped.
  - When nothing is on sale, or the check fails, the three price designs are unavailable and an honest note says why.
- **Unpublished store:** the area asks the owner to publish first, because every advert carries the link.
- **Message presets:** fixed, true statements. The owner may write their own headline: up to 48 characters, markup characters removed, with a reminder to only say what is true.
- **What adverts and captions never contain:** discounts, offers, urgency, delivery times, popularity, reviews or sales figures.
- **Captions with prices:** they say the store always shows the current price.

## How it draws

- **Rendering:** Canvas 2D at the export size, so the preview and the PNG are the same pixels.
  - Thumbnails are the same drawing, scaled.
  - Text uses the app's own fonts (Outfit, Plus Jakarta Sans), waits for them to load, and shrinks and wraps to fit.
- **Long links:** a long store link breaks after `/sites/`. It is never hyphenated or cut.
- **Logo:**
  - The logo is loaded with CORS.
  - Cloudinary logos are requested as a bounded PNG (`f_png,w_480,h_480,c_limit`).
  - Cloudinary sends `Access-Control-Allow-Origin: *` (checked live).
  - If a logo can't be read, the advert uses the business initials, and a tainted canvas is redrawn without the logo, so a download never fails.
- **Screen readers:** the preview has a text description (design, headline, bundles, link).

## Extensibility

`promotionKit.ts` keeps business facts, designs, messages, palettes and captions separate from drawing (`promotionCanvas.ts`).
- **Other website types** (restaurants, shops, salons, hotels, services) need their own fact source and design set, using menu or catalogue items, opening hours or WhatsApp.
- **Not included in V1:** cross-industry presets. They would need their own wording and safety review.

## Verification

- `promotionKitV73.test.ts`: 9 tests. They cover:
  - verified bundles only, and that the six designs are distinct;
  - message and caption safety;
  - exact captions and prices;
  - readability of all 20 palettes × 3 treatments, including cards;
  - link breaking, file names and logo source;
  - the area wiring;
  - storefront-only reads with no checkout, payment or new dependency.
- Updated: two Business Workspace tests that listed the areas now include Promote (it opens from More).
- Browser checks used Playwright on installed Chrome, a local in-memory server and synthetic owners. The storefront catalogue was a synthetic fixture served in the browser.
  - 320/360/390/430/768/1024/1280px with no overflow, 44px controls, and the dock unchanged.
  - More → Promote.
  - Every design × both sizes downloaded as single PNGs, with their dimensions checked from the file header.
  - A real Cloudinary image as the logo, with the canvas still exportable.
  - A long business name, no logo and a light palette.
  - No bundles, a failed catalogue check and an unpublished store.
  - Copying the caption and link, and keyboard selection.
- Not covered:
  - a physical Android phone;
  - the system share sheet with files (it only appears on devices that support it);
  - a live supplier catalogue.
