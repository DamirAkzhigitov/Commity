import { supabaseAuth } from './supabase-auth';

/**
 * Returns a Supabase access JWT suitable for `Authorization: Bearer` on the Nest API.
 * Refreshes the session when the access token is near expiry.
 */
export async function getAccessTokenForApi(): Promise<string | null> {
  const { data: sessionRes, error } = await supabaseAuth.getSession();
  if (error || !sessionRes.session?.access_token) {
    return null;
  }
  const session = sessionRes.session;
  const exp = session.expires_at;
  if (typeof exp === 'number' && exp * 1000 < Date.now() + 45_000) {
    const { data: refreshed, error: refErr } = await supabaseAuth.refreshSession();
    if (!refErr && refreshed.session?.access_token) {
      return refreshed.session.access_token;
    }
  }
  return session.access_token;
}
