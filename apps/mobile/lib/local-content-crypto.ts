import { gcm } from '@noble/ciphers/aes.js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const LOCAL_DEK_KEY = 'pa_local_data_dek_v1';

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
  const existing = await SecureStore.getItemAsync(LOCAL_DEK_KEY);
  if (existing) {
    return hexToBytes(existing);
  }
  const raw = await Crypto.getRandomBytesAsync(32);
  const dek = new Uint8Array(raw);
  await SecureStore.setItemAsync(LOCAL_DEK_KEY, bytesToHex(dek));
  return dek;
}

export async function encryptLocalContent(plain: string): Promise<string> {
  const dek = await getOrCreateDek();
  const ivRaw = await Crypto.getRandomBytesAsync(12);
  const iv = new Uint8Array(ivRaw);
  const cipher = gcm(dek, iv);
  const ct = cipher.encrypt(new TextEncoder().encode(plain));
  return JSON.stringify({ ivB64: bytesToB64(iv), ctB64: bytesToB64(ct) });
}

export async function decryptLocalContent(payload: string | null): Promise<string | null> {
  if (!payload) {
    return null;
  }
  try {
    const { ivB64, ctB64 } = JSON.parse(payload) as { ivB64: string; ctB64: string };
    const dek = await getOrCreateDek();
    const cipher = gcm(dek, b64ToBytes(ivB64));
    const plain = cipher.decrypt(b64ToBytes(ctB64));
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}
