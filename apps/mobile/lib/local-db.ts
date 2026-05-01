import { randomUUID } from 'expo-crypto';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import type { LocalContextRow } from './context-packet';
import { decryptLocalContent, encryptLocalContent } from './local-content-crypto';

const DDL = `
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY NOT NULL,
  title_cipher TEXT NOT NULL,
  description_cipher TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_at TEXT,
  goal_id TEXT,
  local_only INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY NOT NULL,
  title_cipher TEXT NOT NULL,
  body_cipher TEXT NOT NULL,
  local_only INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY NOT NULL,
  title_cipher TEXT NOT NULL,
  text_cipher TEXT,
  remind_at TEXT NOT NULL,
  local_only INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY NOT NULL,
  title_cipher TEXT NOT NULL,
  motivation_cipher TEXT,
  target_date TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  local_only INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY NOT NULL,
  role TEXT NOT NULL,
  body_cipher TEXT NOT NULL,
  client_request_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS item_source_meta (
  item_kind TEXT NOT NULL,
  item_local_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  client_request_id TEXT,
  preview_cipher TEXT,
  PRIMARY KEY (item_kind, item_local_id)
);

CREATE TABLE IF NOT EXISTS action_history (
  id TEXT PRIMARY KEY NOT NULL,
  proposal_id TEXT NOT NULL,
  proposal_type TEXT NOT NULL,
  client_request_id TEXT,
  applied_at TEXT NOT NULL,
  undone_at TEXT,
  undo_kind TEXT NOT NULL,
  entity_kind TEXT NOT NULL,
  entity_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_updated ON tasks(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminders_updated ON reminders(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_goals_updated ON goals(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at DESC);
`;

let dbSingleton: Promise<SQLiteDatabase> | null = null;

export async function getLocalDatabase(): Promise<SQLiteDatabase> {
  if (!dbSingleton) {
    dbSingleton = (async () => {
      const db = await openDatabaseAsync('pa_assistant_local.db');
      await db.execAsync(DDL);
      return db;
    })();
  }
  return dbSingleton;
}

export async function insertChatMessage(
  db: SQLiteDatabase,
  row: {
    id?: string;
    role: 'user' | 'assistant' | 'system';
    bodyCipher: string;
    clientRequestId?: string | null;
    createdAt: string;
  },
): Promise<string> {
  const id = row.id ?? randomUUID();
  await db.runAsync(
    `INSERT INTO chat_messages (id, role, body_cipher, client_request_id, created_at) VALUES (?, ?, ?, ?, ?)`,
    id,
    row.role,
    row.bodyCipher,
    row.clientRequestId ?? null,
    row.createdAt,
  );
  return id;
}

export async function insertTaskRow(
  db: SQLiteDatabase,
  row: {
    id: string;
    titleCipher: string;
    descriptionCipher: string | null;
    status: string;
    priority: string;
    dueAt: string | null;
    goalId: string | null;
    localOnly: number;
    createdAt: string;
    updatedAt: string;
  },
): Promise<void> {
  await db.runAsync(
    `INSERT INTO tasks (id, title_cipher, description_cipher, status, priority, due_at, goal_id, local_only, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.id,
    row.titleCipher,
    row.descriptionCipher,
    row.status,
    row.priority,
    row.dueAt,
    row.goalId,
    row.localOnly,
    row.createdAt,
    row.updatedAt,
  );
}

export async function insertNoteRow(
  db: SQLiteDatabase,
  row: {
    id: string;
    titleCipher: string;
    bodyCipher: string;
    localOnly: number;
    createdAt: string;
    updatedAt: string;
  },
): Promise<void> {
  await db.runAsync(
    `INSERT INTO notes (id, title_cipher, body_cipher, local_only, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    row.id,
    row.titleCipher,
    row.bodyCipher,
    row.localOnly,
    row.createdAt,
    row.updatedAt,
  );
}

export async function insertReminderRow(
  db: SQLiteDatabase,
  row: {
    id: string;
    titleCipher: string;
    textCipher: string | null;
    remindAt: string;
    localOnly: number;
    createdAt: string;
    updatedAt: string;
  },
): Promise<void> {
  await db.runAsync(
    `INSERT INTO reminders (id, title_cipher, text_cipher, remind_at, local_only, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    row.id,
    row.titleCipher,
    row.textCipher,
    row.remindAt,
    row.localOnly,
    row.createdAt,
    row.updatedAt,
  );
}

export async function insertGoalRow(
  db: SQLiteDatabase,
  row: {
    id: string;
    titleCipher: string;
    motivationCipher: string | null;
    targetDate: string | null;
    active: number;
    localOnly: number;
    createdAt: string;
    updatedAt: string;
  },
): Promise<void> {
  await db.runAsync(
    `INSERT INTO goals (id, title_cipher, motivation_cipher, target_date, active, local_only, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    row.id,
    row.titleCipher,
    row.motivationCipher,
    row.targetDate,
    row.active,
    row.localOnly,
    row.createdAt,
    row.updatedAt,
  );
}

export async function insertItemSourceMeta(
  db: SQLiteDatabase,
  row: {
    itemKind: string;
    itemLocalId: string;
    proposalId: string;
    clientRequestId: string | null;
    previewCipher: string | null;
  },
): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO item_source_meta (item_kind, item_local_id, proposal_id, client_request_id, preview_cipher)
     VALUES (?, ?, ?, ?, ?)`,
    row.itemKind,
    row.itemLocalId,
    row.proposalId,
    row.clientRequestId,
    row.previewCipher,
  );
}

export async function appendActionHistory(
  db: SQLiteDatabase,
  row: {
    id: string;
    proposalId: string;
    proposalType: string;
    clientRequestId: string | null;
    appliedAt: string;
    undoKind: string;
    entityKind: string;
    entityId: string;
  },
): Promise<void> {
  await db.runAsync(
    `INSERT INTO action_history (id, proposal_id, proposal_type, client_request_id, applied_at, undone_at, undo_kind, entity_kind, entity_id)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
    row.id,
    row.proposalId,
    row.proposalType,
    row.clientRequestId,
    row.appliedAt,
    row.undoKind,
    row.entityKind,
    row.entityId,
  );
}

export async function deleteTask(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync(`DELETE FROM tasks WHERE id = ?`, id);
  await db.runAsync(`DELETE FROM item_source_meta WHERE item_kind = 'task' AND item_local_id = ?`, id);
}

export async function deleteNote(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync(`DELETE FROM notes WHERE id = ?`, id);
  await db.runAsync(`DELETE FROM item_source_meta WHERE item_kind = 'note' AND item_local_id = ?`, id);
}

export async function deleteReminder(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync(`DELETE FROM reminders WHERE id = ?`, id);
  await db.runAsync(`DELETE FROM item_source_meta WHERE item_kind = 'reminder' AND item_local_id = ?`, id);
}

export async function deleteGoal(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync(`DELETE FROM goals WHERE id = ?`, id);
  await db.runAsync(`DELETE FROM item_source_meta WHERE item_kind = 'goal' AND item_local_id = ?`, id);
}

type Patch = {
  titleOrLabel?: string;
  bodySnippet?: string;
  status?: string;
  priority?: string;
};

export async function updateTaskEncrypted(
  db: SQLiteDatabase,
  localId: string,
  patch: Patch,
  updatedAt: string,
): Promise<void> {
  const row = await db.getFirstAsync<{
    title_cipher: string;
    description_cipher: string | null;
    status: string;
    priority: string;
  }>(`SELECT title_cipher, description_cipher, status, priority FROM tasks WHERE id = ?`, localId);
  if (!row) return;
  const title =
    patch.titleOrLabel !== undefined
      ? patch.titleOrLabel
      : ((await decryptLocalContent(row.title_cipher)) ?? '');
  const description =
    patch.bodySnippet !== undefined
      ? patch.bodySnippet
      : ((await decryptLocalContent(row.description_cipher)) ?? '');
  const titleCipher = await encryptLocalContent(title);
  const descriptionCipher = description ? await encryptLocalContent(description) : null;
  await db.runAsync(
    `UPDATE tasks SET title_cipher = ?, description_cipher = ?, status = COALESCE(?, status), priority = COALESCE(?, priority), updated_at = ?
     WHERE id = ?`,
    titleCipher,
    descriptionCipher,
    patch.status ?? null,
    patch.priority ?? null,
    updatedAt,
    localId,
  );
}

export async function updateNoteEncrypted(
  db: SQLiteDatabase,
  localId: string,
  patch: Patch,
  updatedAt: string,
): Promise<void> {
  const row = await db.getFirstAsync<{ title_cipher: string; body_cipher: string }>(
    `SELECT title_cipher, body_cipher FROM notes WHERE id = ?`,
    localId,
  );
  if (!row) return;
  const title =
    patch.titleOrLabel !== undefined
      ? patch.titleOrLabel
      : ((await decryptLocalContent(row.title_cipher)) ?? '');
  const body =
    patch.bodySnippet !== undefined
      ? patch.bodySnippet
      : ((await decryptLocalContent(row.body_cipher)) ?? '');
  await db.runAsync(
    `UPDATE notes SET title_cipher = ?, body_cipher = ?, updated_at = ? WHERE id = ?`,
    await encryptLocalContent(title),
    await encryptLocalContent(body),
    updatedAt,
    localId,
  );
}

export async function updateReminderEncrypted(
  db: SQLiteDatabase,
  localId: string,
  patch: Patch,
  updatedAt: string,
): Promise<void> {
  const row = await db.getFirstAsync<{ title_cipher: string; text_cipher: string | null }>(
    `SELECT title_cipher, text_cipher FROM reminders WHERE id = ?`,
    localId,
  );
  if (!row) return;
  const title =
    patch.titleOrLabel !== undefined
      ? patch.titleOrLabel
      : ((await decryptLocalContent(row.title_cipher)) ?? '');
  const text =
    patch.bodySnippet !== undefined
      ? patch.bodySnippet
      : ((await decryptLocalContent(row.text_cipher)) ?? '');
  await db.runAsync(
    `UPDATE reminders SET title_cipher = ?, text_cipher = ?, updated_at = ? WHERE id = ?`,
    await encryptLocalContent(title),
    text ? await encryptLocalContent(text) : null,
    updatedAt,
    localId,
  );
}

export async function updateGoalEncrypted(
  db: SQLiteDatabase,
  localId: string,
  patch: Patch,
  updatedAt: string,
): Promise<void> {
  const row = await db.getFirstAsync<{ title_cipher: string; motivation_cipher: string | null }>(
    `SELECT title_cipher, motivation_cipher FROM goals WHERE id = ?`,
    localId,
  );
  if (!row) return;
  const title =
    patch.titleOrLabel !== undefined
      ? patch.titleOrLabel
      : ((await decryptLocalContent(row.title_cipher)) ?? '');
  const motivation =
    patch.bodySnippet !== undefined
      ? patch.bodySnippet
      : ((await decryptLocalContent(row.motivation_cipher)) ?? '');
  await db.runAsync(
    `UPDATE goals SET title_cipher = ?, motivation_cipher = ?, updated_at = ? WHERE id = ?`,
    await encryptLocalContent(title),
    motivation ? await encryptLocalContent(motivation) : null,
    updatedAt,
    localId,
  );
}

export async function setEntityLocalOnly(
  db: SQLiteDatabase,
  kind: 'task' | 'note' | 'reminder' | 'goal',
  id: string,
  localOnly: boolean,
): Promise<void> {
  const ts = new Date().toISOString();
  const bit = localOnly ? 1 : 0;
  if (kind === 'task') {
    await db.runAsync(`UPDATE tasks SET local_only = ?, updated_at = ? WHERE id = ?`, bit, ts, id);
  } else if (kind === 'note') {
    await db.runAsync(`UPDATE notes SET local_only = ?, updated_at = ? WHERE id = ?`, bit, ts, id);
  } else if (kind === 'reminder') {
    await db.runAsync(`UPDATE reminders SET local_only = ?, updated_at = ? WHERE id = ?`, bit, ts, id);
  } else {
    await db.runAsync(`UPDATE goals SET local_only = ?, updated_at = ? WHERE id = ?`, bit, ts, id);
  }
}

export async function undoLastAppliedCreate(db: SQLiteDatabase): Promise<boolean> {
  const row = await db.getFirstAsync<{
    id: string;
    entity_kind: string;
    entity_id: string;
    undo_kind: string;
  }>(
    `SELECT id, entity_kind, entity_id, undo_kind FROM action_history WHERE undone_at IS NULL ORDER BY applied_at DESC LIMIT 1`,
  );
  if (!row || row.undo_kind !== 'delete_entity') return false;

  if (row.entity_kind === 'task') await deleteTask(db, row.entity_id);
  else if (row.entity_kind === 'note') await deleteNote(db, row.entity_id);
  else if (row.entity_kind === 'reminder') await deleteReminder(db, row.entity_id);
  else if (row.entity_kind === 'goal') await deleteGoal(db, row.entity_id);

  await db.runAsync(`UPDATE action_history SET undone_at = ? WHERE id = ?`, new Date().toISOString(), row.id);
  return true;
}

export type TaskListRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  localOnly: boolean;
  updatedAt: string;
};

export async function listTasksDecrypted(db: SQLiteDatabase): Promise<TaskListRow[]> {
  const rows = await db.getAllAsync<{
    id: string;
    title_cipher: string;
    description_cipher: string | null;
    status: string;
    priority: string;
    due_at: string | null;
    local_only: number;
    updated_at: string;
  }>(
    `SELECT id, title_cipher, description_cipher, status, priority, due_at, local_only, updated_at FROM tasks ORDER BY updated_at DESC`,
  );
  const out: TaskListRow[] = [];
  for (const r of rows) {
    const title = (await decryptLocalContent(r.title_cipher)) ?? '';
    const description = await decryptLocalContent(r.description_cipher);
    out.push({
      id: r.id,
      title,
      description,
      status: r.status,
      priority: r.priority,
      dueAt: r.due_at,
      localOnly: r.local_only !== 0,
      updatedAt: r.updated_at,
    });
  }
  return out;
}

export type NoteListRow = {
  id: string;
  title: string;
  body: string;
  localOnly: boolean;
  updatedAt: string;
};

export async function listNotesDecrypted(db: SQLiteDatabase): Promise<NoteListRow[]> {
  const rows = await db.getAllAsync<{
    id: string;
    title_cipher: string;
    body_cipher: string;
    local_only: number;
    updated_at: string;
  }>(`SELECT id, title_cipher, body_cipher, local_only, updated_at FROM notes ORDER BY updated_at DESC`);
  const out: NoteListRow[] = [];
  for (const r of rows) {
    out.push({
      id: r.id,
      title: (await decryptLocalContent(r.title_cipher)) ?? '',
      body: (await decryptLocalContent(r.body_cipher)) ?? '',
      localOnly: r.local_only !== 0,
      updatedAt: r.updated_at,
    });
  }
  return out;
}

export type ReminderListRow = {
  id: string;
  title: string;
  text: string | null;
  remindAt: string;
  localOnly: boolean;
  updatedAt: string;
};

export async function listRemindersDecrypted(db: SQLiteDatabase): Promise<ReminderListRow[]> {
  const rows = await db.getAllAsync<{
    id: string;
    title_cipher: string;
    text_cipher: string | null;
    remind_at: string;
    local_only: number;
    updated_at: string;
  }>(
    `SELECT id, title_cipher, text_cipher, remind_at, local_only, updated_at FROM reminders ORDER BY remind_at ASC`,
  );
  const out: ReminderListRow[] = [];
  for (const r of rows) {
    out.push({
      id: r.id,
      title: (await decryptLocalContent(r.title_cipher)) ?? '',
      text: await decryptLocalContent(r.text_cipher),
      remindAt: r.remind_at,
      localOnly: r.local_only !== 0,
      updatedAt: r.updated_at,
    });
  }
  return out;
}

export type GoalListRow = {
  id: string;
  title: string;
  motivation: string | null;
  targetDate: string | null;
  active: boolean;
  localOnly: boolean;
  updatedAt: string;
};

export async function listGoalsDecrypted(db: SQLiteDatabase): Promise<GoalListRow[]> {
  const rows = await db.getAllAsync<{
    id: string;
    title_cipher: string;
    motivation_cipher: string | null;
    target_date: string | null;
    active: number;
    local_only: number;
    updated_at: string;
  }>(
    `SELECT id, title_cipher, motivation_cipher, target_date, active, local_only, updated_at FROM goals ORDER BY updated_at DESC`,
  );
  const out: GoalListRow[] = [];
  for (const r of rows) {
    out.push({
      id: r.id,
      title: (await decryptLocalContent(r.title_cipher)) ?? '',
      motivation: await decryptLocalContent(r.motivation_cipher),
      targetDate: r.target_date,
      active: r.active !== 0,
      localOnly: r.local_only !== 0,
      updatedAt: r.updated_at,
    });
  }
  return out;
}

/** Rows for outbound assistant context with privacy filtering applied later in context-packet.ts */
export async function loadLocalContextRows(db: SQLiteDatabase): Promise<LocalContextRow[]> {
  const tasks = await listTasksDecrypted(db);
  const notes = await listNotesDecrypted(db);
  const reminders = await listRemindersDecrypted(db);
  const goals = await listGoalsDecrypted(db);

  const stamp = new Map<string, string>();
  for (const t of tasks) stamp.set(`task:${t.id}`, t.updatedAt);
  for (const n of notes) stamp.set(`note:${n.id}`, n.updatedAt);
  for (const r of reminders) stamp.set(`reminder:${r.id}`, r.updatedAt);
  for (const g of goals) stamp.set(`goal:${g.id}`, g.updatedAt);

  const rows: LocalContextRow[] = [];

  for (const t of tasks) {
    rows.push({
      kind: 'task',
      localId: t.id,
      title: t.title,
      bodySnippet: t.description ?? undefined,
      localOnly: t.localOnly,
    });
  }
  for (const n of notes) {
    rows.push({
      kind: 'note',
      localId: n.id,
      title: n.title,
      bodySnippet: n.body.slice(0, 500),
      localOnly: n.localOnly,
    });
  }
  for (const r of reminders) {
    rows.push({
      kind: 'reminder',
      localId: r.id,
      title: r.title,
      bodySnippet: r.text ?? undefined,
      localOnly: r.localOnly,
    });
  }
  for (const g of goals) {
    rows.push({
      kind: 'goal',
      localId: g.id,
      title: g.title,
      bodySnippet: g.motivation ?? undefined,
      localOnly: g.localOnly,
    });
  }

  rows.sort((a, b) => {
    const ka = `${a.kind}:${a.localId}`;
    const kb = `${b.kind}:${b.localId}`;
    const ta = stamp.get(ka) ?? '';
    const tb = stamp.get(kb) ?? '';
    return tb.localeCompare(ta);
  });

  return rows.slice(0, 48);
}
