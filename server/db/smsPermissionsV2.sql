-- SMS V2: separately reviewed MANUAL installation. Never imported by startup.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='20s';
SELECT pg_advisory_xact_lock(hashtextextended('schema:sms:permissions:v2',0));
CREATE TABLE IF NOT EXISTS mysteryhub_sms.permission_records (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 phone text NOT NULL CHECK(phone ~ '^\+233[235][0-9]{8}$'),
 purpose text NOT NULL CHECK(purpose IN ('operational','transactional','marketing')),
 granted boolean NOT NULL,
 source text NOT NULL CHECK(source IN ('previously_obtained','admin_recorded')),
 evidence text NOT NULL CHECK(length(evidence) BETWEEN 8 AND 300),
 obtained_at timestamptz NOT NULL CHECK(isfinite(obtained_at)),
 actor_id varchar(64) NOT NULL REFERENCES public.users(id),
 request_id uuid NOT NULL, review_id uuid NOT NULL,
 input_hash text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(review_id,phone), UNIQUE(request_id,phone)
);
CREATE INDEX IF NOT EXISTS sms_permission_phone ON mysteryhub_sms.permission_records(phone,purpose,id DESC);
ALTER TABLE mysteryhub_sms.permission_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mysteryhub_sms.permission_records FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE mysteryhub_sms.permission_records_id_seq FROM PUBLIC,anon,authenticated;
INSERT INTO mysteryhub_sms.templates(id,title,body,purpose,locked)
 VALUES('channel_notice','Official WhatsApp Channel Announcement','MYSTERY HUB: We are still active! Our official contact channel has moved. Follow the new WhatsApp Channel for service updates and important announcements: {{channel_url}}','operational',false)
 ON CONFLICT DO NOTHING;
COMMIT;
