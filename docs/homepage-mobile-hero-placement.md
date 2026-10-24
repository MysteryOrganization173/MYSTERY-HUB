# Mobile homepage hero placement correction

19 October 2026. Founder review only; no merge, deployment or domain/configuration change.

## Starting state and scope

Existing PR: https://github.com/MysteryOrganization173/MYSTERY-HUB/pull/31

Existing branch: `claude/homepage-mobile-hero-final-polish-oc34gr`.

Starting head: `53b5e88a0a4d96df3f43efd5913a6879b4d9eed1` (Claude's latest compact-band correction, following `033c265` and `e41f133`). Current main: `c00b5637deaa23a2eb3cfda4dec5c1729b3a4007`. Main is an ancestor of this branch. The remote source head remained unchanged during implementation/review; this is a normal follow-up commit, not a rewrite. Mystery Earn PR #29 remains at `7731c09d7a7cf0e78ff7d8461018cd4a7e832307` and was not edited.

This follow-up changes only the phone hero CSS, adds responsive assertions to the existing homepage review harness and records this report. Existing template/service/Marketplace/footer/network-selector behavior is preserved. `Hero.tsx` and `cloudinary.ts` are unchanged by this correction, preserving the exact approved asset and Claude's crop/delivery improvements.

## Root cause and correction

The latest implementation still reserved 62% of the image band's height before the copy, then added the eyebrow, headline, description, two stacked 52px actions, availability list and bottom padding. At 390 × 844 that produced a 577.1px hero and a headline starting at viewport y=256.3px. The image still read as a banner preceding a separate text stack. Its steep `137.5svh - 660px` short-screen adjustment reduced the scene to just 110px on 360 × 560.

All runtime changes are inside the existing `max-width: 767px` block:

- Image band becomes `clamp(190px, min(64vw, 34svh), 290px)`. The same scene stays recognizable on short phones instead of collapsing to a 110px strip.
- Copy starts at 40% of that band, sharing its lower region instead of waiting until 62%. No negative margin or JavaScript positioning is used.
- Hero bottom padding drops from 28px to 20px; description margins from 14/20px to 10/14px; availability-list top margin from 18px to 14px. Copy, heading size, CTA order and button dimensions are unchanged.
- The image's opaque mask extends to 78% instead of 62%. The broad top/lower dimming gradient is removed in favor of the existing localized text-side backing and a short bottom-edge fade. This preserves more skyline/Arch brightness rather than darkening the image to hide the overlap.
- A small shadow immediately behind the headline characters supports contrast over the lower scene. No image blur, replacement, distortion or broad new scrim is added.

The source remains `https://res.cloudinary.com/da6oeat7m/image/upload/v1790778037/ChatGPT_Image_Sep_30_2026_02_14_20_PM_baowst.png`. The existing phone crop remains x=669, y=130, width=1003, height=643 with existing responsive candidates. Desktop/tablet source selection and the official logo are untouched.

## Real-image browser evidence

Three compiled frontends were compared locally under identical viewport conditions: current main, the exact starting Claude revision and the correction. They use the real production Navbar/MobileNav/components and actual Cloudinary artwork, with read-only synthetic API responses and all mutations blocked. The public live guest homepage was also captured read-only at 390 × 844, 360 × 640, 360 × 560 and 768 × 1024; its measured hero/headline/CTA positions matched the corresponding local-main baseline. The gallery uses those actual live screenshots for the four required comparisons. No stand-in, reconstructed crop or generated mockup was used. The candidate remains local; no signed-in production account was changed.

Images were confirmed loaded before final capture. All eight requested sizes were exercised: 360 × 560, 360 × 640, 390 × 700, 390 × 844, 412 × 915, 430 × 932, 768 × 1024 and 1280 × 800. No page overflow or clipped controls were observed. The skyline, Arch, globe/arcs and light trails remain recognizable in the real-image comparisons. At the shortest size the copy begins about 8px lower than Claude's very small-band version, deliberately preserving more scene, while the buttons still move slightly up and remain clear of navigation.

Private evidence is outside Git at `C:\Users\AB\Documents\Codex\homepage-hero-placement-evidence`. Open `comparison.html` for three-way screenshots; `geometry.json` records every measured rectangle for all 24 local cases and `live-geometry.json` records the four live checks. Coordinates below are CSS pixels from the viewport top at scroll zero, including the 65px header. P/S denote complete primary/secondary CTA top–bottom bounds; each remains 52px tall.

### Required comparison measurements

- **390 × 844:** main: hero 586.3, heading 257.5, P 441.3–493.3, S 503.3–555.3. Claude: hero 577.1, heading 256.3, P 440.1–492.1, S 502.1–554.1. Correction: hero 500.2, heading 201.3, P 375.2–427.2, S 437.2–489.2. Saves **76.9px** against Claude. Next section begins at y=565.2 instead of 642.1; bottom nav begins at 783.0.
- **360 × 640:** main: hero 555.4, heading 229.5, P 410.4–462.4, S 472.4–524.4. Claude: hero 555.8, heading 237.9, P 418.8–470.8, S 480.8–532.8. Correction: hero 484.4, heading 188.5, P 359.4–411.4, S 421.4–473.4. Saves **71.4px** against Claude; secondary CTA clears navigation by **105.6px**.
- **360 × 560:** main: hero 555.4, heading 229.5, P 410.4–462.4, S 472.4–524.4 (partly behind navigation at y=499). Claude: hero 487.6, heading 169.7, P 350.6–402.6, S 412.6–464.6. Correction: hero 473.5, heading 177.7, P 348.5–400.5, S 410.5–462.5. Saves **14.0px** against Claude while increasing the visible image band from 110px to 190.4px; both full buttons clear navigation by **36.5px**.
- **768 × 1024:** Claude and correction are unchanged: hero 472.4, heading 165.0, both CTAs at 379.9–431.9 on one row. The Arch stays visible. Main's earlier composition has a 499.9px hero; Claude's tablet improvement is preserved.

Other sizes against Claude: 390 × 700 saves 81.6px; 412 × 915 saves 80.0px; 430 × 932 saves 82.5px. The 1280 × 800 desktop remains unchanged at hero 493.1px, heading 165.0px and both CTAs 400.6–452.6px. Tablet and desktop screenshot files matched byte-for-byte after stable-image capture. Runtime CSS changes cannot apply at 768px or above.

## Behavior and verification

The existing hero headline and both CTA labels/priorities remain exact. Keyboard traversal moves from Create a Free Website to Buy Data with a visible focus outline. Keyboard activation still navigates to `/website-builder` and `/data`. A separate local synthetic member fixture renders the existing account overview with zero marketing-hero elements; no real login, customer account or authentication change was used.

Added repeatable assertions in `scripts/reviewHomepage.py` cover all eight viewports, 52px buttons, at least 24px clearance above phone navigation, a minimum 190px scene, the 390px compact-height/headline limits and single-row tablet/desktop CTAs. These exact conditions passed against the compiled pages through the available browser tool. The standalone Python/Chromium review runner was not executed; its Python syntax was validated with the bundled runtime. It remains optional existing tooling, with no dependency installation.

Final focused homepage/copy/member routing tests: **20 passed, 0 failed, 0 skipped**. Full database-isolated regression: **2189 total, 2162 passed, 0 failed, 27 existing optional skips**. No inherited failure is waived. TypeScript, production build and diff validation passed. Existing non-blocking build warnings remain. No application server, external database, payment initialization or supplier operation was used for visual review.

## Limitations and handoff

Screenshots use CSS-pixel browser viewports, not a physical Android handset. Real browser chrome, safe-area insets, font scaling and dynamic address-bar behavior still need founder device acceptance. Live public-page access was verified, but no Render revision/deployment audit or DNS inspection/mutation is part of this task. The actual artwork loaded successfully, so the correction has real-image visual evidence rather than only arithmetic or build results.

Review the three-way comparisons, especially 390 × 844 and 360 × 560. This branch is for founder review only. No merge or deployment; no service-tile, network-selector, catalogue, showcase, footer, Earn, auth, financial, supplier, Admin, database or production configuration change was made in this follow-up.

## Homepage V3 phone composition (24 October 2026)

Supersedes the image band above. Phones now use one poster-style scene instead of a band followed by copy:

- `PHONE_REGION` is the artwork's right 60% at full height (x 669, y 0, 1003 × 941). The scene box is `--hero-art-w` wide (118vw, or 100vw on screens 680px tall or less) and 0.938 of that tall, anchored right, so the dark sea on the crop's left falls off-canvas.
- The headline opens the page over the dark sky (globe and Wi-Fi arcs). The skyline, Independence Arch and light trails show through a window between headline and description (`--hero-window`, derived from the scene width and headline size). The description, actions and availability list sit over the light trails, which dissolve into the page.
- Shading is local only: a short top fade under the header and two soft radial shades behind the headline and description. The skyline window is not darkened.
- If the image fails, `home-hero-no-art` sets the window to zero, so no empty block remains.
- Tablet (768–1023px) and desktop are unchanged.
