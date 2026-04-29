import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type AssistantAction } from '@personal-assistant/shared';
import OpenAI from 'openai';
import { BillingService } from '../billing/billing.service';
import { UsageService } from '../usage/usage.service';

export interface ChatInput {
  userId: string;
  message: string;
}

@Injectable()
export class AssistantService {
  private readonly openai: OpenAI | null;

  constructor(
    config: ConfigService,
    private readonly billingService: BillingService,
    private readonly usageService: UsageService,
  ) {
    const apiKey = config.get<string>('OPENAI_API_KEY');
    this.openai = apiKey ? new OpenAI({ apiKey }) : null;
  }

  async chat(input: ChatInput) {
    const entitlement = this.billingService.getEntitlement(input.userId);

    if (!entitlement.active) {
      throw new UnauthorizedException('Active subscription entitlement is required.');
    }

    const plannedActions = this.planActions(input.message);

    if (!this.openai) {
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

    this.usageService.record({
      userId: input.userId,
      feature: 'chat',
      model: 'gpt-4.1-mini',
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      estimatedCostUsd: 0,
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
