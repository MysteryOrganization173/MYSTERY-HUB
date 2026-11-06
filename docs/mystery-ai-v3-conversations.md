# Mystery AI V3: saved conversations and reply preference

Temporary chat is the default, including for signed-in customers. Choose
**Saved chats → Start saved chat** to start saving completed question/reply
pairs. Starting a saved chat does not import a temporary chat. Reopening a
saved chat can continue with the same bounded recent context (up to eight
messages and 12,000 characters). Old checkout buttons and recipient values
are not restored. Chat data is not stored in browser storage.

Each active customer account can keep up to 20 conversations and 50 turns
per conversation. Saved chats remain until the customer deletes them or
their application user record is deleted; there is no age-based expiry.
Deletion removes the live conversation and its turns. Previous database
backups may still contain copies until they expire. The optional account
preference is a single explicit reply style; it can be changed or removed
without changing chat history. Only the chosen style is sent as a preference
when asking the existing AI provider. There is no staff transcript viewer.

Obvious credential-like text, phone/long number patterns and email addresses
are redacted before storage, with the same check repeated on the server.
Redaction is imperfect; customers should never enter secrets or payment details.

Apply `server/db/mysteryAiHistory.sql` only after verifying backup and restore
readiness, the app database role, and repeatable migration against disposable
PostgreSQL. It is additive, leaves existing tables/data in place, and is not
run on application startup. The backend database role owns the private schema;
the public API roles have no grants. Keep it outside any Data API exposed
schemas. The Express API uses the existing customer bearer session and
checks owner and active account on each operation. Without the schema,
the feature responds with a temporary-unavailable message, and temporary
chat remains usable.

To pause the feature, remove or disable the history API route in a normal
revert; preserve the private schema and records for recovery. Do not drop
the schema or roll back an entire database.
