import { randomUUID } from 'expo-crypto';
import type { AssistantChatRequest, AssistantChatResponse } from '@personal-assistant/shared';
import {
  buildAssistantChatUrl,
  parseChatRequest,
  parseChatResponse,
} from './assistant-chat-wiring';

export class AssistantApiError extends Error {
  constructor(
    readonly status: number,
    readonly responseBody: string,
  ) {
    super(`Assistant API error (${status})`);
    this.name = 'AssistantApiError';
  }
}

export type ChatRequestInput = Omit<AssistantChatRequest, 'clientRequestId'> & {
  clientRequestId?: string;
};

/**
 * POST /assistant/chat with shared Zod validation, per-request UUID, and bearer token.
 */
export async function postAssistantChat(
  apiBaseUrl: string,
  accessToken: string,
  input: ChatRequestInput,
): Promise<AssistantChatResponse> {
  const clientRequestId = input.clientRequestId ?? randomUUID();
  const body = parseChatRequest(input, clientRequestId);
  const url = buildAssistantChatUrl(apiBaseUrl);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const base =
      'Chat could not reach the API. Emulator: ensure EXPO_PUBLIC_API_BASE_URL uses http://10.0.2.2:<port> or leave http://localhost (auto-remapped on Android emulator only). Physical device: set EXPO_PUBLIC_API_BASE_URL to your dev machine LAN IP. Dev HTTP requires android.usesCleartextTraffic / a new native build after changing app.json.';
    if (e instanceof TypeError) {
      throw new TypeError(`${e.message} (${url}). ${base}`);
    }
    throw e;
  }

  const text = await res.text();
  if (!res.ok) {
    throw new AssistantApiError(res.status, text);
  }

  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    throw new AssistantApiError(res.status, 'Invalid JSON response');
  }

  return parseChatResponse(json);
}
