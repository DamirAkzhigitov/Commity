import { assistantContextPacketSchema } from '@personal-assistant/shared';
import { describe, expect, it } from 'vitest';
import { buildAssistantContextPacketFromRows } from './context-packet';

describe('buildAssistantContextPacketFromRows', () => {
  it('returns undefined when every row is local-only and broader consent is false', () => {
    const packet = buildAssistantContextPacketFromRows(
      [
        {
          kind: 'task',
          localId: 'a',
          title: 'Secret',
          bodySnippet: 'body',
          localOnly: true,
        },
      ],
      { maxTotalChars: 8000, userConfirmedBroaderContext: false },
    );
    expect(packet).toBeUndefined();
  });

  it('includes shareable rows with includeInAi true by default', () => {
    const packet = buildAssistantContextPacketFromRows(
      [
        {
          kind: 'task',
          localId: 't1',
          title: 'Buy milk',
          bodySnippet: '2%',
          localOnly: false,
        },
      ],
      { maxTotalChars: 8000, userConfirmedBroaderContext: false },
    );
    expect(packet).toBeDefined();
    expect(packet!.items).toHaveLength(1);
    expect(packet!.items[0].includeInAi).toBe(true);
    expect(packet!.privacy.userConfirmedBroaderContext).toBe(false);
    expect(() => assistantContextPacketSchema.parse(packet)).not.toThrow();
  });

  it('includes local-only rows off-model when broader consent is enabled', () => {
    const packet = buildAssistantContextPacketFromRows(
      [
        {
          kind: 'document',
          localId: 'n1',
          title: 'Private',
          bodySnippet: 'details',
          localOnly: true,
        },
      ],
      { maxTotalChars: 8000, userConfirmedBroaderContext: true },
    );
    expect(packet).toBeDefined();
    expect(packet!.items[0].includeInAi).toBe(false);
    expect(packet!.items[0].privacy?.sensitivity).toBe('local_only');
    expect(() => assistantContextPacketSchema.parse(packet)).not.toThrow();
  });
});
