# Mystery Hub 3.6.3 · Service Control Center and announcements

**Status:** code release in two parts.
- **Release A** (PR #147, merged as `6beb5d5`): the emergency MTN Data maintenance notice and pause.
- **Release B** (this document): the permanent Service Control Center that replaces Release A's fixed record.

No production setting, table or supplier changes. **Production keeps pausing MTN Data after this deploys**, because nothing is saved there yet, and with nothing saved the Service Control Center applies the Release A record word for word.

**Screenshots:** [`docs/screenshots/service-control-3-6-3/`](screenshots/service-control-3-6-3/). They use synthetic data only, from a local production build: customer pages with synthetic API answers, and Admin against the real server on a disposable `*_test` database.

## What the founder gets

**Admin → Commercial Pricing → Service Control Center** (top of the page).

**Nine service cards.** Data, Instant Bundles and Airtime for each of MTN, Telecel and AirtelTigo. Each card shows:
- its state;
- what that state means for purchases;
- the other checks that still apply (products for sale, supplier route, online payment);
- the expected restoration date;
- its live announcements;
- who last changed it.

**Four states, per scope.** A pause on one network or service never affects another.

| State | New purchases | Customers see |
|---|---|---|
| Operational | Allowed, subject to every other check | Nothing extra |
| Experiencing delays | Allowed | A "may be slower than usual" line and chip |
| Maintenance | **Refused by the server** | Maintenance state, inline notices, chip |
| Suspended | **Refused by the server** | Same, marked "Paused" |

**Changing a state (Manage).**
- Enter the customer words and an optional expected restoration date.
- See exactly what customers will see (a real preview).
- Tick a box that states the effect. For example: "New Telecel Data purchases will be refused as soon as this is saved. Existing orders, payments, recovery and refunds are not affected."
- Then save. Success is shown only after the server confirms.
- If someone else changed the controls meanwhile, the save is refused, your edits stay, and Refresh shows the other change.
- If the server never answers, the screen says the change may or may not have been saved and asks you to refresh.

**Announcements.**
- Create a draft, preview it, then publish, edit, unpublish or archive it.
- Fields:
  - internal name;
  - title;
  - short line and details (plain text only);
  - severity;
  - global or one service;
  - bar or exceptional pop-up;
  - pages;
  - audience;
  - hideable or not;
  - start and end;
  - expected restoration;
  - an action button from a fixed list (Track an order, Browse bundles, Instant Bundles, Get help).
- Publishing, ending or hiding an announcement **never pauses or reopens a service**.

**Change history.** Every change is in the Admin audit log with who, what and the effect: "new purchases refused" or "manual pause lifted".

**"Operational" is not "working".** It only lifts the manual pause. Product switches, supplier route checks and preflight, payment restrictions and eligibility still apply. The Admin screen says so before you save.

## How it works

**Storage.**
- Two keys in the existing commercial settings table (`finance_config`): `service-controls` and `service-announcements`. There is no new table and no migration.
- Writes run in one transaction under an advisory lock, compare the version the Admin reviewed (409 on conflict), and write the audit row in the same transaction. If the audit row fails, nothing is saved; a native Postgres test checks this.

**Enforcement (server).**
- **Data:** a paused network leaves the catalogue, exactly like a product switched off. Quote, card and Wallet payment start, reorder and the assistant all read that catalogue.
- **Instant Bundles:** refused at payment start (before route resolution) and left out of the public list.
- **Airtime:** refused at payment start (after network validation).
- **Reorder:** refused for paused Airtime and Instant.
- **Promotions:** the December campaign headline is computed from the filtered catalogue, so it never advertises a paused network. Campaign amounts are unchanged and the campaign stays off.
- **Not touched:** payment verification, cancel, webhooks, recovery, reconciliation and refunds never read the controls.
- **Purchases already started:**
  - A customer who already started paying is sent to recovery, never charged again.
  - A Wallet retry with the same request is recovered, never refused or charged twice (tested).

**Reads.**
- One snapshot per server process, cached 15 s, single-flight. Inside a database transaction (a signed-in quote, a payment start) the controls are read through that transaction's own connection, never a second pool connection.
- A save takes effect immediately on the server that handled it (it serves what it just committed). Other instances see it within 15 s. A read that started before a save can never put the older record back.
- If a read fails, the last good snapshot keeps applying. With no snapshot at all, the catalogue fails closed: an error never reopens anything.
- A saved record that cannot be read, or a state this version does not know, refuses purchases: the Admin screen says every service is paused until it is saved again.

**Customers.**
- Every page shares one request (`/api/service-status`, customer words only, cacheable 30 s).
- It refreshes when the tab comes back to the foreground (at most every 30 s) and every 5 minutes. It never polls per card.
- Until the first answer, a page uses the last answer it saw, else the shipped Release A record.
- The server refuses paused purchases however stale a page is.

**Expected date.**
- It is shown as an expectation only. Nothing reopens on a date.
- After the date, while still paused, customers read: "Expected resumption was Tuesday, December 1, 2026. Restoration is awaiting confirmation; purchases stay paused until we confirm the service is back."

**Customer presentation.**
- **Bar:** one bar under the header, most severe first, with "N more updates" one tap away. Hiding a bar hides that revision only; a revised announcement shows again.
- **Exceptional pop-up:** once per revision, never over checkout, a receipt or sign-in.
- **Maintenance states:** offer only networks that are selling, plus Instant Bundles and Track an order.
- **Inline notices:** on lists, checkout and receipts. These cannot be hidden.
- **Receipts and Buy again:**
  - Buy again is withheld for a paused scope.
  - An active order on a paused scope reads: "If this order is affected, it will be reviewed. Please don't place it again."
  - An order's status never changes.
- **Home pages** (ordinary and Christmas): open on the first network that is selling. They move off a network that becomes paused unless the customer picked it.

**Migration from Release A.**
- `shared/serviceIncidents.ts` is removed. There is one source of truth.
- Production has nothing saved, so the shipped default (the Release A record, word for word) applies until the founder's first save.
- The first save keeps the MTN pause unless that save changes MTN Data itself.

## Verification

| Gate | Result |
|---|---|
| Type-check (`tsc --noEmit`) | Clean |
| Production build | Succeeds; the browser bundle always uses the real shipped default |
| New suite `serviceControlCenter363.test.ts` | 30/30 |
| Full suite | 3,623 pass, 0 fail (62 opt-in database tests skipped) |
| Native Postgres: new `serviceControlPostgres.test.ts` (12 concurrent signed-in quotes on a cold cache, concurrent saves from two admins, atomic audit, shipped default) | 6/6, added to CI; fails as expected with the pool fix reverted |
| Native Postgres: December campaign, AFA commercial, sales reliability | 7/7, 6/6, 7/7 |
| Release A browser acceptance, rerun on Release B | 107/107 |
| Customer browser QA (all states, 320–1280, Christmas, New Year, axe) | 111/111 |
| Admin browser QA (real server and database: auth, suspend, conflict, failed save, restore, announcement lifecycle, audit, account switch, 320–1280, axe) | 53/53 |

## Independent review

An independent reviewer read the full diff, ran the suites and reproduced issues against a disposable Postgres database. Verdict: **ship after fixes**. The safety core held: no paused scope could start a new purchase, Operational never overrode another restriction, and every hard constraint held. All defects it found are fixed, each with a test:

| # | Finding | Fix |
|---|---|---|
| 1 | **High.** The catalogue read the controls through a second pool connection while a transaction held one; 5 concurrent signed-in quotes on a cold cache exhausted the pool (10 s timeouts, which would also delay verification, webhooks and recovery). | Read through the open transaction. A Postgres test with 12 concurrent quotes passes, and fails with the old code. |
| 2 | The public status rate limit was keyed on the proxy's address, so effectively site-wide. | Removed; the endpoint is served from the 15 s snapshot. |
| 3 | A malformed saved record fell back to the shipped default (reopening saved pauses); an unknown state became Operational. | Both now refuse purchases; Admin shows a repair notice. |
| 4 | A committed save could be reported as "Nothing was changed" if re-reading the view failed. | The server returns success with no view; the screen refreshes. |
| 5 | An announcement could say "purchases stay paused" after the service reopened. | That wording appears only while a pause is in force. Lifting a pause in Admin lists the live announcements to unpublish. |
| 6 | The CTA check accepted names such as `toString`. | Own keys only, on the server and in the browser. |
| 7 | A read started before a save could put the older record back in the cache. | Generation-checked cache. |
| 8 | Website store checkout (switched off today) had no guard. | Guarded before it can ever be switched on. |

Smaller follow-ups also done:
- The checkout re-quotes when the status changes, and refreshes the status when a start is refused.
- The Instant Flexi quote is guarded.
- The exceptional pop-up is a native modal dialog (focus kept inside, background inert, Escape anywhere, focus returned).
- The server refuses supplier or reseller names in customer words.
- `NODE_ENV=test` alone can no longer drop the shipped pause.

Left as they are, by design or as pre-existing:
- An Instant package without its own network takes the network from the request. This is pre-existing order logic, and 3.5's to tighten.
- The Welcome discount floor check ignores paused products. Harmless: nothing paused can be bought.
- Rolling back to Release A would ignore saved controls and pause MTN Data only.

## Dependencies on Mystery Hub 3.5 (Codex)

1. **Settings ownership.** The controls live in `finance_config` beside the commercial settings. A 3.5 change to that table, its backups or restore procedure should include the two new keys.
2. **Several server instances.** Worst-case staleness on another instance is 15 s after a save. If 3.5 needs instant cross-instance effect, it can add a shared invalidation; the version check already prevents conflicting writes.
3. **Supplier health is not automatic.** Nothing here detects an outage or reopens a service. Supplier monitoring and alerts are 3.5's. Any automatic pause is out of scope and would need its own authorization.
4. **Payments in flight at the moment of a pause.**
   - A card payment already started goes to recovery and verification as before.
   - A Wallet retry with the same request ID is recovered.
   - Paystack authorizations are never revoked.
   - Affected orders are reviewed by the existing operations process; nothing is cancelled, refunded or resubmitted automatically.
5. **Release A's reviewer note on Wallet retries.** It said a Wallet retry could be refused by the pause. Re-checked: the retry is matched at the start of payment initialization, before any availability check, and a test now proves it. No 3.5 action is needed beyond keeping that order.

## Founder actions

1. **Verify MTN Airtime and MTN Instant Bundles with the supplier.** Neither is paused, because the incident notice named MTN Data only. If either is affected, set it to Maintenance in the Service Control Center.
2. **December campaign.** Every product in the shipped December Specials draft is MTN Data. While MTN Data is paused, the campaign would have nothing to sell. Its amounts were not changed and it was not activated.

## Safe MTN Data restoration procedure

Restoration is a founder decision. The expected date never does it.

1. **Confirm with the supplier,** in writing, that MTN Data delivery has resumed. A supplier refund is not proof that the customer was refunded; reconcile affected orders separately.
2. **Check Admin.** The MTN Data card should show the supplier route configured, online payment permitted, and the expected number of products for sale.
3. **Open Manage MTN Data, choose Operational,** read the effect ("lifts the manual pause… does not prove the supplier is working"), tick, and save. Wait for "Saved and confirmed by the server".
4. **Update the announcement.** Unpublish or archive "MTN Data service update". Optionally, publish a short "MTN Data is available again" notice (info, MTN Data).
5. **Verify in a private window:** MTN bundles are listed again, with no maintenance chip or notice.
6. **A small live purchase** to confirm delivery end to end, only with the founder's explicit approval.
7. **If anything looks wrong,** set MTN Data back to Maintenance. It takes effect at once on the server that handled the save and within 15 s on any other.
