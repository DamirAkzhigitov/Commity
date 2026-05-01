import type {
  AssistantContextItem,
  AssistantContextPacket,
} from '@personal-assistant/shared';

/** Decrypted rows used only on-device before building an outbound context packet. */
export type LocalContextRow = {
  kind: 'task' | 'note' | 'reminder' | 'goal';
  localId: string;
  title: string;
  bodySnippet?: string;
  localOnly: boolean;
};

const DEFAULT_MAX_CHARS = 12000;

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function estimateItemChars(it: AssistantContextItem): number {
  let n = it.localId.length + it.kind.length;
  if (it.titleOrLabel) n += it.titleOrLabel.length;
  if (it.bodySnippet) n += it.bodySnippet.length;
  return n;
}

/**
 * Builds a bounded privacy-filtered context packet for POST /assistant/chat.
 * Local-only rows are omitted unless `userConfirmedBroaderContext` is true; then they are included with includeInAi false.
 */
export function buildAssistantContextPacketFromRows(
  rows: LocalContextRow[],
  opts?: {
    maxTotalChars?: number;
    userConfirmedBroaderContext?: boolean;
    conversationSummary?: string;
  },
): AssistantContextPacket | undefined {
  const maxTotalChars = opts?.maxTotalChars ?? DEFAULT_MAX_CHARS;
  const userConfirmedBroaderContext = opts?.userConfirmedBroaderContext ?? false;

  const visible = userConfirmedBroaderContext
    ? rows
    : rows.filter((r) => !r.localOnly);

  if (visible.length === 0) {
    return undefined;
  }

  const items: AssistantContextItem[] = [];
  let estimated = opts?.conversationSummary?.length ?? 0;

  for (const r of visible) {
    const includeInAi = userConfirmedBroaderContext ? !r.localOnly : true;
    const privacy = r.localOnly
      ? ({ sensitivity: 'local_only' as const } satisfies AssistantContextItem['privacy'])
      : ({ sensitivity: 'shareable' as const } satisfies AssistantContextItem['privacy']);

    const candidate: AssistantContextItem = {
      kind: r.kind,
      localId: r.localId,
      titleOrLabel: clip(r.title, 512),
      bodySnippet: r.bodySnippet ? clip(r.bodySnippet, 2000) : undefined,
      includeInAi,
      privacy,
    };

    const nextEstimate = estimated + estimateItemChars(candidate);
    if (items.length >= 40 || nextEstimate > maxTotalChars) {
      break;
    }
    items.push(candidate);
    estimated = nextEstimate;
  }

  if (items.length === 0) {
    return undefined;
  }

  return {
    schemaVersion: 1,
    budget: { maxTotalChars, estimatedChars: estimated },
    privacy: { userConfirmedBroaderContext },
    conversationSummary: opts?.conversationSummary
      ? clip(opts.conversationSummary, 2000)
      : undefined,
    items,
  };
}
