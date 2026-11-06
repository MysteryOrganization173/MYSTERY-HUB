-- Separate additive migration; no startup dependency or existing data writes.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
CREATE SCHEMA IF NOT EXISTS mysteryhub_ai_feedback_private;
REVOKE ALL ON SCHEMA mysteryhub_ai_feedback_private FROM PUBLIC;
CREATE TABLE IF NOT EXISTS mysteryhub_ai_feedback_private.reports (
  reference UUID PRIMARY KEY,
  author_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category VARCHAR(20) NOT NULL CHECK (category IN ('inaccurate','misunderstood','unhelpful','broken_action','other')),
  note TEXT CHECK (char_length(note) BETWEEN 1 AND 500),
  answer TEXT CHECK (char_length(answer) BETWEEN 1 AND 2000),
  status VARCHAR(12) NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mystery_ai_report_author_recent ON mysteryhub_ai_feedback_private.reports(author_id,created_at DESC);
CREATE INDEX IF NOT EXISTS mystery_ai_report_queue ON mysteryhub_ai_feedback_private.reports(status,created_at DESC,reference);
ALTER TABLE mysteryhub_ai_feedback_private.reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mysteryhub_ai_feedback_private.reports FROM PUBLIC;
DO $roles$
DECLARE api_role TEXT;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA mysteryhub_ai_feedback_private FROM %I',api_role);
      EXECUTE format('REVOKE ALL ON mysteryhub_ai_feedback_private.reports FROM %I',api_role);
    END IF;
  END LOOP;
END $roles$;
COMMIT;
