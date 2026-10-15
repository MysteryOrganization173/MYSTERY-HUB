# Website Builder visual editor — Phase 1

Status: implemented for founder UX review. Do not merge or deploy this interface change without that review.

Base: `ae65e855cb5dc8cc517c8c7bb00b4263a82acf63`.
Branch: `feat/builder-tap-to-select-v1`.

## Using the editor

Open Website Builder, choose **Edit Website**, and leave **Edit** selected. The website is the primary canvas. Tap or keyboard-activate an outlined name, heading, image, editable button or contact detail. The selected field opens in a desktop side panel or mobile bottom sheet. Changes immediately update the same draft used by the existing editor. **Done** dismisses the panel and returns focus to the canvas target. Empty canvas space, Deselect and Escape clear selection. Preview removes editing annotations while retaining the current unsaved draft.

**Colors** opens the existing primary/accent/background settings contextually. **All Settings** retains structured business, contact, images, sections, items, social links, main-button and managed Bundles & Pricing controls. Save Draft, explicit Publish/Update Live, Unpublish, View Live, Copy Link and Full Preview remain available. On narrow screens the secondary toolbar scrolls horizontally rather than widening the page.

## Implementation

- `websiteVisualEditing` provides a finite typed target map, existing-validator checks and immutable updates. It never evaluates arbitrary field paths. Composed targets identify an enabled section by stable ID, not array index. An inherited heading/body/image displays its resolved value; editing creates a local section override without changing unrelated global content or sibling sections.
- `VisualEditMarkers` emits semantic attributes and keyboard tab stops only inside the owner Edit context. Individual legacy renderers annotate genuine saved fields; there is no DOM-text scraping or alternate renderer.
- `VisualSelectionSurface` intercepts Edit-mode navigation, auxiliary clicks, keyboard activation and submission, adds selection outlines, and restores target focus. It does not intercept normal published pages.
- `VisualContextPanel` reuses WebsiteImageField/WebsiteImageLibrary and regular controlled inputs. Invalid input displays an error and does not update the draft. Mobile sheets use safe-area spacing, scrolling and visual-viewport resize handling. The fullscreen workspace makes background app controls inert during editing and restores their prior state on exit.
- `WebsiteEditorToolbar` keeps the existing save/publication actions. WebsiteEditor continues to own the sole draft, dirty versions, autosave and publication jobs; there is no new store or schema.
- WebsitePreviewFrame/IsolatedTemplatePreview retain the real iframe and shared WebsiteSiteRenderer. Selection messages require same origin, exact source Window, a per-frame random channel, site ID, template ID, a recognized type and a currently allowed target. Old frame/site/template and unsupported targets are rejected. Listeners are removed on unmount.

Supported visual targets: rendered business name/logo; legacy hero heading, description and image; phone, WhatsApp, email and location; actual editable main-button label and permitted destination; composed section headings, bodies, images and buttons; a contextual route to brand colors. Existing Free, restaurant, salon, construction, property, portfolio, agency, hotel, retail, education, church, fashion, services and Data Business families are covered by the current 14-template registry.

Item arrays, gallery items, ordering, section structure/variants, social links, absent fields and advanced configuration remain under All Settings. Hardcoded decorative text and unsupported controls are deliberately not presented as editable. Managed catalog destinations, supplier/payment configuration, server prices and earnings are never visual targets. Inline rich text, arbitrary HTML and undo/redo remain outside Phase 1.

## Safety

Both owner Edit and Preview render through the existing `preview` commerce contract. Edit additionally intercepts interactive actions. There is no Paystack initialization, customer order lookup, checkout analytics, supplier call or financial ledger mutation from those surfaces. Published ManagedDataStorefront and usePaystack code are unchanged.

Owner APIs, RBAC, signed uploads, asset ownership/finalization and snapshot image retention are unchanged. No authentication token is included in iframe content messages. Published output has no selection annotations or Edit event interception. Current server publication/version comparisons, atomic snapshots, failed-save handling, unpublish/republish and media retention remain authoritative. This release requires no migration or production configuration change.

## Verification

- Initial relevant baseline: 205/205 passing.
- Focused renderer/publication/checkout/visual-editor verification: 231/231 passing, including 26 new visual-editor tests. Existing publishing-label assertion now checks the extracted toolbar and its real publication handler; publication safety assertions are retained.
- Final full isolated regression: 1,787 tests; 1,782 pass, three inherited failures, two optional skips. Exact parent had 1,761 tests; 1,756 pass, the same three failures and two skips. Therefore 26 additional passing tests, no new failures.
- Inherited failures: stale Direct SIM BundleCard copy, stale WebsiteBuilderV1 template expectation, and the existing Free schema-mirror assertion. None was modified to obtain a passing result.
- TypeScript, production build and whitespace diff check pass. Existing build warnings remain.
- Disposable embedded PostgreSQL/PGlite publication tests ran with the existing isolated adapter. The test runner strips inherited external database settings. No external database or provider transaction was used.

Compiled browser acceptance used disposable authenticated in-memory users/sites, the real owner draft/publication routes and static production frontend. Payment/provider mutations were blocked by the local fixture. The asset-library journey used an explicitly authorized synthetic asset response; no live upload or Cloudinary credential was used.

Observed journeys: general-business name and section-heading editing; immediate draft updates; public content unchanged after saving; public update after explicit publication; tapped logo opening the existing library; image choice preserved as draft then intentionally published; keyboard Enter selection and Done returning focus; mode switching; legacy construction heading editing; managed Data heading editing with Buy/lookup blocked in Edit/Preview. Managed preview counters: zero payment, tracking and checkout-analytics requests.

Responsive DOM measurements were recorded at 320×640, 360×780, 390×844, 430×900, 768×900 and 1280×900. Document scroll width equaled client width in all six cases, and panel/input bounds fitted their viewports. The 320×640 case covers a short mobile layout. Representative desktop, mobile canvas, selection and bottom-sheet screenshots are stored outside Git in `C:/Users/AB/Documents/Codex/builder-visual-editor-evidence`.

Limitations: these are responsive in-app browser checks, not physical Android Chrome or iOS certification. A real mobile software keyboard was unavailable; visual-viewport handling is implemented but actual keyboard/device behavior still needs founder acceptance. Later viewport-control changes sometimes did not apply or produced stale compositor screenshots; those captures are not additional verified dimensions. No 320×480 or real touchscreen/keyboard result is claimed. No production site or customer record was edited. No actual payment or fulfilment was performed.

## Founder acceptance and release gate

Review the desktop canvas, the 390px bottom sheet, image choice and the phone keyboard experience on an actual Android device. Confirm that All Settings remains discoverable and the scrollable secondary toolbar is understandable. The branch is ready for this review; production rollout remains gated by founder UX approval. No automatic merge or deployment is authorized by this document.
