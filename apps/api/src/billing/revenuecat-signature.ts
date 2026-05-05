import { createHmac, timingSafeEqual } from 'crypto';

/**
 * RevenueCat sends `X-RevenueCat-Signature`: base64(HMAC-SHA256(webhook_secret, raw_body)).
 * See third-party examples aligned with RevenueCat docs (Kotlin verifySignature pattern).
 */
export function verifyRevenueCatSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader?.trim() || !secret) return false;
  const digest = createHmac('sha256', secret).update(rawBody).digest('base64');
  try {
    const expected = Buffer.from(digest);
    const received = Buffer.from(signatureHeader.trim());
    if (expected.length !== received.length) return false;
    return timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}
