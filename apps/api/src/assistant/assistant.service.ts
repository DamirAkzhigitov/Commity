import { randomUUID } from 'crypto';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type AssistantActionProposal,
  type AssistantChatRequest,
  type AssistantChatResponse,
} from '@personal-assistant/shared';
import OpenAI from 'openai';
import { BillingService } from '../billing/billing.service';
import { QuotaPolicyService } from '../quota/quota-policy.service';
import { UsageService } from '../usage/usage.service';
import { buildUserContentForChatModel, formatPrivacyFilteredContextForModel } from './assistant-context-input';

export interface ChatInput {
  userId: string;
  request: AssistantChatRequest;
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

  async chat(input: ChatInput): Promise<AssistantChatResponse> {
    const entitlement = await this.billingService.getEntitlement(input.userId);

    if (!entitlement.active) {
      throw new ForbiddenException('Active subscription or trial entitlement is required.');
    }

    await this.quotaPolicyService.assertSubscribedChatWithinQuota(input.userId, entitlement);

    const { clientRequestId, message } = input.request;
    const proposals = this.planActions(message);
    const contextSection = formatPrivacyFilteredContextForModel(input.request.context);
    const userContent = buildUserContentForChatModel(message, contextSection);

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
        clientRequestId,
        mode: 'mock',
        reply:
          'OpenAI is not configured yet. I can still draft structured actions from your message.',
        proposals,
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
          content: userContent,
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
      clientRequestId,
      mode: 'openai',
      reply: response.output_text,
      proposals,
    };
  }

  private planActions(message: string): AssistantActionProposal[] {
    const normalized = message.toLowerCase();
    const id = () => randomUUID();

    if (normalized.includes('delete') || normalized.includes('remove')) {
      return [
        {
          proposalId: id(),
          type: 'delete_item',
          confirmationTier: 'requires_confirmation',
          payload: {
            localId: 'local_item_pending_selection',
            kind: 'task',
          },
        },
      ];
    }

    if (normalized.includes('update') || normalized.includes('rename')) {
      return [
        {
          proposalId: id(),
          type: 'update_item',
          confirmationTier: 'requires_confirmation',
          payload: {
            localId: 'local_item_pending_selection',
            kind: 'task',
            updates: { titleOrLabel: message.slice(0, 512) },
          },
        },
      ];
    }

    if (normalized.includes('goal')) {
      return [
        {
          proposalId: id(),
          type: 'create_goal',
          confirmationTier: 'requires_confirmation',
          payload: {
            title: message.slice(0, 512),
          },
        },
      ];
    }

    if (normalized.includes('remind')) {
      return [
        {
          proposalId: id(),
          type: 'schedule_reminder',
          confirmationTier: 'requires_confirmation',
          payload: {
            title: message.slice(0, 512),
            text: message.slice(0, 2000),
            remindAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          },
        },
      ];
    }

    if (normalized.includes('note')) {
      return [
        {
          proposalId: id(),
          type: 'create_note',
          confirmationTier: 'requires_confirmation',
          payload: {
            title: 'New note',
            body: message,
          },
        },
      ];
    }

    return [
      {
        proposalId: id(),
        type: 'create_task',
        confirmationTier: 'requires_confirmation',
        payload: {
          title: message,
          priority: 'medium',
        },
      },
    ];
  }
}
