-- Mystery Hub SMS V1. MANUAL INSTALL ONLY. Never imported by connection.ts.
-- Run as backend table owner in an explicit approved maintenance transaction.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('schema:sms:v1',0));
CREATE SCHEMA IF NOT EXISTS mysteryhub_sms;
REVOKE ALL ON SCHEMA mysteryhub_sms FROM PUBLIC;
CREATE TABLE IF NOT EXISTS mysteryhub_sms.settings(id boolean PRIMARY KEY DEFAULT true CHECK(id),schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1),paused boolean NOT NULL DEFAULT true,auto_enabled boolean NOT NULL DEFAULT false,recipient_updates boolean NOT NULL DEFAULT false,cutoff timestamptz,auto_types text[] NOT NULL DEFAULT ARRAY['payment_confirmed','order_delivered','delivery_attention','refund_update'],revision integer NOT NULL DEFAULT 1,balance jsonb,last_balance_at timestamptz,signing_verified_at timestamptz,signing_fingerprint text,heartbeat timestamptz,capture_error_at timestamptz,updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO mysteryhub_sms.settings(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS mysteryhub_sms.templates(id text PRIMARY KEY CHECK(length(id)<=64),title text NOT NULL CHECK(length(title)<=100),body text NOT NULL CHECK(length(body) BETWEEN 1 AND 1600),purpose text NOT NULL CHECK(purpose IN ('transactional','operational','marketing')),locked boolean NOT NULL DEFAULT false,enabled boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS mysteryhub_sms.template_versions(template_id text REFERENCES mysteryhub_sms.templates(id),version integer NOT NULL,snapshot jsonb NOT NULL,actor_id varchar(64) REFERENCES public.users(id),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(template_id,version));
CREATE TABLE IF NOT EXISTS mysteryhub_sms.consents(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id varchar(64) REFERENCES public.users(id),phone text NOT NULL CHECK(phone ~ '^\+233[235][0-9]{8}$'),purpose text NOT NULL CHECK(purpose IN ('marketing','transactional')),granted boolean NOT NULL,source text NOT NULL CHECK(source='account_sms_settings'),created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS sms_consent_phone ON mysteryhub_sms.consents(phone,purpose,id DESC);
CREATE TABLE IF NOT EXISTS mysteryhub_sms.previews(id uuid PRIMARY KEY,actor_id varchar(64) NOT NULL REFERENCES public.users(id),input jsonb NOT NULL,digest text NOT NULL,recipients jsonb NOT NULL,summary jsonb NOT NULL,expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS mysteryhub_sms.campaigns(id uuid PRIMARY KEY,actor_id varchar(64) NOT NULL REFERENCES public.users(id),session_hash text NOT NULL,request_id text NOT NULL UNIQUE,input_hash text NOT NULL,preview_id uuid NOT NULL UNIQUE REFERENCES mysteryhub_sms.previews(id),purpose text NOT NULL CHECK(purpose IN ('transactional','operational','marketing')),body text NOT NULL CHECK(length(body)<=1600),sender text NOT NULL,sandbox boolean NOT NULL,state text NOT NULL CHECK(state IN ('draft','queued','cancelled')),recipient_count integer NOT NULL CHECK(recipient_count BETWEEN 1 AND 1000),estimated_credits integer NOT NULL CHECK(estimated_credits BETWEEN 1 AND 32000),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS mysteryhub_sms.messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_key text NOT NULL UNIQUE,campaign_id uuid REFERENCES mysteryhub_sms.campaigns(id),order_id varchar(64) REFERENCES public.orders(id),user_id varchar(64) REFERENCES public.users(id),purpose text NOT NULL CHECK(purpose IN ('transactional','operational','marketing')),origin text NOT NULL CHECK(origin IN ('manual','automatic')),recipient text NOT NULL CHECK(redacted OR recipient ~ '^\+233[235][0-9]{8}$'),body text NOT NULL CHECK(redacted OR length(body) BETWEEN 1 AND 1600),sender text NOT NULL CHECK(length(sender) BETWEEN 1 AND 11),sandbox boolean NOT NULL,state text NOT NULL DEFAULT 'queued' CHECK(state IN ('draft','queued','submission_started','accepted','delivered','not_delivered','expired','prohibited','failed','uncertain','cancelled')),provider_id text UNIQUE,provider_status text,last_observed bigint NOT NULL DEFAULT 0,estimated_segments integer NOT NULL CHECK(estimated_segments BETWEEN 1 AND 32),reported_segments integer,redacted boolean NOT NULL DEFAULT false,context jsonb NOT NULL DEFAULT '{}',claim uuid,lease_until timestamptz,network_started_at timestamptz,error_code text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS sms_queue ON mysteryhub_sms.messages(created_at) WHERE state='queued';
CREATE INDEX IF NOT EXISTS sms_history ON mysteryhub_sms.messages(created_at DESC,id);
CREATE INDEX IF NOT EXISTS sms_campaign_messages ON mysteryhub_sms.messages(campaign_id);
CREATE TABLE IF NOT EXISTS mysteryhub_sms.attempts(id uuid PRIMARY KEY,message_id uuid NOT NULL UNIQUE REFERENCES mysteryhub_sms.messages(id),state text NOT NULL,started_at timestamptz NOT NULL DEFAULT now(),finished_at timestamptz,error_code text);
CREATE TABLE IF NOT EXISTS mysteryhub_sms.delivery_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),webhook_id text UNIQUE,digest text NOT NULL UNIQUE,message_id uuid NOT NULL REFERENCES mysteryhub_sms.messages(id),status text NOT NULL,observed_at bigint NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS sms_credit_reservations ON mysteryhub_sms.messages(sandbox,network_started_at) WHERE network_started_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS sms_recipient_history ON mysteryhub_sms.messages(recipient,created_at DESC);
CREATE TABLE IF NOT EXISTS mysteryhub_sms.consumed_events(event_key text PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now());
-- Guest-only event source; registered events are consumed read-only from the existing push outbox.
CREATE TABLE IF NOT EXISTS mysteryhub_sms.guest_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id varchar(64) NOT NULL REFERENCES public.orders(id),event_key text NOT NULL UNIQUE,template_id text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS sms_guest_event_time ON mysteryhub_sms.guest_events(created_at,id);
CREATE OR REPLACE FUNCTION mysteryhub_sms.capture_guest_event() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE k text;
BEGIN
 IF NEW.user_id IS NOT NULL OR NOT EXISTS(SELECT 1 FROM mysteryhub_sms.settings WHERE auto_enabled AND NOT paused AND cutoff IS NOT NULL AND NEW.created_at>=cutoff) THEN RETURN NEW; END IF;
 IF NEW.payment_provider NOT IN ('paystack','wallet') OR NEW.payment_status<>'success' OR NEW.paid_at IS NULL OR NEW.store_context IS NOT NULL OR left(NEW.payment_reference,9)='MH_STORE_' THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' OR OLD.payment_status IS DISTINCT FROM NEW.payment_status OR OLD.paid_at IS NULL THEN INSERT INTO mysteryhub_sms.guest_events(order_id,event_key,template_id) VALUES(NEW.id,NEW.id||':sms:payment','payment_confirmed') ON CONFLICT DO NOTHING; END IF;
 IF NEW.status='delivered' AND NEW.delivered_at IS NOT NULL AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR OLD.delivered_at IS NULL) THEN INSERT INTO mysteryhub_sms.guest_events(order_id,event_key,template_id) VALUES(NEW.id,NEW.id||':sms:delivered','order_delivered') ON CONFLICT DO NOTHING; END IF;
 IF COALESCE(NEW.manual_review,false) AND (TG_OP='INSERT' OR OLD.manual_review IS DISTINCT FROM NEW.manual_review) THEN INSERT INTO mysteryhub_sms.guest_events(order_id,event_key,template_id) VALUES(NEW.id,NEW.id||':sms:attention','delivery_attention') ON CONFLICT DO NOTHING; END IF;
 IF NEW.resolution_json->>'outcome' IN ('paystack_refund','wallet_refund') AND NEW.resolution_json->>'stage' IN ('refund_pending','resolved') AND (TG_OP='INSERT' OR OLD.resolution_json->>'stage' IS DISTINCT FROM NEW.resolution_json->>'stage') THEN INSERT INTO mysteryhub_sms.guest_events(order_id,event_key,template_id) VALUES(NEW.id,NEW.id||':sms:refund:'||(NEW.resolution_json->>'stage'),'refund_update') ON CONFLICT DO NOTHING; END IF;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN
 BEGIN UPDATE mysteryhub_sms.settings SET capture_error_at=now() WHERE id=true; EXCEPTION WHEN OTHERS THEN NULL; END;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sms_guest_event ON public.orders;
CREATE TRIGGER sms_guest_event AFTER INSERT OR UPDATE OF status,payment_status,paid_at,delivered_at,manual_review,resolution_json ON public.orders FOR EACH ROW EXECUTE FUNCTION mysteryhub_sms.capture_guest_event();
DO $$ DECLARE t text;r text;BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='mysteryhub_sms' LOOP
 EXECUTE format('ALTER TABLE mysteryhub_sms.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON mysteryhub_sms.%I FROM PUBLIC',t);
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON mysteryhub_sms.%I FROM %I',t,r);EXECUTE format('REVOKE ALL ON SCHEMA mysteryhub_sms FROM %I',r);END IF;END LOOP;
 END LOOP;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA mysteryhub_sms FROM PUBLIC;
INSERT INTO mysteryhub_sms.templates(id,title,body,purpose,locked) VALUES
('payment_confirmed','Order Payment Confirmed','Mystery Hub: Payment verified for {{network}} {{bundle}} order {{reference}}. Delivery is separate. Track at {{site}}/track-order.','transactional',true),
('order_processing','Order Received / Processing','Mystery Hub: Supplier acceptance is recorded for order {{reference}}. Track current progress at {{site}}/track-order.','transactional',true),
('order_delivered','Order Delivered','Mystery Hub: Order {{reference}} is marked delivered by the recorded fulfillment evidence. Need help? {{site}}/help','transactional',true),
('delivery_attention','Order Needs Attention','Mystery Hub: Order {{reference}} needs investigation. This is not a refund or delivery confirmation. Support: {{site}}/help','transactional',true),
('refund_initiated','Refund Processing','Mystery Hub: A refund is being processed for order {{reference}}. Completion is not yet confirmed. Support: {{site}}/help','transactional',true),
('refund_completed','Refund Evidence Verified','Mystery Hub: Completed refund evidence is recorded for order {{reference}}. Contact support if funds are not visible: {{site}}/help','transactional',true),
('delay','Delivery Delay / Investigation','Mystery Hub support: Please visit {{site}}/help for assistance with your order. No delivery time is guaranteed.','operational',false),
('support','Official Support Contact Changed','Mystery Hub Update: Visit {{site}}/help for our current official support contacts. Thank you for your patience.','operational',false),
('maintenance','Service Maintenance / Outage','Mystery Hub service notice: Please check {{site}}/help for current verified service information.','operational',false),
('restored','Service Restored','Mystery Hub service update: Check current availability on {{site}}. Support is available at {{site}}/help.','operational',false),
('channel','New Official WhatsApp Channel','Mystery Hub announcements: Visit {{site}} for our verified official community channels.','marketing',false),
('welcome','Welcome / First Purchase','Welcome to Mystery Hub. Explore our current services at {{site}}. Thank you for choosing us.','marketing',false),
('return','Customer Return Reminder','Hello from Mystery Hub. Explore current services at {{site}} whenever you need them.','marketing',false),
('offer','Special Offer / Discount Announcement','Check current offers and their terms at {{site}}. Eligibility and availability apply.','marketing',false),
('custom','General Custom Message','Write your reviewed message here.','marketing',false) ON CONFLICT DO NOTHING;
COMMIT;
