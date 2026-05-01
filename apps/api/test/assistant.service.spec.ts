import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { subscriptionPlans } from '@personal-assistant/shared';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

  it('returns no proposals for conversational messages in mock mode', async () => {
    billing.getEntitlement.mockResolvedValue({
      userId: 'u1',
      plan: subscriptionPlans[0],
      active: true,
    });
    quota.assertSubscribedChatWithinQuota.mockResolvedValue(undefined);
    usage.record.mockResolvedValue(undefined);

    const out = await service.chat({
      userId: 'u1',
      request: { clientRequestId: '00000000-0000-4000-8000-000000000004', message: 'Hello' },
    });

    expect(out.mode).toBe('mock');
    expect(out.proposals).toEqual([]);
    expect(out.reply).toBe('OpenAI is not configured yet.');
  });

  it('writes execution log with delete proposals for remove intent', async () => {
    const logPath = join(tmpdir(), `pa-svc-${Date.now()}.ndjson`);
    const prev = process.env.ASSISTANT_EXECUTION_LOG_PATH;
    process.env.ASSISTANT_EXECUTION_LOG_PATH = logPath;
    try {
      billing.getEntitlement.mockResolvedValue({
        userId: 'u1',
        plan: subscriptionPlans[0],
        active: true,
      });
      quota.assertSubscribedChatWithinQuota.mockResolvedValue(undefined);
      usage.record.mockResolvedValue(undefined);

      await service.chat({
        userId: 'u1',
        request: {
          clientRequestId: '00000000-0000-4000-8000-0000000000aa',
          message: 'remove all tasks',
        },
      });

      const text = await fs.readFile(logPath, 'utf8');
      const rows = text
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(
          (l) =>
            JSON.parse(l) as {
              phase?: string;
              payloadSummary?: { proposalTypes?: string[]; proposals?: { localId?: string }[] };
            },
        );
      const planned = rows.find((j) => j.phase === 'assistant_chat_proposals_planned');
      expect(planned?.payloadSummary?.proposalTypes).toEqual(['delete_item']);
      expect(planned?.payloadSummary?.proposals?.[0]?.localId).toBe('local_item_pending_selection');
    } finally {
      if (prev === undefined) {
        delete process.env.ASSISTANT_EXECUTION_LOG_PATH;
      } else {
        process.env.ASSISTANT_EXECUTION_LOG_PATH = prev;
      }
      await fs.unlink(logPath).catch(() => {});
    }
  });
});
