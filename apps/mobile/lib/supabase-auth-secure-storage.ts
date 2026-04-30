import AsyncStorage from '@react-native-async-storage/async-storage';
import { gcm } from '@noble/ciphers/aes.js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const DEK_KEY = 'pa_sb_session_dek_v1';
const ENC_PREFIX = 'pa_sb_enc_v1:';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const u8 = new Uint8Array(hex.length / 2);
  for (let i = 0; i < u8.length; i++) {
    u8[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return u8;
}

function bytesToB64(u8: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u8.length; i++) {
    s += String.fromCharCode(u8[i]);
  }
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    u8[i] = s.charCodeAt(i);
  }
  return u8;
}

async function getOrCreateDek(): Promise<Uint8Array> {
  const existing = await SecureStore.getItemAsync(DEK_KEY);
  if (existing) {
    return hexToBytes(existing);
  }
  const raw = await Crypto.getRandomBytesAsync(32);
  const dek = new Uint8Array(raw);
  await SecureStore.setItemAsync(DEK_KEY, bytesToHex(dek));
  return dek;
}

type AsyncAuthStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

/**
 * Persists Supabase auth session: DEK in SecureStore, ciphertext in AsyncStorage.
 * Avoids Expo SecureStore item size limits while keeping material off plain disk.
 */
export function createSupabaseAuthSecureStorage(): AsyncAuthStorage {
  return {
    async getItem(key) {
      const wrapped = await AsyncStorage.getItem(`${ENC_PREFIX}${key}`);
      if (wrapped) {
        try {
          const dek = await getOrCreateDek();
          const { ivB64, ctB64 } = JSON.parse(wrapped) as { ivB64: string; ctB64: string };
          const iv = b64ToBytes(ivB64);
          const ct = b64ToBytes(ctB64);
          const cipher = gcm(dek, iv);
          const plain = cipher.decrypt(ct);
          return new TextDecoder().decode(plain);
        } catch {
          return null;
        }
      }

      const legacy = await AsyncStorage.getItem(key);
      return legacy;
    },

    async setItem(key, value) {
      const dek = await getOrCreateDek();
      const ivRaw = await Crypto.getRandomBytesAsync(12);
      const iv = new Uint8Array(ivRaw);
      const cipher = gcm(dek, iv);
      const ct = cipher.encrypt(new TextEncoder().encode(value));
      await AsyncStorage.setItem(
        `${ENC_PREFIX}${key}`,
        JSON.stringify({ ivB64: bytesToB64(iv), ctB64: bytesToB64(ct) }),
      );
      await AsyncStorage.removeItem(key);
    },

    async removeItem(key) {
      await AsyncStorage.multiRemove([`${ENC_PREFIX}${key}`, key]);
    },
  };
}
