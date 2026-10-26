/** Durable outbox is committed with authoritative orders. No network calls or historical backfill. */
export const NOTIFICATION_SCHEMA=`
CREATE SCHEMA IF NOT EXISTS mysteryhub_notifications;
REVOKE ALL ON SCHEMA mysteryhub_notifications FROM PUBLIC;
CREATE TABLE IF NOT EXISTS mysteryhub_notifications.preferences (
 user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id),transactional BOOLEAN NOT NULL DEFAULT TRUE,
 marketing BOOLEAN NOT NULL DEFAULT FALSE,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS mysteryhub_notifications.devices (
 id UUID PRIMARY KEY,user_id VARCHAR(64) NOT NULL REFERENCES users(id),session_id VARCHAR(64) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
 endpoint_hash VARCHAR(64) UNIQUE NOT NULL,encrypted_subscription TEXT NOT NULL,binding_version INTEGER NOT NULL DEFAULT 1,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS mysteryhub_notifications.templates (
 id VARCHAR(64) PRIMARY KEY,title VARCHAR(80) NOT NULL,body VARCHAR(240) NOT NULL,
 category VARCHAR(20) NOT NULL CHECK(category IN ('transactional','marketing')),enabled BOOLEAN NOT NULL DEFAULT TRUE,
 locked BOOLEAN NOT NULL DEFAULT FALSE,version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS mysteryhub_notifications.events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id VARCHAR(64) NOT NULL REFERENCES users(id),order_id VARCHAR(64) REFERENCES orders(id),
 event_key VARCHAR(160) NOT NULL UNIQUE,template_id VARCHAR(64) NOT NULL REFERENCES mysteryhub_notifications.templates(id),
 label VARCHAR(100) NOT NULL,template_snapshot JSONB NOT NULL DEFAULT '{}',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),expanded_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS mysteryhub_notifications.template_versions (
 id UUID PRIMARY KEY,template_id VARCHAR(64) NOT NULL REFERENCES mysteryhub_notifications.templates(id),version INTEGER NOT NULL,
 snapshot JSONB NOT NULL,actor_id VARCHAR(64) NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(template_id,version)
);
CREATE TABLE IF NOT EXISTS mysteryhub_notifications.deliveries (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),event_id UUID NOT NULL REFERENCES mysteryhub_notifications.events(id),
 device_id UUID REFERENCES mysteryhub_notifications.devices(id) ON DELETE SET NULL,user_id VARCHAR(64) NOT NULL REFERENCES users(id),binding_version INTEGER NOT NULL,
 state VARCHAR(24) NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','retry','provider_accepted','invalid','failed','skipped')),
 attempts INTEGER NOT NULL DEFAULT 0,lease UUID,lease_until TIMESTAMPTZ,next_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 last_code VARCHAR(40),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(event_id,device_id)
);
CREATE TABLE IF NOT EXISTS mysteryhub_notifications.audiences (
 id UUID PRIMARY KEY,actor_id VARCHAR(64) NOT NULL REFERENCES users(id),template_id VARCHAR(64) NOT NULL REFERENCES mysteryhub_notifications.templates(id),
 template_version INTEGER NOT NULL,user_filter VARCHAR(64),device_ids UUID[] NOT NULL,audience_hash VARCHAR(64) NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW()+interval '10 minutes'
);
CREATE TABLE IF NOT EXISTS mysteryhub_notifications.attempts (
 id UUID PRIMARY KEY,delivery_id UUID NOT NULL REFERENCES mysteryhub_notifications.deliveries(id),attempt INTEGER NOT NULL,
 code VARCHAR(40) NOT NULL DEFAULT 'started',started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),finished_at TIMESTAMPTZ,UNIQUE(delivery_id,attempt)
);
CREATE TABLE IF NOT EXISTS mysteryhub_notifications.campaigns (
 id UUID PRIMARY KEY,actor_id VARCHAR(64) NOT NULL REFERENCES users(id),preview_id UUID NOT NULL UNIQUE REFERENCES mysteryhub_notifications.audiences(id),
 request_id VARCHAR(64) NOT NULL UNIQUE,input_hash VARCHAR(64) NOT NULL,recipient_count INTEGER NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS mysteryhub_notifications.settings (id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK(id),paused BOOLEAN NOT NULL DEFAULT FALSE);
INSERT INTO mysteryhub_notifications.settings(id) VALUES(TRUE) ON CONFLICT DO NOTHING;
INSERT INTO mysteryhub_notifications.templates(id,title,body,category,locked) VALUES
 ('payment_confirmed','Payment confirmed','Your payment is verified. Open Orders to follow delivery.','transactional',TRUE),
 ('order_processing','Order processing','Your supplier has accepted this order. Open Orders for the current status.','transactional',TRUE),
 ('order_delivered','Order delivered','Delivery is confirmed for your order. Open Orders for details.','transactional',TRUE),
 ('delivery_attention','Order needs a check','Open Orders for an update and support options. This does not mean delivery has failed.','transactional',TRUE),
 ('refund_update','Refund status update','A verified refund-state update is available. Provider processing does not guarantee funds are visible yet. Open Orders.','transactional',TRUE),
 ('maintenance','Service update','Open {{appName}} for the current service notice.','marketing',FALSE),
 ('new_service','Discover services','Explore the services currently available in {{appName}}.','marketing',FALSE),
 ('special_offer','Current offers','View current offers in {{appName}}. Terms and eligibility apply.','marketing',FALSE)
 ON CONFLICT DO NOTHING;
CREATE INDEX IF NOT EXISTS notifications_ready ON mysteryhub_notifications.deliveries(next_at) WHERE state IN ('queued','retry');
CREATE INDEX IF NOT EXISTS notifications_user_time ON mysteryhub_notifications.events(user_id,created_at DESC);
CREATE OR REPLACE FUNCTION mysteryhub_notifications.snapshot_template() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN SELECT jsonb_build_object('title',title,'body',body,'category',category,'version',version,'enabled',enabled) INTO NEW.template_snapshot FROM mysteryhub_notifications.templates WHERE id=NEW.template_id; RETURN NEW; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_trigger WHERE tgrelid='mysteryhub_notifications.events'::regclass AND tgname='notification_template_snapshot') THEN
 CREATE TRIGGER notification_template_snapshot BEFORE INSERT ON mysteryhub_notifications.events FOR EACH ROW EXECUTE FUNCTION mysteryhub_notifications.snapshot_template(); END IF; END $$;
CREATE OR REPLACE FUNCTION mysteryhub_notifications.capture_order_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE k text;label text;fingerprint text;
BEGIN
 IF NEW.user_id IS NULL OR NEW.payment_provider NOT IN ('paystack','wallet') OR NEW.payment_status<>'success' OR NEW.paid_at IS NULL THEN RETURN NEW; END IF;
 k:='payment_confirmed';label:='Payment verified';fingerprint:=NEW.id||':payment_confirmed';
 IF TG_OP='INSERT' OR OLD.payment_status IS DISTINCT FROM NEW.payment_status OR OLD.paid_at IS NULL THEN
 INSERT INTO mysteryhub_notifications.events(user_id,order_id,event_key,template_id,label) VALUES(NEW.user_id,NEW.id,fingerprint,k,label) ON CONFLICT(event_key) DO NOTHING;END IF;
 IF NEW.status IN ('submitted','processing') AND NEW.supplier_order_id IS NOT NULL AND NEW.submitted_at IS NOT NULL AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR OLD.supplier_order_id IS NULL) THEN
 INSERT INTO mysteryhub_notifications.events(user_id,order_id,event_key,template_id,label) VALUES(NEW.user_id,NEW.id,NEW.id||':processing','order_processing','Supplier accepted') ON CONFLICT(event_key) DO NOTHING;
 END IF;
 IF NEW.status='delivered' AND NEW.delivered_at IS NOT NULL AND (NEW.supplier_order_id IS NOT NULL OR NEW.service_type='marketplace' AND NEW.marketplace_status='completed') AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR OLD.delivered_at IS NULL) THEN
 INSERT INTO mysteryhub_notifications.events(user_id,order_id,event_key,template_id,label) VALUES(NEW.user_id,NEW.id,NEW.id||':delivered','order_delivered','Delivery confirmed') ON CONFLICT(event_key) DO NOTHING;
 END IF;
 IF (NEW.status IN ('failed','refund_pending','cancelled','expired') OR COALESCE(NEW.manual_review,FALSE)) AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR OLD.manual_review IS DISTINCT FROM NEW.manual_review) THEN
 INSERT INTO mysteryhub_notifications.events(user_id,order_id,event_key,template_id,label) VALUES(NEW.user_id,NEW.id,NEW.id||':attention','delivery_attention','Order needs a check') ON CONFLICT(event_key) DO NOTHING;
 END IF;
 IF (NEW.resolution_json->>'stage'='refund_pending' AND NEW.resolution_json->>'outcome' IN ('paystack_refund','wallet_refund') OR NEW.resolution_json->>'stage'='resolved' AND NEW.resolution_json->>'outcome' IN ('paystack_refund','wallet_refund') AND NEW.resolution_json->>'verifiedAt' IS NOT NULL) AND (TG_OP='INSERT' OR OLD.resolution_json->>'stage' IS DISTINCT FROM NEW.resolution_json->>'stage' OR OLD.resolution_json->>'verifiedAt' IS NULL AND NEW.resolution_json->>'verifiedAt' IS NOT NULL) THEN
 INSERT INTO mysteryhub_notifications.events(user_id,order_id,event_key,template_id,label) VALUES(NEW.user_id,NEW.id,NEW.id||':refund:'||(NEW.resolution_json->>'stage'),'refund_update','Refund status updated') ON CONFLICT(event_key) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text;r text;BEGIN
 IF NOT EXISTS(SELECT FROM pg_trigger WHERE tgrelid='orders'::regclass AND tgname='notification_order_event') THEN
 CREATE TRIGGER notification_order_event AFTER INSERT OR UPDATE OF status,payment_status,paid_at,submitted_at,delivered_at,supplier_order_id,resolution_json,manual_review ON orders FOR EACH ROW EXECUTE FUNCTION mysteryhub_notifications.capture_order_event();END IF;
 FOREACH t IN ARRAY ARRAY['preferences','devices','templates','template_versions','events','deliveries','audiences','attempts','campaigns','settings'] LOOP
 EXECUTE format('ALTER TABLE mysteryhub_notifications.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON mysteryhub_notifications.%I FROM PUBLIC',t);
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
 IF EXISTS(SELECT FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON mysteryhub_notifications.%I FROM %I',t,r);EXECUTE format('REVOKE ALL ON SCHEMA mysteryhub_notifications FROM %I',r);END IF;
 END LOOP;END LOOP;
END $$;
REVOKE ALL ON FUNCTION mysteryhub_notifications.capture_order_event() FROM PUBLIC;
REVOKE ALL ON FUNCTION mysteryhub_notifications.snapshot_template() FROM PUBLIC;
`;
