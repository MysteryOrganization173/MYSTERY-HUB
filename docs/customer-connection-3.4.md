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
| Timing | Only after real engagement: a second page in the visit, about 25 s of active use, or a verified purchase (a `direct_checkout` receipt in `processing` or `delivered`, created within the last hour, tolerating a phone clock up to 10 minutes behind the server) once its receipt has been closed. Tracking an older order does not count. Each page must also settle for 2 s, so rapid navigation never triggers one. |
| Frequency | At most one unsolicited invitation per browsing session (kept in `sessionStorage`, so Back and refresh do not show another), and none at all after any dismissal in that session.<br>No two within 12 hours in the same browser, across tabs.<br>An invitation that was shown and ignored rests (install 7 days, Channel 14). |
| Step aside | A dialog opening, a page change or a scroll of 1.5 screens closes it for the rest of the visit, so it never becomes a permanent strip at the bottom of a small phone. |
| Inline cards | The install card inside a page (Home, the member home, the December home) counts as that page's suggestion. Floating invitations stay away while it is visible. Acting on it (Install App, or opening the iPhone steps) uses the visit's one invitation; its "Not now" ends suggestions for the visit. |
| Welcome sheet | It is an account entry, not marketing. It keeps install and Channel invitations out of that visit; first-use notifications may still follow sign-in. |
| Installed-app notifications | A contextual first-use invitation with its own snooze (21 days, two answers). It shares the visit rules: one at a time, never after another invitation or a dismissal in the visit. It is not held back by the marketing 12-hour gap or "seen" rests, so installing from a browser suggestion never blocks the app's first-use card. While a dialog or sheet is open it pauses (stays mounted, hidden), so a brief interruption does not use up its one showing. |
| Storage failure | Corrupt or blocked storage reads as "nothing remembered". The session falls back to memory for the life of the page. |

**Accessibility:**
- The card is a labelled `aside`. It never takes focus and has no backdrop.
- A polite status note tells screen readers that a suggestion appeared at the end of the page.
- Escape (with focus inside), "Not now" / "Maybe later" and the Close button all dismiss it. Close acts as the dismissal under its own name.
- Focus returns to the page's main region when someone answers the card from the keyboard. Automatic closes (a dialog, a page change, a long scroll) leave focus alone.
- Targets are at least 44 px. Reduced motion removes the entrance animation.
- **Storage:** while session storage refuses writes, the in-memory record wins, so a stale stored record can never re-open the visit. Install marks (pending, confirmed, steps read) also live in memory for the page, so blocked storage still hides what it should.

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
- **Second review (verification of the fixes):** 10 findings, all addressed. The fixes:
  - install marks fall back to memory, re-render every card through a version subscription, and refresh across tabs;
  - the welcome slot is tied to the sheet being on screen;
  - the purchase moment tolerates clock skew;
  - focus moves only after explicit answers;
  - the same neutral close after the iPhone steps on both cards;
  - per-store session write failure;
  - the notification card is one per visit but pauses during dialogs;
  - the shared pointer helper.
- **Browser:** `scripts/reviewCustomerConnection.cjs` runs locally only, on a production build with a disposable database. Results: 88/88.
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
    - the installed app (standalone display mode emulated): welcome sheet alone, nothing after it in that visit, no "Get the app", and the Channel (never install) on a later visit;
    - axe-core with no serious or critical issues.
  - The install prompt in that review is **simulated** (Chromium does not let automation open its real dialog), so it proves the product logic, not a device install.

## Release C: notification onboarding, consent, guests and the account notification centre

### One invitation, one decision
- **Copy:** "Stay updated." / "Get order updates, service news and occasional offers." / **Allow Notifications** · Not now, with one quiet line: "You can turn them off anytime."
- **Variants:**
  - members who turned offers off before read "Get updates about your orders on this device.";
  - guests read "Get Mystery Hub service news and occasional offers." (see Guests).
- **Flow:**
  1. The first-party card.
  2. The browser's own permission request (only from the button).
  3. Registration with the server.
  4. The server confirms the device.
  5. One result:
     - "You're all set. Notifications are on for this device.";
     - or "Notifications are blocked." (the browser said no);
     - or "Notifications aren't on yet." (registration or confirmation failed).
- **Closing the browser prompt** without answering changes nothing and rests the invitation. There is no second "offers?" card any more.
- **Coordination:** the card is part of the Release B invitation coordinator.
  - One at a time, calm pages, after engagement, once per visit.
  - It comes first in the installed app (first use after the welcome and sign-in) and for a member right after a verified purchase.
  - Installing comes first elsewhere; the Channel comes last.
  - The coordinator waits for the read-only eligibility check, so a quick Channel card never takes the visit's slot from it.
- **Never offered:**
  - while the operator has sending paused (`/api/notifications/config` now reports `paused`);
  - in a browser that blocked notifications or cannot receive Web Push;
  - to staff;
  - on a device the server already confirmed;
  - as guest news over a browser that already holds an account's subscription.
- "Not now" rests three weeks and stops after the second time. The browser's own answer is final.

### Consent and Ghana's direct-marketing rule
Ghana's Data Protection Act, 2012 (Act 843) requires a data subject's prior consent before their data is used for direct marketing, and lets them require the marketing to stop.

The implementation keeps four things separate:
- browser permission;
- a registered device;
- order and account updates (`transactional`);
- service news and offers (`marketing`).

How consent is recorded:
- **Evidence:** one explicit tap on a card that names each purpose records an append-only `mysteryhub_notifications.consents` row per purpose. Each row holds the subject (account, or guest browser), purpose, granted or withdrawn, source and the copy version shown (`invite-3.4-1`, `-orders`, `-guest`, `settings-1`).
- **Atomic with the device:** the device registration and the consent are written in one transaction, and the success state appears only after the server confirms.
- **Never inferred:** browser permission never creates consent.
- **Never revived:** a withdrawn marketing choice is never switched back on by an invitation. Only the customer's own switch in My Account turns it back on. An answer to the old separate offers question on this device is also honoured.
  - The ledger is ordered by an identity sequence, so choices saved in the same moment never race.
  - A saved "off" from before the ledger counts as a withdrawal only for someone with no ledger entries, and is carried into the ledger the first time they act. Changing only order updates later never counts as declining offers.
- **One-tap "Order updates only":** the success state for a member who accepted offers offers this right where the choice was made. It is recorded as an invitation answer. This keeps the founder's single decision while making order updates without offers one tap away. The server accepts the invitation source only for this exact answer (order updates on, offers off), so the evidence cannot be used to record a grant.
- **Settings registration:** turning a device on in My Account changes no choice. The switches stay exactly as shown.
- **Withdrawal:** settings changes record withdrawals and re-grants. Guest unsubscribes record a withdrawal, and an account taking over a guest browser records the end of the guest consent. Guest consent is never transferred to an account.
- **Legal caveat:** this is an engineering reading of the rule, not legal advice. The founder should confirm the wording with counsel before activation.
  - If counsel prefers fully unbundled consent, the alternative is an unticked "Also send me news and offers" line in the same card. Order updates would then be recorded alone unless ticked.
  - The ledger and copy versions already support that change without a schema change.

### Guests
- **Operational gate:** guest news is off unless the operator sets `WEB_PUSH_GUEST_NEWS=true`. Keep it off until guest delivery (Release D, Admin audiences) is merged and verified. Until then the guest sheet says news without an account is coming, and no guest invitation appears.
- **Guest news:** a browser without an account can choose service news and occasional offers (marketing only).
  - The server returns a random credential. The browser keeps it in local storage and sends it only in the `X-Guest-Notifications` header, never in a URL; the server stores only its hash.
  - Endpoint ownership is checked. A guest browser cannot take over an account's endpoint.
  - Registrations expire after 180 days without use (active use extends them).
  - Rate limits: 30 requests per 10 minutes per visitor, keyed on the proxy's own X-Forwarded-For hop (which a client cannot forge). A database budget allows at most 200 newly created registrations per 10 minutes site-wide, and re-registering is never blocked.
  - The notification worker removes expired registrations with an evidence row on every tick (one statement that skips locked rows), even while sending is paused.
  - A signed-in account taking over a guest browser's endpoint replaces the guest row. The evidence records whether the keys proved it was the same browser (`replaced_by_account` / `replaced_by_account_unverified`).
  - A device left behind by an expired account session does not block guest news.
  - A guest who registered while guest news was open can always see it and turn it off from the footer, even after the gate closes.
  - "Turn off for this browser" (footer › Notifications) deletes the registration and records the withdrawal.
- **Order updates for guests: gated, not built.** The platform has no secret guest-order capability; order lookup works by public reference only. Binding push to a guest order securely needs:
  - a new per-order secret issued at checkout;
  - guest events in the order outbox;
  - worker changes.

  That touches the payment-initialisation path and needs its own reviewed change. So guests are never offered order updates and never told they will receive them. The guest sheet says order updates need an account.
- **No guest inbox:** there is no guest inbox and no fake account.
- **Announcement clicks:** they open the app's home page, not an inbox link a guest cannot read.

### Members and the installed app
- **Browser tabs:** members can enable notifications in a browser tab; installing the app is not required.
- **Installed app:** the first-use invitation now comes from the coordinated layer. The old installed-only two-step card was removed.
- **Account changes:** another account never inherits a card prepared for the previous one.
- **Device binding:** devices stay bound to the signed-in session, and logout still removes them.

### Account notification centre (My Account › Notifications)
- **Wording:** device-neutral ("this device", not "this phone"), because computers get notifications too.
- **iPhone and iPad Safari tabs:** they see "Use the Home Screen app" with the exact steps, instead of a dead end.
- **Paused:** a registered device while sending is paused shows that nothing is being sent right now.
- **Recent notifications:** this account's own server history, newest first, up to 10.
  - Each item shows an "Order update" or "News" label, a time, a title and a body, and opens Orders or Home.
  - Loading, empty and error-with-retry states are shown.
  - It never claims a notification was displayed or read.

### Service worker and payloads
- **Account updates:** they stay generic ("An account update is available. Sign in to view it."). Details appear only through the signed-in inbox lookup.
- **Announcements:** opted-in news and offers now carry their own approved, non-personal template text (`kind: 'announcement'`) and open the home page.
- **Unsafe text:** text containing markup or control characters, or that is too long, falls back to the generic notice.

### Verification (Release C)
- **Unit:**
  - onboarding 7/7 (read-only assessment, purposes per copy, blocked, closed and aborted prompts, guests, copy, single surface);
  - service worker 24/24 (announcement display, unsafe text, click targets);
  - updated account, PWA and invitation suites.
- **Native PostgreSQL 16:**
  - new `notificationConsentPostgres` 14/14: private tables, consent per purpose, withdrawal never revived, the pre-ledger rule, invitation-sourced "Order updates only", the guest gate, guest credential hash and ownership, forged-key takeover refused, a stale session not blocking, account takeover, expiry clean-up and unsubscribe, HTTP (no account, no credential in URLs, paused flag), announcement payloads;
  - existing `notificationsPostgres` 18/18;
  - `backendRlsPostgres` with 53 private tables (its `MAINTAIN` check needs PostgreSQL 17, which CI uses).
- **Independent review:** 10 findings, all addressed.
  - Rate-limit key and site-wide ceiling.
  - Guest news gated until delivery exists.
  - Settings registration no longer re-enables order updates.
  - Guest takeover requires matching keys.
  - One-tap "Order updates only".
  - Opt-out rule scoped to pre-ledger records.
  - Announcement text clamped.
  - Stale sessions no longer block guests.
  - No stray subscription after a refused registration.
  - Expiry clean-up.
  - Found while fixing: the ledger now has deterministic ordering.
- **Verification review of the fixes:** 10 more findings. The fixes:
  - a spoof-resistant visitor key;
  - guests can withdraw while the gate is closed;
  - the invitation source is limited to "Order updates only";
  - a successful registration is never undone by a later failure;
  - the ordering column is added idempotently to databases that already have the table;
  - a signed-in account replaces an unproven guest row, with the evidence noted;
  - the registration budget counts created rows;
  - expiry clean-up moved to the worker as one lock-safe statement.

  Not changed:
  - One finding concerned an intermediate commit that was never merged or deployed.
  - One concerned Creative Studio's existing copy of the visitor key, which is outside this assignment and recommended as a follow-up.
- **Browser:** `scripts/reviewNotificationOnboarding.cjs` 28/28. It runs locally only, with synthetic push keys and a disposable database.
  - The browser permission answer and the push subscription are **simulated**: headless Chromium cannot show the prompt or reach a push service. This proves the product and server logic, not delivery.
  - No delivery was queued or attempted.
- **Release B review re-run:** 88/88.

## Release D: Admin Notification Center, readiness and activation gates

Activation runbook and the founder's phone checklist: `docs/notifications-activation-3.4.md`.

### Status in plain words (Admin › Notifications)
- **Checklist:** the server's facts, never secrets.
  - Keys valid; the sending switch; paused or live.
  - The background sender (last check, last failure).
  - Devices that can receive versus registrations left by signed-out sessions.
  - Customers who chose news and offers (people, and their devices); visitor browsers.
  - Order updates waiting for a resume (last 24 hours only).
  - The last 7 days by result, with the most common problem in words.
- **Check it on your phone:** *Send a test to my devices* reaches only the signed-in operator's own devices (taken from the session, never from input). It is audited, idempotent per click, limited to 3 in 10 minutes, and works while paused.
  - A plain test takes the private account path: generic lock-screen text, then "Test notification" after sign-in.
  - Opening it from the notification marks it opened. This is recorded for operator tests only; customer notifications are never tracked.
- **Pause and resume:** both need a reason (audited); resume also needs an explicit approval.
  - **Resume is refused by the server** until an operator has opened a test from its notification in the last 30 days.
  - The Admin page mirrors this rule for the viewer's own phone.

### Audiences, consent first
- **Customers who chose news and offers:** active customers with a live session and `marketing=true`. Counted as people and devices.
- **One customer:** the same rule for a single account ID.
- **Visitors who chose news:** guest browsers with an unexpired registration. Only while `WEB_PUSH_GUEST_NEWS` is on, and never a browser that is also a live account device.
- **Everyone who chose news:** both groups.
- **Server-side enforcement:** the preview binds the template version, audience, page and exact recipients (hash) for 10 minutes.
  - The send re-checks all of it, plus pause and the guest gate.
  - It refuses the same announcement to the same audience within 30 minutes, even from a second preview.
  - Campaign creation is serialised.

### Pages an announcement may open
- **Fixed list:** `/`, `/data`, `/services`, `/marketplace`, `/earn` (`ANNOUNCEMENT_DESTINATIONS`).
- **Where it applies:** the server, the payload (`url`), the service worker (its own copy of the list; anything else opens Home) and the account inbox (`opens`).
- **No URLs:** web addresses cannot be entered.

### Delivery to visitor browsers
- **Records:** one event per browser and one delivery per browser.
- **At send time:** the worker re-checks the registration, the gate, pause, the template and the 24-hour freshness.
- **A gone browser:** a 404/410 removes the registration and records `guest_endpoint_expired` in the consent ledger.

### While paused
- The worker expands and sends nothing for customers or visitors. Only operator tests move.

### History
- **Grouped:** announcements (one row per campaign), tests (with when the operator opened them), and automatic order updates (with "Waiting for resume" while paused).
- **Filters:** by kind and by any delivery's result.
- **Detail:** per-device tries with codes and times, problems in plain words, and visitor browsers marked.
- **Never shown:** endpoints and people.
- **Earlier campaigns:** grouped after the upgrade. Their id is recovered from the event key.

### Composer
- **Preview:** shows what the phone shows. An announcement shows its own text and page; an account update shows the generic notice and the signed-in content.
- **Send to my devices first:** tests the exact saved announcement and page.
- **Confirmation:** shows recipients now, made up of customers (devices) and visitor browsers, plus the page, the type and the consent rule.

### Schema (additive, idempotent, mirrored in `schema.sql`)
- **`events`:**
  - nullable `user_id`, plus `guest_device_id`, `destination`, `campaign_id`, `operator_test`, `opened_at`;
  - a subject check (an account or a guest browser);
  - a one-time grouping backfill.
- **`deliveries`:** nullable `user_id`, plus `guest_device_id` (unique per event).
- **`audiences`:** `guest_device_ids`, `audience_kind`, `destination`.
- **Templates:** a locked internal `operator_test` template, never listed among templates.
- **Unchanged:** the order trigger.

### Verification (Release D)
- **Unit `notificationAdmin34` 7/7:**
  - readiness wording and gating;
  - no key material;
  - one destination list shared by the server, Admin and the service worker;
  - announcement versus account preview;
  - audience counts and an unavailable visitor audience;
  - history mapping without invented receipts.
- **Updated suites:** `notificationCenter` 17/17.
- **Native PostgreSQL 16, `notificationAdminPostgres` 10/10:**
  - the schema upgrade and subject check;
  - members, visitors and everyone, people versus devices, approved pages;
  - a planted duplicate browser excluded;
  - campaigns refused while paused, then fanned out per customer and per browser;
  - idempotency and duplicate protection;
  - audit details;
  - visitor gate at delivery, and a gone browser removed with evidence;
  - the operator test: own device only, while paused, account path, opened only by the owner, the resume gate;
  - the announcement test, refusals and the rate limit;
  - readiness without key material;
  - grouped history, filters and detail without endpoints;
  - the grouping backfill;
  - admin-only HTTP.
- **Existing suites:** `notificationsPostgres` 19/19 (one assertion that a Release C edit had put inside a comment is restored); consent 14/14.
- **Browser `scripts/reviewAdminNotifications.cjs`, 48/48:**
  - a local production build with synthetic keys and the simulated push service (`scripts/qa/simulatedPushProvider.cjs`), which refuses to load outside a local `*_test` database;
  - the status checklist; the test on the operator's own phone while paused, with a simulated tap;
  - the resume gate and confirmation; compose, page, preview, test-first, confirm and send to consenting customers only;
  - duplicate protection; visitor browsers and a gone browser; history filters and detail;
  - templates; layouts at 320–1440 and a 390×640 phone with the sheet open;
  - axe clean at 1280 and 390 (serious and critical);
  - pause with rate-limit recovery.
