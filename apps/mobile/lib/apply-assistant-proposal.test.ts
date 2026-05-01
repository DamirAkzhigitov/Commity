import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  appendAssistantExecutionLog: vi.fn().mockResolvedValue(undefined),
  deleteTask: vi.fn().mockResolvedValue(undefined),
  insertItemSourceMeta: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./assistant-execution-log', () => ({
  appendAssistantExecutionLog: mocks.appendAssistantExecutionLog,
}));

vi.mock('./local-content-crypto', () => ({
  encryptLocalContent: async (s: string) => `enc:${s}`,
}));

vi.mock('./local-db', () => ({
  appendActionHistory: vi.fn().mockResolvedValue(undefined),
  deleteDocument: vi.fn().mockResolvedValue(undefined),
  deleteReminder: vi.fn().mockResolvedValue(undefined),
  deleteSubitem: vi.fn().mockResolvedValue(undefined),
  deleteTask: mocks.deleteTask,
  insertDocumentRow: vi.fn().mockResolvedValue(undefined),
  insertItemSourceMeta: mocks.insertItemSourceMeta,
  insertReminderRow: vi.fn().mockResolvedValue(undefined),
  insertSubitemRow: vi.fn().mockResolvedValue(undefined),
  insertTaskRow: vi.fn().mockResolvedValue(undefined),
  updateDocumentEncrypted: vi.fn().mockResolvedValue(undefined),
  updateReminderEncrypted: vi.fn().mockResolvedValue(undefined),
  updateSubitemEncrypted: vi.fn().mockResolvedValue(undefined),
  updateTaskEncrypted: vi.fn().mockResolvedValue(undefined),
}));

import { applyAssistantProposal } from './apply-assistant-proposal';

const db = {} as never;

describe('applyAssistantProposal execution logging', () => {
  beforeEach(() => {
    mocks.appendAssistantExecutionLog.mockClear();
    mocks.deleteTask.mockClear();
    mocks.insertItemSourceMeta.mockClear();
  });

  it('records delete_item phases and targets deleteTask', async () => {
    await applyAssistantProposal(
      db,
      {
        proposalId: '00000000-0000-4000-8000-000000000001',
        type: 'delete_item',
        confirmationTier: 'requires_confirmation',
        payload: { kind: 'task', localId: 'task-a' },
      },
      { clientRequestId: '00000000-0000-4000-8000-000000000002' },
    );

    expect(mocks.deleteTask).toHaveBeenCalledWith(db, 'task-a');
    const phases = mocks.appendAssistantExecutionLog.mock.calls.map((c) => c[0].phase);
    expect(phases).toEqual(
      expect.arrayContaining([
        'apply_assistant_proposal_start',
        'delete_item_before_local_db',
        'apply_assistant_proposal_success',
      ]),
    );
    const deleteLog = mocks.appendAssistantExecutionLog.mock.calls
      .map((c) => c[0])
      .find((x) => x.phase === 'delete_item_before_local_db');
    expect(deleteLog?.functionOrEndpoint).toBe('deleteTask');
    expect(deleteLog?.payloadSummary).toEqual({ kind: 'task', localId: 'task-a' });
  });
});
