import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import { getAppConfig } from './config';

let purchasesConfigured = false;

function canUseNativePurchases(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/**
 * Configures the RevenueCat SDK once when a platform API key is present.
 * No-ops on web, simulators without keys, or when env is unset.
 */
export function ensurePurchasesConfigured(): void {
  if (!canUseNativePurchases() || purchasesConfigured) {
    return;
  }
  const key = getAppConfig().revenueCatApiKey.trim();
  if (!key) {
    return;
  }
  Purchases.configure({ apiKey: key });
  purchasesConfigured = true;
}

/**
 * Associates the RC customer with the signed-in Supabase user (or clears on sign-out).
 */
export async function syncPurchasesWithAuthUser(userId: string | null): Promise<void> {
  if (!canUseNativePurchases()) {
    return;
  }
  ensurePurchasesConfigured();
  if (!purchasesConfigured) {
    return;
  }
  try {
    if (userId) {
      await Purchases.logIn(userId);
    } else {
      await Purchases.logOut();
    }
  } catch {
    // Missing native module in Expo Go, misconfigured keys, or network — billing UI still works via API cache.
  }
}
