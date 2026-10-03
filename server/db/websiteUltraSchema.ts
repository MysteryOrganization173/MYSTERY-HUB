export const ULTRA_ENQUIRY_SCHEMA = `CREATE TABLE IF NOT EXISTS website_ultra_enquiries (
  id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE, user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  brief JSONB NOT NULL, status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE INDEX IF NOT EXISTS idx_website_ultra_created ON website_ultra_enquiries (created_at DESC, id);`;
