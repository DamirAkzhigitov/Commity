import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./local-content-crypto', () => ({
  encryptLocalContent: async (s: string) => `enc:${s}`,
  decryptLocalContent: async (s: string | null) =>
    s == null ? null : s.startsWith('enc:') ? s.slice(4) : s,
}));

import {
  createDocumentManual,
  createSubitemManual,
  createTaskManual,
  getItemSourceMeta,
  listDocumentsByTaskDecrypted,
  listRemindersLinkedToTaskDecrypted,
  listSubitemsByTaskDecrypted,
} from './local-db';

type TableRow = Record<string, unknown>;

class FakeDb {
  tables: Record<string, TableRow[]> = {
    tasks: [],
    subitems: [],
    documents: [],
    reminders: [],
    notes: [],
    goals: [],
    chat_messages: [],
    item_source_meta: [],
    action_history: [],
  };

  async execAsync(_sql: string): Promise<void> {}
  async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    return (this.runQuery(sql, params) as T[]) ?? [];
  }
  async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    const rows = this.runQuery(sql, params) as T[];
    return rows[0] ?? null;
  }
  async runAsync(sql: string, ...params: unknown[]): Promise<void> {
    this.runMutation(sql, params);
  }

  private detectTable(sql: string): string {
    const m = sql.match(/(?:FROM|INTO|UPDATE)\s+([a-z_]+)/i);
    return m ? m[1] : '';
  }

  private runQuery(sql: string, params: unknown[]): TableRow[] {
    const table = this.detectTable(sql);
    if (!this.tables[table]) return [];

    if (table === 'subitems' && /SELECT\s+MAX\(sort_order\)/i.test(sql)) {
      const filtered = this.tables.subitems.filter((r) => r.task_id === params[0]);
      const max = filtered.reduce((acc: number, r) => {
        const s = r.sort_order as number;
        return s > acc ? s : acc;
      }, -1);
      return [{ max_order: filtered.length === 0 ? null : max }];
    }

    let rows = this.tables[table].slice();
    if (table === 'subitems' && /WHERE\s+task_id\s*=\s*\?/i.test(sql)) {
      rows = rows.filter((r) => r.task_id === params[0]);
    } else if (table === 'documents' && /WHERE\s+task_id\s*=\s*\?/i.test(sql)) {
      rows = rows.filter((r) => r.task_id === params[0]);
    } else if (table === 'reminders' && /WHERE\s+linked_task_id\s*=\s*\?/i.test(sql)) {
      const subitemIn = sql.match(/linked_subitem_id\s+IN\s*\(([^)]+)\)/i);
      const subIds = new Set(params.slice(1));
      rows = rows.filter((r) => {
        if (r.linked_task_id === params[0]) return true;
        if (subitemIn && subIds.has(r.linked_subitem_id as string)) return true;
        return false;
      });
    } else if (
      table === 'item_source_meta' &&
      /WHERE\s+item_kind\s*=\s*\?\s+AND\s+item_local_id\s*=\s*\?/i.test(sql)
    ) {
      rows = rows.filter((r) => r.item_kind === params[0] && r.item_local_id === params[1]);
    } else if (table === 'tasks' && /WHERE\s+id\s*=\s*\?/i.test(sql)) {
      rows = rows.filter((r) => r.id === params[0]);
    } else if (table === 'action_history' && /undone_at IS NULL/i.test(sql)) {
      rows = rows.filter((r) => r.undone_at == null);
      rows.sort((a, b) => String(b.applied_at).localeCompare(String(a.applied_at)));
      rows = rows.slice(0, 1);
    }
    return rows;
  }

  private runMutation(sql: string, params: unknown[]): void {
    const table = this.detectTable(sql);
    if (sql.startsWith('INSERT INTO') || sql.startsWith('INSERT OR REPLACE INTO')) {
      const cols = sql.match(/INSERT(?:\s+OR\s+REPLACE)?\s+INTO\s+\w+\s*\(([^)]+)\)/i);
      const valuesMatch = sql.match(/VALUES\s*\(([^)]+)\)/i);
      if (!cols || !valuesMatch) return;
      const names = cols[1].split(',').map((c) => c.trim());
      const valueTokens = valuesMatch[1].split(',').map((v) => v.trim());
      const row: TableRow = {};
      let p = 0;
      names.forEach((n, i) => {
        const tok = valueTokens[i];
        if (tok === '?') {
          row[n] = params[p++];
        } else if (/^NULL$/i.test(tok)) {
          row[n] = null;
        } else {
          row[n] = tok.replace(/^'|'$/g, '');
        }
      });
      if (sql.startsWith('INSERT OR REPLACE')) {
        const idx = this.tables[table].findIndex(
          (r) => r.item_kind === row.item_kind && r.item_local_id === row.item_local_id,
        );
        if (idx >= 0) {
          this.tables[table][idx] = row;
          return;
        }
      }
      this.tables[table].push(row);
    } else if (sql.startsWith('UPDATE')) {
      // Minimal: update by id WHERE id = ?
      const setMatch = sql.match(/SET\s+(.*?)\s+WHERE/i);
      if (!setMatch) return;
      const assignments = setMatch[1].split(',').map((a) => a.trim());
      const whereIdx = sql.toUpperCase().lastIndexOf('WHERE');
      const wherePart = sql.slice(whereIdx);
      const setParams = params.slice(0, assignments.length);
      const whereParams = params.slice(assignments.length);
      this.tables[table] = this.tables[table].map((r) => {
        const matchesWhere = (() => {
          if (/id\s*=\s*\?/.test(wherePart)) return r.id === whereParams[0];
          if (/linked_task_id\s*=\s*\?/.test(wherePart))
            return r.linked_task_id === whereParams[0];
          if (/linked_subitem_id\s*=\s*\?/.test(wherePart))
            return r.linked_subitem_id === whereParams[0];
          if (/item_kind\s*=\s*'?\w+'?\s+AND\s+item_local_id\s*=\s*\?/.test(wherePart))
            return r.item_local_id === whereParams[0];
          return false;
        })();
        if (!matchesWhere) return r;
        const next = { ...r };
        assignments.forEach((a, i) => {
          const col = a.split('=')[0].trim();
          // Support COALESCE(?, status) — accept first param
          const value = setParams[i];
          if (value !== null && value !== undefined) next[col] = value;
        });
        return next;
      });
    } else if (sql.startsWith('DELETE FROM')) {
      const wherePart = sql.split('WHERE')[1] ?? '';
      this.tables[table] = this.tables[table].filter((r) => {
        if (/id\s*=\s*\?/.test(wherePart)) return r.id !== params[0];
        if (/item_kind\s*=\s*'(\w+)'\s+AND\s+item_local_id\s*=\s*\?/.test(wherePart)) {
          const m = wherePart.match(/item_kind\s*=\s*'(\w+)'/);
          const kind = m?.[1];
          return !(r.item_kind === kind && r.item_local_id === params[0]);
        }
        return true;
      });
    }
  }
}

describe('manual create helpers', () => {
  let db: FakeDb;
  beforeEach(() => {
    db = new FakeDb();
  });

  it('createTaskManual stores task with subitems and an undoable action history entry', async () => {
    const id = await createTaskManual(db as never, {
      title: 'Plan migration',
      description: 'Step by step',
      priority: 'high',
      subitems: [{ title: 'Research' }, { title: 'Schedule' }],
      documents: [{ title: 'Draft brief', snippet: 'outline', localOnly: true }],
    });
    expect(id).toMatch(/[0-9a-f-]{8,}/);
    expect(db.tables.tasks).toHaveLength(1);
    expect(db.tables.subitems).toHaveLength(2);
    expect(db.tables.documents).toHaveLength(1);
    expect(db.tables.documents[0].local_only).toBe(1);
    const history = db.tables.action_history;
    expect(history).toHaveLength(1);
    expect(history[0].undo_kind).toBe('delete_entity');
    expect(history[0].entity_kind).toBe('task');
    expect(history[0].entity_id).toBe(id);
    expect(String(history[0].proposal_id).startsWith('manual:')).toBe(true);
  });

  it('createSubitemManual increments sort order and tracks history', async () => {
    const taskId = await createTaskManual(db as never, { title: 'T' });
    await createSubitemManual(db as never, taskId, 'first');
    await createSubitemManual(db as never, taskId, 'second');
    const subs = await listSubitemsByTaskDecrypted(db as never, taskId);
    expect(subs.map((s) => s.title)).toEqual(['first', 'second']);
    expect(subs.map((s) => s.sortOrder)).toEqual([0, 1]);
    expect(db.tables.action_history.filter((h) => h.entity_kind === 'subitem')).toHaveLength(2);
  });

  it('createDocumentManual stores private flag and history', async () => {
    const taskId = await createTaskManual(db as never, { title: 'T' });
    const docId = await createDocumentManual(db as never, taskId, {
      title: 'Sensitive',
      snippet: 'top secret',
      localOnly: true,
    });
    const docs = await listDocumentsByTaskDecrypted(db as never, taskId);
    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe(docId);
    expect(docs[0].localOnly).toBe(true);
    expect(docs[0].snippet).toBe('top secret');
  });

  it('rejects empty subitem and document titles', async () => {
    const taskId = await createTaskManual(db as never, { title: 'T' });
    await expect(createSubitemManual(db as never, taskId, '   ')).rejects.toThrow(/required/i);
    await expect(
      createDocumentManual(db as never, taskId, { title: '' }),
    ).rejects.toThrow(/required/i);
  });
});

describe('listRemindersLinkedToTaskDecrypted', () => {
  it('returns task-level and subitem-level reminders only', async () => {
    const db = new FakeDb();
    const taskId = await createTaskManual(db as never, { title: 'T' });
    const otherTask = await createTaskManual(db as never, { title: 'Other' });
    const sub = await createSubitemManual(db as never, taskId, 'sub');

    db.tables.reminders.push(
      {
        id: 'r-task',
        title_cipher: 'enc:Task reminder',
        text_cipher: null,
        remind_at: '2026-05-01T10:00:00.000Z',
        linked_task_id: taskId,
        linked_subitem_id: null,
        local_only: 0,
        updated_at: '2026-05-01T00:00:00.000Z',
      },
      {
        id: 'r-sub',
        title_cipher: 'enc:Sub reminder',
        text_cipher: null,
        remind_at: '2026-05-02T10:00:00.000Z',
        linked_task_id: null,
        linked_subitem_id: sub,
        local_only: 0,
        updated_at: '2026-05-01T00:00:00.000Z',
      },
      {
        id: 'r-other',
        title_cipher: 'enc:Other reminder',
        text_cipher: null,
        remind_at: '2026-05-03T10:00:00.000Z',
        linked_task_id: otherTask,
        linked_subitem_id: null,
        local_only: 0,
        updated_at: '2026-05-01T00:00:00.000Z',
      },
    );

    const result = await listRemindersLinkedToTaskDecrypted(db as never, taskId, [sub]);
    const ids = result.map((r) => r.id).sort();
    expect(ids).toEqual(['r-sub', 'r-task']);
  });
});

describe('getItemSourceMeta', () => {
  it('returns null when no source metadata exists', async () => {
    const db = new FakeDb();
    const taskId = await createTaskManual(db as never, { title: 'T' });
    const meta = await getItemSourceMeta(db as never, 'task', taskId);
    expect(meta).toBeNull();
  });
});
