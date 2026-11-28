# Mystery Hub 3.7 · Mystery Countdown: the final experience

**Status:** built on branch `claude/project-thread-iqmma9` from `main` at `3bee064` (PR #160). **Waiting for the founder's creative approval.** Nothing is merged or deployed. Section 15 records the approval and release once they happen.

**What this release does not do.** It does not switch on Mystery Greetings or Mystery Gifts. It does not touch campaigns, services, Paystack, payments, prices, suppliers, refunds, SMS or broadcasts. It changes no production setting, secret, schema, environment variable or Cloudinary asset. It buys no licence. It stays out of the Website Builder.

**How to read this report.** Four kinds of evidence are kept apart:

- **Implemented:** in the code on the branch.
- **Synthetic verification:** tests and a local production build in headless Chromium, with a controlled server clock.
- **Physical-device acceptance:** not done. Nothing here was tried on a real phone, tablet or television.
- **Verified production behaviour:** not yet. Nothing is deployed.

I cannot listen to audio. Every judgement about sound quality in this report is structural: loudness, peaks, timing and spectrum. The founder's audition is the real test of whether the music is good.

## 1. Founder feedback addressed

| Feedback | What changed |
|---|---|
| The synthesised ambient soundtrack sounds like a space simulator. It is too quiet and feels artificial. | Retired. The oscillator score (`score.ts`, `voices.ts`) is deleted. The new soundtrack is eleven solo acoustic piano recordings of traditional carols and New Year melodies. They are mastered to −16 LUFS, which is normal streaming loudness and about 4 dB louder than before. |
| The final ten seconds and midnight are underwhelming. | New sound design throughout: a piano build for the final minute, ten distinct second cues that climb in tension, and a midnight impact. The impact has a deep, controlled low end, golden fireworks across the stereo field, and the chorus of Auld Lang Syne. |
| The page looks the same on every screen. | Five composed layouts: phone, tablet portrait, landscape (laptop, desktop and TV, two columns), ultrawide, and a centred cinematic focus for the final minute and midnight. The dial and type scale with the screen's height as well as its width. |
| The page keeps saying Accra. | Ghana-wide wording throughout, said once where it helps rather than everywhere (section 9). The clock is unchanged: `Africa/Accra`, GMT, the server's time, and the target 1 January 2027 00:00 GMT. |

## 2. Creative direction

The page should feel warm and human, not futuristic. The approved Midnight Dial, the navy and champagne-gold palette, and the typography all stay. The sound is a quiet solo grand piano in a warm room, the kind of music people leave playing while they relax.

The occasion builds through the evening:

1. Christmas carols.
2. A turn toward the New Year.
3. Auld Lang Syne on New Year's Eve.
4. A focused final minute.
5. Ten seconds that become the main event.
6. A midnight that feels significant.
7. A calm, beautiful Welcome 2027 with Ode to Joy.

## 3. The music catalogue

**Where the music comes from.** No free recording library offered what the brief needed. The candidates were either non-commercial or no-derivatives Creative Commons, electronic rather than acoustic, or licensed in a way that forbids standalone public audio. Buying a licence was not authorised. So the recordings were made for Mystery Hub:

- **Melodies:** public-domain tunes.
- **Settings:** public-domain hymn settings from the Open Hymnal Project, ABC edition 2026.11 (<https://openhymnal.org/>, terms at <https://openhymnal.org/copying.html>).
- **Arrangements:** original solo-piano arrangements written in `scripts/countdown-music/pieces.py` and `arrange.py`. They cover the intros, a different texture for each verse, voicings, dynamics, pedalling, rubato, key changes and endings.
- **Piano:** each arrangement is played offline through the **Salamander Grand Piano V3** samples. These are a Yamaha C5 sampled by Alexander Holm at 16 velocity layers, licensed **CC BY 3.0**, which allows commercial use with attribution (<https://archive.org/details/SalamanderGrandPianoV3>).

No third-party recording is used. Nothing was downloaded from a streaming service. Nothing was bought.

| # | Track | Music | Character | Length | Opus | MP3 |
|---|---|---|---|---|---|---|
| 1 | Silent Night | Franz Xaver Gruber, 1818 | hushed, lullaby, rises a tone for the last verse | 2:40 | 2.33 MB | 3.14 MB |
| 2 | The First Noel | Traditional English carol | flowing, a four-part hymn verse in the middle | 2:40 | 2.33 MB | 3.17 MB |
| 3 | Away in a Manger | James R. Murray, 1887 | gentle waltz, music-box intro | 2:04 | 1.85 MB | 2.41 MB |
| 4 | What Child Is This? | Greensleeves, English traditional | minor-key, nostalgic | 2:16 | 1.98 MB | 2.68 MB |
| 5 | In the Bleak Midwinter | Gustav Holst, 1906 | reflective, the most spacious | 3:32 | 3.08 MB | 4.09 MB |
| 6 | O Come, All Ye Faithful | John Francis Wade, 1743 | warm, stately, fuller last verse | 3:16 | 2.88 MB | 3.84 MB |
| 7 | Angels We Have Heard on High | Traditional French carol | bright, the Gloria in octaves | 2:05 | 1.83 MB | 2.39 MB |
| 8 | Hark! The Herald Angels Sing | Felix Mendelssohn, 1840 | joyful, festive energy | 3:09 | 2.78 MB | 3.70 MB |
| 9 | Joy to the World | After Handel, arr. Lowell Mason, 1836 | celebratory, the bridge to New Year | 2:02 | 1.76 MB | 2.44 MB |
| 10 | Auld Lang Syne | Traditional Scottish melody | tender, then hopeful; harmony written for Mystery Hub | 3:19 | 2.97 MB | 3.88 MB |
| 11 | Ode to Joy | Ludwig van Beethoven, 1824 | uplifting, the New Year's first track | 2:30 | 2.19 MB | 2.96 MB |

**Why eleven, not 6 to 10.** Each season plays 6 to 9 of these tracks (section 5). The catalogue is the union of those seasons.

**O Holy Night was left out.** Its well-known settings and modern arrangements are not clearly public domain. The Open Hymnal setting is too sparse for a strong arrangement.

**Rights, part by part (brief §6).**

1. **Composition:** public domain. Every composer and arranger named above died more than 70 years ago, and every melody was published by 1906.
2. **Arrangement:**
   - The arrangements are new, written for Mystery Hub.
   - The underlying hymn settings were published before 1929, by people who died more than 70 years ago, with one exception.
   - **That exception:** the Open Hymnal setting of *Angels We Have Heard on High* is by Edward S. Barnes (1887–1958). Ghana's copyright term is the author's life plus 70 years, so his harmony is protected there until the end of 2028.
   - **So that track uses only the traditional melody.** Its harmony was written for Mystery Hub, and the track was re-rendered. A test pins this (`ANGELS_CHORDS`).
   - Auld Lang Syne also uses harmony written here.
3. **Recording:** made by Mystery Hub's own renderer from the CC BY 3.0 samples. No recording by anyone else is used.
4. **Adaptation:** the work is new, and CC BY 3.0 allows adapting the samples.
5. **Hosting:** CC BY 3.0 and public domain both allow public streaming from any host, including a CDN, if attribution is shown.

**Attribution** is shown in the player's *Music credits* panel and recorded in the manifest: "Piano: Salamander Grand Piano V3 by Alexander Holm, licensed CC BY 3.0. Arranged and recorded for Mystery Hub."

**Manifest:** [`docs/countdown-music/manifest.json`](countdown-music/manifest.json), generated by `scripts/countdown-music/manifest.py`. For every track and cue it records:

- title, composer and performer;
- source, source URL and licence for each part;
- attribution and permitted use;
- format, codec, duration and bytes;
- modifications;
- loudness and true peak.

A test checks that the manifest agrees with the player's own list.

**Not legal advice.** This rights analysis was done carefully, but it has not been reviewed by a lawyer. If the founder wants certainty for a commercial site, a short review by a Ghanaian IP lawyer is the right step, especially of the hymnal settings.

## 4. Formats and sizes

- **Mastering:** each track is rendered at 48 kHz in stereo, with a convolution room. Each is mastered to −16 LUFS integrated, with a true-peak ceiling of −1 dBTP. Measured true peaks are −1.2 to −2.9 dBTP.
- **Delivery:** two formats per file.
  - **Opus in WebM** at a 96 kbps target (117 kbps actual, because Opus spends more on piano transients) for browsers that play it.
  - **MP3 VBR V2** (about 157 kbps) for the rest, notably older iPhones.
  - The page asks the browser which one it can play (`pickFormat`).
- **Why this rate:** 96 kbps Opus is generally regarded as transparent for solo piano, and quality was put ahead of size, as the brief asks. The rates were not compared by ear, because I cannot listen. If the founder hears compression artefacts, the files can be re-encoded higher without any code change.

| What | Opus (WebM) | MP3 |
|---|---|---|
| One track (average; range) | 2.36 MB (1.76–3.08) | 3.16 MB (2.39–4.09) |
| An hour of continuous listening | about 53 MB | about 70 MB |
| The countdown's own sounds, fetched in the final hour (second cues and midnight effects) | 0.55 MB | 0.85 MB |
| Final-minute build (only with music on) | 0.85 MB | 1.11 MB |
| Midnight music (only with music on) | 0.38 MB | 0.57 MB |
| **Total storage, all files, both formats** | 27.7 MB | 37.2 MB, **65.0 MB together** |

**Total storage is not what a visitor downloads.** A visitor downloads one format, one track at a time, and only after tapping *Play music*.

## 5. Playlist behaviour

**The seasons.** They follow the Ghana date from the server's clock, never the device's (`seasonFor`):

| When | Playlist |
|---|---|
| until 26 December | 9 Christmas carols, Silent Night first |
| 27–30 December | the turn: Joy to the World, Auld Lang Syne, Hark!, Ode to Joy and carols (9) |
| 31 December | New Year's Eve: Auld Lang Syne first, then Ode to Joy and the brighter carols (8) |
| the final hour | Auld Lang Syne, Silent Night, In the Bleak Midwinter, Ode to Joy (4, quieter) |
| 1–7 January | New Year: Ode to Joy first (6) |
| from 8 January | Auld Lang Syne and Ode to Joy |

**The player** (`Player.tsx`):

- **Hidden until the visitor taps *Play music*.**
- **Controls:**
  - play/pause, previous and next;
  - the current title, its season and its place in the list ("Christmas · 3 of 9");
  - volume;
  - shuffle;
  - *Countdown sounds* on or off, separately from the music;
  - *Turn sound off*;
  - music credits.
- **Phones:** one compact bar at the bottom (play, title, next). The rest sits behind *More*.
- **760 px and wider:** a two-row card.
- **Immersive view:** a small, quiet pill.

**Behaviour:**

- **Off by default.** Nothing plays from a shared link. Sound starts only from the tap.
- **Autoplay refusals are reported honestly.** "This browser didn't allow sound. Tap play to try again."
- **Remembered in this browser only:** countdown sounds on or off, volume and shuffle. The key is `mh-countdown-sound-v1`, and nothing personal is stored. Music itself always waits for a tap.
- **Tracks advance by themselves** with a 2.5 s crossfade.
- **Shuffle never plays the same track twice in a row** and avoids the most recent half of the list. *Previous* restarts the track after 4 seconds, as players usually do.
- **Failures:**
  - a failed track is skipped;
  - three failures in a row turn the music off for the visit, with a note;
  - countdown sounds carry on regardless.
- **Hidden page:** everything pauses when the page is hidden, and resumes on return if the browser allows. If it doesn't, the note says so.
- **Leaving the page:** everything stops, and the audio graph is closed when the page goes.
- **No extra permissions.** No notification, location or other permission is requested.

## 6. Audio delivery

- **Not in the JavaScript.** The recordings are separate files under `/countdown-audio/v1/`, versioned so a file never changes once published.
- **Nothing before the tap.** Before the tap, no audio element, audio context or audio file exists.
- **One track at a time.** After the tap:
  - the current track loads;
  - the next one is fetched 30 seconds before the current one ends (never with Data Saver on, when it simply loads as it starts);
  - the two decks crossfade.
- **The countdown's own sounds** (second cues and midnight effects) are fetched once the final hour begins, or for a replay. They are decoded once.
- **Volume** runs through Web Audio, so it works on iPhones too. They ignore an audio element's own volume.
- **A safety limiter** guards the sum of the build and a cue. The recordings are mastered, so it rarely acts.
- **Slow or failed audio never holds the countdown back.** Late audio joins at the moment the clock calls for. Audio that never arrives stays silent while the visuals carry on.

**Where the files live is the founder's choice** (section 14):

- same-origin `public/countdown-audio/v1/`, served by the existing Render static site;
- or Cloudinary, which needs an account change, so it is prepared here but not done.

## 7. The countdown's sound design

All of it is original (`scripts/countdown-music/cues.py`). The piano notes are Salamander samples. The impacts, risers and fireworks are synthesised here, with no samples.

- **Final minute (T−60 to midnight):**
  - At T−62 the playlist fades over 4 seconds.
  - The build begins: a piano at 120 bpm, so every bar is two seconds.
  - It moves from a soft pulse to a held dominant tremolo, and hints at the Auld Lang Syne motif that midnight resolves.
  - A visitor who arrives late joins it where the clock is.
- **Final ten seconds:**
  - Ten cues, one per visible second, each different.
  - Each pairs a warm low impact with a piano octave that climbs the dominant chord.
  - The last three gather with a reversed swell.
  - Peaks rise from −11 to −5.5 dBTP across the ten, so tension grows without the last one being loud.
  - Each cue starts when the page shows its second, from where that second already is. The clock leads.
  - The last cue gives way, with a 60 ms fade, as midnight lands.
- **Midnight (29 seconds, two stems that start together):**
  - **The effects stem:** a full-keyboard F major impact chord with a deep low end, then 14 golden fireworks across the stereo field, in an outdoor space.
  - **The music stem:** the chorus of Auld Lang Syne in festive octaves, settling into a calm final chord.
  - With music off, the effects still play. With countdown sounds off, the music still plays.
  - At T+25 the New Year playlist begins with Ode to Joy.

**Measured on the previews** (`previews.py`, which mixes them with the page's own timings):

| Preview | Integrated loudness | True peak |
|---|---|---|
| Final ten seconds | −14.8 LUFS | −1.6 dBTP |
| Midnight transition | −16.3 LUFS | −1.3 dBTP |
| Effects only | −19.1 LUFS | −2.4 dBTP |

There is no clipping anywhere.

## 8. The visual sequence

- **Final minute:**
  - The page moves to a centred focus layout on every screen.
  - Sharing steps back, leaving only the way home.
  - The sky deepens.
  - The seconds sit large inside the dial.
- **Final ten seconds:**
  - Very large numerals in the dial, one gentle entrance each.
  - The title steps aside.
  - The ten gold segments go out one by one.
- **Midnight (22 seconds, `CELEBRATION_SECONDS`):**
  - A light reveal blooms behind 2027.
  - The ring sweeps to full, with 12 rays and 28 sparks.
  - The outlined 7 fills with light.
  - **Golden fireworks** are drawn on one canvas over the whole screen. There are 14 bursts, each landing exactly when its sound does, because both use the same list (`FIREWORKS` in `audioPlan.ts`, from `cues.py`).
  - The kicker reads "Afehyia pa! · Happy New Year". Sharing is hidden while it plays.
  - The show ends by itself when its last spark fades, at about 16 s.
- **How the fireworks stay light:**
  - The positions are worked out from time rather than stepped frame by frame, so a slow device never falls behind.
  - The particle count scales with the screen up to a cap.
  - Canvas resolution is capped at 1.5×, and 1× on very large screens.
  - The random generator is seeded, so every visit and every recording draws the same show.
  - Nothing flashes.
- **After:** a calm Welcome 2027 with the lit dial, warm wishes, New Year sharing, **Replay midnight** (labelled "Replay · not live"), the way home, and Ode to Joy.
- **Reduced motion:** no fireworks and no animation. The celebration is a calm 6-second moment, and everything stays readable.

## 9. Location wording

The founder's examples are followed. Ghana is said once where it helps, and the time zone is explained once:

| Before | Now |
|---|---|
| Accra · Ghana time | **Ghana · GMT** |
| Midnight · Accra (dial caption) | **Midnight · Ghana** |
| Midnight in Accra is on its way… | **Midnight is on its way…** |
| New Year's Eve · Accra | **New Year's Eve** |
| Checking the time in Accra… | **Synchronising the countdown…** |
| We can't confirm the time in Accra right now | **We can't synchronise the countdown right now** |
| New Year's Day · Accra / 3 January 2027 · Accra | **New Year's Day · 2027** / **3 January 2027** |
| 2027 began here (commemorative) and "2027 began in Accra" (title) | **Welcome to a beautiful 2027** |
| Midnight, 1 January 2027 · Accra time (GMT) | **Midnight, 1 January 2027 · GMT** |
| Time until 2027 in Accra (timer label) | **Time until 2027** (its sentence ends "…, Ghana time.") |
| Announcements "…in Accra." | "It's New Year's Eve." / "Happy New Year! Welcome to 2027." |
| Link preview "Midnight in Accra" | "Midnight in Ghana", with a new image file (v2), so cached previews refresh |
| Greetings card "Until 2027 in Accra" | "Until 2027" |

The warm sharing words from PR #160 are unchanged. The canonical URL is unchanged.

Nothing asks for location, and nothing guesses a city. A test checks that no visible string in the countdown says Accra.

## 10. Responsive design

The CSS has one scale unit, `--s`, that follows the screen. It is 1 px on phones. It grows with the viewport's width on tablets. On landscape screens it follows the smaller of width/1440 and height/900, which is what keeps a 1366 × 768 laptop from scrolling.

- **Phones:**
  - The compact single column is kept.
  - The player is a slim bar at the bottom, clear of the home indicator.
  - Landscape phones and short screens have their own tightening.
  - The rotating seconds light was rebuilt as a slim arm. The old full-square layer's corners stuck out and caused the five "horizontal overflow" failures that had been reported since 3.7.1.
- **Tablet portrait:** a larger dial (up to about 60% of the width), more generous type, and a two-row player card.
- **Landscape at 1000 × 600 and larger** (tablet landscape, laptops, desktops, TVs):
  - A two-column composition: words, timer and sharing on the left, a large dial on the right.
  - A short-laptop variant for heights up to 820 px.
  - A wider frame on ultrawide screens.
- **Final minute and midnight:** every size switches to a centred cinematic column, with the dial at up to 62% of the height.
- **Immersive (full screen, optional):** chrome and sharing hide, the player shrinks to a pill, and the dial and numerals fill the screen.

Screenshots of every required size are in section 13.

## 11. Timing and synchronisation

**The server-authoritative clock is unchanged** (`src/greetings/countdown.ts`). All 3.7.1 timing tests still pass unweakened, and the timing pins in `mysteryCountdown371.test.ts` are kept.

**Audio follows the clock:**

- The page tells the sound controller what it shows each time the shown second changes.
- Every sound starts at the offset that moment calls for.
- Nothing about midnight waits on audio.

**Handled:**

- **Late arrival:** joins the build where it is.
- **Hidden tab:** pauses, and the clock re-checks on return.
- **Sleep across midnight:** the clock confirms with the server. Music waits during "Synchronising" and never guesses.
- **Device clock changed:** the count stays the server's.
- **Failed audio:** silence while the visuals carry on.
- **Refused autoplay:** said plainly.
- **Replay:** labelled, with the effects fetched for it. Afterwards the paused track resumes.
- **One live celebration per page load.** Someone who arrives later gets a calm Welcome and never a live midnight.

## 12. Accessibility

- Every control has a real label: *Play music*, *Pause music*, *Next track*, *Previous track*, *More sound controls* (aria-expanded), and *Turn sound off*.
- *Shuffle* and *Countdown sounds* are toggle buttons (aria-pressed).
- The volume slider announces a percentage.
- The track title is announced politely when it changes.
- Stage announcements happen once per stage, never every second.
- The timer has a minute-precision sentence that is read on demand.
- Keyboard order and visible focus are checked in the browser regression.
- Full screen has an accessible exit, and Escape works.
- Reduced motion is honoured, and nothing flashes or strobes.
- Sound and fireworks are optional extras. The countdown makes sense without them.

## 13. Evidence (synthetic)

Founder review files are in the project files under `countdown-final/`:

- **A. Playlist audition:** `previews/audition.mp3` (29 minutes, all eleven tracks in order with the player's 2.5 s crossfade). The single tracks are in `audio/playlist/`.
- **B. Final ten seconds:** `previews/final-ten-seconds.mp3` (T−13 to T+5) and `previews/effects-only.mp3` (the same moment with music off).
- **C. Midnight:** `previews/midnight-transition.mp3`, from T−70 to T+80. It covers Auld Lang Syne fading at T−62, the build, the ten seconds, the celebration, and Ode to Joy from T+25.
- **D. Audiovisual recordings with the page's real audio:**
  - `video/midnight-mobile-390x844.mp4`
  - `video/midnight-tv-1920x1080.mp4` (T−75 to T+43: the final minute, the ten seconds, midnight, the whole celebration and the settled Welcome)
  - `video/final-ten-effects-only-390x844.mp4` (music paused, countdown sounds on)
  - They were recorded from a local production build in headless Chromium, with a controlled server clock. The audio is the page's own output, captured beside the speakers inside the browser.
- **E. Responsive screenshots:** `screens/`, 13 sizes × 8 states plus the player. A comparison sheet is in `screens/sheet-*.png`.

**These are browser emulation only.** No physical phone, tablet or television was used. The brand mark in the screenshots is a local copy, because the sandbox cannot reach Cloudinary.

## 14. Hosting plan (founder decision)

**Option 1, recommended: same origin, with no account change.**

- Add the 30 files (65 MB) to `public/countdown-audio/v1/`. Render's static site serves them from `/countdown-audio/v1/`, as it already serves `/og/` images.
- Range requests and caching should work as for any other static file. This has not been checked on the live host, because the sandbox cannot reach the domain.
- No CORS is involved.
- **Cost:** the repository grows by about 65 MB, and audio counts toward the Render bandwidth allowance.
- This is how the local review build was staged.

**Option 2: Cloudinary.** This needs the founder's approval for the account change.

- Upload the same 30 files as `resource_type: video` to the folder `mysteryhub/countdown-audio/v1/`, with public IDs equal to the file names without extension (for example `silent-night`, uploaded once as `.webm` and once as `.mp3`).
- Then set `AUDIO_BASE` to `https://res.cloudinary.com/da6oeat7m/video/upload/mysteryhub/countdown-audio/v1/`.
- The player routes audio through Web Audio, so the files must be served with `Access-Control-Allow-Origin`. Cloudinary's delivery URLs normally send `*`, but this must be confirmed after upload.
- **Cost:** bandwidth counts toward Cloudinary credits.
- The sandbox cannot reach Cloudinary, so this cannot be tested from here.

## 15. Approval and release

- Founder creative approval: **pending.**
- Tests, review, PR, CI, merge and deployment: after approval.

## 16. Remaining limitations

- **The quality of the music is unverified by ear.** I cannot hear it, and the founder's audition decides.
- **No physical device or TV testing.** Safari and Firefox were not run; Chromium only.
- **iPhone:** the MP3 fallback and Web Audio routing follow documented Safari behaviour, but have not been tested on a device.
- **Rights:** reasoned carefully, but not reviewed by a lawyer (section 3).

## 17. Greetings and Gifts: remaining frontend dependencies

**Nothing in this release activates either.** Mystery Greetings is not activated, and Mystery Gifts is not activated.

The Greetings countdown card's wording was updated (section 9). Its behaviour is unchanged.
