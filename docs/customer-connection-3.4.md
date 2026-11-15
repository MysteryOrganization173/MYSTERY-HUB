# Mystery Hub 3.4: customer connection (install, Channel, notifications, footers)

This is the living design record for the 3.4 assignment. Release B is described here; Releases C and D add their sections. The progress log is in `docs/checkpoints/3.4-customer-connection.md`.

## Release B: invitations, install, WhatsApp Channel, footers

### One coordinated system (`src/pwa/invitations.ts`)
Mystery Hub's own suggestions share one coordinator, so they never compete:
- install the app;
- follow the WhatsApp Channel;
- allow notifications (installed-app first use for now; Release C extends this).

Each rule is a pure, tested function.

| Rule | Behaviour |
|---|---|
| On screen | One at a time. The installed app's welcome sheet also claims the screen. |
| Never over | Any dialog, sheet or menu (tracked by the shared overlay stack), checkout, receipt or order status, sign-in, account, password change, the assistant, template preview, Marketplace enquiry or waitlist. |
| Pages | Only calm browsing pages: Home, Data, Services, Marketplace, Creative, About, Help, Earn and Website.<br>Never on Orders (recovery and critical status), Wallet, AFA or Results Checker, `/app`, Admin, the editor or My Business.<br>Never after a Paystack return (`?reference=` / `?trxref=`).<br>Greetings and published business websites never load the app shell, so nothing can appear there. |
| Timing | Only after real engagement: a second page in the visit, about 25 s of active use, or a verified purchase (a `direct_checkout` receipt in `processing` or `delivered`, created within the last hour) once its receipt has been closed. Tracking an older order does not count. Each page must also settle for 2 s, so rapid navigation never triggers one. |
| Frequency | At most one unsolicited invitation per browsing session (kept in `sessionStorage`, so Back and refresh do not show another), and none at all after any dismissal in that session.<br>No two within 12 hours in the same browser, across tabs.<br>An invitation that was shown and ignored rests (install 7 days, Channel 14). |
| Step aside | A dialog opening, a page change or a scroll of 1.5 screens closes it for the rest of the visit, so it never becomes a permanent strip at the bottom of a small phone. |
| Inline cards | The install card inside a page (Home, the member home, the December home) counts as that page's suggestion. Floating invitations stay away while it is visible. Acting on it (Install App, or opening the iPhone steps) uses the visit's one invitation; its "Not now" ends suggestions for the visit. |
| Welcome sheet | It is an account entry, not marketing. It keeps install and Channel invitations out of that visit; first-use notifications may still follow sign-in. |
| Installed-app notifications | A contextual first-use invitation with its own snooze (21 days, two answers). It shares the visit rules: one at a time, never after another invitation or a dismissal in the visit. It is not held back by the marketing 12-hour gap or "seen" rests, so installing from a browser suggestion never blocks the app's first-use card. An unanswered card may return within its visit after a sheet closes. |
| Storage failure | Corrupt or blocked storage reads as "nothing remembered". The session falls back to memory for the life of the page. |

**Accessibility:**
- The card is a labelled `aside`. It never takes focus and has no backdrop.
- A polite status note tells screen readers that a suggestion appeared at the end of the page.
- Escape (with focus inside), "Not now" / "Maybe later" and the Close button all dismiss it. Close acts as the dismissal under its own name.
- Focus returns to the page's main region when the card closes from the keyboard.
- Targets are at least 44 px. Reduced motion removes the entrance animation.
- **Storage:** if session storage stops accepting writes, the in-memory record wins, so a stale stored record can never re-open the visit.

### Install
- **Copy:** "Mystery Hub, one tap away." / "Buy data, track orders and more, right from your home screen." / **Install App** · Not now.
  - Computers read "one click away … right from your desktop", because they have no home screen.
  - iPhone and iPad get **Add to Home Screen** with three short steps.
  - No store buttons.
- **Rules kept:**
  - the 30-day rest after "Not now" (or declining the browser dialog);
  - permanent suppression after the third dismissal;
  - business websites excluded;
  - the `/app` page always available (now also linked as **Get the app** in both footers, outside the installed app).
- **Honest progress:**
  - *Accepted* is shown as "Installing Mystery Hub…" and stored as **pending** (`mh_install_pending_at`). It is never called installed.
  - Only the browser's `appinstalled`, or opening from the home screen (standalone display mode), records a **confirmed** install (`mh_app_installed_at`) and clears the pending mark.
  - A pending install that never completes is offered again after 3 days, if the browser still offers installation.
  - A confirmed install silences automatic suggestions in that browser for 90 days.
  - The install marks are re-read on every render, so one card, `/app` or another tab is honoured by the others.
  - **iPhone and iPad:** closing after reading the Add to Home Screen steps is not counted as a "no", because Safari cannot confirm an install. It rests 30 days instead.
  - Another browser cannot know about an install made elsewhere, and the code does not pretend otherwise. iPhone home-screen apps keep their own storage.
- **In-app browsers:** the WhatsApp, Facebook and Instagram browsers are no longer offered Add to Home Screen, which cannot work there.

### WhatsApp Channel
- **URL:** the official Channel is now `https://whatsapp.com/channel/0029Vb97gokADTOKgN8Nzr0s`. It is one constant in `src/config/business.ts`, used by:
  - the footers;
  - the Marketplace channel block;
  - `socials`;
  - `getWhatsAppChannelUrl()`.
  
  A test checks that the old Channel ID appears in no first-party file. Personal support links (`wa.me/233242836323`) are untouched.
- **Copy:** "Stay in the Mystery. 💚" (the heart is hidden from screen readers) / "Follow our official channel for bundle updates, Friday Drops and special offers." / **Follow Channel** · Maybe later · Already following.
- **Snooze rules:**
  - "Maybe later" (or Close) rests 30 days, then 60. The third time stops automatic invitations.
  - "Already following" stops them in this browser.
- **A click is not a follow:** "Follow Channel" opens WhatsApp in a new tab and records only an outbound click (rest 90 days). Nothing ever says "followed".
- **Storage:** all of this is local, with safe failure. No database or account preference was added for guest popup state.
- **Marketplace:** its channel block no longer says "Ask about available products … on WhatsApp". A one-way Channel cannot answer questions; it now says "Follow our official channel for new arrivals and sourcing updates."

### Footers (normal and December)
The founder's December screenshots were not available to this session. The design follows the existing seasonal footer and its documentation; it makes no claim of fidelity to those screenshots.

| Part | Normal footer | December footer |
|---|---|---|
| Support | A **Contact support** card. WhatsApp support (024 283 6323) leads; SMS 059 206 6298, Call 059 452 1108 and Email follow, each labelled. | The same contact lines inside the **Need help?** card, in festive styling. |
| Community | **Follow Mystery Hub**, a separate group: WhatsApp Channel and Telegram, described as updates and offers, with a pointer back to support for order help. | The same group, placed under the brand. |
| Other content | Services and account navigation, Help & FAQs, About, Get the app, Coming soon, Mobile Money trust, legal and Staff Portal are all kept. | Same, with festive styling. |

Both footers:
- never break a phone number across lines;
- stack SMS and Call on phones narrower than 360 px.

The ordinary footer returns unchanged in structure when the season ends. Neither can reach a customer-published website, which renders outside the app.

### Verification (Release B)
- **Unit:** `customerConnection34.test.ts` covers rules, storage failure, the coordinator, copy, shell placement, the Channel sweep and footer separation. The updated install, footer and seasonal suites pass.
- **Independent review:** 10 findings, all fixed. The fixes:
  - installed-app notifications are no longer blocked by marketing gaps or rests;
  - the welcome-slot race;
  - acting on the inline install card no longer lets a Channel card follow;
  - unanswered notification cards can return within their visit;
  - focus return and a polite announcement;
  - a neutral close after reading the iPhone steps;
  - install marks are re-read;
  - the purchase moment requires a recent order;
  - session storage write failures are handled;
  - shared busy guards and install-mark helpers.
- **Browser:** `scripts/reviewCustomerConnection.cjs` runs locally only, on a production build with a disposable database. Results: 83/83.
  - Covers:
    - first look vs engagement, the polite note and focus return;
    - Install App on the Home card with nothing following it;
    - the Channel (Maybe later, Already following, Follow and its outbound URL, no follow recorded);
    - session cap, refresh and the cross-tab gap;
    - install on a phone (inline card on Home, floating on Data, accept → pending → `appinstalled` → confirmed, decline → rest, no chaining);
    - payment return, Orders and `/app`;
    - sign-in, the phone menu and checkout making a visible invitation step aside for good;
    - seven sizes from 320×568 to 1440×900, above the tab bar, under 45 % of the height, Escape and reduced motion;
    - both footers at seven sizes with one-line numbers;
    - axe-core with no serious or critical issues.
  - The install prompt in that review is **simulated** (Chromium does not let automation open its real dialog), so it proves the product logic, not a device install.
