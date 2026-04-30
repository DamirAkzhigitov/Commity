import {
  assistantChatRequestSchema,
  assistantChatResponseSchema,
  type AssistantChatRequest,
  type AssistantChatResponse,
} from '@personal-assistant/shared';

export function normalizeApiBaseUrl(base: string): string {
  return base.replace(/\/$/, '');
}

export function assistantChatPath(): string {
  return '/assistant/chat';
}

export function buildAssistantChatUrl(apiBaseUrl: string): string {
  return `${normalizeApiBaseUrl(apiBaseUrl)}${assistantChatPath()}`;
}

export function parseChatRequest(
  input: Omit<AssistantChatRequest, 'clientRequestId'> & { clientRequestId?: string },
  clientRequestId: string,
): AssistantChatRequest {
  return assistantChatRequestSchema.parse({ ...input, clientRequestId });
}

export function parseChatResponse(json: unknown): AssistantChatResponse {
  return assistantChatResponseSchema.parse(json);
}
