/** Additive, backend-only transition history; never exposed through the Supabase Data API. */
export const WEBSITE_CHECKPOINT_SCHEMA = `
CREATE SCHEMA IF NOT EXISTS mysteryhub_builder_private;
REVOKE ALL ON SCHEMA mysteryhub_builder_private FROM PUBLIC;
CREATE TABLE IF NOT EXISTS mysteryhub_builder_private.website_draft_checkpoints (
  id UUID PRIMARY KEY,
  site_id VARCHAR(64) NOT NULL REFERENCES website_sites(id) ON DELETE CASCADE,
  user_id VARCHAR(64) NOT NULL,
  template_id VARCHAR(64) NOT NULL,
  source_revision VARCHAR(40) NOT NULL,
  reason VARCHAR(32) NOT NULL CHECK (reason IN ('template_change','layout_change','draft_restore')),
  document JSONB NOT NULL CHECK (octet_length(document::text) <= 524288),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS website_draft_checkpoints_owner_site ON mysteryhub_builder_private.website_draft_checkpoints(user_id,site_id,created_at DESC);
ALTER TABLE mysteryhub_builder_private.website_draft_checkpoints ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mysteryhub_builder_private.website_draft_checkpoints FROM PUBLIC;
DO $builder_history_roles$
DECLARE role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA mysteryhub_builder_private FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON mysteryhub_builder_private.website_draft_checkpoints FROM %I',role_name);
    END IF;
  END LOOP;
END $builder_history_roles$;
`;
