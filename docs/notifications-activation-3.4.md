# Notifications: activation gates and controlled acceptance (3.4)

This is the operator's runbook for turning on Web Push for real customers. Merging code does not send anything:
delivery stays paused until the founder completes the gates below and approves live sending in Admin.

## Where production stands (read-only check, 15 Nov 2026)

`GET https://mysterybundlehub.com/api/notifications/config` returned:

| Field | Value | Meaning |
| --- | --- | --- |
| `enabled` | `true` | `WEB_PUSH_ENABLED=true` and the server's keys validate (only the public key is ever exposed). |
| `paused` | `true` | Nothing is sent to customers or visitors. |
| `guests` | `false` | News for visitors without an account is off (`WEB_PUSH_GUEST_NEWS` not set). |

Not visible from outside, and shown to a signed-in operator in **Admin › Notifications › Status** once Release D is
live: how many devices are registered, whether the background sender is running, and order updates waiting for a
resume.

## Gates, in order

1. **Server configuration.** `WEB_PUSH_ENABLED=true`, `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`,
   `WEB_PUSH_VAPID_SUBJECT` and `WEB_PUSH_STORAGE_KEY` (see `docs/notifications-b3.md`). Production reports this as
   done. Never rotate the storage key without a re-subscription plan: existing registrations become unreadable.
2. **Paused.** The default, and production's state today. Pause stops every customer and visitor notification. The
   operator's own test still works, so a phone can be checked first.
3. **A phone check (enforced).** Admin › Notifications › Status › *Send a test to my devices*, then tap the
   notification on the phone. Status changes to *Checked on your phone*.
   - **What counts:** the test push carries a one-off token, and only opening it from the notification records the check. A copied link does not.
   - **The rule:** the server refuses to resume until an operator has opened a test this way within the last 30 days. Any operator's check counts, so a second Admin can resume in an emergency.
4. **Controlled acceptance.** The checklist below, on a phone the founder controls.
5. **Founder approval to resume.** Status › *Resume sending*: a reason for the audit log, plus an explicit approval
   tick. The dialog says what will go out:
   - order updates from the last 24 hours that are waiting (anything older is never sent);
   - any announcement deliveries still queued. Cancel those first in Status if they should not go out.
6. **First announcement.** Write it and save it as a template. Choose the page it opens and *Send to my devices
   first*. Then send to *One customer who chose news and offers* (a customer account the founder controls) before
   any wider audience.
7. **Visitor news (optional, later).** Set `WEB_PUSH_GUEST_NEWS=true` only when the founder wants visitors without an
   account to be invited. Turning it off again stops new visitor registrations and any further visitor deliveries.
   Visitors who already registered can still turn news off.

## Controlled acceptance on the founder's phone

Use a phone the founder controls, never a customer's. Android: Chrome. iPhone: iOS 16.4 or later. Add Mystery Hub to
the Home Screen and open it from there, because Safari tabs cannot receive web notifications.

**A. Register the phone**
1. On the phone, open mysterybundlehub.com and sign in with the founder's Admin account.
2. Tap the bell (or My Account › Notifications) and choose **Allow Notifications** on the "Stay updated." card. Allow them when the browser asks.
3. Expected: the device shows as on, confirmed by the server. Browser permission alone is never treated as "on".

**B. Plain test (receipt, tap, inbox ownership)**
4. On a laptop, open Admin › Notifications. Status shows the device among *devices … can receive* and *Not checked
   on a phone yet*.
5. Choose *Send a test to my devices*. Expected: *Test sent to your 1 device.*
6. Within about 10–20 seconds the phone shows **Mystery Hub — An account update is available. Sign in to view it.**
   The lock screen is generic on purpose, as for order updates.
7. Tap it. Mystery Hub opens and shows *Test notification: This is a test from Mystery Hub Admin. No action is
   needed.*
8. In Admin choose *Refresh*. Status shows *Checked on your phone*, with the time the test was opened.

**C. Announcement test (text and page)**
9. In Compose, write the announcement, *Save draft template*, and choose the page it opens. Choose *Send to my
   devices first*.
10. The phone shows the announcement's own title and message. Tapping it opens the chosen page.

**D. Account switching**
11. Sign out on the phone. The device registration ends with that sign-in, and open account notices are cleared.
12. Sign in to a different (customer) account. The founder's test does not appear in that account's notifications.
    Opening an old test link says it is not available for the signed-in account.

**E. Unsubscribe**
13. Sign back in as the founder and turn notifications off for this device in My Account. *Send a test to my
    devices* now says no phone is registered, unless another of the founder's devices still is.

**F. Pause and error recovery**
14. While paused, tests still arrive and customers receive nothing. Anything queued is held, not lost. To stop
    queued announcements for good, use *Cancel queued announcements* in Status, or *Cancel the rest* in an
    announcement's History detail. Either needs a reason and is audited.
15. History shows each send. A device whose subscription is gone shows *Expired or invalid*, with *The phone or
    browser is no longer subscribed, so it was removed.* A temporary push-service problem shows *Retrying*.

**G. Resume (the founder's decision)**
16. Status › *Resume sending* › reason › tick the approval › *Resume sending*. Status changes to *Sending is live*.
17. To stop at any time, choose *Pause sending*.

If any step fails, leave sending paused. Record the step, the phone model and the browser version.

## What each result means

- **Accepted**: the push service took the message for that device. It is not proof that the phone showed it or that
  anyone saw it.
- **Checked on your phone**: the operator opened their own test from its notification. This is real tap evidence,
  recorded only for operator tests. Customer notifications are never tracked as opened.
- **Not sent / Cancelled**: nothing went to the device. The reason is shown in words, for example cancelled by an
  operator, signed out, or a changed choice.
- **No eligible device**: an order update that had nobody to go to: no signed-in device, or order updates turned off.
- **Not sent: older than 24 hours**: saved while paused and too old when sending resumed.
- **Duplicates:** nobody receives the same announcement twice within 30 minutes, whichever audience, page or review
  it comes from. A corrected template (a new version) is a new announcement.
- There is no "read" or "delivered to phone" state anywhere in Admin.

## Rollback

- **Immediate:** Admin › *Pause sending*. All customer and visitor delivery stops; anything queued is held, not lost. *Cancel queued announcements* stops queued announcements for good.
- **Full stop:** set `WEB_PUSH_ENABLED=false` and restart. The background sender stops; registrations are kept.
- **Visitor news:** unset `WEB_PUSH_GUEST_NEWS`. No new visitor registrations, and no more visitor deliveries.

## Evidence (local, not production)

- Native PostgreSQL:
  - Admin Notification Center 12/12;
  - notifications lifecycle 19/19;
  - consent and guests 14/14.
- Browser review `scripts/reviewAdminNotifications.cjs`, 52/52:
  - a local production build with synthetic keys and the simulated push service (`scripts/qa/simulatedPushProvider.cjs`);
  - nothing leaves the machine;
  - the phone tap is simulated by the signed-in lookup a real tap performs.

This is product and server evidence, not acceptance on a real phone. Controlled acceptance above is still the
founder's step.
