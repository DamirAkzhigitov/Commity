import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'pa_user_confirmed_broader_context';

export async function getBroaderContextConsent(): Promise<boolean> {
  const v = await AsyncStorage.getItem(KEY);
  return v === 'true';
}

export async function setBroaderContextConsent(value: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, value ? 'true' : 'false');
}
