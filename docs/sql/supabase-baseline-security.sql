-- Supabase baseline hardening for backend-first architecture.
-- Expected project defaults:
--   Data API OFF
--   Auto expose new tables/functions OFF
--   Automatic RLS ON
--
-- Run in Supabase SQL Editor after schema migration.

BEGIN;

-- 1) Ensure infra tables are protected by RLS if Data API is ever enabled.
ALTER TABLE IF EXISTS public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."UsageEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Subscription" ENABLE ROW LEVEL SECURITY;

-- 2) Lock down API roles by default.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public."User" FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE public."UsageEvent" FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE public."Subscription" FROM anon';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE public."User" FROM authenticated';
    EXECUTE 'REVOKE ALL ON TABLE public."UsageEvent" FROM authenticated';
    EXECUTE 'REVOKE ALL ON TABLE public."Subscription" FROM authenticated';
  END IF;
END $$;

-- 3) Optional: if client reads are needed later, add explicit policies per table.
-- Example policy template:
-- CREATE POLICY "user can read own usage"
--   ON public."UsageEvent"
--   FOR SELECT
--   TO authenticated
--   USING ("userId" = auth.uid()::text);

COMMIT;
