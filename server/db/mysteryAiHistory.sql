-- Apply as the backend database role, after isolated restore and role verification.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
CREATE SCHEMA IF NOT EXISTS mysteryhub_ai_private;
REVOKE ALL ON SCHEMA mysteryhub_ai_private FROM PUBLIC;
CREATE TABLE IF NOT EXISTS mysteryhub_ai_private.conversations (
  id UUID PRIMARY KEY,
  owner_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title VARCHAR(80) NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mystery_ai_conversation_owner_updated
  ON mysteryhub_ai_private.conversations(owner_id, updated_at DESC, id);
CREATE TABLE IF NOT EXISTS mysteryhub_ai_private.turns (
  conversation_id UUID NOT NULL REFERENCES mysteryhub_ai_private.conversations(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  position SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 50),
  question TEXT NOT NULL CHECK (char_length(question) BETWEEN 1 AND 2000),
  reply TEXT NOT NULL CHECK (char_length(reply) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(conversation_id, position),
  UNIQUE(conversation_id, request_id)
);
CREATE TABLE IF NOT EXISTS mysteryhub_ai_private.preferences (
  owner_id VARCHAR(64) PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  style VARCHAR(16) NOT NULL CHECK (style IN ('brief', 'step_by_step'))
);
ALTER TABLE mysteryhub_ai_private.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mysteryhub_ai_private.turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE mysteryhub_ai_private.preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA mysteryhub_ai_private FROM PUBLIC;
DO $roles$
DECLARE api_role TEXT;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA mysteryhub_ai_private FROM %I',api_role);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA mysteryhub_ai_private FROM %I',api_role);
    END IF;
  END LOOP;
END $roles$;
COMMIT;
