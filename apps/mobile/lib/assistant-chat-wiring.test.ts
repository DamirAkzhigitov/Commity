import { describe, expect, it } from 'vitest';
import {
  buildAssistantChatUrl,
  normalizeApiBaseUrl,
  parseChatRequest,
  parseChatResponse,
} from './assistant-chat-wiring';

const sampleReqId = 'c2b3e4a1-7f0d-4c2a-9e1b-11aa22bb33cc';

describe('assistant-chat-wiring', () => {
  it('normalizes API base and builds chat URL', () => {
    expect(normalizeApiBaseUrl('http://10.0.2.2:3000/')).toBe('http://10.0.2.2:3000');
    expect(buildAssistantChatUrl('http://localhost:3000')).toBe('http://localhost:3000/assistant/chat');
  });

  it('parseChatRequest fills clientRequestId and validates', () => {
    const body = parseChatRequest({ message: 'hello' }, sampleReqId);
    expect(body).toEqual({ clientRequestId: sampleReqId, message: 'hello' });
    expect(() => parseChatRequest({ message: '' }, sampleReqId)).toThrow();
  });

  it('parseChatResponse accepts assistant payload', () => {
    const out = parseChatResponse({
      mode: 'mock',
      reply: 'ok',
      proposals: [],
    });
    expect(out.mode).toBe('mock');
    expect(out.reply).toBe('ok');
    expect(out.proposals).toEqual([]);
  });
});
