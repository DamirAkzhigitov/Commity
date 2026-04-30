-- Align backend schema to infra-only persistence for MVP.
-- Remove personal-content tables that must remain local-first on device.
DROP TABLE IF EXISTS "ChatMessage" CASCADE;
DROP TABLE IF EXISTS "Conversation" CASCADE;
DROP TABLE IF EXISTS "MemoryItem" CASCADE;
DROP TABLE IF EXISTS "Reminder" CASCADE;
DROP TABLE IF EXISTS "Note" CASCADE;
DROP TABLE IF EXISTS "Task" CASCADE;
DROP TABLE IF EXISTS "Goal" CASCADE;

DROP TYPE IF EXISTS "MemoryKind";
DROP TYPE IF EXISTS "Priority";
DROP TYPE IF EXISTS "TaskStatus";

-- Supabase baseline hardening for infra tables.
ALTER TABLE IF EXISTS public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."UsageEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Subscription" ENABLE ROW LEVEL SECURITY;

-- Local Postgres (docker compose) does not have Supabase API roles.
-- Guard role-based hardening so this migration works in both environments.
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
