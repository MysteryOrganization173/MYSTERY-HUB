/** Backend-only tables: custom sessions/authorization live in Express, not Supabase JWTs.
 * Run after all table creation. One atomic statement; reruns do not change data or policies.
 * No FORCE RLS: the verified owner-based backend access model must remain functional.
 */
export const BACKEND_RLS_SCHEMA = `
DO $backend_rls$
DECLARE
  table_name text;
  role_name text;
BEGIN
  -- Bound lock acquisition during a rolling deploy; an error rolls back this whole statement.
  PERFORM set_config('lock_timeout', '5s', true);
  FOR table_name IN SELECT unnest(ARRAY[
    'admin_audit_log', 'afa_registrations',
    'finance_accounts', 'finance_config', 'finance_ledger', 'finance_operations',
    'marketplace_categories', 'marketplace_inquiries', 'marketplace_products', 'orders',
    'referral_attributions', 'referral_clicks', 'referral_profile_suspensions',
    'referral_profiles', 'referral_reward_rules', 'referral_reward_suppressions',
    'reward_ledger', 'sessions', 'supplier_webhook_events', 'users', 'waitlist',
    'website_assets', 'website_sites', 'website_ultra_enquiries'
  ]) LOOP
    -- The actual startup connection must retain access after RLS, even without BYPASSRLS.
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=table_name AND c.relkind='r'
        AND NOT c.relforcerowsecurity
        AND pg_catalog.pg_has_role(current_user,c.relowner,'USAGE')
    ) THEN
      RAISE EXCEPTION 'Backend RLS requires an existing, non-FORCE table owned by the startup role: public.%', table_name;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    -- RLS does not cover TRUNCATE. Remove residual client grants as well as CRUD grants.
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', table_name);
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', table_name, role_name);
      END IF;
    END LOOP;
  END LOOP;
  -- New tables created by this same backend role must not inherit Supabase client grants.
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I',role_name);
    END IF;
  END LOOP;
END
$backend_rls$;
`;
