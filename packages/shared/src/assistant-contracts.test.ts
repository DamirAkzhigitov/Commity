import { describe, expect, it } from 'vitest';
import {
  assistantActionProposalSchema,
  assistantChatRequestSchema,
  assistantContextPacketSchema,
  assistantContextItemSchema,
  scheduleReminderProposalPayloadSchema,
} from './assistant-contracts.js';

const validUuid = '11111111-1111-4111-8111-111111111111';

/** Golden-style document matching docs/ai-context-contract.md example shapes. */
const goldenTaskProposal = {
  proposalId: validUuid,
  type: 'create_task' as const,
  confirmationTier: 'requires_confirmation' as const,
  confidence: 0.72,
  payload: {
    title: 'Renew passport',
    description: 'Complete and submit the passport renewal form.',
    priority: 'high' as const,
    dueAt: '2026-05-15T17:00:00.000Z',
    subitems: [
      { title: 'Take passport photo' },
      { title: 'Fill out renewal form' },
      { title: 'Mail renewal packet' },
    ],
    documents: [
      {
        title: 'Passport renewal form',
        documentType: 'form',
        localId: 'doc_7f3a',
      },
    ],
  },
};

describe('assistantChatRequestSchema', () => {
  it('accepts minimal valid request', () => {
    const out = assistantChatRequestSchema.parse({
      clientRequestId: validUuid,
      message: 'hello',
    });
    expect(out.message).toBe('hello');
  });

  it('rejects invalid clientRequestId', () => {
    const r = assistantChatRequestSchema.safeParse({
      clientRequestId: 'not-a-uuid',
      message: 'hi',
    });
    expect(r.success).toBe(false);
  });

  it('rejects empty message after trim', () => {
    const r = assistantChatRequestSchema.safeParse({
      clientRequestId: validUuid,
      message: '   ',
    });
    expect(r.success).toBe(false);
  });

  it('accepts bounded context packet and rejects local_only with includeInAi true', () => {
    const base = {
      schemaVersion: 1 as const,
      budget: { maxTotalChars: 8000, estimatedChars: 100 },
      privacy: { userConfirmedBroaderContext: false },
      items: [
        {
          kind: 'document' as const,
          localId: 'n1',
          includeInAi: false,
          privacy: { sensitivity: 'local_only' as const },
        },
      ],
    };
    expect(assistantContextPacketSchema.safeParse(base).success).toBe(true);

    const bad = {
      ...base,
      items: [{ ...base.items[0], includeInAi: true }],
    };
    expect(assistantContextPacketSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts all context item kinds', () => {
    const kinds = ['task', 'subitem', 'document', 'reminder', 'memory', 'chat_excerpt'] as const;
    for (const kind of kinds) {
      const row = {
        kind,
        localId: 'x',
        includeInAi: true,
      };
      expect(() => assistantContextItemSchema.parse(row)).not.toThrow();
    }
  });

  it('rejects legacy note/goal context kinds', () => {
    expect(
      assistantContextItemSchema.safeParse({
        kind: 'note',
        localId: 'n',
        includeInAi: true,
      }).success,
    ).toBe(false);
    expect(
      assistantContextItemSchema.safeParse({
        kind: 'goal',
        localId: 'g',
        includeInAi: true,
      }).success,
    ).toBe(false);
  });

  it('rejects estimatedChars above maxTotalChars', () => {
    const r = assistantContextPacketSchema.safeParse({
      schemaVersion: 1,
      budget: { maxTotalChars: 2000, estimatedChars: 9000 },
      privacy: { userConfirmedBroaderContext: false },
      items: [],
    });
    expect(r.success).toBe(false);
  });
});

describe('assistantActionProposalSchema', () => {
  it('accepts noop (draft)', () => {
    const p = assistantActionProposalSchema.parse({
      proposalId: validUuid,
      type: 'noop',
      confirmationTier: 'draft',
      payload: {},
    });
    expect(p.type).toBe('noop');
  });

  it('rejects noop with wrong tier', () => {
    const r = assistantActionProposalSchema.safeParse({
      proposalId: validUuid,
      type: 'noop',
      confirmationTier: 'requires_confirmation',
      payload: {},
    });
    expect(r.success).toBe(false);
  });

  it('accepts create_task with nested Subitems and Documents (golden)', () => {
    const p = assistantActionProposalSchema.parse(goldenTaskProposal);
    expect(p.type).toBe('create_task');
    expect(p.payload.subitems).toHaveLength(3);
    expect(p.payload.documents).toHaveLength(1);
  });

  it('accepts create_task and delete_item shapes', () => {
    expect(
      assistantActionProposalSchema.safeParse({
        proposalId: validUuid,
        type: 'create_task',
        confirmationTier: 'requires_confirmation',
        payload: { title: 'Buy milk' },
      }).success,
    ).toBe(true);

    expect(
      assistantActionProposalSchema.safeParse({
        proposalId: validUuid,
        type: 'delete_item',
        confirmationTier: 'requires_confirmation',
        payload: { localId: 'x', kind: 'document' },
      }).success,
    ).toBe(true);
  });

  it('accepts create_subitem and upsert_document', () => {
    expect(
      assistantActionProposalSchema.safeParse({
        proposalId: validUuid,
        type: 'create_subitem',
        confirmationTier: 'requires_confirmation',
        payload: { taskLocalId: 'task_1', title: 'Step one' },
      }).success,
    ).toBe(true);

    expect(
      assistantActionProposalSchema.safeParse({
        proposalId: validUuid,
        type: 'upsert_document',
        confirmationTier: 'requires_confirmation',
        payload: {
          taskLocalId: 'task_1',
          title: 'Spec',
          documentType: 'pdf',
          bodySnippet: 'See section 2',
        },
      }).success,
    ).toBe(true);
  });

  it('rejects delete_item with draft tier', () => {
    const r = assistantActionProposalSchema.safeParse({
      proposalId: validUuid,
      type: 'delete_item',
      confirmationTier: 'draft',
      payload: { localId: 'x', kind: 'task' },
    });
    expect(r.success).toBe(false);
  });

  it('rejects create_task, create_subitem, upsert_document with invalid payloads', () => {
    expect(
      assistantActionProposalSchema.safeParse({
        proposalId: validUuid,
        type: 'create_task',
        confirmationTier: 'requires_confirmation',
        payload: { title: '' },
      }).success,
    ).toBe(false);

    expect(
      assistantActionProposalSchema.safeParse({
        proposalId: validUuid,
        type: 'create_subitem',
        confirmationTier: 'requires_confirmation',
        payload: { taskLocalId: '', title: 'x' },
      }).success,
    ).toBe(false);

    expect(
      assistantActionProposalSchema.safeParse({
        proposalId: validUuid,
        type: 'upsert_document',
        confirmationTier: 'requires_confirmation',
        payload: { taskLocalId: 't', title: '' },
      }).success,
    ).toBe(false);
  });

  it('rejects update_item with unsupported kinds', () => {
    expect(
      assistantActionProposalSchema.safeParse({
        proposalId: validUuid,
        type: 'update_item',
        confirmationTier: 'requires_confirmation',
        payload: { localId: 't1', kind: 'memory', updates: { titleOrLabel: 'x' } },
      }).success,
    ).toBe(false);
  });

  it('rejects update_item with empty updates', () => {
    const r = assistantActionProposalSchema.safeParse({
      proposalId: validUuid,
      type: 'update_item',
      confirmationTier: 'requires_confirmation',
      payload: { localId: 't1', kind: 'task', updates: {} },
    });
    expect(r.success).toBe(false);
  });
});

describe('scheduleReminderProposalPayloadSchema', () => {
  it('requires title and remindAt', () => {
    expect(
      scheduleReminderProposalPayloadSchema.safeParse({
        title: 'Dentist',
        remindAt: '2026-05-01T15:00:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('accepts optional task/subitem links', () => {
    const out = scheduleReminderProposalPayloadSchema.parse({
      title: 'Follow up',
      remindAt: '2026-05-01T15:00:00.000Z',
      linkedTaskLocalId: 'task_a',
      linkedSubitemLocalId: 'sub_b',
    });
    expect(out.linkedTaskLocalId).toBe('task_a');
    expect(out.linkedSubitemLocalId).toBe('sub_b');
  });

  it('rejects missing title', () => {
    expect(
      scheduleReminderProposalPayloadSchema.safeParse({
        remindAt: '2026-05-01T15:00:00.000Z',
      }).success,
    ).toBe(false);
  });

  it('rejects invalid datetime', () => {
    expect(
      scheduleReminderProposalPayloadSchema.safeParse({
        title: 'x',
        remindAt: 'not-iso',
      }).success,
    ).toBe(false);
  });
});
