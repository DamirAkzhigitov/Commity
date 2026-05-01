import { randomUUID } from 'expo-crypto';
import type { AssistantChatRequest, AssistantChatResponse } from '@personal-assistant/shared';
import { appendAssistantExecutionLog } from './assistant-execution-log';
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
      await appendAssistantExecutionLog({
        phase: 'assistant_api_network_error',
        clientRequestId,
        functionOrEndpoint: 'postAssistantChat',
        payloadSummary: { messageLen: input.message.length },
        resultStatus: 'failure',
        errorName: e.name,
        errorMessage: e.message.slice(0, 500),
      });
      throw new TypeError(`${e.message} (${url}). ${base}`);
    }
    await appendAssistantExecutionLog({
      phase: 'assistant_api_network_error',
      clientRequestId,
      functionOrEndpoint: 'postAssistantChat',
      payloadSummary: { messageLen: input.message.length },
      resultStatus: 'failure',
      errorMessage: String(e).slice(0, 500),
    });
    throw e;
  }

  const text = await res.text();
  if (!res.ok) {
    await appendAssistantExecutionLog({
      phase: 'assistant_api_http_error',
      clientRequestId,
      functionOrEndpoint: 'postAssistantChat',
      payloadSummary: {
        httpStatus: res.status,
        responseBodyLen: text.length,
      },
      resultStatus: 'failure',
      errorMessage: `HTTP ${res.status}`,
    });
    throw new AssistantApiError(res.status, text);
  }

  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    await appendAssistantExecutionLog({
      phase: 'assistant_api_json_error',
      clientRequestId,
      functionOrEndpoint: 'postAssistantChat',
      resultStatus: 'failure',
      errorMessage: 'Invalid JSON response',
    });
    throw new AssistantApiError(res.status, 'Invalid JSON response');
  }

  const parsed = parseChatResponse(json);
  await appendAssistantExecutionLog({
    phase: 'assistant_api_response_parsed',
    clientRequestId: parsed.clientRequestId ?? clientRequestId,
    functionOrEndpoint: 'postAssistantChat',
    payloadSummary: {
      proposalCount: parsed.proposals.length,
      proposalTypes: parsed.proposals.map((p) => p.type),
    },
    resultStatus: 'success',
  });

  return parsed;
}
