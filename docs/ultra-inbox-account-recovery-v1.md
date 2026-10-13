# Customer operations repair — Task A checkpoint

Base: production main `826abd00b3d08211b3d765f857d51c4f2d7b6602`.

Ultra Enquiries is a read-only subsection of Admin Website Builder. It reuses the existing protected listing route and persisted brief schema. Search covers reference, business/type, contact, email and phone. Results are paginated; detail retrieval shows the complete original brief. WhatsApp opens a chat with the saved customer number without a message. Reference links accept HTTP/HTTPS only; customer content renders as React text. Requests reject invalid pagination/search, remain admin-only and are non-cacheable. No migration, submission edits, CRM statuses or automatic messaging.

Verification: eight focused API/presentation checks passed; TypeScript, production build and diff check passed. Standalone PostgreSQL 17.6 verified 25+2 pagination, literal wildcard search, complete guest brief retrieval and exact preservation of all 27 synthetic enquiries. Compiled Admin login/list/detail worked at 1280px and 390px; mobile dialog352px, no horizontal overflow, no console errors. Production enquiry MH-ULTRA-5B5CBE91 was not read, recreated or changed by this implementation.

Release requires backend and frontend from this checkpoint; no new environment variables or schema changes. Do not deploy the new UI before its protected API is available. No merge or deployment is part of this task. Task B continues separately on the integration branch.
