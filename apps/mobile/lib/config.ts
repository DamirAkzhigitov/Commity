/**
 * Reads public client configuration. Use EXPO_PUBLIC_* in `.env` (Expo inlines at bundle time).
 * Android emulator: API host is often `http://10.0.2.2:3000` instead of localhost.
 */
export type AppConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  apiBaseUrl: string;
};

export function getAppConfig(): AppConfig {
  return {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000',
  };
}

export function isSupabaseConfigured(config: AppConfig): boolean {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}
