// Additive and repeatable. Seed conflicts preserve administrator labels and activation.
export const MARKETPLACE_FLEXIBILITY_SCHEMA = `
CREATE TABLE IF NOT EXISTS marketplace_categories (
  slug VARCHAR(64) PRIMARY KEY, label VARCHAR(100) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE, sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO marketplace_categories (slug,label,sort_order) VALUES
 ('laptops_computers','Laptops & Computers',0), ('phones_accessories','Phones & Accessories',1),
 ('ai_productivity','AI & Productivity Tools',2), ('creator_tools','Creator & Media Tools',3),
 ('business_software','Business Software',4), ('digital_products','Digital Products',5),
 ('business_essentials','Business Hardware',6)
ON CONFLICT (slug) DO NOTHING;
ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS product_kind VARCHAR(16) NOT NULL DEFAULT 'physical' CHECK (product_kind IN ('physical','digital','service'));
ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS fulfilment_note VARCHAR(1000);
ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS fulfilment_identifier_label VARCHAR(100);
ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS fulfilment_identifier_placeholder VARCHAR(150);
ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS fulfilment_identifier_required BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS admin_note VARCHAR(1000);
ALTER TABLE marketplace_inquiries ADD COLUMN IF NOT EXISTS admin_note VARCHAR(1000);
ALTER TABLE marketplace_inquiries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE marketplace_inquiries ADD COLUMN IF NOT EXISTS contacted_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS marketplace_context JSONB;
CREATE INDEX IF NOT EXISTS idx_marketplace_inquiry_status ON marketplace_inquiries (status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_inquiry_product ON marketplace_inquiries (product_id,created_at DESC);
`;
