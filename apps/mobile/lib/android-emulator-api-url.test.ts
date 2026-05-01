import { describe, expect, it } from 'vitest';
import { normalizeAndroidEmulatorApiBaseUrl } from './android-emulator-api-url';

describe('normalizeAndroidEmulatorApiBaseUrl', () => {
  it('leaves localhost on iOS simulator (host loopback works there)', () => {
    expect(
      normalizeAndroidEmulatorApiBaseUrl('http://localhost:3000', {
        platformOs: 'ios',
        isPhysicalDevice: false,
      }),
    ).toBe('http://localhost:3000');
  });

  it('maps Android emulator loopback to 10.0.2.2', () => {
    expect(
      normalizeAndroidEmulatorApiBaseUrl('http://localhost:3000', {
        platformOs: 'android',
        isPhysicalDevice: false,
      }),
    ).toBe('http://10.0.2.2:3000');
  });

  it('does not remap on a physical Android device (use LAN IP in .env)', () => {
    expect(
      normalizeAndroidEmulatorApiBaseUrl('http://localhost:3000', {
        platformOs: 'android',
        isPhysicalDevice: true,
      }),
    ).toBe('http://localhost:3000');
  });

  it('does not remap https or non-loopback hosts', () => {
    expect(
      normalizeAndroidEmulatorApiBaseUrl('https://localhost:3000', {
        platformOs: 'android',
        isPhysicalDevice: false,
      }),
    ).toBe('https://localhost:3000');
    expect(
      normalizeAndroidEmulatorApiBaseUrl('http://192.168.1.5:3000', {
        platformOs: 'android',
        isPhysicalDevice: false,
      }),
    ).toBe('http://192.168.1.5:3000');
  });
});
