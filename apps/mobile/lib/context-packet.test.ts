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

  it('excludes private/local-only Documents by default while keeping the Task hierarchy', () => {
    const packet = buildAssistantContextPacketFromRows(
      [
        { kind: 'task', localId: 'task-1', title: 'Renew passport', localOnly: false },
        {
          kind: 'subitem',
          localId: 'sub-1',
          title: 'Take photo',
          localOnly: false,
          metadata: { taskId: 'task-1' },
        },
        {
          kind: 'document',
          localId: 'doc-shareable',
          title: 'Renewal form',
          bodySnippet: 'fields…',
          localOnly: false,
          metadata: { taskId: 'task-1', documentType: 'form' },
        },
        {
          kind: 'document',
          localId: 'doc-private',
          title: 'Old passport scan',
          bodySnippet: 'numbers',
          localOnly: true,
          metadata: { taskId: 'task-1', documentType: 'image' },
        },
      ],
      { maxTotalChars: 8000, userConfirmedBroaderContext: false },
    );
    expect(packet).toBeDefined();
    const ids = packet!.items.map((i) => i.localId);
    expect(ids).toContain('task-1');
    expect(ids).toContain('sub-1');
    expect(ids).toContain('doc-shareable');
    expect(ids).not.toContain('doc-private');
    const sub = packet!.items.find((i) => i.localId === 'sub-1');
    expect(sub?.metadata?.taskId).toBe('task-1');
    const doc = packet!.items.find((i) => i.localId === 'doc-shareable');
    expect(doc?.metadata?.taskId).toBe('task-1');
    expect(doc?.metadata?.documentType).toBe('form');
    expect(() => assistantContextPacketSchema.parse(packet)).not.toThrow();
  });
});
