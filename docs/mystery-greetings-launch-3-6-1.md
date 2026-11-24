# Mystery Hub 3.6.1 · Mystery Greetings: launch readiness, refinement and qualification

**Status:** code release. Mystery Greetings stays **off in production**. Nothing in this release turns on a gate, installs the schema, sets a secret or creates a production greeting. Activation is a separate founder decision; the runbook is at the end.

**Baseline:** `origin/main` at `189dc3a` (PR #142 merge). Open PRs at the start: only the stale draft #69 (backend), which this release does not touch.

**Screenshots:** [`docs/screenshots/mystery-greetings-3-6-1/`](screenshots/mystery-greetings-3-6-1/). They use synthetic names and messages only, from a local server and a disposable database.

## A. Initial assessment

Mystery Greetings was already a substantial, careful implementation (PRs #104, #116, #117). This release kept almost all of it.

| Area | Finding |
| --- | --- |
| Creator flow: idempotency, single-flight create, honest failure wording, history-aware Back, two-hour tab drafts, blocked-storage fallback | **Already excellent.** Kept. |
| Recipient: sealed gift, letter as real text, privacy-preserving error pages, Ghanaian-letter font fallback | **Already excellent.** Kept. |
| Raw-HTML `/g/:id` responder, generic OG head, OG image | **Already excellent.** Verified live in production (section F). |
| Privacy model: creator secret, hidden sender, analytics consent, plain-text rendering | **Already excellent.** Kept and re-verified. |
| OG image `/og/mystery-greetings-v1.jpg` | **Appropriate.** Generic, festive, branded, no personal data. Not changed. |
| Sealed-gift idle motion (bob, halo, bow wiggle) and the Starlight sky twinkle | **Genuine defect.** Ran `infinite`, the same battery issue found in PR #142's review, on a page opened from WhatsApp on budget phones. |
| Public "creator is open" signal (`/api/seasonal/status` `createPath`, `/templates` `creationConfigured`) | **Genuine defect.** Advertised from the gates and secret alone. A missing schema or overdue retention clean-up (which makes the server refuse every create) still advertised a working creator, so people would have filled in a whole greeting only to be refused. |
| Admin readiness | **Worth refining.** It showed the right facts but no single verdict on whether the feature actually works. "Switched on" could be mistaken for "live". |
| Reveal peak | **Worth refining.** The words arrived with the paper, and the sparks barely registered. |
| Letters | **Worth refining.** The Classic and Starlight letters differed only in ink colour. The New Year "2027" mark collided with the inner foil border. |
| Accessibility | **Genuine defect (moderate, pre-existing).** After opening, the page had no `h1` (axe `page-has-heading-one`). |
| Creator details | **Worth refining.** "Surprise me" could pick an off-screen card. The share-screen buttons wrapped at 390 px. Changes of step or design had no feedback. |
| Project harness | **Harness defect.** It force-checked a hidden radio that a sticky bar covers at 320 px (one false failure in the baseline). |

## B. Creative outcome

The concept stays the same: wrapped gift → anticipation → reveal → personal letter → share or create your own. This release refines how it is executed.

- **The reveal peak** (still 1.7 s, with nothing added to its length):
  - The bow unties and the lid lifts. A soft bloom of the season's light opens behind the box. The sparks are larger and glow more, so the moment of opening registers.
  - The paper rises out of the box first and blank. Then the words write themselves in reading order: ornament, "Merry Christmas,", the name, the message, the signature, the foot.
  - Everything settles before the letter is handed over, so focus moves to the greeting and nothing replays.
- **Four letters, four identities, one component:**
  - Classic letters carry the gift's own satin ribbon, tied across the top corner. Gold at Christmas, champagne for the New Year.
  - Starlight letters carry a scatter of foil stars in two corners. Gold at Christmas, silver for the New Year.
  - The New Year "2027" foil mark now sits inside the border.
  - All decoration stays in the margins, behind the words, and never covers text.
- **The sealed gift:** breathes, glows and gives its bow two little tugs, then rests after about 12 s. The Starlight sky twinkles through a finite sequence. Nothing loops forever.
- **Creator micro-interactions:**
  - A new step's content rises in, while its sticky actions stay anchored.
  - Choosing a gift design makes that gift hop. A chosen message's check pops.
  - "Surprise me" scrolls its pick into view.
  - The whole sky crossfades when the occasion or design changes.
  - The share screen opens with the gift landing in a glow. "Copied" confirms with a pop.
  - On narrow phones the share actions stack instead of wrapping.
- **Rules for every new animation:**
  - It is transform or opacity only.
  - It plays once, on a real change.
  - It is off with reduced motion, and the information and controls are identical either way.

## C. Creator experience

Unchanged, and re-verified:
- Occasion and design use real gift previews. The occasion comes from the link or the real Accra date; founder preview dates are never read.
- Personalisation covers name, curated or own message, "Surprise me", optional sender and "Keep me a mystery".
- The client mirrors the server's text rules and explains anything it rejects without losing the draft.
- The preview is the real recipient component. It saves nothing and makes no link.
- There is one idempotent create. Success is shown only from the server's canonical link.
- Rate-limited, busy, offline, duplicate and closed each get their own wording.
- Management: removal only with this browser's secret. "Sent from this browser" lists greetings without their messages.

**New:** when the server would refuse a greeting (schema missing, or retention overdue), `/greetings` shows "isn't open right now" instead of a form.

## D. Recipient experience

Unchanged, and re-verified:
- loading and slow states;
- the sealed invitation;
- one labelled button to open;
- the letter as real, zoomable, translatable text with line breaks kept;
- the accurate hidden-sender line;
- the actions after the reveal;
- the New Year countdown, after the reveal only;
- reporting;
- calm, private error pages that never reveal whether a greeting exists.

**New:**
- the refined reveal and letters;
- finite motion;
- once opened, the greeting is the page's `h1`, and focus lands on it;
- "Create your own" is offered only while a new greeting would really be accepted.

## E. Sharing and discovery

Unchanged, and re-verified by the harness:
- the WhatsApp `wa.me` link carries a warm teaser and the link only, never the message, a name or the secret;
- "Copy link" never claims success it did not get;
- native share is hidden where unsupported, and a cancelled sheet is never reported as sent;
- "Open my greeting" and "Create another";
- recipient to creator passes context in the tab only (never in the URL), and only when analytics consent allows.

**Evidence types:** these are simulated browser checks against the local production build. No real WhatsApp message or crawler fetch was made. Live production checks were read-only (section F).

## F. Technical and operational readiness

### Directly verified in production (read-only, 23–24 November)

| Check | Result |
| --- | --- |
| `GET https://mysterybundlehub.com/g/<unknown 24-char ID>` | **404**, served by the Node/Express responder (`x-render-origin-server: Render`, `no-store`). Head: "Greeting unavailable — Mystery Hub", canonical `https://mysterybundlehub.com/g/…`, `noindex, nofollow`, no image. |
| `/greetings` | **200**, its own head ("Mystery Greetings — Wrap a Christmas or New Year greeting"), the OG image, canonical, noindex. |
| `www.` and `http://` greeting links | **301** to `https://mysterybundlehub.com/g/…`, path preserved. |
| `/og/mystery-greetings-v1.jpg` | **200** `image/jpeg`, 50,155 bytes. |
| `GET /api/seasonal/status` | Season off. `greetings.createPath: null`, so the homepages say "Coming soon". |
| `GET /api/experiences/templates` | `creationConfigured: false`. |
| `GET /api/experiences/countdown` | Target `2027-01-01T00:00:00.000Z`, server-time based. |
| `GET /api/experiences/greetings/<unknown>` | 404 `GREETING_UNAVAILABLE`. By design this is the same answer whether links are off or the ID is unknown. |
| Optional schema, Supabase project "Mystery Hub Production" (`fcvydpuuwbciuulrvizk`) | **Not installed.** A metadata-only listing of schema `mysteryhub_experiences` returned **no tables**. No rows were read and no SQL was run. |

**Routing conclusion.** The historical launch blocker is resolved on the canonical host. A static SPA fallback would answer 200 with the homepage head; production instead answers 404 with the greeting head. So `mysterybundlehub.com` reaches the Node responder, which serves per-greeting status, generic metadata and the frontend assets. No repository routing change was needed.

**What production cannot show yet.** Successful retrieval of a real greeting and a real WhatsApp preview cannot be demonstrated while links are off and the schema is absent. That is step 4 of the runbook.

**Gate state:** links off, creation off, abuse secret not configured as far as the public signals show, and the season off. The Admin readiness endpoint requires an Admin session and was not called in production.

### Changed in this release (server)

- **`greetingCreationAvailable()`** (`server/services/experienceService.ts`) answers whether a greeting would really be accepted. That means both gates on, the abuse secret valid, the schema installed and retention not overdue.
  - `/api/seasonal/status` (homepages) and `/api/experiences/templates` (creator, recipient's "Create your own") now advertise only this.
  - **Gates off:** answered from the environment alone, with no database access, so the current production state costs nothing.
  - **Gates on:** one small read-only check per process per minute at most (schema present, nothing overdue, no audit query), shared by concurrent callers.
  - **No waiting:** visitors never wait on the database. An earlier answer is served at once while the check refreshes (stale-while-revalidate), and the first answer in a process waits at most 1.5 s.
  - **Failures:** a momentary `BUSY` is never remembered as "closed". Storage that answers with an error counts as unavailable for 15 s.
  - **Caching:** while the greetings switches are on, `/api/seasonal/status` is browser-cacheable for 60 s instead of 300 s, so a change reaches visitors within about two minutes. Admin clean-up refreshes the answer at once.
  - **Creator:** the closed creator page has "Check again".
  - The two-transaction concurrency cap is unchanged.
- **Admin readiness** adds two fields:
  - `available` (links and creation actually working);
  - `status`:
    - `live`;
    - `links-only` (links work and the creation switch is off);
    - `off`;
    - `not-working` (anything switched on that does not actually work, for example creation switched on while retention is overdue).
  The panel leads with that verdict, then shows the environment switches, then the working-now checks. It never shows a secret value, a message or a name.

## G. Privacy, safety and performance

- **Unchanged:** share-ID entropy, the creator secret (storage, header-only), hidden sender (never sent or stored), plain-text rendering (tested: no HTML sinks in `src/greetings`), input validation, idempotency, duplicate rules, quotas, report limits, Admin authorisation and audit, retention, the 365-day expiry, the separate link and creation gates, and the January 6 independence.
- **Battery and CPU:**
  - No greeting animation loops forever. The only loops left are the loading shimmer and the "Wrapping…" spinner, which exist only while a request is in flight.
  - The browser check measured 0 running animations on a sealed gift after about 14 s, on the Starlight sky after its sequence, and after the reveal.
- **Bundle (gzip):**
  - recipient JS 3.70 → 3.71 KB;
  - greetings CSS 7.59 → 8.53 KB;
  - creator JS 8.22 → 8.40 KB;
  - in total, a recipient on mobile data downloads **+0.95 KB**;
  - the app entry is 74.66 KB, against 74.65 KB.
- **Accessibility:** axe found no serious or critical issues on the recipient or creator. The pre-existing moderate `page-has-heading-one` is fixed.

## H. Verification

- **Type check and build:** `npx tsc --noEmit` is clean and `npm run build` passes.
- **Native PostgreSQL** (`mysteryExperiencesPostgres.test.ts`):
  - **19/19** against a disposable local PostgreSQL 16, with a non-superuser `NOBYPASSRLS` owner and synthetic `anon`/`authenticated`/`service_role` roles.
  - It is now 19 tests rather than 18 because this release adds real-schema availability checks: missing schema, live, retention overdue, and live again after clean-up.
- **Focused unit suites:** `mysteryGreetingsV1`, `mysteryExperiences`, `christmasWelcomeAndGreetings`, `seasonalExperience`, `christmasFinalQa`, `socialSharing` and `clientRouting` all pass. The new `mysteryGreetingsLaunch361.test.ts` has 8 tests, including the availability timing cases from the independent review:
  - a busy moment is never cached as closed;
  - the first answer waits at most 1.5 s;
  - stale-while-revalidate;
  - the public check reads no audit or personal data.
- **Updated tests, same or stronger intent:**
  - The homepage-entry test keeps every original case. It adds: storage missing, retention overdue and storage unreadable each close the creator; the gates-off path never reads the database; and repeated status calls share one check.
  - Two source pins now name `greetingCreationAvailable`.
- **Project end-to-end harness** (`scripts/reviewMysteryGreetings.cjs`): **30/30**, with each phase against a server whose gates were verified first.
  - open: 28/28;
  - links on, creation off: 1/1;
  - both off: 1/1.
  - The harness ran against a local production build over **verified TLS** (a throwaway local CA), because since PR #141 production mode requires it. Its loopback-only and `*_test` database guards are unchanged.
- **Harness fixes:**
  - It taps the visible "Write my own" option and fails loudly if it did not select. Before, it force-checked a hidden input.
  - The Admin check now also requires "Status: Live" and both "working now" rows.
- **Supplementary browser QA: 30/30.**
  - Motion: idle motion stops; the Starlight sky stops; nothing keeps running after the reveal.
  - Retention overdue: the creator is closed on the homepages, `/greetings` and the recipient's "Create your own"; links keep opening; Admin says "Switched on, but not working" with the reason. After the audited clean-up, Admin says "Live" again.
  - Homepages, guest and member, on 10, 25 and 31 December and 1 January: "Create a greeting" opens the creator on the right occasion.
  - Emulated Pixel 7, Galaxy S9+, iPhone 13 and iPhone SE. This is Chromium device emulation, not physical devices.
- **Full regression suite** (after merging PR #143): **3627 tests, 3566 pass, 0 fail, 61 skipped**.
  - `main` alone: 3619 / 3558 / 0 / 61. The difference is the 8 new tests.
  - The 61 skips are the opt-in native PostgreSQL suites, which need a database URL. The greetings one ran separately (19/19).
- **Harness hardening:** it never force-checks a hidden input. It taps the visible option, as a customer does, and asserts the option was selected.
- **Independent review** (a separate review agent):
  - No critical findings.
  - **Fixed, important:**
    - a switched-on but failing creator now reads "not working", not "links only";
    - the availability check can no longer make visitors wait, or cache a busy moment as closed;
    - the runbook's expected statuses now match the code.
  - **Fixed, minor:**
    - the bloom ends before the hand-over and stays inside the stage;
    - the 2027 mark sits behind the words;
    - "Surprise me" moves focus to its pick;
    - stale Admin readiness is cleared when a refresh fails;
    - the raw creation switch is shown;
    - clean-up refreshes availability at once;
    - the closed creator has "Check again";
    - the status route never throws.
  - **Confirmed and strengthened:** the proxy-identity analysis (reporting could be silenced; Cloudflare validation must check Render's appended hop) and the decision to document it as an activation blocker rather than change it unasked.

## I. Release

See the PR (branch `claude/elegant-lamport-q2binq`).

## J. Founder activation runbook (each step needs your separate approval)

### 0. Preconditions: required before any public activation

1. **Fix visitor identity behind the proxy (blocker).**
   - **The problem:**
     - Greeting quotas key on `req.socket.remoteAddress`.
     - Repository evidence (`server/routes/creativeStudioApi.ts`) says the API runs behind Render's proxy without `trust proxy`, so that address is the proxy, not the visitor. Every visitor would then share one identity.
     - Successful creates are limited to **20 per hour per identity**. That would mean about 20 greetings an hour for everyone together.
     - Reports (10 a day), management (60 an hour) and the per-process limits (240 requests a minute, 15 creates a minute) would also be shared.
   - **Reporting could be silenced.** Reports are keyed per identity (`PRIMARY KEY(greeting_id, reporter_hash)`) with 10 a day per identity. Behind a shared proxy identity, that means one report per greeting per day for everyone, and one person could use up reporting for the whole site.
   - **It does not make anything looser:** greetings cannot be over-created. That is why merging this release (gates off) is fine. Launching is not.
   - **Fix (backend workstream, with your approval):** derive the identity from a client address you can trust, then hash it exactly as `abuseIdentity` does today.
     - The origin cannot simply be restricted to Cloudflare on Render: `*.onrender.com` stays reachable and bypasses Cloudflare.
     - So trust `CF-Connecting-IP` only after checking that the **rightmost** `X-Forwarded-For` hop (the one Render appends) is inside Cloudflare's published IP ranges. Otherwise use that rightmost hop.
     - Never trust headers the visitor sends.
     - Then re-tune the initial limits.
2. **Verified backup** of production, and confirmation of the actual backend owner role that will own the schema.
3. **Capacity:**
   - Each process serves at most two greeting transactions at once, by design.
   - No production load test has been done.
   - Decide the number of Render instances and accept the browser's brief `BUSY` retries.
4. **Retention ownership:**
   - Someone must run Admin → System Health → Mystery Greetings → **Run clean-up** whenever it shows "Due now" (30 days after the first removal or expiry).
   - Until it runs, new greetings are refused, and now they are also not advertised.

### 1. Install the optional schema (gates still off)

- **Prerequisites:** verified backup, maintenance window and the backend owner role.
- **Run:** `server/db/mysteryExperiences.sql` in one transaction (it sets its own `lock_timeout`) as that owner. It is safe to re-run.
- **Verify:**
  - four tables in `mysteryhub_experiences`, RLS enabled on each;
  - `anon`, `authenticated` and `service_role` have no `USAGE` on the schema.
- **Rollback:** leave the gates off. Do not drop data without a separate retention decision.

### 2. Configure the abuse secret

- **Set:** `EXPERIENCES_ABUSE_SECRET` (64 hex characters, freshly generated, never shared in chat) on the **Node web service that answers `mysterybundlehub.com`**. That is the service verified above, not the static site.
- **Expected:** Admin readiness shows "Abuse protection secret: Configured" and "Status: Off" (both switches still off).

### 3. Turn on links only

- **Set:** `MYSTERY_GREETING_LINKS_ENABLED=true`.
- **Expected:**
  - Admin shows "Status: Links only", with "Shared links working now: Yes" and "New greetings accepted now: No".
  - If it says "Switched on, but not working", the schema is missing or unreadable. Turn links off and fix that first.
  - `/g/<unknown>` stays 404.

### 4. Controlled real-domain test greeting (creation is still not public)

The create API needs both gates, and there is no fixture or back door (by design). So:

1. With the **season presentation still off** (`SEASONAL_EXPERIENCE` unset), nothing on the site links to `/greetings`. Briefly set `MYSTERY_GREETINGS_ENABLED=true`.
   - The creator is then **unadvertised, not private**. Anyone who types `/greetings` or calls the API can create during this window, within the server's limits.
   - Do this only after J.0.1 is fixed, and keep the window short.
2. Within about 2 minutes (browser status cache 1 minute, availability check 1 minute), open `https://mysterybundlehub.com/greetings` and create one synthetic greeting (for example "Test" → "Founder QA").
3. Set `MYSTERY_GREETINGS_ENABLED=false` again. Links keep working.
4. Check:
   - `curl -I https://mysterybundlehub.com/g/<id>` returns 200, `no-store`, `noindex`;
   - the head shows "🎁 A special surprise is waiting for you." with no name or message;
   - `og:image` returns `image/jpeg`.
5. **WhatsApp:** send the link to yourself. The card should show the generic surprise text and image. Open it on a second phone with a different network or browser and reveal it.
6. Remove the test greeting from the creator's browser (**Remove this greeting**), or keep it as a reference.

Alternatively, skip step 3 and go straight to step 5 if you are ready to launch creation.

### 5. Turn on creation

- **Set:** `MYSTERY_GREETINGS_ENABLED=true`.
- **Expected:**
  - Admin shows "Status: Live".
  - `/greetings` opens.
  - "Create your own" appears after a reveal.
  - The seasonal homepages show "Create a greeting", but only while the season presentation is on. That is a separate decision.
- **Seasonal homepages:** turning on `SEASONAL_EXPERIENCE=christmas-2026` is independent of Greetings.

### 6. Real-device acceptance

On a budget Android phone (Chrome), an iPhone (Safari) and WhatsApp's in-app browser:
- create, share and open;
- reveal and replay;
- reduced motion;
- the New Year countdown from 27 December;
- report a test greeting, and remove it from Admin.

### Rollback (fast, keeps shared links)

- **Stop new greetings:** `MYSTERY_GREETINGS_ENABLED=false`. The server refuses new greetings at once. Pages stop advertising the creator as soon as their cached status expires (at most 5 minutes once the switch is off, because the browser cache returns to 300 s). Existing links keep opening.
- **Emergency hide-everything:** `MYSTERY_GREETING_LINKS_ENABLED=false`. Every greeting answers 404.
- **Season off on 6 January:** this never revokes greetings. They expire 365 days after creation.

## K. Remaining recommendations

**Required before activation**
- **Visitor identity behind the proxy.** See J.0.1. This belongs to the backend workstream (3.5) and needs your approval.
- **Production steps.** Schema installation, the secret and the controlled real-domain test (J.1–J.4).

**Desirable after activation**
- **Retention clean-up.** A scheduled, audited clean-up through existing operations, so it never blocks creation.
- **Load test.** Capacity under seasonal peaks, then tune the 2-transaction cap and the quotas.
- **Real-device checks.** Physical Android, iPhone and WhatsApp in-app browser.

**Optional future features**
- More gift designs, through a reviewed contract change (variant IDs are part of the persisted contract).
- Per-occasion message packs.

**Standalone Mystery Countdown** (separate assignment). Ready to reuse:
- `src/greetings/countdown.ts` (server-time anchoring, monotonic clock, resync on foreground and reconnect, `countdownParts`);
- `/api/experiences/countdown`;
- the New Year copy and palettes.

Not built: a full-screen experience and a midnight transition.

**Mystery Hub 3.5**
- **Visitor identity:** as above.
- **Static site:** the Render static site's `render.yaml` SPA catch-all no longer serves the canonical domain for `/g/*`. Keep it that way if domains change.
