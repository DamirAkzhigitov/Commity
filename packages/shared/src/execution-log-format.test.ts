import { describe, expect, it } from 'vitest';
import { clipNdjsonLinesToMaxUtf8Bytes, summarizeAssistantProposalForLog } from './execution-log-format.js';

describe('clipNdjsonLinesToMaxUtf8Bytes', () => {
  it('returns unchanged when under the byte limit', () => {
    const s = '{"a":1}\n{"b":2}\n';
    expect(clipNdjsonLinesToMaxUtf8Bytes(s, 10_000)).toBe(s);
  });

  it('drops oldest lines first when over the limit', () => {
    const line = `{"x":1,"p":"${'a'.repeat(80)}"}`;
    const lines = Array.from({ length: 40 }, () => line);
    const many = `${lines.join('\n')}\n`;
    const enc = new TextEncoder();
    const max = 800;
    expect(enc.encode(many).byteLength).toBeGreaterThan(max);
    const out = clipNdjsonLinesToMaxUtf8Bytes(many, max);
    expect(enc.encode(out).byteLength).toBeLessThanOrEqual(max);
    const lineCount = out.trim().split('\n').filter(Boolean).length;
    expect(lineCount).toBeLessThan(40);
    expect(lineCount).toBeGreaterThan(0);
  });
});

describe('summarizeAssistantProposalForLog', () => {
  it('includes kind and localId for delete_item (no title text)', () => {
    const s = summarizeAssistantProposalForLog({
      proposalId: '00000000-0000-4000-8000-000000000099',
      type: 'delete_item',
      confirmationTier: 'requires_confirmation',
      payload: { kind: 'task', localId: 'local_item_pending_selection' },
    });
    expect(s).toMatchObject({
      proposalType: 'delete_item',
      kind: 'task',
      localId: 'local_item_pending_selection',
    });
    expect(s).not.toHaveProperty('title');
  });
});
