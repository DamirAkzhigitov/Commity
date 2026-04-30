import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { subscriptionPlans } from '@personal-assistant/shared';
import { AssistantService } from '../src/assistant/assistant.service';
import { BillingService } from '../src/billing/billing.service';
import { QuotaPolicyService } from '../src/quota/quota-policy.service';
import { UsageService } from '../src/usage/usage.service';

describe('AssistantService', () => {
  let service: AssistantService;
  let billing: { getEntitlement: jest.Mock };
  let quota: { assertSubscribedChatWithinQuota: jest.Mock };
  let usage: { record: jest.Mock };

  beforeEach(async () => {
    billing = { getEntitlement: jest.fn() };
    quota = { assertSubscribedChatWithinQuota: jest.fn() };
    usage = { record: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AssistantService,
        {
          provide: ConfigService,
          useValue: {
            get: () => undefined,
          },
        },
        { provide: BillingService, useValue: billing },
        { provide: QuotaPolicyService, useValue: quota },
        { provide: UsageService, useValue: usage },
      ],
    }).compile();

    service = moduleRef.get(AssistantService);
  });

  it('does not record usage when entitlement is inactive', async () => {
    billing.getEntitlement.mockResolvedValue({
      userId: 'u1',
      plan: subscriptionPlans[0],
      active: false,
    });

    await expect(
      service.chat({
        userId: 'u1',
        request: { clientRequestId: '00000000-0000-4000-8000-000000000001', message: 'hello' },
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(quota.assertSubscribedChatWithinQuota).not.toHaveBeenCalled();
    expect(usage.record).not.toHaveBeenCalled();
  });

  it('does not record usage when quota rejects', async () => {
    billing.getEntitlement.mockResolvedValue({
      userId: 'u1',
      plan: subscriptionPlans[1],
      active: true,
    });
    quota.assertSubscribedChatWithinQuota.mockRejectedValue(
      new ForbiddenException('Monthly message quota exceeded.'),
    );

    await expect(
      service.chat({
        userId: 'u1',
        request: { clientRequestId: '00000000-0000-4000-8000-000000000001', message: 'hello' },
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(usage.record).not.toHaveBeenCalled();
  });

  it('records mock-mode usage without calling OpenAI', async () => {
    billing.getEntitlement.mockResolvedValue({
      userId: 'u1',
      plan: subscriptionPlans[0],
      active: true,
    });
    quota.assertSubscribedChatWithinQuota.mockResolvedValue(undefined);
    usage.record.mockResolvedValue(undefined);

    const out = await service.chat({
      userId: 'u1',
      request: { clientRequestId: '00000000-0000-4000-8000-000000000003', message: 'buy milk' },
    });

    expect(out.mode).toBe('mock');
    expect(out.clientRequestId).toBe('00000000-0000-4000-8000-000000000003');
    expect(out.proposals[0].type).toBe('create_task');
    expect(usage.record).toHaveBeenCalledWith({
      userId: 'u1',
      feature: 'chat',
      model: 'mock',
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
    });
  });
});
