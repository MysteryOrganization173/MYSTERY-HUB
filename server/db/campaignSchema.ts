/** Additive marketing records. No financial updates/backfill and no public table grants. */
export const CAMPAIGN_SCHEMA=`
CREATE TABLE IF NOT EXISTS growth_campaigns (
 id varchar(40) PRIMARY KEY,name varchar(100) NOT NULL,description varchar(500) NOT NULL DEFAULT '',
 channel varchar(20) NOT NULL CHECK(channel IN ('whatsapp','facebook','instagram','tiktok','google','youtube','x','email','print','other')),
 destination varchar(150) NOT NULL,site_id varchar(64),status varchar(12) NOT NULL CHECK(status IN ('active','paused','archived')),
 budget_minor bigint CHECK(budget_minor BETWEEN 0 AND 1000000000),starts_on date,ends_on date,
 revision uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(starts_on IS NULL OR ends_on IS NULL OR ends_on>=starts_on)
);
CREATE TABLE IF NOT EXISTS growth_campaign_links (
 id varchar(40) PRIMARY KEY,campaign_id varchar(40) NOT NULL REFERENCES growth_campaigns(id),
 code varchar(6) UNIQUE NOT NULL CHECK(code ~ '^[A-Za-z0-9_-]{6}$'),label varchar(100) NOT NULL,
 channel varchar(20) NOT NULL CHECK(channel IN ('whatsapp','facebook','instagram','tiktok','google','youtube','x','email','print','other')),
 destination varchar(150) NOT NULL,site_id varchar(64),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaign_links_campaign ON growth_campaign_links(campaign_id);
CREATE TABLE IF NOT EXISTS growth_campaign_spend (
 id varchar(40) PRIMARY KEY,campaign_id varchar(40) NOT NULL REFERENCES growth_campaigns(id),
 request_id uuid NOT NULL UNIQUE,amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 0 AND 1000000000),spent_on date NOT NULL,notes varchar(280) NOT NULL DEFAULT '',
 revision uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaign_spend_dates ON growth_campaign_spend(campaign_id,spent_on);
CREATE TABLE IF NOT EXISTS growth_campaign_touches (
 id varchar(40) PRIMARY KEY,link_id varchar(40) NOT NULL REFERENCES growth_campaign_links(id),
 token_hash varchar(64) UNIQUE,visitor_id uuid,bound_user_id varchar(64),created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '7 days')
);
CREATE INDEX IF NOT EXISTS idx_campaign_touches_expiry ON growth_campaign_touches(expires_at);
CREATE INDEX IF NOT EXISTS idx_campaign_touches_visitor ON growth_campaign_touches(visitor_id,created_at DESC) WHERE token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_touches_link ON growth_campaign_touches(link_id,created_at);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS campaign_context jsonb;
CREATE INDEX IF NOT EXISTS idx_orders_campaign_paid ON orders((campaign_context->>'campaignId'),paid_at) WHERE campaign_context IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_campaign_link ON orders((campaign_context->>'linkId'),paid_at) WHERE campaign_context IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_request_day ON analytics_events(entity_id) WHERE event_name='campaign_link_day';
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_visit_once ON analytics_events(entity_id,session_id) WHERE event_name='campaign_visit';
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_checkout_once ON analytics_events(entity_id) WHERE event_name='campaign_checkout';
CREATE INDEX IF NOT EXISTS idx_campaign_events_period ON analytics_events(event_name,created_at) WHERE event_name IN ('campaign_visit','campaign_checkout','campaign_link_day');
CREATE OR REPLACE FUNCTION campaign_snapshot_immutable() RETURNS trigger LANGUAGE plpgsql AS $campaign_snapshot$
BEGIN IF OLD.campaign_context IS DISTINCT FROM NEW.campaign_context THEN RAISE EXCEPTION 'Campaign attribution is immutable'; END IF; RETURN NEW; END $campaign_snapshot$;
REVOKE ALL ON FUNCTION campaign_snapshot_immutable() FROM PUBLIC;
CREATE OR REPLACE FUNCTION campaign_link_immutable() RETURNS trigger LANGUAGE plpgsql AS $campaign_link$
BEGIN RAISE EXCEPTION 'Campaign links are immutable'; END $campaign_link$;
REVOKE ALL ON FUNCTION campaign_link_immutable() FROM PUBLIC;
DO $campaign_access$ DECLARE name text; role_name text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='order_campaign_immutable' AND tgrelid='orders'::regclass) THEN
  CREATE TRIGGER order_campaign_immutable BEFORE UPDATE OF campaign_context ON orders FOR EACH ROW EXECUTE FUNCTION campaign_snapshot_immutable();
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='campaign_link_immutable' AND tgrelid='growth_campaign_links'::regclass) THEN
  CREATE TRIGGER campaign_link_immutable BEFORE UPDATE OR DELETE ON growth_campaign_links FOR EACH ROW EXECUTE FUNCTION campaign_link_immutable();
 END IF;
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON FUNCTION campaign_snapshot_immutable() FROM %I',role_name);
   EXECUTE format('REVOKE ALL ON FUNCTION campaign_link_immutable() FROM %I',role_name);
  END IF;
 END LOOP;
 FOREACH name IN ARRAY ARRAY['growth_campaigns','growth_campaign_links','growth_campaign_spend','growth_campaign_touches'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',name);
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',name);
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I',name,role_name); END IF;
  END LOOP;
 END LOOP;
END $campaign_access$;
`;
