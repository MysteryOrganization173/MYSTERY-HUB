# Website Builder visual editor — Phase 2a (Canvas First)

Status: implemented for founder review. Do not merge or deploy without that review.

## What changed for owners

- **One slim top bar.** Back, business name with save status, and Publish/Update Live. On wider screens it also holds Edit/Preview, preview size, Colors, All Settings and a More menu.
- **Bottom dock on phones.** Edit, Colors, Preview, Settings and More, in the layout flow so it never covers the website. More holds Save draft now, Full preview, View live site, Copy link, Unpublish and preview size.
- **Selected element stays visible.** The draft frame scrolls the selected element above the bottom sheet and labels it with a small dark tag. A white ring under the green outline keeps the selection readable on dark, light and green customer themes.
- **Natural keyboard behaviour.** On touch screens the sheet opens without raising the keyboard; typing starts when the owner taps the field. Return closes the keyboard on headings and single-line fields. Long headings use a two-line box.
- **Previous/Next.** The sheet steps through the editable parts of the page in reading order ("5 of 9"), reported by the frame from the rendered page.
- **Clear feedback for other taps.** Tapping visible content without a tap-to-edit field (menu items, galleries, fixed template labels) briefly outlines it and opens a short sheet that explains where it is changed, with an Open All Settings button. Tapping empty space still clears the selection.
- **Plain labels.** Main heading, Short description, Main photo, Main button text, Button link, Logo.
- **Dark editor surfaces.** Toolbar, dock, menus, sheets, inputs and canvas surroundings use layered charcoal and slate with restrained Mystery Hub green, matching the existing All Settings panel. The customer site renders in its own frame and keeps its own colours.

## Unchanged

Draft state, autosave, save/publish/unpublish handlers and their ordering, V1.2 draft/publication isolation, templates and renderers, Cloudinary media library, owner authorization, message identity checks, and payment/supplier/pricing code. Published pages still carry no editor annotations.

## Not in this phase

Undo/redo, item/section manipulation on the canvas, template redesign, typography presets, image replacement flows.

## Messages added

- `MYSTERYHUB_VISUAL_SELECT` may carry `hint: 'settings'` with `targetId: null`. Any other hint value is ignored.
- `MYSTERYHUB_VISUAL_ORDER` carries rendered target ids in document order. It passes the same origin/source/channel/site/template checks; ids are filtered to known non-settings targets, capped at 200.
- `MYSTERYHUB_PREVIEW_CONTENT` carries `reserveBottom` (0–0.7), the share of the frame covered by the sheet.
