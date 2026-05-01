import {
  ArgumentsHost,
  ForbiddenException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { AssistantContractException } from '../src/assistant/assistant-contract-error';
import { AssistantContractExceptionFilter } from '../src/assistant/assistant-contract-exception.filter';

interface CapturedResponse {
  status?: number;
  body?: unknown;
}

function makeHost(): { host: ArgumentsHost; res: CapturedResponse } {
  const captured: CapturedResponse = {};
  const fakeRes = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: <T>() => fakeRes as unknown as T,
      getRequest: <T>() => ({}) as T,
      getNext: <T>() => ({}) as T,
    }),
  } as unknown as ArgumentsHost;
  return { host, res: captured };
}

describe('AssistantContractExceptionFilter', () => {
  const filter = new AssistantContractExceptionFilter();

  it('passes through AssistantContractException unchanged', () => {
    const { host, res } = makeHost();
    const exc = new AssistantContractException(
      'AI_PROVIDER_ERROR',
      'rate limited',
      HttpStatus.TOO_MANY_REQUESTS,
      { providerErrorType: 'rate_limit' },
    );
    filter.catch(exc, host);
    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      error: {
        code: 'AI_PROVIDER_ERROR',
        message: 'rate limited',
        details: { providerErrorType: 'rate_limit' },
      },
    });
  });

  it('maps UnauthorizedException to AUTH_REQUIRED (401)', () => {
    const { host, res } = makeHost();
    filter.catch(new UnauthorizedException('Invalid token'), host);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: 'AUTH_REQUIRED', message: 'Invalid token' },
    });
  });

  it('maps quota-related ForbiddenException to ASSISTANT_QUOTA_EXCEEDED (403)', () => {
    const { host, res } = makeHost();
    filter.catch(
      new ForbiddenException('Monthly message quota exceeded.'),
      host,
    );
    expect(res.status).toBe(403);
    expect((res.body as { error: { code: string } }).error.code).toBe(
      'ASSISTANT_QUOTA_EXCEEDED',
    );
  });

  it('maps non-quota ForbiddenException to ENTITLEMENT_INACTIVE (403)', () => {
    const { host, res } = makeHost();
    filter.catch(
      new ForbiddenException('Active subscription or trial entitlement is required.'),
      host,
    );
    expect(res.status).toBe(403);
    expect((res.body as { error: { code: string } }).error.code).toBe(
      'ENTITLEMENT_INACTIVE',
    );
  });

  it('maps generic 400 HttpException to REQUEST_VALIDATION_FAILED', () => {
    const { host, res } = makeHost();
    filter.catch(new HttpException('Bad payload', HttpStatus.BAD_REQUEST), host);
    expect(res.status).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe(
      'REQUEST_VALIDATION_FAILED',
    );
  });

  it('maps unknown errors to INTERNAL_ERROR (500)', () => {
    const { host, res } = makeHost();
    const errorSpy = jest
      .spyOn(
        (filter as unknown as { logger: { error: (...args: unknown[]) => void } }).logger,
        'error',
      )
      .mockImplementation(() => undefined);
    try {
      filter.catch(new Error('boom'), host);
    } finally {
      errorSpy.mockRestore();
    }
    expect(res.status).toBe(500);
    expect((res.body as { error: { code: string } }).error.code).toBe(
      'INTERNAL_ERROR',
    );
  });
});
