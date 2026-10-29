/** Additive indexes and backend-only protection; no event backfill or financial writes. */
export const GROWTH_ANALYTICS_SCHEMA=`
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON analytics_events FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON analytics_events FROM anon; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON analytics_events FROM authenticated; END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_analytics_growth_dedupe ON analytics_events(event_name,visitor_id,session_id,entity_id,created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_visitor_history ON analytics_events(visitor_id,event_name,created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at);
`;
