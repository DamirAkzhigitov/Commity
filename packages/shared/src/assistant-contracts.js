"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assistantChatResponseSchema = exports.assistantActionProposalSchema = exports.deleteItemProposalPayloadSchema = exports.updateItemProposalPayloadSchema = exports.createGoalProposalPayloadSchema = exports.scheduleReminderProposalPayloadSchema = exports.createNoteProposalPayloadSchema = exports.createTaskProposalPayloadSchema = exports.noopProposalPayloadSchema = exports.assistantChatRequestSchema = exports.assistantContextPacketSchema = exports.assistantContextItemSchema = exports.contextItemMetadataSchema = exports.contextItemPrivacySchema = exports.contextItemKindSchema = exports.confirmationTierSchema = void 0;
const zod_1 = require("zod");
/** How strongly the client should gate applying this proposal. */
exports.confirmationTierSchema = zod_1.z.enum(['draft', 'requires_confirmation']);
exports.contextItemKindSchema = zod_1.z.enum([
    'task',
    'note',
    'reminder',
    'goal',
    'memory',
    'chat_excerpt',
]);
/** Per-item privacy metadata: local_only items must not be sent to the model (includeInAi false). */
exports.contextItemPrivacySchema = zod_1.z.object({
    sensitivity: zod_1.z.enum(['shareable', 'local_only']).default('shareable'),
});
exports.contextItemMetadataSchema = zod_1.z
    .record(zod_1.z.string().max(64), zod_1.z.string().max(256))
    .refine((meta) => Object.keys(meta).length <= 16, {
    message: 'metadata may have at most 16 keys',
});
exports.assistantContextItemSchema = zod_1.z
    .object({
    kind: exports.contextItemKindSchema,
    localId: zod_1.z.string().min(1).max(128),
    titleOrLabel: zod_1.z.string().max(512).optional(),
    bodySnippet: zod_1.z.string().max(2000).optional(),
    metadata: exports.contextItemMetadataSchema.optional(),
    /** When false, exclude from backend prompts and provider calls. */
    includeInAi: zod_1.z.boolean(),
    privacy: exports.contextItemPrivacySchema.optional(),
})
    .refine((item) => item.privacy?.sensitivity !== 'local_only' || item.includeInAi === false, {
    path: ['includeInAi'],
    message: 'local_only items must set includeInAi to false so they stay off the AI payload',
});
exports.assistantContextPacketSchema = zod_1.z
    .object({
    schemaVersion: zod_1.z.literal(1),
    budget: zod_1.z.object({
        maxTotalChars: zod_1.z.number().int().min(2000).max(50000),
        estimatedChars: zod_1.z.number().int().nonnegative().optional(),
    }),
    privacy: zod_1.z.object({
        userConfirmedBroaderContext: zod_1.z.boolean(),
    }),
    conversationSummary: zod_1.z.string().max(2000).optional(),
    items: zod_1.z.array(exports.assistantContextItemSchema).max(40),
})
    .refine((packet) => packet.budget.estimatedChars === undefined ||
    packet.budget.estimatedChars <= packet.budget.maxTotalChars, {
    path: ['budget', 'estimatedChars'],
    message: 'estimatedChars must not exceed maxTotalChars',
});
/** Wire format for POST /assistant/chat (AI proxy; no personal persistence). */
exports.assistantChatRequestSchema = zod_1.z.object({
    clientRequestId: zod_1.z.string().uuid(),
    message: zod_1.z.string().trim().min(1).max(32000),
    locale: zod_1.z.string().max(32).optional(),
    context: exports.assistantContextPacketSchema.optional(),
});
const updateItemPatchSchema = zod_1.z
    .object({
    titleOrLabel: zod_1.z.string().max(512).optional(),
    bodySnippet: zod_1.z.string().max(2000).optional(),
    status: zod_1.z.string().max(64).optional(),
    priority: zod_1.z.string().max(64).optional(),
})
    .strict()
    .refine((patch) => Object.keys(patch).length > 0, {
    message: 'updates must include at least one field',
});
exports.noopProposalPayloadSchema = zod_1.z
    .object({
    detail: zod_1.z.string().max(2000).optional(),
})
    .strict();
exports.createTaskProposalPayloadSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(512),
    description: zod_1.z.string().max(10000).optional(),
    priority: zod_1.z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    dueAt: zod_1.z.string().datetime().optional(),
    goalId: zod_1.z.string().max(128).optional(),
});
exports.createNoteProposalPayloadSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(512),
    body: zod_1.z.string().min(1).max(32000),
});
/** Reminder / scheduled item: non-empty title, optional body text, validated schedule instant. */
exports.scheduleReminderProposalPayloadSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(512),
    text: zod_1.z.string().min(1).max(2000).optional(),
    remindAt: zod_1.z.string().datetime(),
});
exports.createGoalProposalPayloadSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(512),
    motivation: zod_1.z.string().max(4000).optional(),
    targetDate: zod_1.z.string().datetime().optional(),
});
exports.updateItemProposalPayloadSchema = zod_1.z.object({
    localId: zod_1.z.string().min(1).max(128),
    kind: exports.contextItemKindSchema,
    updates: updateItemPatchSchema,
});
exports.deleteItemProposalPayloadSchema = zod_1.z.object({
    localId: zod_1.z.string().min(1).max(128),
    kind: exports.contextItemKindSchema,
});
exports.assistantActionProposalSchema = zod_1.z.discriminatedUnion('type', [
    zod_1.z.object({
        proposalId: zod_1.z.string().uuid(),
        type: zod_1.z.literal('noop'),
        confirmationTier: zod_1.z.literal('draft'),
        confidence: zod_1.z.number().min(0).max(1).optional(),
        payload: exports.noopProposalPayloadSchema,
    }),
    zod_1.z.object({
        proposalId: zod_1.z.string().uuid(),
        type: zod_1.z.literal('create_task'),
        confirmationTier: exports.confirmationTierSchema,
        confidence: zod_1.z.number().min(0).max(1).optional(),
        payload: exports.createTaskProposalPayloadSchema,
    }),
    zod_1.z.object({
        proposalId: zod_1.z.string().uuid(),
        type: zod_1.z.literal('create_note'),
        confirmationTier: exports.confirmationTierSchema,
        confidence: zod_1.z.number().min(0).max(1).optional(),
        payload: exports.createNoteProposalPayloadSchema,
    }),
    zod_1.z.object({
        proposalId: zod_1.z.string().uuid(),
        type: zod_1.z.literal('schedule_reminder'),
        confirmationTier: exports.confirmationTierSchema,
        confidence: zod_1.z.number().min(0).max(1).optional(),
        payload: exports.scheduleReminderProposalPayloadSchema,
    }),
    zod_1.z.object({
        proposalId: zod_1.z.string().uuid(),
        type: zod_1.z.literal('create_goal'),
        confirmationTier: exports.confirmationTierSchema,
        confidence: zod_1.z.number().min(0).max(1).optional(),
        payload: exports.createGoalProposalPayloadSchema,
    }),
    zod_1.z.object({
        proposalId: zod_1.z.string().uuid(),
        type: zod_1.z.literal('update_item'),
        confirmationTier: exports.confirmationTierSchema,
        confidence: zod_1.z.number().min(0).max(1).optional(),
        payload: exports.updateItemProposalPayloadSchema,
    }),
    zod_1.z.object({
        proposalId: zod_1.z.string().uuid(),
        type: zod_1.z.literal('delete_item'),
        confirmationTier: zod_1.z.literal('requires_confirmation'),
        confidence: zod_1.z.number().min(0).max(1).optional(),
        payload: exports.deleteItemProposalPayloadSchema,
    }),
]);
/** Response body from POST /assistant/chat. */
exports.assistantChatResponseSchema = zod_1.z.object({
    clientRequestId: zod_1.z.string().uuid().optional(),
    mode: zod_1.z.enum(['mock', 'openai']),
    reply: zod_1.z.string(),
    proposals: zod_1.z.array(exports.assistantActionProposalSchema).max(20),
});
