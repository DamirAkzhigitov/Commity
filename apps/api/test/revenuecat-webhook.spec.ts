import { createHmac } from 'crypto';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { RevenueCatWebhookService } from '../src/billing/revenuecat-webhook.service';
import { verifyRevenueCatSignature } from '../src/billing/revenuecat-signature';

describe('verifyRevenueCatSignature', () => {
  it('accepts a valid HMAC-SHA256 base64 digest', () => {
    const secret = 'whsec_test';
    const body = Buffer.from('{"api_version":"1.0"}');
    const sig = createHmac('sha256', secret).update(body).digest('base64');
    expect(verifyRevenueCatSignature(body, sig, secret)).toBe(true);
  });

  it('rejects wrong secret', () => {
    const body = Buffer.from('{}');
    const sig = createHmac('sha256', 'good').update(body).digest('base64');
    expect(verifyRevenueCatSignature(body, sig, 'wrong')).toBe(false);
  });

  it('rejects tampered body', () => {
    const secret = 'whsec_test';
    const original = Buffer.from('{"a":1}');
    const sig = createHmac('sha256', secret).update(original).digest('base64');
    expect(verifyRevenueCatSignature(Buffer.from('{"a":2}'), sig, secret)).toBe(false);
  });

  it('rejects missing signature header', () => {
    expect(verifyRevenueCatSignature(Buffer.from('x'), undefined, 'sec')).toBe(false);
  });
});

describe('RevenueCatWebhookService.verifyRequest', () => {
  function svc(secret?: string, auth?: string) {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'REVENUECAT_WEBHOOK_SECRET') return secret;
        if (key === 'REVENUECAT_WEBHOOK_AUTHORIZATION') return auth;
        return undefined;
      }),
    };
    return new RevenueCatWebhookService(config as never, {} as never);
  }

  it('throws ServiceUnavailable when webhook secret is not configured', () => {
    expect(() => svc(undefined).verifyRequest({}, Buffer.from('{}'))).toThrow(
      ServiceUnavailableException,
    );
  });

  it('throws Unauthorized when signature is invalid', () => {
    const body = Buffer.from('payload');
    expect(() => svc('secret').verifyRequest({ 'x-revenuecat-signature': 'bad' }, body)).toThrow(
      UnauthorizedException,
    );
  });

  it('accepts valid signature', () => {
    const secret = 'abc';
    const body = Buffer.from('hello');
    const sig = createHmac('sha256', secret).update(body).digest('base64');
    expect(() => svc(secret).verifyRequest({ 'x-revenuecat-signature': sig }, body)).not.toThrow();
  });

  it('requires Authorization header when REVENUECAT_WEBHOOK_AUTHORIZATION is set', () => {
    const secret = 'sec';
    const body = Buffer.from('{}');
    const sig = createHmac('sha256', secret).update(body).digest('base64');
    const auth = 'Bearer expected-token';
    const s = svc(secret, auth);

    expect(() =>
      s.verifyRequest({ 'x-revenuecat-signature': sig }, body),
    ).toThrow(UnauthorizedException);

    expect(() =>
      s.verifyRequest({ 'x-revenuecat-signature': sig, authorization: auth }, body),
    ).not.toThrow();
  });
});
