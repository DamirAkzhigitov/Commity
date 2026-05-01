import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type AssistantChatRequest,
  type AssistantChatResponse,
  summarizeAssistantProposalForLog,
} from '@personal-assistant/shared';
import OpenAI from 'openai';
import { BillingService } from '../billing/billing.service';
import { QuotaPolicyService } from '../quota/quota-policy.service';
import { UsageService } from '../usage/usage.service';
import { appendApiAssistantExecutionLog } from './assistant-execution-file-logger';
import { buildUserContentForChatModel, formatPrivacyFilteredContextForModel } from './assistant-context-input';
import { planAssistantActions } from './plan-assistant-actions';

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

    const t0 = Date.now();
    const { clientRequestId, message, context } = input.request;

    await appendApiAssistantExecutionLog({
      phase: 'assistant_chat_start',
      clientRequestId,
      functionOrEndpoint: 'POST /assistant/chat → AssistantService.chat',
      payloadSummary: {
        messageLen: message.length,
        contextItemCount: context?.items.length ?? 0,
      },
    });

    const proposals = planAssistantActions(message);
    await appendApiAssistantExecutionLog({
      phase: 'assistant_chat_proposals_planned',
      clientRequestId,
      payloadSummary: {
        proposalCount: proposals.length,
        proposalTypes: proposals.map((p) => p.type),
        proposals: proposals.map(summarizeAssistantProposalForLog),
      },
    });

    const contextSection = formatPrivacyFilteredContextForModel(input.request.context);
    const userContent = buildUserContentForChatModel(message, contextSection);

    try {
      if (!this.openai) {
        await this.usageService.record({
          userId: input.userId,
          feature: 'chat',
          model: 'mock',
          inputTokens: 0,
          outputTokens: 0,
          estimatedCostUsd: 0,
        });

        await appendApiAssistantExecutionLog({
          phase: 'assistant_chat_complete',
          clientRequestId,
          resultStatus: 'success',
          durationMs: Date.now() - t0,
          payloadSummary: { mode: 'mock', proposalCount: proposals.length },
        });

        return {
          clientRequestId,
          mode: 'mock',
          reply:
            proposals.length > 0
              ? 'OpenAI is not configured yet. I can still draft structured actions from your message.'
              : 'OpenAI is not configured yet.',
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

      await appendApiAssistantExecutionLog({
        phase: 'assistant_chat_complete',
        clientRequestId,
        resultStatus: 'success',
        durationMs: Date.now() - t0,
        payloadSummary: {
          mode: 'openai',
          proposalCount: proposals.length,
          model: modelName,
        },
      });

      return {
        clientRequestId,
        mode: 'openai',
        reply: response.output_text,
        proposals,
      };
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      await appendApiAssistantExecutionLog({
        phase: 'assistant_chat_failed',
        clientRequestId,
        resultStatus: 'failure',
        durationMs: Date.now() - t0,
        errorName: e.name,
        errorMessage: e.message.slice(0, 500),
        errorStackHead: e.stack?.split('\n').slice(0, 8).join('\n'),
      });
      throw err;
    }
  }
}
