# Website Builder V7.4, Milestone A: Mobile template preview

Base: `04b95af` (main). Frontend only: no server, schema, API, payment, supplier, pricing or publication change.

## The problem (measured on main, 360 × 780 phone)

The website got 65.5% of the screen. The rest went to:
- a three-line explanation;
- a toolbar;
- a simulated browser bar with traffic lights;
- a padded device frame;
- the name bar.

The site was also drawn at 375px and scaled down to fit a 360px screen. On load, the Back button showed a thick focus ring.

## What changed

**On a phone (under 640px), the preview is the phone.** The website renders edge to edge at the screen's real width, unscaled. The simulated browser bar, the device frame, the canvas padding, the ambient glow and the plans strip are gone.

**One slim top bar:**
- Back (44px);
- the design name;
- one line saying what you're looking at, such as "Example content" or "Example bundles and prices", with an **About** link that opens the full explanation;
- Share.

The explanation is never removed, only folded away.

**One way to use the design.** When the name bar is shown, "Use this design" is the only Use action; the duplicate "USE" in the top bar is gone. Otherwise "Use" stays in the top bar.

**Compact name bar.** It stays at 44px touch targets and respects the bottom safe area. The top bar respects the top safe area.

**Focus.** Focus starts on the design name, not on a ringed button. The shared dialog focus helper now picks the first *visible* `data-autofocus` target, so a phone-only element can't strand desktop keyboard focus.

**Desktop and tablet.** The framed device, browser bar, Desktop/Tablet/Mobile switcher and plans strip are kept. The explanation line is slimmer.

## Measured after (local, Playwright on installed Chrome)

| Screen | Website share before | After |
| --- | --- | --- |
| 360 × 780 | 65.5% | 84.9%, rendered at 360px (was 375 scaled to 344) |
| 390 × 844 | 68.1% | 86.0% |

121/121 browser checks passed:
- 320/360/390/430: share of the screen, real width, no browser bar, focus, 44px controls, About, one Use action, no overflow.
- 768/1024/1280: the switcher renders 375/768/1280, desktop focus starts on the design name.
- All widths: Back closes the preview; the typed name appears; Use this design opens the start step.
