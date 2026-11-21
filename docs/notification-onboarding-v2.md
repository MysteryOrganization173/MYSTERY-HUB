# Mystery Hub 3.4 — Notification Onboarding V2

Notification invitations are easier to discover and accept, and less suppressed. The design, the copy, consent and the
Web Push registration are unchanged. The changes are in timing, dismissal, eligibility while paused, and how the three
invitations (Install, Notifications, WhatsApp Channel) share the screen.

Frontend only. No server, worker, schema, provider, flag or pause setting changed.

## The card

The design and approved copy are unchanged.

- **Members:** "Stay updated." / "Get order updates, service news and occasional offers." / **Allow Notifications** · Not now.
- **Members who turned offers off before:** "Get updates about your orders on this device."
- **Visitors** (only while `WEB_PUSH_GUEST_NEWS` is on): "Get Mystery Hub service news and occasional offers."
- **New quiet lines:**
  - **Repair** (the browser already allows notifications, but this device is not registered): "Your browser already allows them. You can turn them off anytime."
  - **Paused** (the operator paused sending): "Notifications will arrive once sending resumes." It gives no date and never says anything is arriving now. It also shows under "You're all set."

## Timing (all values in `NOTIFICATION_TIMING`, `src/pwa/invitations.ts`)

| Value | Meaning |
|---|---|
| `settleMs` 5 s | The card appears about 5 s after a calm page settles. No engagement is needed, so a first-time visitor sees it on the landing page. |
| `autoHideMs` 12 s | An untouched card leaves this long after it became visible. |
| `resumeMinMs` 4 s | After hover or focus leaves the card, at least this much time remains. |
| `exitMs` 200 ms | The gentle exit. There is none with reduced motion: the card simply goes. |
| `ignoredRestMs` 12 h | A card left alone does not return for this long, in any tab. |
| `afterOtherMs` 30 min | No notification card this soon after an Install or Channel card in another tab. The installed app is exempt: its first use right after installing is the moment notifications are for. |
| `snoozeDays` 3 | Applies to "Not now", the close button, Escape, and closing the browser's own question. |

Install and the Channel keep their own rules: engagement (a second page, about 25 s of use or a verified purchase),
the 2-second settle, the 12-hour gap between them, and their own snoozes. The install card's 30-day / three-strike rest
was not touched.

**A calm page:**
- A calm browsing page (Home, Data, Services, Marketplace, Creative, About, Help, Earn, Website) that is not a Paystack return.
- The page has finished loading (`load`, or 10 s at most).
- The tab is visible.
- No field has focus (`isFormEntry`).
- Nothing on the shared overlay stack is open (dialogs, sheets, the phone menu).
- None of the app's busy states is active: checkout, receipt, sign-in, account, a password change, the editor, the assistant, template preview, Marketplace enquiry or the waitlist.
- No in-page install card is on screen.

**The settle clock:**
- It starts when the page becomes calm, and restarts only when the page changes or the calm is interrupted.
- Re-renders reschedule the single timer without restarting the clock.
- One read-only eligibility check runs per account (or visitor) per page life, once a calm page is open.
  - When the account changes (sign-in, sign-out, a switch), the next calm page cancels the old check and starts a new one.
  - Results for a previous account are never used: they are keyed to the account and its session.
  - No check runs at all when the card cannot appear in this visit: already shown or answered, resting, snoozed, or too soon after another card.
  - A rest that ends while the page stays open is looked at again at that moment.
- It runs again only if the browser permission changed in the meantime (another tab, site settings).

## Ignored versus dismissed

**Ignored:** the card left by itself, or stepped aside for a dialog, page change, typing or a long scroll.
- Not a "no": no snooze, no count and no dismissal flag.
- It still was this visit's one invitation, so nothing replaces it and it does not reappear on the next page.
- It may return on a later visit, after the 12-hour rest.

**Dismissed:** "Not now", the close button or Escape (and closing the browser's own question).
- A three-day snooze, every time.
- There is no strike limit and no permanent suppression.
- Nothing else is suggested for the rest of the visit.

**What holds the auto-hide** (`src/pwa/autoHide.ts`):
- the pointer resting on the card;
- keyboard focus inside it;
- a hidden tab;
- moving by keyboard (Tab or F6) on the page, until focus has been inside the card and left again;
- any tap or click inside it, which holds it for good.

Reaching the card during its 200 ms exit (a tap, a click or focus) stops the exit.

The screen-reader note says the card is there "for a few seconds", and that Notifications in the footer is always there.

After Allow the card is working, then shows its result. None of those states leaves by itself:
- **Working:** the browser's question, then registration. Only switching account closes it; a dialog, page change, typing or scroll do not.
- **Blocked, error and success:** these wait for Done or Close.

**Migration:**
- The old rule stored `{count, lastAt}` and stopped after two answers. The same record is now read under the new rule.
- The count is ignored, and only the time of the last answer counts.
- A record that reached the old limit is no longer suppressed. A recent one still rests out its three days.
- **Edge cases:**
  - an invalid or corrupt record reads as nothing remembered;
  - a time more than a day in the future (a changed clock) is ignored;
  - unavailable storage remembers nothing.
- Install and Channel records are untouched. No consent or browser permission is reset.

## Permission and registration

The flow is unchanged: tap → the browser's permission (only where needed) → subscription → server registration with
the consent the words name → server confirmation → "You're all set."

Permission, subscription, registration, provider acceptance and display are never conflated. "On" appears only after
the server confirms the device.

- **Registered:** a device the server confirms is never invited again. This is checked against the server, not local memory.
- **Repair:** if the browser allows notifications but the device is not registered, one tap registers it with no new browser question.
  - Members are also offered this when the browser holds a subscription the server does not know.
  - Visitors are not: a subscription there may belong to an account, so they use the footer's Notifications sheet.
- **A failed tap is never a "no":**
  - "Dismissed" (the three-day rest) is recorded only when the browser really asked and the person closed its question.
  - A network or service failure shows "Notifications aren't on yet." with Try again.
- **The browser's question follows the tap directly:**
  - The key comes from the configuration the assessment just read (kept for one minute, and forgotten if a read fails), so there is no network wait. This matters for browsers that only ask right after a tap.
  - Otherwise the configuration is read first, so a service known to be off never leads to a permission request. The server refuses registrations while it is off in any case.
- **Focus:** pressing Allow from the keyboard moves focus to the result's first button, unless focus was taken elsewhere in the meantime.
- **Blocked:**
  - The browser's "Block" is final: no invitation, and no repeated request.
  - My Account (members) and the footer's Notifications sheet (visitors) give short directions.
- **Allowed or blocked elsewhere:** any "Allow Notifications" on the page (My Account, the Notification Center, the visitor sheet) tells the coordinator. A card assessed earlier is then never shown.
- **Unchanged:**
  - account switching, sign-out and session-bound ownership;
  - consent per purpose;
  - a past "no" to offers is never revived;
  - "Order updates only" right after allowing.

## Paused by the operator

**Backend contract (verified):**
- Member and guest registration (`NotificationService.subscribe`, `guestSubscribe`) require Web Push to be configured, but do not check the pause.
- Registering while paused is accepted, so no backend change and no Codex coordination was needed.
- The pause still stops every delivery in the worker, which is unchanged.

**What changed:**
- The invitation is no longer hidden while paused; it says when notifications arrive.
- Only an unconfigured or unavailable service (where registration would be refused) hides it.

## Install, Notifications and the WhatsApp Channel

**The global rules are unchanged:**
- one card on screen;
- one unsolicited invitation per visit;
- nothing after a dismissal;
- never over a dialog or a busy state;
- voluntary footer and account entries are always available.

**Priority:**
- Notifications lead whenever the device can register and is not registered yet.
- After a verified purchase they always lead for members: their best moment.

**Turn-taking** (`notificationsLead`, `invitationPlan`):
- If the last suggestion shown in this browser was the notification card, and Install or the Channel could have a turn, the next visit is theirs.
- The notification card stays away for that whole visit, even if the visitor leaves before Install or the Channel appears.
- The visit after that, notifications lead again.
- If neither of the others is possible at all, notifications are not held back.
- So neither side starves the other.

**In-page install card** (Home, the member home, the December home):
- It is that page's install suggestion, so floating Install and Channel cards stay off the page.
- It now reports whether it is on screen. The notification card may float while the in-page card is scrolled away, and steps aside when it comes into view, so two never share the screen.
- Install is never suggested inside the installed app.

**Kept as before:**
- the Channel URL, card, "Maybe later" rests and "Already following";
- the iPhone Add to Home Screen steps;
- installed-app detection.

## Visitors, members and browsers

- **Members:** Android browsers, desktop browsers, the installed app and iPhone/iPad Home Screen apps, through the existing authenticated registration, with transactional and promotional records kept separate.
- **Visitors:** the guest-news flow, only while `WEB_PUSH_GUEST_NEWS` is on (not changed). Order updates are never offered without an account.
- **Offered nothing:**
  - an iPhone Safari tab (no Web Push outside the Home Screen app);
  - in-app browsers and embedded frames without a service worker or push;
  - published business websites;
  - insecure pages.

## Tests

- **Unit tests:** `server/suppliers/__tests__/notificationOnboardingV2.test.ts` maps to the brief's acceptance items 1–25. Item 25 is covered by browser layout checks plus CSS assertions.
  - Updated: `notificationOnboarding`, `pwaLaunchReadiness`, `customerConnection34` and `notificationCenter341`.
- **Browser review (local only, simulated permission and subscription):** `scripts/reviewNotificationOnboardingV2.cjs`.
  - Timing: the 5-second appearance; the 12-second auto-hide and its holds.
  - Dismissal: ignored versus dismissed; the three-day rest; old two-strike records.
  - Coordination: turn-taking with the Channel; the in-page install card.
  - States: paused; repair; blocked.
  - Postponement: typing, sign-in, a hidden tab and reduced motion.
  - Layout: 320, 360, 360×560 (short Android), 390, 430, 768 and 1280.
- **Not proven by these tests:** receipt on a physical phone, and the native permission sheets of real Android and iOS devices. These need a real device.
