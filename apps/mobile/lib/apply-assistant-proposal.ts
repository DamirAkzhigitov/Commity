import type { AssistantActionProposal } from '@personal-assistant/shared';
import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { encryptLocalContent } from './local-content-crypto';
import {
  appendActionHistory,
  deleteGoal,
  deleteNote,
  deleteReminder,
  deleteTask,
  insertGoalRow,
  insertItemSourceMeta,
  insertNoteRow,
  insertReminderRow,
  insertTaskRow,
  updateGoalEncrypted,
  updateNoteEncrypted,
  updateReminderEncrypted,
  updateTaskEncrypted,
} from './local-db';

export type ApplyProposalOptions = {
  clientRequestId?: string;
  /** Short plaintext preview of the user message for provenance (stored encrypted). */
  messagePreview?: string;
};

function isoNow(): string {
  return new Date().toISOString();
}

/**
 * Applies a structured assistant proposal to encrypted local SQLite rows.
 * Supports undo for create_* via action_history + delete_entity.
 */
export async function applyAssistantProposal(
  db: SQLiteDatabase,
  proposal: AssistantActionProposal,
  opts: ApplyProposalOptions,
): Promise<{ entityKind?: string; entityId?: string }> {
  const appliedAt = isoNow();
  const previewCipher =
    opts.messagePreview !== undefined ? await encryptLocalContent(opts.messagePreview) : null;

  switch (proposal.type) {
    case 'noop':
      return {};

    case 'create_task': {
      const id = randomUUID();
      const { title, description, priority, dueAt, goalId } = proposal.payload;
      await insertTaskRow(db, {
        id,
        titleCipher: await encryptLocalContent(title),
        descriptionCipher: description ? await encryptLocalContent(description) : null,
        status: 'todo',
        priority: priority ?? 'medium',
        dueAt: dueAt ?? null,
        goalId: goalId ?? null,
        localOnly: 0,
        createdAt: appliedAt,
        updatedAt: appliedAt,
      });
      await insertItemSourceMeta(db, {
        itemKind: 'task',
        itemLocalId: id,
        proposalId: proposal.proposalId,
        clientRequestId: opts.clientRequestId ?? null,
        previewCipher,
      });
      await appendActionHistory(db, {
        id: randomUUID(),
        proposalId: proposal.proposalId,
        proposalType: 'create_task',
        clientRequestId: opts.clientRequestId ?? null,
        appliedAt,
        undoKind: 'delete_entity',
        entityKind: 'task',
        entityId: id,
      });
      return { entityKind: 'task', entityId: id };
    }

    case 'create_note': {
      const id = randomUUID();
      const { title, body } = proposal.payload;
      await insertNoteRow(db, {
        id,
        titleCipher: await encryptLocalContent(title),
        bodyCipher: await encryptLocalContent(body),
        localOnly: 0,
        createdAt: appliedAt,
        updatedAt: appliedAt,
      });
      await insertItemSourceMeta(db, {
        itemKind: 'note',
        itemLocalId: id,
        proposalId: proposal.proposalId,
        clientRequestId: opts.clientRequestId ?? null,
        previewCipher,
      });
      await appendActionHistory(db, {
        id: randomUUID(),
        proposalId: proposal.proposalId,
        proposalType: 'create_note',
        clientRequestId: opts.clientRequestId ?? null,
        appliedAt,
        undoKind: 'delete_entity',
        entityKind: 'note',
        entityId: id,
      });
      return { entityKind: 'note', entityId: id };
    }

    case 'schedule_reminder': {
      const id = randomUUID();
      const { title, text, remindAt } = proposal.payload;
      await insertReminderRow(db, {
        id,
        titleCipher: await encryptLocalContent(title),
        textCipher: text ? await encryptLocalContent(text) : null,
        remindAt,
        localOnly: 0,
        createdAt: appliedAt,
        updatedAt: appliedAt,
      });
      await insertItemSourceMeta(db, {
        itemKind: 'reminder',
        itemLocalId: id,
        proposalId: proposal.proposalId,
        clientRequestId: opts.clientRequestId ?? null,
        previewCipher,
      });
      await appendActionHistory(db, {
        id: randomUUID(),
        proposalId: proposal.proposalId,
        proposalType: 'schedule_reminder',
        clientRequestId: opts.clientRequestId ?? null,
        appliedAt,
        undoKind: 'delete_entity',
        entityKind: 'reminder',
        entityId: id,
      });
      return { entityKind: 'reminder', entityId: id };
    }

    case 'create_goal': {
      const id = randomUUID();
      const { title, motivation, targetDate } = proposal.payload;
      await insertGoalRow(db, {
        id,
        titleCipher: await encryptLocalContent(title),
        motivationCipher: motivation ? await encryptLocalContent(motivation) : null,
        targetDate: targetDate ?? null,
        active: 1,
        localOnly: 0,
        createdAt: appliedAt,
        updatedAt: appliedAt,
      });
      await insertItemSourceMeta(db, {
        itemKind: 'goal',
        itemLocalId: id,
        proposalId: proposal.proposalId,
        clientRequestId: opts.clientRequestId ?? null,
        previewCipher,
      });
      await appendActionHistory(db, {
        id: randomUUID(),
        proposalId: proposal.proposalId,
        proposalType: 'create_goal',
        clientRequestId: opts.clientRequestId ?? null,
        appliedAt,
        undoKind: 'delete_entity',
        entityKind: 'goal',
        entityId: id,
      });
      return { entityKind: 'goal', entityId: id };
    }

    case 'update_item': {
      const { localId, kind, updates } = proposal.payload;
      const updatedAt = appliedAt;
      if (kind === 'task') {
        await updateTaskEncrypted(db, localId, updates, updatedAt);
      } else if (kind === 'note') {
        await updateNoteEncrypted(db, localId, updates, updatedAt);
      } else if (kind === 'reminder') {
        await updateReminderEncrypted(db, localId, updates, updatedAt);
      } else if (kind === 'goal') {
        await updateGoalEncrypted(db, localId, updates, updatedAt);
      }
      await insertItemSourceMeta(db, {
        itemKind: kind,
        itemLocalId: localId,
        proposalId: proposal.proposalId,
        clientRequestId: opts.clientRequestId ?? null,
        previewCipher,
      });
      return { entityKind: kind, entityId: localId };
    }

    case 'delete_item': {
      const { localId, kind } = proposal.payload;
      if (kind === 'task') await deleteTask(db, localId);
      else if (kind === 'note') await deleteNote(db, localId);
      else if (kind === 'reminder') await deleteReminder(db, localId);
      else if (kind === 'goal') await deleteGoal(db, localId);
      await insertItemSourceMeta(db, {
        itemKind: kind,
        itemLocalId: localId,
        proposalId: proposal.proposalId,
        clientRequestId: opts.clientRequestId ?? null,
        previewCipher,
      });
      return { entityKind: kind, entityId: localId };
    }
  }
}
