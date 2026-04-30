import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type AssistantAction } from '@personal-assistant/shared';
import OpenAI from 'openai';
import { BillingService } from '../billing/billing.service';
import { QuotaPolicyService } from '../quota/quota-policy.service';
import { UsageService } from '../usage/usage.service';

export interface ChatInput {
  userId: string;
  message: string;
}

function estimateChatCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  config: ConfigService,
): number {
  if (model === 'mock') {
    return 0;
  }
  const inRate = Number(config.get('OPENAI_INPUT_USD_PER_MILLION') ?? 0.15);
  const outRate = Number(config.get('OPENAI_OUTPUT_USD_PER_MILLION') ?? 0.6);
  return (inputTokens * inRate + outputTokens * outRate) / 1_000_000;
}

@Injectable()
export class AssistantService {
  private readonly openai: OpenAI | null;

  constructor(
    private readonly config: ConfigService,
    private readonly billingService: BillingService,
    private readonly quotaPolicyService: QuotaPolicyService,
    private readonly usageService: UsageService,
  ) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    this.openai = apiKey ? new OpenAI({ apiKey }) : null;
  }

  async chat(input: ChatInput) {
    const entitlement = await this.billingService.getEntitlement(input.userId);

    if (!entitlement.active) {
      throw new ForbiddenException('Active subscription or trial entitlement is required.');
    }

    await this.quotaPolicyService.assertSubscribedChatWithinQuota(input.userId, entitlement);

    const plannedActions = this.planActions(input.message);

    if (!this.openai) {
      await this.usageService.record({
        userId: input.userId,
        feature: 'chat',
        model: 'mock',
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
      });

      return {
        mode: 'mock',
        reply:
          'OpenAI is not configured yet. I can still draft structured actions from your message.',
        plannedActions,
      };
    }

    const response = await this.openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content:
            'You are a personal assistant. Be concise and propose structured next actions when helpful.',
        },
        {
          role: 'user',
          content: input.message,
        },
      ],
    });

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    const modelName = 'gpt-4.1-mini';

    await this.usageService.record({
      userId: input.userId,
      feature: 'chat',
      model: modelName,
      inputTokens,
      outputTokens,
      estimatedCostUsd: estimateChatCostUsd(modelName, inputTokens, outputTokens, this.config),
    });

    return {
      mode: 'openai',
      reply: response.output_text,
      plannedActions,
    };
  }

  private planActions(message: string): AssistantAction[] {
    const normalized = message.toLowerCase();

    if (normalized.includes('remind')) {
      return [
        {
          type: 'schedule_reminder',
          payload: {
            title: message,
            remindAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          },
        },
      ];
    }

    if (normalized.includes('note')) {
      return [
        {
          type: 'create_note',
          payload: {
            title: 'New note',
            body: message,
          },
        },
      ];
    }

    return [
      {
        type: 'create_task',
        payload: {
          title: message,
          priority: 'medium',
        },
      },
    ];
  }
}
