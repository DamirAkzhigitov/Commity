/**
 * Reads public client configuration. Use EXPO_PUBLIC_* in `.env` (Expo inlines at bundle time).
 * Android emulator: `http://localhost` and `127.0.0.1` point at the emulator, not your dev machine — we
 * remap to `10.0.2.2` only when `Platform.OS === 'android'` and the app is not on a physical device.
 * Physical Android devices must use your computer's LAN IP (e.g. http://192.168.1.10:3000).
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { normalizeAndroidEmulatorApiBaseUrl } from './android-emulator-api-url';

export type AppConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  apiBaseUrl: string;
};

export function getAppConfig(): AppConfig {
  const rawApi = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
  const apiBaseUrl = normalizeAndroidEmulatorApiBaseUrl(rawApi, {
    platformOs: Platform.OS,
    isPhysicalDevice: Constants.isDevice,
  });

  return {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    apiBaseUrl,
  };
}

export function isSupabaseConfigured(config: AppConfig): boolean {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}
