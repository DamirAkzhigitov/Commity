import { clipNdjsonLinesToMaxUtf8Bytes, type AssistantExecutionLogEntry } from '@personal-assistant/shared';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_MAX_BYTES = 2_000_000;

function logFilePath(): string {
  return process.env.ASSISTANT_EXECUTION_LOG_PATH ?? join(tmpdir(), 'personal-assistant-api-assistant-execution.ndjson');
}

function maxUtf8Bytes(): number {
  const raw = process.env.ASSISTANT_EXECUTION_LOG_MAX_BYTES;
  const n = raw !== undefined ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 256 ? n : DEFAULT_MAX_BYTES;
}

/**
 * Append one NDJSON line for assistant request handling. Does not log message text, tokens, or user ids.
 * Errors are swallowed so chat is unaffected if the log volume or FS fails.
 */
export async function appendApiAssistantExecutionLog(
  entry: Omit<AssistantExecutionLogEntry, 'ts' | 'source'> &
    Partial<Pick<AssistantExecutionLogEntry, 'ts' | 'source'>>,
): Promise<void> {
  const full: AssistantExecutionLogEntry = {
    ...entry,
    ts: entry.ts ?? new Date().toISOString(),
    source: 'api',
  };
  const path = logFilePath();
  const line = `${JSON.stringify(full)}\n`;
  try {
    let existing = '';
    try {
      existing = await fs.readFile(path, 'utf8');
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') {
        throw e;
      }
    }
    const limit = maxUtf8Bytes();
    let next = existing + line;
    if (Buffer.byteLength(next, 'utf8') > limit) {
      next = clipNdjsonLinesToMaxUtf8Bytes(next, Math.floor(limit * 0.9));
    }
    await fs.writeFile(path, next, 'utf8');
  } catch {
    // intentionally quiet
  }
}

/** Exposed for tests and ops runbooks. */
export function getAssistantExecutionLogPathForTests(): string {
  return logFilePath();
}
