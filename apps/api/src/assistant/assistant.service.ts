import { ForbiddenException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  assistantChatResponseSchema,
  type AssistantChatRequest,
  type AssistantChatResponse,
  summarizeAssistantProposalForLog,
} from '@personal-assistant/shared';
import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  PermissionDeniedError,
  RateLimitError,
} from 'openai';
import { BillingService } from '../billing/billing.service';
import { QuotaPolicyService } from '../quota/quota-policy.service';
import { UsageService } from '../usage/usage.service';
import { AssistantContractException } from './assistant-contract-error';
import { appendApiAssistantExecutionLog } from './assistant-execution-file-logger';
import { buildUserContentForChatModel, formatPrivacyFilteredContextForModel } from './assistant-context-input';
import { planAssistantActions } from './plan-assistant-actions';

export interface ChatInput {
  userId: string;
  request: AssistantChatRequest;
  /**
   * Optional client-cancellation signal. When the HTTP client disconnects,
   * the controller forwards this so the upstream OpenAI call is aborted
   * and we stop billing tokens for a request that no one is waiting for.
   */
  signal?: AbortSignal;
}

/** Documented per-request guardrails for the OpenAI provider call. */
const OPENAI_REQUEST_TIMEOUT_MS = 30_000;
const OPENAI_MAX_RETRIES = 1;
const OPENAI_MAX_OUTPUT_TOKENS = 1200;

const DEFAULT_INPUT_USD_PER_MILLION = 0.15;
const DEFAULT_OUTPUT_USD_PER_MILLION = 0.6;

function parseUsdRate(raw: unknown, fallback: number): number {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function estimateChatCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  config: ConfigService,
): number {
  if (model === 'mock') {
    return 0;
  }
  const inRate = parseUsdRate(
    config.get('OPENAI_INPUT_USD_PER_MILLION'),
    DEFAULT_INPUT_USD_PER_MILLION,
  );
  const outRate = parseUsdRate(
    config.get('OPENAI_OUTPUT_USD_PER_MILLION'),
    DEFAULT_OUTPUT_USD_PER_MILLION,
  );
  const cost = (inputTokens * inRate + outputTokens * outRate) / 1_000_000;
  return Number.isFinite(cost) && cost >= 0 ? cost : 0;
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

    await this.quotaPolicyService.assertChatWithinPlanQuota(input.userId, entitlement);

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

        return assistantChatResponseSchema.parse({
          clientRequestId,
          mode: 'mock',
          reply:
            proposals.length > 0
              ? 'OpenAI is not configured yet. I can still draft structured actions from your message.'
              : 'OpenAI is not configured yet.',
          proposals,
        });
      }

      const response = await this.openai.responses.create(
        {
          model: 'gpt-4.1-mini',
          max_output_tokens: OPENAI_MAX_OUTPUT_TOKENS,
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
        },
        {
          timeout: OPENAI_REQUEST_TIMEOUT_MS,
          maxRetries: OPENAI_MAX_RETRIES,
          ...(input.signal ? { signal: input.signal } : {}),
        },
      );

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

      return assistantChatResponseSchema.parse({
        clientRequestId,
        mode: 'openai',
        reply: response.output_text,
        proposals,
      });
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
      throw mapAssistantChatError(err);
    }
  }
}

/**
 * Map exceptions raised during the OpenAI provider round-trip (or our own
 * post-processing) into the documented contract error codes. Existing Nest
 * exceptions (e.g. `ForbiddenException`) are passed through and projected
 * by `AssistantContractExceptionFilter`.
 */
function mapAssistantChatError(err: unknown): unknown {
  if (err instanceof AssistantContractException) return err;
  if (err instanceof ForbiddenException) return err;

  if (err instanceof APIUserAbortError) {
    return new AssistantContractException(
      'AI_PROVIDER_ERROR',
      'Upstream request was aborted.',
      HttpStatus.SERVICE_UNAVAILABLE,
      { providerErrorType: 'aborted' },
    );
  }

  if (err instanceof APIConnectionTimeoutError) {
    return new AssistantContractException(
      'AI_PROVIDER_ERROR',
      'Upstream request timed out.',
      HttpStatus.GATEWAY_TIMEOUT,
      { providerErrorType: 'timeout' },
    );
  }

  if (err instanceof APIConnectionError) {
    return new AssistantContractException(
      'AI_PROVIDER_ERROR',
      'Upstream provider connection failed.',
      HttpStatus.BAD_GATEWAY,
      { providerErrorType: 'connection' },
    );
  }

  if (err instanceof RateLimitError) {
    return new AssistantContractException(
      'AI_PROVIDER_ERROR',
      'Upstream provider rate-limited the request.',
      HttpStatus.TOO_MANY_REQUESTS,
      { providerErrorType: 'rate_limit', providerStatus: err.status },
    );
  }

  if (err instanceof AuthenticationError || err instanceof PermissionDeniedError) {
    return new AssistantContractException(
      'AI_PROVIDER_ERROR',
      'Upstream provider rejected our credentials.',
      HttpStatus.BAD_GATEWAY,
      { providerErrorType: 'auth', providerStatus: err.status },
    );
  }

  if (err instanceof BadRequestError) {
    return new AssistantContractException(
      'AI_PROVIDER_ERROR',
      'Upstream provider rejected the request as malformed.',
      HttpStatus.BAD_GATEWAY,
      { providerErrorType: 'bad_request', providerStatus: err.status },
    );
  }

  if (err instanceof APIError) {
    return new AssistantContractException(
      'AI_PROVIDER_ERROR',
      'Upstream provider returned an error.',
      HttpStatus.BAD_GATEWAY,
      { providerErrorType: 'api_error', providerStatus: err.status },
    );
  }

  return new AssistantContractException(
    'INTERNAL_ERROR',
    'Internal server error.',
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}
