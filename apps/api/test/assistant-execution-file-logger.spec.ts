import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  appendApiAssistantExecutionLog,
  getAssistantExecutionLogPathForTests,
} from '../src/assistant/assistant-execution-file-logger';

describe('appendApiAssistantExecutionLog', () => {
  let tempFile: string | null = null;
  let savedPath: string | undefined;
  let savedMax: string | undefined;

  beforeEach(() => {
    savedPath = process.env.ASSISTANT_EXECUTION_LOG_PATH;
    savedMax = process.env.ASSISTANT_EXECUTION_LOG_MAX_BYTES;
    tempFile = null;
  });

  afterEach(async () => {
    if (savedPath === undefined) {
      delete process.env.ASSISTANT_EXECUTION_LOG_PATH;
    } else {
      process.env.ASSISTANT_EXECUTION_LOG_PATH = savedPath;
    }
    if (savedMax === undefined) {
      delete process.env.ASSISTANT_EXECUTION_LOG_MAX_BYTES;
    } else {
      process.env.ASSISTANT_EXECUTION_LOG_MAX_BYTES = savedMax;
    }
    if (tempFile) {
      await fs.unlink(tempFile).catch(() => {});
      tempFile = null;
    }
  });

  it('appends NDJSON with api source', async () => {
    tempFile = join(tmpdir(), `pa-api-exec-${Date.now()}.ndjson`);
    process.env.ASSISTANT_EXECUTION_LOG_PATH = tempFile;
    expect(getAssistantExecutionLogPathForTests()).toBe(tempFile);

    await appendApiAssistantExecutionLog({
      phase: 'api_unit_test',
      clientRequestId: '00000000-0000-4000-8000-000000000020',
    });

    const text = await fs.readFile(tempFile, 'utf8');
    const row = JSON.parse(text.trim()) as { source: string; phase: string };
    expect(row.source).toBe('api');
    expect(row.phase).toBe('api_unit_test');
  });

  it('drops oldest lines when file exceeds max bytes', async () => {
    tempFile = join(tmpdir(), `pa-api-exec-${Date.now()}-2.ndjson`);
    process.env.ASSISTANT_EXECUTION_LOG_PATH = tempFile;
    process.env.ASSISTANT_EXECUTION_LOG_MAX_BYTES = '450';

    const longLine =
      `${JSON.stringify({ ts: '1', source: 'api', phase: 'bulk', pad: 'z'.repeat(220) })}\n`;
    await fs.writeFile(tempFile, longLine.repeat(3), 'utf8');

    await appendApiAssistantExecutionLog({ phase: 'after_trim' });

    const text = await fs.readFile(tempFile, 'utf8');
    expect(text).toContain('after_trim');
    expect(Buffer.byteLength(text, 'utf8')).toBeLessThanOrEqual(450);
  });
});
