/** Kept identical to schema.sql. Additive: admin-uploaded marketplace product images (signed Cloudinary uploads). */
export const MARKETPLACE_ASSET_SCHEMA = `
CREATE TABLE IF NOT EXISTS marketplace_assets (
  id VARCHAR(64) PRIMARY KEY,
  uploaded_by VARCHAR(64) NOT NULL REFERENCES users(id),
  provider VARCHAR(20) NOT NULL DEFAULT 'cloudinary' CHECK (provider = 'cloudinary'),
  public_id VARCHAR(255) NOT NULL UNIQUE,
  original_filename VARCHAR(150) NOT NULL,
  mime VARCHAR(32) NOT NULL,
  format VARCHAR(10), bytes BIGINT NOT NULL CHECK (bytes > 0), width INTEGER, height INTEGER,
  secure_url VARCHAR(500),
  status VARCHAR(16) NOT NULL CHECK (status IN ('pending','ready','failed')),
  expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_marketplace_assets_status ON marketplace_assets (status, created_at DESC);
`;
