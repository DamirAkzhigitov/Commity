import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Stable error codes documented in `docs/ai-context-contract.md`.
 *
 * Keep this enum in sync with the contract so that clients receiving a
 * non-200 response from `POST /assistant/chat` can switch on a stable
 * machine-readable code instead of free-form `message`.
 */
export const ASSISTANT_CONTRACT_ERROR_CODES = [
  'AUTH_REQUIRED',
  'ENTITLEMENT_INACTIVE',
  'ASSISTANT_QUOTA_EXCEEDED',
  'CONTEXT_PACKET_TOO_LARGE',
  'CONTEXT_PACKET_INVALID',
  'CHAT_MESSAGE_INVALID',
  'REQUEST_VALIDATION_FAILED',
  'AI_PROVIDER_ERROR',
  'INTERNAL_ERROR',
] as const;

export type AssistantContractErrorCode = (typeof ASSISTANT_CONTRACT_ERROR_CODES)[number];

export interface AssistantContractErrorBody {
  error: {
    code: AssistantContractErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Nest exception that serializes to the contract-defined
 * `{ error: { code, message, details? } }` shape.
 */
export class AssistantContractException extends HttpException {
  readonly code: AssistantContractErrorCode;

  constructor(
    code: AssistantContractErrorCode,
    message: string,
    status: HttpStatus,
    details?: Record<string, unknown>,
  ) {
    const body: AssistantContractErrorBody = {
      error: { code, message, ...(details ? { details } : {}) },
    };
    super(body, status);
    this.code = code;
  }
}
