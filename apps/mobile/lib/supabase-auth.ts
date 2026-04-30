import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getAppConfig } from './config';
import { createSupabaseAuthSecureStorage } from './supabase-auth-secure-storage';

const { supabaseUrl, supabaseAnonKey } = getAppConfig();

const client = createClient(
  supabaseUrl || 'https://example.supabase.co',
  supabaseAnonKey || 'anon-key-placeholder',
  {
    auth: {
      storage: createSupabaseAuthSecureStorage(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

/**
 * Auth-only Supabase surface for the mobile app: sign-in, session, refresh.
 * The full `client` is not exported — use Nest API + local DB for assistant data (Supabase Data API OFF).
 */
export const supabaseAuth: SupabaseClient['auth'] = client.auth;
