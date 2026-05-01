import type { AssistantContextItem, AssistantContextPacket } from '@personal-assistant/shared';
import {
  buildUserContentForChatModel,
  formatPrivacyFilteredContextForModel,
} from '../src/assistant/assistant-context-input';

function pack(items: AssistantContextItem[], extra?: Partial<AssistantContextPacket>): AssistantContextPacket {
  return {
    schemaVersion: 1,
    budget: { maxTotalChars: 8000 },
    privacy: { userConfirmedBroaderContext: false },
    items,
    ...extra,
  };
}

describe('assistant-context-input', () => {
  const shareableTask: AssistantContextItem = {
    kind: 'task',
    localId: 't1',
    titleOrLabel: 'Buy milk',
    bodySnippet: '2%',
    includeInAi: true,
  };

  it('drops includeInAi false from model block', () => {
    const s = formatPrivacyFilteredContextForModel(
      pack([
        {
          ...shareableTask,
          localId: 'vis',
        },
        {
          ...shareableTask,
          localId: 'hidden',
          includeInAi: false,
          titleOrLabel: 'SECRET NOTE',
          bodySnippet: 'must not leak',
        },
      ]),
    );
    expect(s).toContain('localId=vis');
    expect(s).not.toContain('hidden');
    expect(s).not.toContain('SECRET');
  });

  it('formats includeInAi true items', () => {
    const s = formatPrivacyFilteredContextForModel(
      pack([
        {
          ...shareableTask,
          localId: 'x',
          titleOrLabel: 'Buy milk',
        },
      ]),
    );
    expect(s).toContain('Buy milk');
    expect(s).toContain('localId=x');
  });

  it('deterministic ordering by kind then localId', () => {
    const s = formatPrivacyFilteredContextForModel(
      pack([
        { kind: 'document', localId: 'd2', titleOrLabel: 'B', includeInAi: true },
        { kind: 'document', localId: 'd1', titleOrLabel: 'A', includeInAi: true },
        { kind: 'task', localId: 'z', titleOrLabel: 't', includeInAi: true },
      ]),
    );
    const doc1 = s.indexOf('localId=d1');
    const doc2 = s.indexOf('localId=d2');
    const taskIdx = s.indexOf('kind=task');
    expect(taskIdx).toBeGreaterThanOrEqual(0);
    expect(doc1).toBeGreaterThanOrEqual(0);
    expect(doc2).toBeGreaterThanOrEqual(0);
    expect(doc1).toBeLessThan(doc2);
    expect(doc2).toBeLessThan(taskIdx);
  });

  it('prepends clipped conversation_summary when budget allows', () => {
    const s = formatPrivacyFilteredContextForModel(
      pack(
        [{ kind: 'reminder', localId: 'r1', titleOrLabel: 'Run', includeInAi: true }],
        { conversationSummary: 'Earlier we discussed errands.' },
      ),
    );
    expect(s.startsWith('conversation_summary:')).toBe(true);
    expect(s).toContain('Earlier we discussed errands');
    expect(s).toContain('kind=reminder');
  });

  it('composeUser wraps message with context headings', () => {
    expect(buildUserContentForChatModel('hi', '')).toBe('hi');
    const u = buildUserContentForChatModel('hello', 'kind=task|localId=a');
    expect(u).toContain('Local context');
    expect(u).toContain('User message');
    expect(u).toContain('hello');
    expect(u).toContain('kind=task|localId=a');
  });
});
