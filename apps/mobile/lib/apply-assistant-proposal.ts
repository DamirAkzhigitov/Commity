import type { AssistantActionProposal } from '@personal-assistant/shared';
import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { encryptLocalContent } from './local-content-crypto';
import {
  appendActionHistory,
  deleteDocument,
  deleteReminder,
  deleteSubitem,
  deleteTask,
  insertDocumentRow,
  insertItemSourceMeta,
  insertReminderRow,
  insertSubitemRow,
  insertTaskRow,
  updateDocumentEncrypted,
  updateReminderEncrypted,
  updateSubitemEncrypted,
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
      const taskId = randomUUID();
      const { title, description, priority, dueAt, subitems, documents } = proposal.payload;
      await insertTaskRow(db, {
        id: taskId,
        titleCipher: await encryptLocalContent(title),
        descriptionCipher: description ? await encryptLocalContent(description) : null,
        status: 'todo',
        priority: priority ?? 'medium',
        dueAt: dueAt ?? null,
        goalId: null,
        localOnly: 0,
        createdAt: appliedAt,
        updatedAt: appliedAt,
      });

      let sortOrder = 0;
      for (const si of subitems ?? []) {
        await insertSubitemRow(db, {
          id: randomUUID(),
          taskId,
          titleCipher: await encryptLocalContent(si.title),
          status: 'todo',
          sortOrder,
          localOnly: 0,
          createdAt: appliedAt,
          updatedAt: appliedAt,
        });
        sortOrder += 1;
      }

      for (const d of documents ?? []) {
        if (d.localId) {
          await db.runAsync(`UPDATE documents SET task_id = ? WHERE id = ?`, taskId, d.localId);
          if (d.title) {
            await updateDocumentEncrypted(
              db,
              d.localId,
              { titleOrLabel: d.title },
              appliedAt,
            );
          }
        } else {
          await insertDocumentRow(db, {
            id: randomUUID(),
            taskId,
            titleCipher: await encryptLocalContent(d.title),
            documentType: d.documentType ?? null,
            snippetCipher: null,
            refUriCipher: null,
            localOnly: 0,
            createdAt: appliedAt,
            updatedAt: appliedAt,
          });
        }
      }

      await insertItemSourceMeta(db, {
        itemKind: 'task',
        itemLocalId: taskId,
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
        entityId: taskId,
      });
      return { entityKind: 'task', entityId: taskId };
    }

    case 'create_subitem': {
      const id = randomUUID();
      const { taskLocalId, title } = proposal.payload;
      await insertSubitemRow(db, {
        id,
        taskId: taskLocalId,
        titleCipher: await encryptLocalContent(title),
        status: 'todo',
        sortOrder: 0,
        localOnly: 0,
        createdAt: appliedAt,
        updatedAt: appliedAt,
      });
      await insertItemSourceMeta(db, {
        itemKind: 'subitem',
        itemLocalId: id,
        proposalId: proposal.proposalId,
        clientRequestId: opts.clientRequestId ?? null,
        previewCipher,
      });
      await appendActionHistory(db, {
        id: randomUUID(),
        proposalId: proposal.proposalId,
        proposalType: 'create_subitem',
        clientRequestId: opts.clientRequestId ?? null,
        appliedAt,
        undoKind: 'delete_entity',
        entityKind: 'subitem',
        entityId: id,
      });
      return { entityKind: 'subitem', entityId: id };
    }

    case 'upsert_document': {
      const { taskLocalId, localId, title, documentType, bodySnippet } = proposal.payload;
      if (localId) {
        await db.runAsync(`UPDATE documents SET task_id = ? WHERE id = ?`, taskLocalId, localId);
        await updateDocumentEncrypted(db, localId, { titleOrLabel: title, bodySnippet }, appliedAt);
        if (documentType !== undefined) {
          await db.runAsync(`UPDATE documents SET document_type = ? WHERE id = ?`, documentType ?? null, localId);
        }
        await insertItemSourceMeta(db, {
          itemKind: 'document',
          itemLocalId: localId,
          proposalId: proposal.proposalId,
          clientRequestId: opts.clientRequestId ?? null,
          previewCipher,
        });
        return { entityKind: 'document', entityId: localId };
      }

      const id = randomUUID();
      await insertDocumentRow(db, {
        id,
        taskId: taskLocalId,
        titleCipher: await encryptLocalContent(title),
        documentType: documentType ?? null,
        snippetCipher: bodySnippet ? await encryptLocalContent(bodySnippet) : null,
        refUriCipher: null,
        localOnly: 0,
        createdAt: appliedAt,
        updatedAt: appliedAt,
      });
      await insertItemSourceMeta(db, {
        itemKind: 'document',
        itemLocalId: id,
        proposalId: proposal.proposalId,
        clientRequestId: opts.clientRequestId ?? null,
        previewCipher,
      });
      await appendActionHistory(db, {
        id: randomUUID(),
        proposalId: proposal.proposalId,
        proposalType: 'upsert_document',
        clientRequestId: opts.clientRequestId ?? null,
        appliedAt,
        undoKind: 'delete_entity',
        entityKind: 'document',
        entityId: id,
      });
      return { entityKind: 'document', entityId: id };
    }

    case 'schedule_reminder': {
      const id = randomUUID();
      const { title, text, remindAt, linkedTaskLocalId, linkedSubitemLocalId } = proposal.payload;
      await insertReminderRow(db, {
        id,
        titleCipher: await encryptLocalContent(title),
        textCipher: text ? await encryptLocalContent(text) : null,
        remindAt,
        linkedTaskId: linkedTaskLocalId ?? null,
        linkedSubitemId: linkedSubitemLocalId ?? null,
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

    case 'update_item': {
      const { localId, kind, updates } = proposal.payload;
      const updatedAt = appliedAt;
      if (kind === 'task') {
        await updateTaskEncrypted(db, localId, updates, updatedAt);
      } else if (kind === 'reminder') {
        await updateReminderEncrypted(db, localId, updates, updatedAt);
      } else if (kind === 'subitem') {
        await updateSubitemEncrypted(db, localId, updates, updatedAt);
      } else if (kind === 'document') {
        await updateDocumentEncrypted(db, localId, updates, updatedAt);
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
      else if (kind === 'reminder') await deleteReminder(db, localId);
      else if (kind === 'subitem') await deleteSubitem(db, localId);
      else if (kind === 'document') await deleteDocument(db, localId);
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
