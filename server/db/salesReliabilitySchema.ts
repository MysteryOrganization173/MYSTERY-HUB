/** Private operational evidence only. No customer/order foreign keys or financial changes. */
export const SALES_RELIABILITY_SCHEMA=`
CREATE SCHEMA IF NOT EXISTS mysteryhub_operations;
REVOKE ALL ON SCHEMA mysteryhub_operations FROM PUBLIC;
CREATE TABLE IF NOT EXISTS mysteryhub_operations.checkout_observations (
 id UUID PRIMARY KEY, observed_at TIMESTAMPTZ NOT NULL,
 service TEXT NOT NULL CHECK(service IN ('data','airtime','instant_bundle')),
 stage TEXT NOT NULL CHECK(stage IN ('services','catalog','wallet','beneficiary','application')),
 category TEXT NOT NULL CHECK(category IN ('passed','validation','unverified','timeout','authorization','connection','http_error','supplier_response','service_unavailable','wallet_low','configuration','internal_error','application_error')),
 blocked BOOLEAN NOT NULL, phase TEXT NOT NULL CHECK(phase IN ('headers','body','unknown')),
 fresh JSONB NOT NULL CHECK(jsonb_typeof(fresh)='object'), cached JSONB NOT NULL CHECK(jsonb_typeof(cached)='array')
);
CREATE INDEX IF NOT EXISTS checkout_observations_time ON mysteryhub_operations.checkout_observations(observed_at DESC,id);
CREATE TABLE IF NOT EXISTS mysteryhub_operations.checkout_incidents (
 id UUID PRIMARY KEY, service TEXT NOT NULL CHECK(service IN ('data','airtime','instant_bundle')),
 stage TEXT NOT NULL CHECK(stage IN ('services','catalog','wallet','beneficiary','application')),
 category TEXT NOT NULL CHECK(category IN ('timeout','authorization','connection','http_error','supplier_response','service_unavailable','wallet_low','configuration','internal_error','application_error')),
 first_failure_at TIMESTAMPTZ NOT NULL, last_failure_at TIMESTAMPTZ NOT NULL,
 affected_attempts INTEGER NOT NULL CHECK(affected_attempts>=3), blocked_attempts INTEGER NOT NULL CHECK(blocked_attempts>=0 AND blocked_attempts<=affected_attempts),
 first_recovery_at TIMESTAMPTZ, last_recovery_at TIMESTAMPTZ, recovered_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS checkout_incidents_open ON mysteryhub_operations.checkout_incidents(service,stage) WHERE recovered_at IS NULL;
DO $sales_security$
DECLARE t text; r text;
BEGIN
 FOREACH t IN ARRAY ARRAY['checkout_observations','checkout_incidents'] LOOP
  EXECUTE format('ALTER TABLE mysteryhub_operations.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON TABLE mysteryhub_operations.%I FROM PUBLIC',t);
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
    EXECUTE format('REVOKE ALL ON SCHEMA mysteryhub_operations FROM %I',r);
    EXECUTE format('REVOKE ALL ON TABLE mysteryhub_operations.%I FROM %I',t,r);
   END IF;
  END LOOP;
 END LOOP;
END $sales_security$;
`;
