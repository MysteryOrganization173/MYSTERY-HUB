/** Kept identical to schema.sql. Additive initialization; no existing content is migrated. */
export const WEBSITE_FREE_SCHEMA = `
CREATE TABLE IF NOT EXISTS website_assets (
  id VARCHAR(64) PRIMARY KEY,
  website_id VARCHAR(64) REFERENCES website_sites(id) ON DELETE SET NULL,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id),
  provider VARCHAR(20) NOT NULL DEFAULT 'cloudinary' CHECK (provider = 'cloudinary'),
  public_id VARCHAR(255) NOT NULL UNIQUE,
  original_filename VARCHAR(150) NOT NULL,
  mime VARCHAR(32) NOT NULL,
  format VARCHAR(10), bytes BIGINT NOT NULL CHECK (bytes > 0), width INTEGER, height INTEGER,
  secure_url VARCHAR(500), delivery_url VARCHAR(500),
  status VARCHAR(16) NOT NULL CHECK (status IN ('pending','ready','deleting','deleted','failed')),
  expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_website_assets_site_status ON website_assets (website_id, status);
CREATE INDEX IF NOT EXISTS idx_website_assets_cleanup ON website_assets (status, expires_at);
CREATE TABLE IF NOT EXISTS analytics_events (
  id VARCHAR(64) PRIMARY KEY, event_name VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  visitor_id UUID, session_id UUID, entity_type VARCHAR(32), entity_id VARCHAR(64),
  metadata_json JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_analytics_event_date ON analytics_events (event_name, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_entity ON analytics_events (entity_type, entity_id);
`;
