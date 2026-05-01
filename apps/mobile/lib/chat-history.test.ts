import { describe, expect, it } from 'vitest';
import { recentSliceOldestFirst } from './chat-history';

describe('recentSliceOldestFirst', () => {
  it('returns empty for limit zero', () => {
    expect(recentSliceOldestFirst(['a', 'b'], 0)).toEqual([]);
  });

  it('limits to N newest then orders oldest-first', () => {
    const rows = [
      { id: 'c', createdAt: '2024-01-01T03:00:00.000Z' },
      { id: 'b', createdAt: '2024-01-01T02:00:00.000Z' },
      { id: 'a', createdAt: '2024-01-01T01:00:00.000Z' },
    ];
    expect(recentSliceOldestFirst(rows, 2)).toEqual([
      { id: 'b', createdAt: '2024-01-01T02:00:00.000Z' },
      { id: 'c', createdAt: '2024-01-01T03:00:00.000Z' },
    ]);
  });

  it('handles full slice as chronological', () => {
    const rows = [
      { id: 'z', ts: '2' },
      { id: 'y', ts: '1' },
    ];
    expect(recentSliceOldestFirst(rows, 5)).toEqual([
      { id: 'y', ts: '1' },
      { id: 'z', ts: '2' },
    ]);
  });
});
