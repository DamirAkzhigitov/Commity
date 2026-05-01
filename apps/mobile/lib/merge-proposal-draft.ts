import type { AssistantActionProposal } from '@personal-assistant/shared';

export type ProposalDraftFields = {
  title?: string;
  description?: string;
  body?: string;
  text?: string;
  remindAt?: string;
  motivation?: string;
  targetDate?: string;
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
    case 'create_note':
      return {
        ...proposal,
        payload: {
          ...proposal.payload,
          ...(draft.title !== undefined ? { title: draft.title } : {}),
          ...(draft.body !== undefined ? { body: draft.body } : {}),
        },
      };
    case 'schedule_reminder': {
      const payload = { ...proposal.payload };
      if (draft.title !== undefined) payload.title = draft.title;
      if (draft.remindAt !== undefined) payload.remindAt = draft.remindAt;
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
    case 'create_goal': {
      const payload = { ...proposal.payload };
      if (draft.title !== undefined) payload.title = draft.title;
      if (draft.motivation !== undefined) {
        const m = draft.motivation.trim();
        payload.motivation = m.length > 0 ? m : undefined;
      }
      if (draft.targetDate !== undefined) {
        const td = draft.targetDate.trim();
        payload.targetDate = td.length > 0 ? td : undefined;
      }
      return { ...proposal, payload };
    }
    case 'update_item':
    case 'delete_item':
      return proposal;
  }
}
