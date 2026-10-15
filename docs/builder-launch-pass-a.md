# Website Builder launch readiness, Pass A

Branch `claude/builder-launch-pass-a-pbsz1p`, based on `main` at `90c7c47` (verified). Not merged, not deployed. Frontend only: no server, database, payment, pricing, supplier or slug changes.

## Problems and root causes

| Founder report | Root cause | Fix |
| --- | --- | --- |
| Data site ends with a dark footer, then a white contact block repeating logo, details and a button | `renderTemplateLayout` appended `SiteContactDetails` after **every** legacy template, below the template's own footer, in the site background colour. Legacy footers only printed one plain-text contact line, so the block existed to expose phone, email, WhatsApp and social links. Affected all 13 legacy templates, not only Data. | New `SiteFooterContact` renders the saved phone (tap to call), WhatsApp, email and social links *inside* each template's own footer, inheriting its colours and keeping the visual-edit markers. The appended section is removed. Logo stays in each header; the main button keeps its saved destination. |
| Hero artwork disappears on phones | Data hero: below 640px the image sat at 45% opacity under a 95% surface gradient, and the text block has a solid background, so almost no pixels of the image reached the screen. | Phones show the owner's artwork as its own 16:9 band at the top of the hero card; wider screens keep the blended backdrop. |
| Compressed mobile type, controls and nested previews | All Settings inputs were 12px (`text-xs`); phones edited a 375px page scaled down onto 360px screens; choosing Tablet/Desktop on a phone shrank the *editing* canvas to ~28%. | All Settings type and controls now match the canvas sheet (16px fields, 48px targets, 13px help text). On phones the edit canvas renders 1:1 at the screen's width; Tablet/Desktop on a phone switch to Preview and are labelled "scaled to fit". |
| All Settings disconnected from Canvas First | Native `<select>` section picker on phones, bright green tab pills on desktop, Tailwind slate styling unrelated to the editor tokens. | One scrollable section row at every width in the editor's chip style, a "Back to canvas" header, and scoped styles that bring the existing forms onto the editor tokens. Form logic is untouched. |
| Long, awkward design-switch confirmation on phones | A centred modal with stacked lists, a 45dvh live preview and the confirm button at the very end of the scroll. | A bottom sheet on phones (dialog on desktop): question and one-line draft-only promise in the header, a fixed-height preview of the owner's details in the new design, two compact "Comes with you / Starts fresh" cards, and pinned Cancel / Switch design actions. Same migration and API call. |
| Exiting lands near the bottom of the Mystery Hub page | The editor replaces the builder page with a fixed overlay, so the document collapses to header + footer and the browser keeps (or clamps) the old scroll offset. On close the page re-grows under that offset. | On leaving the editor the builder returns to the top of the website card (or to Bundles & Pricing when the owner chose that), and focus moves to the site name. |
| Dashboard, gallery, editor and settings feel like different products | Inconsistent buttons, raw URL text, native "Manage" picker. | Website card redesigned: status pill, address chip with copy, full-width Edit website, View site + Share (native share sheet on phones, copy elsewhere), quieter Unpublish. Dashboard areas use the same chip row as All Settings. |

## Verification

- `npx tsc --noEmit`: pass. `npm run build`: pass (existing chunk-size warning only).
- `npm test`: 1,805 tests, 1,799 pass, 2 fail, 4 skipped. Main: 1,789 / 1,783 / 2 / 4. The 16 new tests (`websiteBuilderPassA.test.ts`) pass. Inherited failures, identical on main: "Mystery Hub Mobile Bundle Card Compression Verification" and `websiteBuilderV1.test.ts`.
- One existing assertion changed: `websiteFreeV1` "legacy layouts render saved contacts…" looked for the saved CTA URL in the markup, which only the removed duplicate block printed. It now asserts the main button resolves to that URL (the button navigates on tap, as before).
- Browser journey (Playwright, Chromium touch emulation, in-memory server): Data, Makola Mart (light), Lens Creative (dark) and Glow Salon at 360, 390, 768 and 1280px. Branch 56/56; main 35/56 on the same script. Covers duplicate contact, hero visibility from real pixels, no horizontal overflow, tap without keyboard, All Settings type size and navigation, preview, exit position, design-switch actions visible without scrolling, customer theme kept inside the editor frame, and draft-until-publish isolation on the public API.
- Image hosts are blocked in the sandbox, so screenshots use a stand-in photo and logo routed in place of Cloudinary and Unsplash.

## Not verified here

- Real Android: keyboard opening only on field tap, sheet above Gboard, scroll-into-view (carried over from Phase 2a), and the native share sheet.
- Template gallery "Preview" modal and Start Blank were not restyled in this pass.

## Follow-up: non-Data templates and content editing (recommendation for Release B)

Ordered by owner impact per unit of work.

1. **Make existing item editing reachable (frontend, reuse).** `WebsiteTemplateItemsControl` already edits menu items, products, rooms, services and portfolio pieces with images and prices, per-template field lists in `websiteTemplateItemFields`. It is buried under All Settings → Sections, below an "Enable Custom Sections Layout" button. Give it its own "Menu / Products / Services" area named per template and let a canvas tap on an item open it. No backend change.
2. **Remove the Sections trap on legacy templates (frontend).** "Enable Custom Sections Layout" swaps a hand-designed legacy template for the generic section renderer. Owners will press it expecting more control and lose their design. Hide it for legacy templates or explain the consequence before it runs.
3. **Editable fixed template text (needs a content-model decision; Codex task).** Section titles and footer labels ("Explore our menu", "Trending Hardware & Gadgets", "Showroom Address") are hardcoded in each `*TemplateView.tsx`. Making them editable needs a small, versioned `labels` map in `SiteContent`, validated in `websiteValidation`, carried into publish snapshots and the template migration. Frontend rendering can reuse the visual-edit markers once the field exists.
4. **Statistics, features and testimonials (Codex task).** `stats` and `features` exist in `SiteContent` but have no editor and are reset on design switch; testimonials have no field. Needs validation rules that keep the "no fake stats or testimonials" policy (owner-entered only, never pre-filled).
5. **Gallery images per template (mostly frontend).** Cloudinary upload and the media library (`WebsiteImageField`, `WebsiteImageLibrary`) are reusable; legacy templates read gallery imagery from template defaults. An `images` list in content would need validation and snapshot support (small Codex task).
6. **Ghanaian template photography.** Default heroes are Unsplash URLs in `src/data/templates.ts`; replace with licensed Ghanaian photography on the existing Cloudinary account.
7. **Style presets** (fonts, radius): `SiteSettings.fontFamily` and `borderRadius` exist but no template reads them. Wiring presets is frontend work per template; pick 3 presets rather than free controls.
