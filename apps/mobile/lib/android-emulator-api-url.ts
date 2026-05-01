/**
 * Rewrites loopback hosts to the Android emulator's host gateway (10.0.2.2).
 * Used by getAppConfig() — kept pure so Vitest runs without react-native.
 */
export function normalizeAndroidEmulatorApiBaseUrl(
  apiBaseUrl: string,
  env: { platformOs: string; isPhysicalDevice: boolean },
): string {
  const trimmed = apiBaseUrl.trim();
  if (!trimmed || env.platformOs !== 'android' || env.isPhysicalDevice) {
    return trimmed;
  }

  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'http:') {
      return trimmed;
    }
    if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') {
      return trimmed;
    }
    u.hostname = '10.0.2.2';
    return u.toString().replace(/\/$/, '');
  } catch {
    return trimmed;
  }
}
