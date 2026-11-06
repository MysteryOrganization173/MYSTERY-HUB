# Mystery AI V3: voice and feedback

**Voice.** On a secure page, Mystery AI displays the microphone button only
when the browser exposes `SpeechRecognition` or `webkitSpeechRecognition`.
The microphone starts only when the customer taps the button. The browser
may use its own remote speech service. Mystery Hub does not capture or
upload raw audio. Listening ends after at most 25 seconds, with a bounded
three-second finalization window. Cancel, close, navigation, account changes
and incompatible dialogs abort the recognition session. A completed
transcript is editable in the composer. Nothing is sent until the customer
uses the regular Send action.

Typed chat remains available when speech recognition is absent, denied,
offline, or interrupted. There is no server transcription fallback or
additional provider credential. A browser exposing the API does not
guarantee microphone or recognition availability for its installed app.

**Feedback.** Signed-in customers can report a selected answer by category
with an optional note. The answer is excluded by default. The customer can
explicitly include the selected answer and preview the exact bounded,
redacted text before submitting. The rest of the conversation is not sent.
Obvious sensitive patterns are redacted again on the server. Users should
not include passwords, PINs, voucher codes, or payment details. The API
limits submissions to five per account in a rolling 24-hour period and
uses opaque idempotent report references. Application staff can review
submitted reports in **Admin → System Health → Mystery AI feedback**;
they cannot browse conversation history or see account identities in that
queue. Reviewing a report does not change prompts or train models.

Apply `server/db/mysteryAiFeedback.sql` separately from the code rollout,
after verifying the encrypted recovery record, database role and disposable
PostgreSQL gates. It creates one private, RLS-enabled table and no public API
grants. Keep the schema outside the Supabase Data API. It does not run on
application startup. If rollout needs to be paused, revert the code and
retain the table. Reports are retained for operational review until the
application user record is deleted. Database backups may retain copies.

**Founder phone acceptance.** In Chrome on Android and the installed
Mystery Hub app, open Mystery AI and tap **Use microphone**. Allow the
browser to listen, say “Open Creative Studio,” stop, edit the draft and
confirm the message is sent only when you tap Send. Repeat with permission
denied, then check Samsung Internet and Safari if available; if the
microphone is unavailable, confirm ordinary typed chat still works.
