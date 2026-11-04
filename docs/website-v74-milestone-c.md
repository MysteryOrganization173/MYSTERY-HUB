# Website Builder V7.4, Milestone C: Data Store artwork, gallery style and one-page navigation

Base: `d09bbba` (main, after Milestones A and B). Frontend only.

No server, schema, API, Paystack, supplier, pricing, eligibility, fulfilment, Store Earnings or publication change. The live site changes only through Update Live.

## Colour-matched default artwork

**What was found.** The founder's twelve coordinated artworks are not in this Cloudinary account. All 175 image assets were searched and the folder listing is empty. They are not on this computer either: the only local copies are low-resolution WhatsApp images, so they were not used.

**What ships instead.** Twelve colour families made from the one founder-approved starter (`Global_Connectivity_Tech_Showcase_w4kgd6`, 1536 × 1024), using Cloudinary hue transformations.
- Composition, subject and the text-free left side stay identical, so every family crops the same way in every style.
- Blue is the starter itself.
- Every URL was checked live and returns HTTP 200.
- **Nothing was invented.** Each URL is a documented transformation of a verified public ID.

| Family | Delivery transform | Palettes |
| --- | --- | --- |
| Blue | none (the starter) | Signal blue |
| Cyan | `e_hue:-6` | Ocean, Steel and cyan |
| Teal | `e_hue:-12` | Graphite teal, Ocean mint |
| Green | `e_hue:-35` | Fresh green, Ivory and forest |
| Lime | `e_hue:-55` | Charcoal lime, Sandstone olive |
| Gold | `e_hue:-85` | Kente gold, Navy and gold |
| Amber | `e_hue:-100` | Ember night, Paper and ink, Charcoal copper |
| Red | `e_hue:85` | Slate and coral, Burgundy cream |
| Berry | `e_hue:70` | Berry |
| Purple | `e_hue:45` | Aubergine gold |
| Indigo | `e_hue:20` | Royal indigo |
| Monochrome | `e_grayscale` | Monochrome |

- **Custom colours** follow the accent's hue; a near-grey accent gets Monochrome.
- **Deterministic and in one file:** `src/utils/dataResellerArtwork.ts`.
- **Swapping in the founder's own twelve artworks** later means changing one `src` per family.

## The reset rules (founder decision)

| State | What happens |
| --- | --- |
| **A: Automatic** | The hero is one of the twelve. Changing colours swaps it for the matching family in the same draft edit, so one Undo restores both. Changing style keeps it. |
| **B: Custom** | An upload, a library pick or the legacy QuickByte banner. Colour and style changes never touch it. |
| **C: Remove** | Removing the photo ("Remove image" in the tap-to-edit panel or All Settings) restores the artwork matching the current colours. The hero is never empty. The draft is marked changed, Undo works, and nothing goes live. |
| **D: Publish** | The draft holds a real, verified URL. The public renderer is unchanged: it shows exactly what was published. |

**Existing sites:**
- Nothing is migrated.
- A saved hero renders exactly as before.
- An owner site with an empty hero keeps the legacy banner it has always shown.
- A store still on the plain starter with different colours sees a "Match the artwork to my colours" button in the editor. Nothing changes until the owner presses it.

**Image-free styles.** Studio and Compact still show no banner.

**Delivery.**
- `getCloudinarySrcSet` chains `f_auto,q_auto,w_N` before the colour transform, so a phone downloads about 20 KB at 480px.
- Eager loading with high fetch priority for the hero, and fixed `width`/`height`.

## Gallery style

All seven styles were reviewed at 390 and 1280. **Market** is the clearest first impression:
- the headline beside a framed photo;
- network tiles;
- readable bundle cards with full-width Buy buttons.

The gallery tells owners "this is how your store starts", so Market is now both the gallery style and the style new stores are created with (`WEBSITE_DEFAULT_STYLE.reseller`). Existing stores keep their saved style; stores with none still render Classic.

## One-page navigation

- Every in-page target inside a published site lands with its heading clear of sticky headers and tab bars (`scroll-margin-top`).
- Smooth scrolling is the app's existing rule, which already turns off for reduced motion.
- **Night Kitchen** now shows its section links on phones too, as a scrollable row of 44px links under the name.
- The table enquiry is a linkable section ("Enquire").
- Links are only drawn for sections that exist, so no link points at missing content.

## Updated tests

- **Market as the default:** `dataStoreV71` (gallery, new store) and `websiteDataStoreV1` (new store).
- **`builderV72`:** its palette regex allows the handler to span lines; it still requires an ordinary undoable draft edit.
