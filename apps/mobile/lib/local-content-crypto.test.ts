import { beforeEach, describe, expect, it, vi } from 'vitest';

const secureStoreState = vi.hoisted(() => ({
  value: null as string | null,
}));

const randomBytesQueue = vi.hoisted(() => [] as number[][]);

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async () => secureStoreState.value),
  setItemAsync: vi.fn(async (_key: string, value: string) => {
    secureStoreState.value = value;
  }),
  deleteItemAsync: vi.fn(async () => {
    secureStoreState.value = null;
  }),
}));

vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: vi.fn(async (size: number) => {
    const next = randomBytesQueue.shift();
    if (!next) {
      return new Uint8Array(size);
    }
    return new Uint8Array(next);
  }),
}));

vi.mock('@noble/ciphers/aes.js', () => ({
  gcm: (key: Uint8Array, _iv: Uint8Array) => ({
    encrypt: (plain: Uint8Array) => Uint8Array.from([key[0] ?? 0, ...plain]),
    decrypt: (cipher: Uint8Array) => {
      if ((cipher[0] ?? -1) !== (key[0] ?? -2)) {
        throw new Error('auth-failed');
      }
      return cipher.slice(1);
    },
  }),
}));

import {
  clearLocalContentDek,
  decryptLocalContent,
  decryptLocalContentDetailed,
  encryptLocalContent,
} from './local-content-crypto';

describe('local-content-crypto diagnostics', () => {
  beforeEach(() => {
    secureStoreState.value = null;
    randomBytesQueue.length = 0;
    if (typeof globalThis.btoa !== 'function') {
      globalThis.btoa = (value: string) => Buffer.from(value, 'binary').toString('base64');
    }
    if (typeof globalThis.atob !== 'function') {
      globalThis.atob = (value: string) => Buffer.from(value, 'base64').toString('binary');
    }
  });

  it('round-trips encrypted content', async () => {
    randomBytesQueue.push(
      Array.from({ length: 32 }, (_v, i) => i + 1),
      Array.from({ length: 12 }, (_v, i) => i + 10),
    );
    const payload = await encryptLocalContent('hello');
    const result = await decryptLocalContentDetailed(payload);
    expect(result).toEqual({ ok: true, plain: 'hello' });
    await expect(decryptLocalContent(payload)).resolves.toBe('hello');
  });

  it('classifies malformed payloads', async () => {
    await expect(decryptLocalContentDetailed(null)).resolves.toEqual({
      ok: false,
      code: 'empty_payload',
    });
    await expect(decryptLocalContentDetailed('not-json')).resolves.toEqual({
      ok: false,
      code: 'invalid_payload_json',
    });
    await expect(decryptLocalContentDetailed('{"foo":"bar"}')).resolves.toEqual({
      ok: false,
      code: 'invalid_payload_shape',
    });
  });

  it('returns decrypt_failed when ciphertext was sealed with old key', async () => {
    randomBytesQueue.push(
      Array.from({ length: 32 }, () => 7),
      Array.from({ length: 12 }, () => 3),
    );
    const payload = await encryptLocalContent('persistent');

    await clearLocalContentDek();
    randomBytesQueue.push(Array.from({ length: 32 }, () => 9));

    const result = await decryptLocalContentDetailed(payload);
    expect(result).toEqual({ ok: false, code: 'decrypt_failed' });
    await expect(decryptLocalContent(payload)).resolves.toBeNull();
  });
});
