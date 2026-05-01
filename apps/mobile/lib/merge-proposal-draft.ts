import type { AssistantActionProposal } from '@personal-assistant/shared';

export type ProposalDraftFields = {
  title?: string;
  description?: string;
  text?: string;
  remindAt?: string;
  taskLocalId?: string;
  bodySnippet?: string;
  documentType?: string;
  linkedTaskLocalId?: string;
  linkedSubitemLocalId?: string;
};

export function mergeProposalWithDraft(
  proposal: AssistantActionProposal,
  draft: ProposalDraftFields | undefined,
): AssistantActionProposal {
  if (!draft) return proposal;

  switch (proposal.type) {
    case 'noop':
      return proposal;
    case 'create_task':
      return {
        ...proposal,
        payload: {
          ...proposal.payload,
          ...(draft.title !== undefined ? { title: draft.title } : {}),
          ...(draft.description !== undefined ? { description: draft.description } : {}),
        },
      };
    case 'create_subitem':
      return {
        ...proposal,
        payload: {
          ...proposal.payload,
          ...(draft.taskLocalId !== undefined ? { taskLocalId: draft.taskLocalId } : {}),
          ...(draft.title !== undefined ? { title: draft.title } : {}),
        },
      };
    case 'upsert_document':
      return {
        ...proposal,
        payload: {
          ...proposal.payload,
          ...(draft.taskLocalId !== undefined ? { taskLocalId: draft.taskLocalId } : {}),
          ...(draft.title !== undefined ? { title: draft.title } : {}),
          ...(draft.documentType !== undefined ? { documentType: draft.documentType } : {}),
          ...(draft.bodySnippet !== undefined ? { bodySnippet: draft.bodySnippet } : {}),
        },
      };
    case 'schedule_reminder': {
      const payload = { ...proposal.payload };
      if (draft.title !== undefined) payload.title = draft.title;
      if (draft.remindAt !== undefined) payload.remindAt = draft.remindAt;
      if (draft.linkedTaskLocalId !== undefined) {
        const v = draft.linkedTaskLocalId.trim();
        payload.linkedTaskLocalId = v.length > 0 ? v : undefined;
      }
      if (draft.linkedSubitemLocalId !== undefined) {
        const v = draft.linkedSubitemLocalId.trim();
        payload.linkedSubitemLocalId = v.length > 0 ? v : undefined;
      }
      if (draft.text !== undefined) {
        const t = draft.text.trim();
        if (t.length > 0) {
          payload.text = t;
        } else {
          delete payload.text;
        }
      }
      return { ...proposal, payload };
    }
    case 'update_item':
    case 'delete_item':
      return proposal;
  }
}
