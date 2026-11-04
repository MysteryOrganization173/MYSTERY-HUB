# Website Builder V7.4, Milestone B: Premium restaurant and shop templates

Base: `04b95af` (main). Frontend and template data only.

No server, schema, API, payment, supplier, pricing, Store Earnings or publication change. Existing websites keep the content and images they saved. The new photographs are only the starting point for new websites and the gallery preview.

## What was wrong (seen in real screenshots of main)

**Photos that showed the wrong thing:**

| Labelled as | What the photo showed |
| --- | --- |
| "Grilled tilapia with banku" | dumplings |
| "Light soup with fufu" | a salad bowl |
| "Jollof" | a biryani-style rice |
| Sobolo | a mojito (on the published Night Kitchen it didn't load at all) |
| "Kente occasion set" | striped trousers |
| "Linen kaftan" | knitwear |
| "Statement look" | a portrait with no clothes visible |

The same photographs fed the starter examples every new restaurant or boutique received.

**Night Kitchen:**
- The hero filled more than a whole phone screen before any food appeared.
- The menu was a plain list with thin outlined Add buttons and "Ask" when no price was set.

**Classic Kitchen:**
- The gallery demo used a fixed list of categories.
- The hero photo was dimmed to 45% under a dark gradient.
- On phones the header button wrapped the business name.

**Boutique:** the Add controls in the first row sat underneath the second row's photos and could not be tapped. The browser journey found this.

**Classic Shop:** the ordering note sat in a loud accent bar with a flame icon, and the hero photo was dimmed.

## New starter photography (Cloudinary, `mysteryhub/website-starters/`)

These are generated with Cloudinary's image generation, then reviewed one by one for accuracy:
- the right dish and garment;
- plausible plating;
- no text, people or logos.

They are tagged `website-starter`, `generated-starter` and `v74`, and each has alt text in its context.

| Public ID | Used for |
| --- | --- |
| `food/jollof-grilled-chicken` | Jollof with grilled chicken; Signature party jollof |
| `food/grilled-tilapia-banku` | Grilled tilapia with banku; Char-grilled whole tilapia |
| `food/light-soup-fufu` | Light soup with fufu; Goat light soup |
| `food/sobolo` | Sobolo; Sobolo spritz |
| `restaurant/night-kitchen-hero` | Night Kitchen hero (candlelit spread) |
| `restaurant/classic-kitchen-hero` | Classic Kitchen hero (daylight table, kente runner) |
| `boutique/kente-occasion-set`, `linen-kaftan`, `ankara-statement-dress` | Boutique pieces |
| `boutique/boutique-hero` | Boutique hero and "Ready-to-wear pieces" |

Images are delivered through the existing `SafeImage`:
- Cloudinary `f_auto,q_auto`;
- responsive widths, with `sizes` set so menu thumbnails fetch small widths;
- lazy loading below the fold.

## Design changes

**Night Kitchen** (warm, dark, editorial):
- The hero is about 68% of a phone screen, so the first dishes appear on the first screen.
- Each dish is an elevated card on the palette's surface: a fixed 104px photo crop, a stronger name, a 2-line description and a clear price.
- A filled Add button (44px), or "Choose" when the dish has options.
- "All" groups dishes under category headings. On wide screens the groups flow into two balanced columns like a printed menu card.

**Classic Kitchen** (warm, traditional, serif):
- Categories come from the real dishes.
- The hero photograph shows properly, with a wash only behind the words.
- The header keeps the name on one line and turns the button into a 44px icon on phones.
- Larger photos and a filled Add button.
- The same category grouping, in its own serif style.

**Boutique** (editorial):
- Each piece has a quiet "Add to list" or "Choose options" button inside its card. The layout bug is fixed.
- "Price on request" replaces "Ask for the price".

**Classic Shop** (practical catalogue):
- The ordering note is a calm slate bar with an info icon.
- The hero photo is clear, with a left wash.
- Product photos carry `sizes`.
- "Price on request".

The order list is unchanged: one shared WhatsApp order list, no payment, stock or cart backend.
