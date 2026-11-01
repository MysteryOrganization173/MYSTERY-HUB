/** Additive admin-only fields. Original brief and original Ultra submission status are untouched. */
export const LEAD_OPERATIONS_SCHEMA=`
ALTER TABLE website_ultra_enquiries ADD COLUMN IF NOT EXISTS lead_status TEXT NOT NULL DEFAULT 'new' CHECK(lead_status IN ('new','contacted','quoted','closed'));
ALTER TABLE website_ultra_enquiries ADD COLUMN IF NOT EXISTS lead_note TEXT NOT NULL DEFAULT '' CHECK(length(lead_note)<=1000);
ALTER TABLE website_ultra_enquiries ADD COLUMN IF NOT EXISTS lead_outcome TEXT CHECK(lead_outcome IN ('accepted','not_proceeding','duplicate'));
ALTER TABLE website_ultra_enquiries ADD COLUMN IF NOT EXISTS lead_updated_at TIMESTAMPTZ;
ALTER TABLE website_ultra_enquiries ADD COLUMN IF NOT EXISTS lead_updated_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE website_ultra_enquiries ADD COLUMN IF NOT EXISTS follow_up_on DATE;
ALTER TABLE website_ultra_enquiries ADD COLUMN IF NOT EXISTS workflow_version INTEGER NOT NULL DEFAULT 0 CHECK(workflow_version>=0);
ALTER TABLE marketplace_inquiries ADD COLUMN IF NOT EXISTS follow_up_on DATE;
ALTER TABLE marketplace_inquiries ADD COLUMN IF NOT EXISTS workflow_version INTEGER NOT NULL DEFAULT 0 CHECK(workflow_version>=0);
ALTER TABLE marketplace_inquiries ADD COLUMN IF NOT EXISTS lead_updated_by TEXT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ultra_lead_queue ON website_ultra_enquiries(lead_status,follow_up_on,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_lead_queue ON marketplace_inquiries(status,follow_up_on,created_at DESC);
`;
