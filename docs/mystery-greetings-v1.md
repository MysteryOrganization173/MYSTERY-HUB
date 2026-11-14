# Mystery Greetings V1: creator, recipient, sharing and Admin

**Status (14 November 2026): built and switched off.** Merging this changes nothing customers can see.
- Greeting links and creation stay off until their server gates are switched on.
- The optional greetings schema is not installed in production.
- The seasonal homepages keep saying "Coming soon" until the server reports the creator open.

The backend is PR #104 (integrated dormant by #116); see `docs/mystery-experiences-v1-contract.md`. Launch steps are at the end.

## The experience

**Sender:** Choose → Personalize → Preview → Create → Share, at `/greetings` (no account).
**Recipient:** Open → Reveal → Read → Create their own, at `/g/:shareId`.

Both are standalone pages. `src/main.tsx` dispatches them before the app shell loads, so a recipient on a modest Android phone downloads only:
- the shared entry;
- a 3.6 KB recipient chunk;
- an 8 KB shared greetings chunk;
- a 7 KB stylesheet.

(All sizes gzip.)

## UX direction: "Gift → Letter"

Three directions were explored against the backend's two design IDs (`gift-classic-v1`, `gift-starlight-v1`):

| | Emotional impact | Fast to complete | Mobile & reading | Performance | Accessibility | Christmas + New Year |
|---|---|---|---|---|---|---|
| **A. Wrapped gift** | High: anticipation, "for me" | One tap | Gifts hold no text; long messages need another surface | Light SVG | One labelled button | Good; can read as a prize |
| **B. Sealed envelope** | Warm, personal | One tap | Letter paper suits long messages | Light | Good | Christmassy; flat for New Year |
| **C. Starlight reveal** | Elegant, New Year | Ambiguous gesture | Text over motion is hard to read | Particles cost on low-end phones | Weak without motion | New Year only |

**Chosen: a gift that opens into a letter (A + B), with C's light as the Starlight look.**
- **The gift** gives the mystery and one obvious action ("Open your gift"). It matches the backend's "gift" IDs and the homepage's gift art.
- **The letter** that rises out of the box is real text: readable at any length, line breaks kept, zoomable and translatable. It works the same with motion off.
- **Starlight** (star-foil wrap, firework sparks for New Year) carries the "light reveals" idea without making legibility depend on animation.
- **One composition:** occasion × design changes palette, lighting, wrap, bow, tag mark, letter ornament, wording and reveal. There are no separate codebases and no invented variant IDs.

## Creator (`src/greetings/CreatorPage.tsx`)

There are three steps, plus a share screen. A progress bar shows "Step 1 of 3".

1. **Design**
   - Occasion: Christmas 2026 / New Year 2027, as a segmented control.
     - The default is the link's `occasion` (homepage or received greeting).
     - Otherwise it is the real Accra date: New Year from 27 December.
     - Founder preview dates are never read.
   - Gift design: two large live tiles drawn in the chosen occasion's colours. Christmas opens on Classic ribbon, the New Year on Starlight, unless the creator picks otherwise.
2. **Message**
   - "Who is it for?"
   - Message: pick a curated message (with "Surprise me") or write your own, with a 600-character counter.
   - Your name (optional), with "Keep me a mystery".
   - The browser mirrors the server's text rules (`model.ts`, tested against `personalText` itself), so problems show before anything is sent:
     - empty fields;
     - `<` or `>`;
     - links;
     - too long;
     - no letters.
   - Invisible characters are removed. Combined emoji, which the server refuses, are split and the creator is told. Nothing typed is lost.
3. **Preview**
   - The real recipient component: tap the gift to try the reveal.
   - An "Edit" link on each choice.
   - One action: **Wrap my greeting**.
   - The preview saves nothing and shows no link.

**Creating:**
- One request at a time. Rapid taps are ignored, and the button shows "Wrapping your greeting…".
- The idempotency key is tied to the exact content and kept with the draft. A lost answer, an offline moment or a refresh retried with the same content gets the same greeting back (`duplicate: true`), never a second one. Changed content gets a new key.
- Success is shown only after the server's confirmed, canonical link.
- Each failure has its own wording:
  - **offline:** "couldn't confirm, retrying won't duplicate";
  - **busy or rate-limited:** "please wait";
  - **duplicate content within 10 minutes:** "you just made this exact greeting";
  - **creation closed:** says so.
- Momentary server contention (`429 BUSY`) is retried twice after a short random pause. Real rate limits are not.

**Back and refresh:**
- The phone's Back and the on-screen Back move between steps with everything kept.
- Refresh keeps the step and draft.
- A refresh on the share screen keeps the link; a new visit starts fresh.

**Drafts:**
- Kept in this tab only (`sessionStorage`), ignored after two hours, and deleted as soon as the greeting is created.

**Share screen:**
- The link in a read-only field.
- **Share on WhatsApp:** a `wa.me/?text=` link the creator taps.
- **Copy link:** Clipboard API, then a fallback that selects the link. It never says "copied" unless it was.
- **More ways to share:** shown only where Web Share exists, and called directly from the tap. A cancelled sheet says nothing.
- **Open my greeting** and **Create another** (which keeps the sender name and design).
- The copy says "Nothing is sent until you share it"; nothing claims delivery.

**Management:**
- A quiet note under the share actions: "Anyone with the link can open it", that only this browser can remove it later, and that links expire after a year.
- **Remove this greeting**, with a confirmation, revokes it with the creator secret. Only the server's confirmation says "Removed". If the server answers "not found", this browser's secret is not the one that made the greeting: nothing changed, and it offers "Forget it on this device".
- "Sent from this browser" lists earlier greetings (open or remove) with recipient name and date, never the message.
- The page explains that only this browser can remove a greeting, that clearing data or switching phones loses that, and that there is no recovery.
- In storage-blocked private modes it says removal lasts only until the page closes.

## Recipient (`src/greetings/RecipientPage.tsx`, `GreetingStage.tsx`)

1. **Loading:** a soft gift shimmer, "Opening your greeting…", and "Still opening… your connection seems slow." after 6 s.
2. **Sealed:** "A Christmas gift for / **Ama** / From Kofi". The name is set large in the festive serif and scales down for long names. Below it, the gift breathes gently and "Open your gift" is one large labelled button.
3. **Reveal (about 1.7 s):**
   - the bow unties;
   - the lid lifts away;
   - light and sparks rise;
   - the letter comes up out of the box and grows into place;
   - the box settles away.
4. **Read:**
   - cream letter paper with a foil edge;
   - an ornament (holly, or a New Year star);
   - "MERRY CHRISTMAS, / Ama";
   - the message (`white-space: pre-line`);
   - "From Kofi" or "From a mystery sender".
   - Focus moves to the greeting's heading. The actions below fade in 0.6 s later, so the letter is read first.
5. **Then:**
   - **Create your own greeting** (only while the server reports creation open);
   - **Replay the surprise** (a quiet button);
   - the New Year countdown (New Year greetings only);
   - one line about Mystery Greetings;
   - **Visit Mystery Hub**.
   - In the footer: "Report this greeting" and a small "Mystery Greetings by Mystery Hub".

**Reduced motion:**
- No idle movement and no flying parts.
- The gift fades and the letter fades in where it will stay (about 0.25 s).
- The page also works with no animation support: the state machine runs on timers, not animation events.

**Errors:**
- **Malformed link:** refused before any request.
- **Unknown, expired or removed:** one shared, private message ("isn't available… may have expired, or the person who sent it may have removed it").
- **Service paused, busy, offline:** retry, and offline retries by itself on reconnect.
- Every error page offers Visit Mystery Hub. "Create a greeting" appears only when creation is open.
- No page shows the link ID or hints that a particular greeting exists.

**Report:**
- Three reasons: abusive, spam or scam, someone's private information.
- "Thank you. Mystery Hub will review this greeting." appears only when the server stored the report; a limit or outage asks to try again. Reports never remove anything by themselves.

## Christmas and New Year

| | Christmas 2026 | New Year 2027 |
|---|---|---|
| Light | Wine-to-pine night, warm berry glow, gold bokeh | Midnight navy, champagne glow (Starlight: near-black sky with stars) |
| Classic gift | Berry velvet, gold satin bow | Midnight blue, champagne bow |
| Starlight gift | Evergreen with gold star foil, upward sparks | Night-sky wrap with silver stars and bow, a firework ring of sparks |
| Tag and ornament | Holly sprig and berries | Four-point star |
| Words | "A Christmas gift for", "Open your gift", "Merry Christmas," | "A New Year surprise for", "Open your surprise", "Happy New Year," |
| Letter | Berry ink accents | Navy accents and a faint "2027" foil mark |
| Extras | — | The countdown to 00:00 on 1 January 2027 in Accra, after the reveal |

**Shared across both:** Mystery Hub green for actions (as on the approved seasonal homepages), gold or champagne for the season, Fraunces italic for names and headings, and Plus Jakarta Sans for reading.

**Ghanaian letters:** Fraunces, Plus Jakarta Sans and Outfit have no Ɛ ɛ Ɔ ɔ Ɖ ɖ Ƒ Ɣ ɣ Ʋ ʋ Ʒ ʒ, so names such as Ɛfua or Ɔsei would have mixed in a mismatched fallback. A Noto Serif Display italic subset of exactly those letters (Google Fonts `text=`, a few kilobytes) follows Fraunces in the serif stack, and Noto Sans follows Plus Jakarta Sans (it is the system font on Android). The browser takes each missing glyph from the next font, so the line stays one style. The approved seasonal homepages still use Fraunces alone for names; the same fix would help there, separately.

**Curated messages:** they come from the authoritative catalogue (`shared/mysteryExperiences.ts`). This release adds one Ghanaian greeting per occasion through that same contract (`christmas-afehyia-v1`, `newyear-afehyia-v1`). The server validates them, serves them and stores a snapshot.

## New Year countdown (`countdown.ts`)

- **Source:** the existing `/api/experiences/countdown` contract. No new time service.
- **Clock correction:** the server's remaining time is anchored to the page's monotonic clock at the midpoint of the request, so a wrong phone clock does not matter and the count cannot drift.
- **Ticking:** whole seconds. It stops at zero and says "It's 2027 in Accra. Happy New Year!". It bows out after 7 January.
- **Resync:** whenever the page returns to the foreground or the connection comes back.
- **Placement:** shown only after the reveal, so it never competes with opening the gift. Screen readers get one summary rather than a ticking announcement.

## Link previews and routes

- **`/g/<24-character ID>`**
  - The Node responder answers 200 or 404 from `ExperienceService.exists`.
  - The head is generic: "🎁 A special surprise is waiting for you." and "Open a little surprise…".
  - No names or message ever appear in the head.
  - The image is a fixed branded card, `https://mysterybundlehub.com/og/mystery-greetings-v1.jpg` (1200×630 JPEG, 50 KB, `public/og/`). It is rendered from the real gift artwork and the approved logo, and uploads nothing to Cloudinary.
  - The canonical host is always `mysterybundlehub.com`, with `noindex, nofollow` and `no-store`.
- **`/greetings`:** its own head ("Mystery Greetings — Wrap a Christmas or New Year greeting", the same card), canonical without query, and noindex.
- **When the creator is offered:** the seasonal homepages, the creator page and the recipient's "Create your own" all follow one server answer: both gates on and the abuse secret configured (without it every create is refused).
- **Other routes:** `/sites/*`, `/c/*`, product and app routes are unchanged. `/g` paths mirror the server's own `^/g(/|$)` rule.

## Admin (System Health → Mystery Greetings)

**Readiness** (`GET /api/admin/experiences/readiness`, Admin only, never throws). It reports:
- links gate;
- creation gate;
- abuse secret (configured or missing; never its value);
- schema (installed, not installed, or could not check);
- whether retention clean-up is due;
- when clean-up last ran;
- plain-language blockers.

**Totals** (7, 30 or 90 days) from the database:
- greetings created;
- greetings still open;
- greetings created from a received greeting;
- interaction counts with estimated browsers.

There are no names or messages in this panel.

**Reports:** reported live greetings, each with "Review" (opens the link as a recipient sees it) and "Remove" (needs an acknowledgement, and is audited). "Remove a greeting by its link" accepts a pasted link or ID.

**Clean-up:** runs the bounded retention maintenance (confirmation, audited).

**Contention:** the server serves at most two greeting database transactions per process and answers a third at once with `429 BUSY`. The pages retry that twice after a short random pause (every greeting call is a read, idempotent or deduplicated), and Admin loads its numbers one after another.

**Clean-up matters:** while any greeting expired or removed more than 30 days ago remains, the server refuses new greetings. The panel flags this as "Due now".

The existing Seasonal experience panel is unchanged. Nothing here switches greetings on.

## Privacy and security

- **Rendering:** personal text is React text only. There is no HTML rendering anywhere in `src/greetings` (tested).
- **Links:** canonical `https` links only, from the server, checked again in the browser.
- **The creator secret** (32 random bytes):
  - lives in this browser's storage;
  - is sent only in the create body and the remove request's `Authorization: Greeting …` header;
  - never appears in a link, the WhatsApp text, analytics, the URL or a log.
- **"Create your own":** the received greeting's ID travels in the tab (`sessionStorage`, 30 minutes, read once), never in the creator's URL. It is sent only when analytics is allowed, and the server drops it again for Do Not Track, GPC and bots.
- **Analytics:** interaction counts only, with the site's existing anonymous browser and session IDs. They are off with Do Not Track, GPC, blocked storage, Admin or preview paths, and the server filters bots and prefetches.
- **Limits:** every existing server limit, quota, idempotency rule, 10-minute duplicate-content rule, report cap and Admin check is unchanged and exercised.
- **Removing:** removing someone else's greeting needs their secret, and a wrong one answers like "not found".
- **Unaffected:** payments, pricing, suppliers, Wallet, checkout and the seasonal switch are untouched.

## Verification

See the PR for the latest numbers.
- **Unit:** `mysteryGreetingsV1.test.ts`.
- **Native PostgreSQL:** `mysteryExperiencesPostgres.test.ts`, which now also covers readiness.
- **End to end:** `scripts/reviewMysteryGreetings.cjs`.
  - Real browsers against a local production build with a disposable database.
  - Three gate phases: open, closed, dark.
  - Eight viewport sizes.

## Before launch (each needs founder approval)

1. **Install the schema.** Install `server/db/mysteryExperiences.sql` on production, following the contract's installation sequence (backup, owner role, lock timeout, verification).
2. **Set the abuse secret.** Set `EXPERIENCES_ABUSE_SECRET` (64 hex characters) on the API service.
3. **Turn on links.** Set `MYSTERY_GREETING_LINKS_ENABLED=true`, then with one synthetic greeting check:
   - `/g/<id>` and its head on the real domain;
   - that `https://mysterybundlehub.com/og/mystery-greetings-v1.jpg` returns `image/jpeg`;
   - a WhatsApp preview, sent to yourself.
4. **Turn on creation.** Set `MYSTERY_GREETINGS_ENABLED=true`. `/greetings` opens, and the seasonal homepages show "Create a greeting" (within 5 minutes, the status cache).
5. **Seasonal homepages.** These entries are seen only while the seasonal presentation (`SEASONAL_EXPERIENCE`) is on, which is a separate approval. `/greetings` works directly either way.
6. **Run clean-up.** Run retention clean-up from Admin whenever it shows "Due now". Removed greetings make it due 30 days after removal.

**Capacity:** each server process serves at most two greeting database transactions at once (a #104 design limit). Brief bursts are retried in the browser, but no production load test has been done.

**Turning off:** setting `MYSTERY_GREETINGS_ENABLED=false` stops new greetings while existing links keep working. Turning links off hides every greeting.
