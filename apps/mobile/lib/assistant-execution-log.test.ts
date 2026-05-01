import { beforeEach, describe, expect, it, vi } from 'vitest';

const fsMocks = vi.hoisted(() => {
  const writeAsStringAsync = vi.fn().mockResolvedValue(undefined);
  const readAsStringAsync = vi.fn().mockResolvedValue('');
  const getInfoAsync = vi.fn().mockResolvedValue({ exists: false });
  return { writeAsStringAsync, readAsStringAsync, getInfoAsync };
});

vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  cacheDirectory: null,
  EncodingType: { UTF8: 'utf8' },
  getInfoAsync: fsMocks.getInfoAsync,
  readAsStringAsync: fsMocks.readAsStringAsync,
  writeAsStringAsync: fsMocks.writeAsStringAsync,
}));

import { appendAssistantExecutionLog, ASSISTANT_EXECUTION_LOG_BASENAME } from './assistant-execution-log';

describe('appendAssistantExecutionLog', () => {
  beforeEach(() => {
    fsMocks.writeAsStringAsync.mockClear();
    fsMocks.readAsStringAsync.mockClear();
    fsMocks.getInfoAsync.mockClear();
    fsMocks.getInfoAsync.mockResolvedValue({ exists: false });
  });

  it('writes NDJSON with mobile source, phase, and timestamp', async () => {
    await appendAssistantExecutionLog({
      phase: 'test_phase',
      functionOrEndpoint: 'unit_test',
    });

    expect(fsMocks.writeAsStringAsync).toHaveBeenCalledTimes(1);
    const [uri, content] = fsMocks.writeAsStringAsync.mock.calls[0]!;
    expect(uri).toContain(ASSISTANT_EXECUTION_LOG_BASENAME);
    const line = content.trim().split('\n').filter(Boolean)[0];
    expect(line).toBeTruthy();
    const row = JSON.parse(line!) as { source: string; phase: string; ts: string; functionOrEndpoint?: string };
    expect(row.source).toBe('mobile');
    expect(row.phase).toBe('test_phase');
    expect(row.functionOrEndpoint).toBe('unit_test');
    expect(row.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('appends to existing file content when present', async () => {
    fsMocks.getInfoAsync.mockResolvedValue({ exists: true, size: 10 });
    fsMocks.readAsStringAsync.mockResolvedValue('{"a":1}\n');

    await appendAssistantExecutionLog({ phase: 'second' });

    const [, content] = fsMocks.writeAsStringAsync.mock.calls[0]!;
    const lines = content.trim().split('\n').filter(Boolean);
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]!)).toMatchObject({ a: 1 });
    expect(JSON.parse(lines[1]!)).toMatchObject({ phase: 'second', source: 'mobile' });
  });
});
