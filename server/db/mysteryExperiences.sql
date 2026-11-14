-- OPTIONAL installation only after separate approval. NEVER imported by startup.
BEGIN;
SET LOCAL lock_timeout='3s';
CREATE SCHEMA IF NOT EXISTS mysteryhub_experiences;
REVOKE ALL ON SCHEMA mysteryhub_experiences FROM PUBLIC;
CREATE TABLE IF NOT EXISTS mysteryhub_experiences.configuration (
 id text PRIMARY KEY CHECK(id ~ '^[a-z0-9-]{1,64}$'),
 definition_version integer NOT NULL DEFAULT 1 CHECK(definition_version>0),
 starts_at timestamptz NOT NULL DEFAULT '2026-12-01T00:00:00Z', ends_at timestamptz NOT NULL DEFAULT '2027-01-06T00:00:00Z',
 time_zone text NOT NULL DEFAULT 'Africa/Accra' CHECK(time_zone='Africa/Accra'), CHECK(ends_at>starts_at),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 lifecycle text NOT NULL DEFAULT 'draft' CHECK(lifecycle IN ('draft','approved','archived')),
 enabled boolean NOT NULL DEFAULT false, preview_enabled boolean NOT NULL DEFAULT true,
 override_phase text CHECK(override_phase IN ('christmas_season','christmas_day','boxing_day','new_year_transition','new_year_eve','new_year_day','new_year_celebration')),
 override_until timestamptz, updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(NOT enabled OR lifecycle='approved'), CHECK((override_phase IS NULL)=(override_until IS NULL))
);
INSERT INTO mysteryhub_experiences.configuration(id) VALUES('christmas-2026') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS mysteryhub_experiences.greetings (
 id uuid PRIMARY KEY, share_id varchar(24) UNIQUE NOT NULL CHECK(share_id ~ '^[A-Za-z0-9_-]{24}$'),
 creator_hash char(64) NOT NULL, idempotency_key uuid NOT NULL, payload_hash char(64) NOT NULL,
 schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1),
 occasion text NOT NULL CHECK(occasion IN ('christmas-2026','new-year-2027')),
 recipient_name text NOT NULL CHECK(char_length(recipient_name) BETWEEN 1 AND 60),
 sender_name text CHECK(char_length(sender_name) BETWEEN 1 AND 60), show_sender boolean NOT NULL,
 template_id text, message text NOT NULL CHECK(char_length(message) BETWEEN 4 AND 600),
 variant text NOT NULL CHECK(variant IN ('gift-classic-v1','gift-starlight-v1')),
 parent_id uuid REFERENCES mysteryhub_experiences.greetings(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 revoked_at timestamptz, CHECK(expires_at>created_at), CHECK(show_sender OR sender_name IS NULL), UNIQUE(creator_hash,idempotency_key)
);
CREATE INDEX IF NOT EXISTS experience_greetings_parent ON mysteryhub_experiences.greetings(parent_id);
CREATE INDEX IF NOT EXISTS experience_greetings_expiry ON mysteryhub_experiences.greetings(expires_at);
CREATE INDEX IF NOT EXISTS experience_greetings_revoked ON mysteryhub_experiences.greetings(revoked_at) WHERE revoked_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS experience_greetings_created ON mysteryhub_experiences.greetings(created_at);
CREATE INDEX IF NOT EXISTS experience_greetings_creator ON mysteryhub_experiences.greetings(creator_hash,created_at DESC);
CREATE TABLE IF NOT EXISTS mysteryhub_experiences.budgets (
 scope varchar(80) NOT NULL, bucket timestamptz NOT NULL, hits integer NOT NULL CHECK(hits>0), PRIMARY KEY(scope,bucket)
);
CREATE INDEX IF NOT EXISTS experience_budgets_expiry ON mysteryhub_experiences.budgets(bucket);
CREATE TABLE IF NOT EXISTS mysteryhub_experiences.reports (
 greeting_id uuid NOT NULL REFERENCES mysteryhub_experiences.greetings(id) ON DELETE CASCADE,
 reporter_hash char(64) NOT NULL, reason text NOT NULL CHECK(reason IN ('abuse','spam','privacy')),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(greeting_id,reporter_hash)
);
CREATE INDEX IF NOT EXISTS experience_reports_created ON mysteryhub_experiences.reports(created_at);
-- Reuse existing analytics storage, without changing any business or financial attribution.
CREATE INDEX IF NOT EXISTS experience_events_period ON public.analytics_events(created_at,event_name) WHERE entity_type='experience';
CREATE UNIQUE INDEX IF NOT EXISTS experience_event_once ON public.analytics_events(event_name,visitor_id,session_id,entity_id) WHERE event_name IN ('experience_greeting_open','experience_greeting_reveal','experience_greeting_remix_started','experience_countdown_open','experience_discovery_open','experience_platform_navigation');
CREATE UNIQUE INDEX IF NOT EXISTS experience_created_once ON public.analytics_events(entity_id) WHERE event_name='experience_greeting_created';
DO $$ DECLARE t text; r text; BEGIN
 FOREACH t IN ARRAY ARRAY['configuration','greetings','budgets','reports'] LOOP
  EXECUTE format('ALTER TABLE mysteryhub_experiences.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON mysteryhub_experiences.%I FROM PUBLIC',t);
 END LOOP;
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
   EXECUTE format('REVOKE ALL ON SCHEMA mysteryhub_experiences FROM %I',r);
   EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA mysteryhub_experiences FROM %I',r);
  END IF;
 END LOOP;
END $$;
COMMIT;
