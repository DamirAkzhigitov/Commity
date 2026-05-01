import { z } from 'zod';

/** How strongly the client should gate applying this proposal. */
export const confirmationTierSchema = z.enum(['draft', 'requires_confirmation']);
export type ConfirmationTier = z.infer<typeof confirmationTierSchema>;

/** Context rows included in outbound assistant packets (`POST /assistant/chat`). */
export const contextItemKindSchema = z.enum([
  'task',
  'subitem',
  'document',
  'reminder',
  'memory',
  'chat_excerpt',
]);
export type ContextItemKind = z.infer<typeof contextItemKindSchema>;

/** Kinds addressable by structured update/delete proposals. */
export const proposalTargetKindSchema = z.enum(['task', 'subitem', 'document', 'reminder']);
export type ProposalTargetKind = z.infer<typeof proposalTargetKindSchema>;

/** Per-item privacy metadata: local_only items must not be sent to the model (includeInAi false). */
export const contextItemPrivacySchema = z.object({
  sensitivity: z.enum(['shareable', 'local_only']).default('shareable'),
});
export type ContextItemPrivacy = z.infer<typeof contextItemPrivacySchema>;

export const contextItemMetadataSchema = z
  .record(z.string().max(64), z.string().max(256))
  .refine((meta) => Object.keys(meta).length <= 16, {
    message: 'metadata may have at most 16 keys',
  });

export const assistantContextItemSchema = z
  .object({
    kind: contextItemKindSchema,
    localId: z.string().min(1).max(128),
    titleOrLabel: z.string().max(512).optional(),
    bodySnippet: z.string().max(2000).optional(),
    metadata: contextItemMetadataSchema.optional(),
    /** When false, exclude from backend prompts and provider calls. */
    includeInAi: z.boolean(),
    privacy: contextItemPrivacySchema.optional(),
  })
  .refine(
    (item) =>
      item.privacy?.sensitivity !== 'local_only' || item.includeInAi === false,
    {
      path: ['includeInAi'],
      message: 'local_only items must set includeInAi to false so they stay off the AI payload',
    },
  );
export type AssistantContextItem = z.infer<typeof assistantContextItemSchema>;

export const assistantContextPacketSchema = z
  .object({
    schemaVersion: z.literal(1),
    budget: z.object({
      maxTotalChars: z.number().int().min(2000).max(50000),
      estimatedChars: z.number().int().nonnegative().optional(),
    }),
    privacy: z.object({
      userConfirmedBroaderContext: z.boolean(),
    }),
    conversationSummary: z.string().max(2000).optional(),
    items: z.array(assistantContextItemSchema).max(40),
  })
  .refine(
    (packet) =>
      packet.budget.estimatedChars === undefined ||
      packet.budget.estimatedChars <= packet.budget.maxTotalChars,
    {
      path: ['budget', 'estimatedChars'],
      message: 'estimatedChars must not exceed maxTotalChars',
    },
  );
export type AssistantContextPacket = z.infer<typeof assistantContextPacketSchema>;

/** Wire format for POST /assistant/chat (AI proxy; no personal persistence). */
export const assistantChatRequestSchema = z.object({
  clientRequestId: z.string().uuid(),
  message: z.string().trim().min(1).max(32000),
  locale: z.string().max(32).optional(),
  context: assistantContextPacketSchema.optional(),
});
export type AssistantChatRequest = z.infer<typeof assistantChatRequestSchema>;

const updateItemPatchSchema = z
  .object({
    titleOrLabel: z.string().max(512).optional(),
    bodySnippet: z.string().max(2000).optional(),
    status: z.string().max(64).optional(),
    priority: z.string().max(64).optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'updates must include at least one field',
  });

export const noopProposalPayloadSchema = z
  .object({
    detail: z.string().max(2000).optional(),
  })
  .strict();

/** Nested draft Subitems attached to a new Task proposal. */
export const createTaskSubitemDraftSchema = z.object({
  title: z.string().min(1).max(512),
});
export type CreateTaskSubitemDraft = z.infer<typeof createTaskSubitemDraftSchema>;

/** Task-scoped document references carried on create_task (existing local doc id or inline draft). */
export const createTaskDocumentRefSchema = z.object({
  title: z.string().min(1).max(512),
  documentType: z.string().max(64).optional(),
  localId: z.string().min(1).max(128).optional(),
});
export type CreateTaskDocumentRef = z.infer<typeof createTaskDocumentRefSchema>;

export const createTaskProposalPayloadSchema = z.object({
  title: z.string().min(1).max(512),
  description: z.string().max(10000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  dueAt: z.string().datetime().optional(),
  subitems: z.array(createTaskSubitemDraftSchema).max(50).optional(),
  documents: z.array(createTaskDocumentRefSchema).max(20).optional(),
});

export const createSubitemProposalPayloadSchema = z.object({
  taskLocalId: z.string().min(1).max(128),
  title: z.string().min(1).max(512),
});

/** Reminder / scheduled item: non-empty title, optional body text, validated schedule instant. */
export const scheduleReminderProposalPayloadSchema = z.object({
  title: z.string().min(1).max(512),
  text: z.string().min(1).max(2000).optional(),
  remindAt: z.string().datetime(),
  linkedTaskLocalId: z.string().min(1).max(128).optional(),
  linkedSubitemLocalId: z.string().min(1).max(128).optional(),
});

export const upsertDocumentProposalPayloadSchema = z.object({
  taskLocalId: z.string().min(1).max(128),
  localId: z.string().min(1).max(128).optional(),
  title: z.string().min(1).max(512),
  documentType: z.string().max(64).optional(),
  bodySnippet: z.string().max(2000).optional(),
});

export const updateItemProposalPayloadSchema = z.object({
  localId: z.string().min(1).max(128),
  kind: proposalTargetKindSchema,
  updates: updateItemPatchSchema,
});

export const deleteItemProposalPayloadSchema = z.object({
  localId: z.string().min(1).max(128),
  kind: proposalTargetKindSchema,
});

export const assistantActionProposalSchema = z.discriminatedUnion('type', [
  z.object({
    proposalId: z.string().uuid(),
    type: z.literal('noop'),
    confirmationTier: z.literal('draft'),
    confidence: z.number().min(0).max(1).optional(),
    payload: noopProposalPayloadSchema,
  }),
  z.object({
    proposalId: z.string().uuid(),
    type: z.literal('create_task'),
    confirmationTier: confirmationTierSchema,
    confidence: z.number().min(0).max(1).optional(),
    payload: createTaskProposalPayloadSchema,
  }),
  z.object({
    proposalId: z.string().uuid(),
    type: z.literal('create_subitem'),
    confirmationTier: confirmationTierSchema,
    confidence: z.number().min(0).max(1).optional(),
    payload: createSubitemProposalPayloadSchema,
  }),
  z.object({
    proposalId: z.string().uuid(),
    type: z.literal('upsert_document'),
    confirmationTier: confirmationTierSchema,
    confidence: z.number().min(0).max(1).optional(),
    payload: upsertDocumentProposalPayloadSchema,
  }),
  z.object({
    proposalId: z.string().uuid(),
    type: z.literal('schedule_reminder'),
    confirmationTier: confirmationTierSchema,
    confidence: z.number().min(0).max(1).optional(),
    payload: scheduleReminderProposalPayloadSchema,
  }),
  z.object({
    proposalId: z.string().uuid(),
    type: z.literal('update_item'),
    confirmationTier: confirmationTierSchema,
    confidence: z.number().min(0).max(1).optional(),
    payload: updateItemProposalPayloadSchema,
  }),
  z.object({
    proposalId: z.string().uuid(),
    type: z.literal('delete_item'),
    confirmationTier: z.literal('requires_confirmation'),
    confidence: z.number().min(0).max(1).optional(),
    payload: deleteItemProposalPayloadSchema,
  }),
]);
export type AssistantActionProposal = z.infer<typeof assistantActionProposalSchema>;

/** Response body from POST /assistant/chat. */
export const assistantChatResponseSchema = z.object({
  clientRequestId: z.string().uuid().optional(),
  mode: z.enum(['mock', 'openai']),
  reply: z.string(),
  proposals: z.array(assistantActionProposalSchema).max(20),
});
export type AssistantChatResponse = z.infer<typeof assistantChatResponseSchema>;
