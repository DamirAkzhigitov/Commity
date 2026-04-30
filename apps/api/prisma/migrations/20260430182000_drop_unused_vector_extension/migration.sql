-- Infra-only backend does not use pgvector tables.
-- Remove extension to satisfy Supabase security advisor (extension_in_public).
DROP EXTENSION IF EXISTS vector;
