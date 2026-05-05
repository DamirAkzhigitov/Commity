import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { AssistantContextItem } from '@personal-assistant/shared';
import { subscriptionPlans } from '@personal-assistant/shared';
import { AssistantService } from '../src/assistant/assistant.service';
import { BillingService } from '../src/billing/billing.service';
import { QuotaPolicyService } from '../src/quota/quota-policy.service';
import { UsageService } from '../src/usage/usage.service';

const openaiMocks = {
  responsesCreate: jest.fn(),
};

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    responses: {
      create: (...args: unknown[]) => openaiMocks.responsesCreate(...args),
    },
  })),
}));

describe('AssistantService OpenAI request body with context', () => {
  let service: AssistantService;
  let billing: { getEntitlement: jest.Mock };
  let quota: { assertChatWithinPlanQuota: jest.Mock };
  let usage: { record: jest.Mock };

  const reqId = '00000000-0000-4000-8000-000000000099';

  beforeEach(async () => {
    openaiMocks.responsesCreate.mockReset();
    openaiMocks.responsesCreate.mockResolvedValue({
      output_text: 'model reply',
      usage: { input_tokens: 3, output_tokens: 4 },
    });

    billing = { getEntitlement: jest.fn() };
    quota = { assertChatWithinPlanQuota: jest.fn() };
    usage = { record: jest.fn().mockResolvedValue(undefined) };

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
            get: (key: string) => (key === 'OPENAI_API_KEY' ? 'sk-test-placeholder' : undefined),
          },
        },
        { provide: BillingService, useValue: billing },
        { provide: QuotaPolicyService, useValue: quota },
        { provide: UsageService, useValue: usage },
      ],
    }).compile();

    service = moduleRef.get(AssistantService);
  });

  it('threads includeInAi:true items into responses.create user content', async () => {
    const visible: AssistantContextItem = {
      kind: 'document',
      localId: 'n_visible',
      titleOrLabel: 'Meeting notes',
      bodySnippet: 'Discuss roadmap',
      includeInAi: true,
    };

    await service.chat({
      userId: 'u1',
      request: {
        clientRequestId: reqId,
        message: 'What should I do next?',
        context: {
          schemaVersion: 1,
          budget: { maxTotalChars: 6000 },
          privacy: { userConfirmedBroaderContext: false },
          items: [visible],
        },
      },
    });

    expect(openaiMocks.responsesCreate).toHaveBeenCalledTimes(1);
    const call = openaiMocks.responsesCreate.mock.calls[0][0] as {
      input: Array<{ role: string; content: string }>;
    };
    expect(call.input.some((x) => x.role === 'system')).toBe(true);
    const userMsg = call.input.find((x) => x.role === 'user');
    expect(userMsg?.content).toContain('Meeting notes');
    expect(userMsg?.content).toContain('What should I do next?');
    expect(userMsg?.content).toContain('localId=n_visible');
    expect(userMsg?.content).toContain('kind=document');
  });

  it('does not inject includeInAi:false items into provider prompt', async () => {
    const hidden: AssistantContextItem = {
      kind: 'task',
      localId: 'secret-item-id',
      titleOrLabel: 'TOP SECRET TASK NAME',
      includeInAi: false,
      privacy: { sensitivity: 'local_only' },
    };

    await service.chat({
      userId: 'u1',
      request: {
        clientRequestId: reqId,
        message: 'Plan my week',
        context: {
          schemaVersion: 1,
          budget: { maxTotalChars: 8000 },
          privacy: { userConfirmedBroaderContext: true },
          items: [hidden],
        },
      },
    });

    const call = openaiMocks.responsesCreate.mock.calls[0][0] as {
      input: Array<{ role: string; content: string }>;
    };
    const userMsg = call.input.find((x) => x.role === 'user')!;
    expect(userMsg.content.trim()).toBe('Plan my week');
    expect(userMsg.content).not.toContain('TOP SECRET TASK NAME');
    expect(userMsg.content).not.toContain('secret-item-id');
  });
});
