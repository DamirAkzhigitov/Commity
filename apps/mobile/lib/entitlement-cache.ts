import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GetSubscriptionResponse } from '@personal-assistant/shared';
import { getSubscriptionResponseSchema } from '@personal-assistant/shared';

const STORAGE_KEY = 'pa_entitlement_snapshot_v1';

export async function readCachedEntitlement(): Promise<GetSubscriptionResponse | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return getSubscriptionResponseSchema.parse(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export async function writeCachedEntitlement(snapshot: GetSubscriptionResponse): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export async function clearCachedEntitlement(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
