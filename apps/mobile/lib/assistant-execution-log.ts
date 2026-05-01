import {
  clipNdjsonLinesToMaxUtf8Bytes,
  type AssistantExecutionLogEntry,
} from '@personal-assistant/shared';
import {
  cacheDirectory,
  documentDirectory,
  EncodingType,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';

const DEFAULT_MAX_BYTES = 2_000_000;

function maxBytes(): number {
  return DEFAULT_MAX_BYTES;
}

/** Relative filename under the resolved base directory (document or cache). */
export const ASSISTANT_EXECUTION_LOG_BASENAME = 'assistant-execution.ndjson';

function resolveLogUri(): string | null {
  const base = documentDirectory ?? cacheDirectory;
  return base ? `${base}${ASSISTANT_EXECUTION_LOG_BASENAME}` : null;
}

/**
 * Append one NDJSON execution trace line. Never throws; failures are swallowed so UX is unaffected.
 * Logs exclude raw user messages, tokens, and ciphertext.
 */
export async function appendAssistantExecutionLog(
  entry: Omit<AssistantExecutionLogEntry, 'ts' | 'source'> &
    Partial<Pick<AssistantExecutionLogEntry, 'ts' | 'source'>>,
): Promise<void> {
  const uri = resolveLogUri();
  if (!uri) {
    return;
  }

  const full: AssistantExecutionLogEntry = {
    ...entry,
    ts: entry.ts ?? new Date().toISOString(),
    source: entry.source ?? 'mobile',
  };

  const line = `${JSON.stringify(full)}\n`;

  try {
    let existing = '';
    const info = await getInfoAsync(uri);
    if (info.exists && info.size > 0) {
      existing = await readAsStringAsync(uri, { encoding: EncodingType.UTF8 });
    }
    let next = existing + line;
    const limit = maxBytes();
    if (new TextEncoder().encode(next).byteLength > limit) {
      next = clipNdjsonLinesToMaxUtf8Bytes(next, Math.floor(limit * 0.9));
    }
    await writeAsStringAsync(uri, next, { encoding: EncodingType.UTF8 });
  } catch {
    // intentionally quiet
  }
}

/** For support: document or cache directory + basename (no personal content). */
export function describeAssistantExecutionLogLocation(): string {
  const base = documentDirectory ?? cacheDirectory ?? '(none)';
  return `${base}${ASSISTANT_EXECUTION_LOG_BASENAME}`;
}
