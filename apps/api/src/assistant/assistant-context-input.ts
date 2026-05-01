import type { AssistantContextItem, AssistantContextPacket } from '@personal-assistant/shared';

/** Upper cap for context text passed to the provider (packets may advertise a larger budget). */
const CONTEXT_SECTION_CHAR_CAP = 12_000;

function includeForModel(item: AssistantContextItem): boolean {
  return item.includeInAi !== false;
}

function sortDeterministic(items: AssistantContextItem[]): AssistantContextItem[] {
  return [...items].sort((a, b) => {
    const k = a.kind.localeCompare(b.kind);
    if (k !== 0) return k;
    return a.localId.localeCompare(b.localId);
  });
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max);
}

/**
 * Privacy-filtered, bounded, deterministic text block derived from validated context.items.
 * Excludes rows with includeInAi false; skips raw logging at call sites — use only for model input.
 */
export function formatPrivacyFilteredContextForModel(packet: AssistantContextPacket | undefined): string {
  if (!packet?.items?.length) return '';

  const filtered = packet.items.filter(includeForModel);
  if (!filtered.length) return '';

  const budgetLimit = Math.min(packet.budget.maxTotalChars, CONTEXT_SECTION_CHAR_CAP);
  let remaining = budgetLimit;
  const lines: string[] = [];

  const summary = packet.conversationSummary?.trim();
  if (summary) {
    const line = `conversation_summary:${clip(summary.replace(/\r\n/g, '\n'), 2000)}`;
    if (line.length <= remaining) {
      lines.push(line);
      remaining -= line.length + 1;
    }
  }

  const sorted = sortDeterministic(filtered);

  for (const item of sorted) {
    const parts: string[] = [`kind=${item.kind}`, `localId=${item.localId}`];
    if (item.titleOrLabel?.trim()) {
      parts.push(`title=${clip(item.titleOrLabel.trim().replace(/\r\n/g, '\n'), 512)}`);
    }
    if (item.bodySnippet?.trim()) {
      parts.push(`body=${clip(item.bodySnippet.trim().replace(/\r\n/g, '\n'), 2000)}`);
    }
    if (item.metadata && Object.keys(item.metadata).length > 0) {
      const keys = Object.keys(item.metadata).sort();
      for (const key of keys) {
        parts.push(`${key}=${clip(item.metadata[key].replace(/\r\n/g, '\n'), 256)}`);
      }
    }
    const line = parts.join('|');
    if (line.length > remaining) {
      break;
    }
    lines.push(line);
    remaining -= line.length + 1;
  }

  return lines.join('\n');
}

export function buildUserContentForChatModel(message: string, contextSection: string): string {
  const trimmed = message.trim();
  if (!contextSection) return trimmed;
  return `Local context (this turn only; user-approved items for the model):\n${contextSection}\n\nUser message:\n${trimmed}`;
}
