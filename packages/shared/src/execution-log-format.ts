import type { AssistantActionProposal } from './assistant-contracts.js';

/** One NDJSON line for assistant execution tracing (mobile + API). No raw user text or tokens. */
export type AssistantExecutionLogSource = 'mobile' | 'api';

export type AssistantExecutionResultStatus = 'success' | 'failure';

export type AssistantExecutionLogEntry = {
  ts: string;
  source: AssistantExecutionLogSource;
  phase: string;
  clientRequestId?: string | null;
  proposalId?: string | null;
  actionType?: string;
  functionOrEndpoint?: string;
  payloadSummary?: Record<string, unknown>;
  executionStartTs?: string;
  executionEndTs?: string;
  durationMs?: number;
  resultStatus?: AssistantExecutionResultStatus;
  errorName?: string;
  errorMessage?: string;
  errorStackHead?: string;
};

/** Keeps the newest NDJSON lines that fit within maxUtf8Bytes (drops oldest lines first). */
export function clipNdjsonLinesToMaxUtf8Bytes(content: string, maxUtf8Bytes: number): string {
  if (maxUtf8Bytes < 256) {
    throw new RangeError('maxUtf8Bytes must be at least 256');
  }
  const enc = new TextEncoder();
  const trimmed = content.replace(/\n+$/, '');
  if (trimmed.length === 0) {
    return '';
  }
  const lines = trimmed.split('\n');
  let kept = lines;
  let joined = kept.join('\n');
  while (kept.length > 1 && enc.encode(joined + '\n').byteLength > maxUtf8Bytes) {
    kept = kept.slice(1);
    joined = kept.join('\n');
  }
  if (enc.encode(joined + '\n').byteLength > maxUtf8Bytes && kept.length > 0) {
    let line = kept[kept.length - 1]!;
    while (line.length > 0 && enc.encode(line + '\n').byteLength > maxUtf8Bytes) {
      line = line.slice(0, -32);
    }
    return line.length > 0 ? `${line}\n` : '';
  }
  return joined.length > 0 ? `${joined}\n` : '';
}

/** Safe structural summary for logs (IDs and counts; no titles or body text). */
export function summarizeAssistantProposalForLog(proposal: AssistantActionProposal): Record<string, unknown> {
  const base: Record<string, unknown> = {
    proposalType: proposal.type,
    proposalId: proposal.proposalId,
    confirmationTier: proposal.confirmationTier,
  };
  switch (proposal.type) {
    case 'noop':
      return {
        ...base,
        detailLen: proposal.payload.detail?.length ?? 0,
      };
    case 'create_task':
      return {
        ...base,
        titleLen: proposal.payload.title.length,
        descriptionLen: proposal.payload.description?.length ?? 0,
        subitemCount: proposal.payload.subitems?.length ?? 0,
        documentCount: proposal.payload.documents?.length ?? 0,
      };
    case 'create_subitem':
      return {
        ...base,
        taskLocalId: proposal.payload.taskLocalId,
        titleLen: proposal.payload.title.length,
      };
    case 'upsert_document':
      return {
        ...base,
        taskLocalId: proposal.payload.taskLocalId,
        localId: proposal.payload.localId,
        titleLen: proposal.payload.title.length,
        bodySnippetLen: proposal.payload.bodySnippet?.length ?? 0,
      };
    case 'schedule_reminder':
      return {
        ...base,
        titleLen: proposal.payload.title.length,
        textLen: proposal.payload.text?.length ?? 0,
        linkedTaskLocalId: proposal.payload.linkedTaskLocalId,
        linkedSubitemLocalId: proposal.payload.linkedSubitemLocalId,
      };
    case 'update_item':
      return {
        ...base,
        kind: proposal.payload.kind,
        localId: proposal.payload.localId,
        updateKeys: Object.keys(proposal.payload.updates),
      };
    case 'delete_item':
      return {
        ...base,
        kind: proposal.payload.kind,
        localId: proposal.payload.localId,
      };
    default:
      return base;
  }
}
