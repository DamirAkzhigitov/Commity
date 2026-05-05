import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { subscriptionPlans } from '@personal-assistant/shared';
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  RateLimitError,
} from 'openai';
import { AssistantContractException } from '../src/assistant/assistant-contract-error';
import { AssistantService } from '../src/assistant/assistant.service';
import { BillingService } from '../src/billing/billing.service';
import { QuotaPolicyService } from '../src/quota/quota-policy.service';
import { UsageService } from '../src/usage/usage.service';

const openaiMocks = {
  responsesCreate: jest.fn(),
};

jest.mock('openai', () => {
  const actual = jest.requireActual('openai');
  return {
    __esModule: true,
    ...actual,
    default: jest.fn().mockImplementation(() => ({
      responses: {
        create: (...args: unknown[]) => openaiMocks.responsesCreate(...args),
      },
    })),
  };
});

const reqId = '00000000-0000-4000-8000-000000000a01';

async function buildService(): Promise<{
  service: AssistantService;
  usage: { record: jest.Mock };
}> {
  const billing = { getEntitlement: jest.fn() };
  const quota = { assertChatWithinPlanQuota: jest.fn() };
  const usage = { record: jest.fn().mockResolvedValue(undefined) };

  billing.getEntitlement.mockResolvedValue({
    userId: 'u1',
    plan: subscriptionPlans[0],
    active: true,
  });
  quota.assertChatWithinPlanQuota.mockResolvedValue(undefined);

  const moduleRef = await Test.createTestingModule({
    providers: [
      AssistantService,
      {
        provide: ConfigService,
        useValue: {
          get: (key: string) =>
            key === 'OPENAI_API_KEY' ? 'sk-test-placeholder' : undefined,
        },
      },
      { provide: BillingService, useValue: billing },
      { provide: QuotaPolicyService, useValue: quota },
      { provide: UsageService, useValue: usage },
    ],
  }).compile();

  return { service: moduleRef.get(AssistantService), usage };
}

describe('AssistantService OpenAI guardrails and error mapping', () => {
  beforeEach(() => {
    openaiMocks.responsesCreate.mockReset();
  });

  it('passes timeout, maxRetries, max_output_tokens, and signal to the provider', async () => {
    openaiMocks.responsesCreate.mockResolvedValue({
      output_text: 'ok',
      usage: { input_tokens: 1, output_tokens: 1 },
    });

    const { service } = await buildService();
    const controller = new AbortController();

    await service.chat({
      userId: 'u1',
      request: { clientRequestId: reqId, message: 'plan my day' },
      signal: controller.signal,
    });

    expect(openaiMocks.responsesCreate).toHaveBeenCalledTimes(1);
    const [body, opts] = openaiMocks.responsesCreate.mock.calls[0] as [
      { max_output_tokens?: number },
      { timeout?: number; maxRetries?: number; signal?: AbortSignal } | undefined,
    ];
    expect(body.max_output_tokens).toBeGreaterThan(0);
    expect(body.max_output_tokens).toBeLessThanOrEqual(2000);
    expect(opts?.timeout).toBeGreaterThan(0);
    expect(opts?.timeout).toBeLessThanOrEqual(60_000);
    expect(typeof opts?.maxRetries).toBe('number');
    expect(opts?.signal).toBe(controller.signal);
  });

  it('does not record usage and maps RateLimitError → AI_PROVIDER_ERROR (429)', async () => {
    const headers = new Headers();
    openaiMocks.responsesCreate.mockRejectedValue(
      new RateLimitError(429, { message: 'slow down' }, 'rate-limited', headers),
    );

    const { service, usage } = await buildService();

    let caught: unknown;
    try {
      await service.chat({
        userId: 'u1',
        request: { clientRequestId: reqId, message: 'hello world' },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AssistantContractException);
    const exc = caught as AssistantContractException;
    expect(exc.code).toBe('AI_PROVIDER_ERROR');
    expect(exc.getStatus()).toBe(429);
    expect(usage.record).not.toHaveBeenCalled();
  });

  it('maps AuthenticationError → AI_PROVIDER_ERROR (502)', async () => {
    openaiMocks.responsesCreate.mockRejectedValue(
      new AuthenticationError(401, { message: 'bad key' }, 'auth', new Headers()),
    );
    const { service } = await buildService();
    let caught: unknown;
    try {
      await service.chat({
        userId: 'u1',
        request: { clientRequestId: reqId, message: 'hello world' },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AssistantContractException);
    const exc = caught as AssistantContractException;
    expect(exc.code).toBe('AI_PROVIDER_ERROR');
    expect(exc.getStatus()).toBe(502);
  });

  it('maps APIConnectionTimeoutError → AI_PROVIDER_ERROR (504)', async () => {
    openaiMocks.responsesCreate.mockRejectedValue(
      new APIConnectionTimeoutError({ message: 'timed out' }),
    );
    const { service } = await buildService();
    let caught: unknown;
    try {
      await service.chat({
        userId: 'u1',
        request: { clientRequestId: reqId, message: 'hello world' },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AssistantContractException);
    const exc = caught as AssistantContractException;
    expect(exc.code).toBe('AI_PROVIDER_ERROR');
    expect(exc.getStatus()).toBe(504);
  });

  it('maps APIConnectionError → AI_PROVIDER_ERROR (502)', async () => {
    openaiMocks.responsesCreate.mockRejectedValue(
      new APIConnectionError({ message: 'down' }),
    );
    const { service } = await buildService();
    let caught: unknown;
    try {
      await service.chat({
        userId: 'u1',
        request: { clientRequestId: reqId, message: 'hello world' },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AssistantContractException);
    const exc = caught as AssistantContractException;
    expect(exc.code).toBe('AI_PROVIDER_ERROR');
    expect(exc.getStatus()).toBe(502);
  });

  it('maps BadRequestError → AI_PROVIDER_ERROR (502)', async () => {
    openaiMocks.responsesCreate.mockRejectedValue(
      new BadRequestError(400, { message: 'bad' }, 'bad-request', new Headers()),
    );
    const { service } = await buildService();
    let caught: unknown;
    try {
      await service.chat({
        userId: 'u1',
        request: { clientRequestId: reqId, message: 'hello world' },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AssistantContractException);
    const exc = caught as AssistantContractException;
    expect(exc.code).toBe('AI_PROVIDER_ERROR');
    expect(exc.getStatus()).toBe(502);
  });

  it('maps generic APIError → AI_PROVIDER_ERROR (502)', async () => {
    openaiMocks.responsesCreate.mockRejectedValue(
      new APIError(503, { message: 'meh' }, 'transient', new Headers()),
    );
    const { service } = await buildService();
    let caught: unknown;
    try {
      await service.chat({
        userId: 'u1',
        request: { clientRequestId: reqId, message: 'hello world' },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AssistantContractException);
    const exc = caught as AssistantContractException;
    expect(exc.code).toBe('AI_PROVIDER_ERROR');
    expect(exc.getStatus()).toBe(502);
  });

  it('maps APIUserAbortError → AI_PROVIDER_ERROR (503)', async () => {
    openaiMocks.responsesCreate.mockRejectedValue(
      new APIUserAbortError({ message: 'aborted' }),
    );
    const { service } = await buildService();
    let caught: unknown;
    try {
      await service.chat({
        userId: 'u1',
        request: { clientRequestId: reqId, message: 'hello world' },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AssistantContractException);
    const exc = caught as AssistantContractException;
    expect(exc.code).toBe('AI_PROVIDER_ERROR');
    expect(exc.getStatus()).toBe(503);
  });

  it('maps unknown Error → INTERNAL_ERROR (500)', async () => {
    openaiMocks.responsesCreate.mockRejectedValue(new Error('boom'));
    const { service } = await buildService();
    let caught: unknown;
    try {
      await service.chat({
        userId: 'u1',
        request: { clientRequestId: reqId, message: 'hello world' },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AssistantContractException);
    const exc = caught as AssistantContractException;
    expect(exc.code).toBe('INTERNAL_ERROR');
    expect(exc.getStatus()).toBe(500);
  });
});
