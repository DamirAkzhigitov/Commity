import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalData } from '../../context/local-data-context';
import {
  createDocumentManual,
  createSubitemManual,
  deleteDocument,
  deleteSubitem,
  deleteTask,
  getItemSourceMeta,
  getLocalDatabase,
  getTaskByIdDecrypted,
  listDocumentsByTaskDecrypted,
  listRemindersLinkedToTaskDecrypted,
  listSubitemsByTaskDecrypted,
  setEntityLocalOnly,
  setSubitemStatus,
  setTaskStatus,
  updateDocumentEncrypted,
  updateSubitemEncrypted,
  updateTaskEncrypted,
  type DocumentRow,
  type ItemSourceMetaRow,
  type ReminderListRow,
  type SubitemRow,
  type TaskDetailRow,
} from '../../lib/local-db';

type SourceMap = Record<string, ItemSourceMetaRow | null>;

export default function TaskDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const taskId = typeof params.id === 'string' ? params.id : '';
  const { ready, refreshKey, refresh } = useLocalData();

  const [task, setTask] = useState<TaskDetailRow | null>(null);
  const [subitems, setSubitems] = useState<SubitemRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [reminders, setReminders] = useState<ReminderListRow[]>([]);
  const [sources, setSources] = useState<SourceMap>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [newSubitemTitle, setNewSubitemTitle] = useState('');
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocSnippet, setNewDocSnippet] = useState('');
  const [newDocPrivate, setNewDocPrivate] = useState(false);

  const reload = useCallback(async () => {
    if (!ready || !taskId) return;
    setLoading(true);
    try {
      const db = await getLocalDatabase();
      const t = await getTaskByIdDecrypted(db, taskId);
      setTask(t);
      if (!t) {
        setSubitems([]);
        setDocuments([]);
        setReminders([]);
        setSources({});
        return;
      }
      const subs = await listSubitemsByTaskDecrypted(db, taskId);
      const docs = await listDocumentsByTaskDecrypted(db, taskId);
      const rems = await listRemindersLinkedToTaskDecrypted(
        db,
        taskId,
        subs.map((s) => s.id),
      );
      setSubitems(subs);
      setDocuments(docs);
      setReminders(rems);
      const meta: SourceMap = {};
      meta[`task:${taskId}`] = await getItemSourceMeta(db, 'task', taskId);
      for (const s of subs) meta[`subitem:${s.id}`] = await getItemSourceMeta(db, 'subitem', s.id);
      for (const d of docs)
        meta[`document:${d.id}`] = await getItemSourceMeta(db, 'document', d.id);
      for (const r of rems)
        meta[`reminder:${r.id}`] = await getItemSourceMeta(db, 'reminder', r.id);
      setSources(meta);
      setEditTitle(t.title);
      setEditDescription(t.description ?? '');
    } finally {
      setLoading(false);
    }
  }, [ready, taskId]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload, refreshKey]),
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!task) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>Task not found.</Text>
        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryLabel}>Back</Text>
        </Pressable>
      </View>
    );
  }

  async function toggleTaskComplete() {
    if (!task) return;
    const next = task.status === 'done' ? 'todo' : 'done';
    const db = await getLocalDatabase();
    await setTaskStatus(db, task.id, next);
    refresh();
  }

  async function saveTaskEdits() {
    if (!task) return;
    const db = await getLocalDatabase();
    await updateTaskEncrypted(
      db,
      task.id,
      { titleOrLabel: editTitle.trim() || task.title, bodySnippet: editDescription },
      new Date().toISOString(),
    );
    setEditing(false);
    refresh();
  }

  async function setTaskPrivacy(localOnly: boolean) {
    if (!task) return;
    const db = await getLocalDatabase();
    await setEntityLocalOnly(db, 'task', task.id, localOnly);
    refresh();
  }

  async function deleteTaskAndBack() {
    if (!task) return;
    Alert.alert('Delete task', 'This will also remove its subitems and documents.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const db = await getLocalDatabase();
          await deleteTask(db, task.id);
          refresh();
          router.back();
        },
      },
    ]);
  }

  async function addSubitem() {
    if (!task) return;
    const trimmed = newSubitemTitle.trim();
    if (!trimmed) return;
    const db = await getLocalDatabase();
    await createSubitemManual(db, task.id, trimmed);
    setNewSubitemTitle('');
    refresh();
  }

  async function toggleSubitem(s: SubitemRow) {
    const db = await getLocalDatabase();
    await setSubitemStatus(db, s.id, s.status === 'done' ? 'todo' : 'done');
    refresh();
  }

  async function renameSubitem(s: SubitemRow, title: string) {
    const db = await getLocalDatabase();
    await updateSubitemEncrypted(db, s.id, { titleOrLabel: title }, new Date().toISOString());
    refresh();
  }

  async function removeSubitem(s: SubitemRow) {
    const db = await getLocalDatabase();
    await deleteSubitem(db, s.id);
    refresh();
  }

  async function addDocument() {
    if (!task) return;
    const trimmed = newDocTitle.trim();
    if (!trimmed) return;
    const db = await getLocalDatabase();
    await createDocumentManual(db, task.id, {
      title: trimmed,
      snippet: newDocSnippet.trim() ? newDocSnippet.trim() : null,
      localOnly: newDocPrivate,
    });
    setNewDocTitle('');
    setNewDocSnippet('');
    setNewDocPrivate(false);
    refresh();
  }

  async function setDocumentPrivacy(d: DocumentRow, localOnly: boolean) {
    const db = await getLocalDatabase();
    await setEntityLocalOnly(db, 'document', d.id, localOnly);
    refresh();
  }

  async function updateDocumentSnippet(d: DocumentRow, snippet: string) {
    const db = await getLocalDatabase();
    await updateDocumentEncrypted(db, d.id, { bodySnippet: snippet }, new Date().toISOString());
    refresh();
  }

  async function removeDocument(d: DocumentRow) {
    const db = await getLocalDatabase();
    await deleteDocument(db, d.id);
    refresh();
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.headerCard}>
        {editing ? (
          <>
            <Text style={styles.label}>Title</Text>
            <TextInput style={styles.input} value={editTitle} onChangeText={setEditTitle} />
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              multiline
              value={editDescription}
              onChangeText={setEditDescription}
            />
            <View style={styles.row}>
              <Pressable style={styles.primary} onPress={() => void saveTaskEdits()}>
                <Text style={styles.primaryLabel}>Save</Text>
              </Pressable>
              <Pressable
                style={styles.secondary}
                onPress={() => {
                  setEditTitle(task.title);
                  setEditDescription(task.description ?? '');
                  setEditing(false);
                }}
              >
                <Text style={styles.secondaryLabel}>Cancel</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={styles.row}>
              <Text style={styles.title}>{task.title}</Text>
              <Text style={styles.badge}>{task.priority}</Text>
            </View>
            {task.description ? <Text style={styles.body}>{task.description}</Text> : null}
            <Text style={styles.meta}>
              status: {task.status.replace('_', ' ')} · updated {task.updatedAt}
            </Text>
            {task.dueAt ? <Text style={styles.meta}>due: {task.dueAt}</Text> : null}
            <View style={styles.row}>
              <Pressable style={styles.primary} onPress={() => void toggleTaskComplete()}>
                <Text style={styles.primaryLabel}>
                  {task.status === 'done' ? 'Mark not done' : 'Mark done'}
                </Text>
              </Pressable>
              <Pressable style={styles.secondary} onPress={() => setEditing(true)}>
                <Text style={styles.secondaryLabel}>Edit</Text>
              </Pressable>
              <Pressable style={styles.danger} onPress={() => void deleteTaskAndBack()}>
                <Text style={styles.dangerLabel}>Delete</Text>
              </Pressable>
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>
                Local-only {task.localOnly ? '(omitted from AI context)' : ''}
              </Text>
              <Switch value={task.localOnly} onValueChange={(v) => void setTaskPrivacy(v)} />
            </View>
            <SourceMetaPill source={sources[`task:${task.id}`] ?? null} />
          </>
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Subitems ({subitems.length})</Text>
        {subitems.length === 0 ? <Text style={styles.empty}>No subitems yet.</Text> : null}
        {subitems.map((s) => (
          <SubitemRowView
            key={s.id}
            subitem={s}
            source={sources[`subitem:${s.id}`] ?? null}
            onToggle={() => void toggleSubitem(s)}
            onRename={(t) => void renameSubitem(s, t)}
            onPrivacy={(v) => {
              void (async () => {
                const db = await getLocalDatabase();
                await setEntityLocalOnly(db, 'subitem', s.id, v);
                refresh();
              })();
            }}
            onDelete={() => void removeSubitem(s)}
          />
        ))}
        <Text style={styles.label}>Add subitem</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flex]}
            value={newSubitemTitle}
            onChangeText={setNewSubitemTitle}
            placeholder="What's the next step?"
          />
          <Pressable style={styles.primary} onPress={() => void addSubitem()}>
            <Text style={styles.primaryLabel}>Add</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Documents ({documents.length})</Text>
        {documents.length === 0 ? <Text style={styles.empty}>No documents yet.</Text> : null}
        {documents.map((d) => (
          <DocumentRowView
            key={d.id}
            doc={d}
            source={sources[`document:${d.id}`] ?? null}
            onPrivacy={(v) => void setDocumentPrivacy(d, v)}
            onSnippetChange={(t) => void updateDocumentSnippet(d, t)}
            onDelete={() => void removeDocument(d)}
          />
        ))}
        <Text style={styles.label}>Add document</Text>
        <TextInput
          style={styles.input}
          value={newDocTitle}
          onChangeText={setNewDocTitle}
          placeholder="Document title"
        />
        <TextInput
          style={[styles.input, styles.multiline]}
          multiline
          value={newDocSnippet}
          onChangeText={setNewDocSnippet}
          placeholder="Optional short snippet (sent to AI unless private)"
        />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Mark private / local-only</Text>
          <Switch value={newDocPrivate} onValueChange={setNewDocPrivate} />
        </View>
        <Pressable style={styles.primary} onPress={() => void addDocument()}>
          <Text style={styles.primaryLabel}>Add document</Text>
        </Pressable>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Linked reminders ({reminders.length})</Text>
        {reminders.length === 0 ? (
          <Text style={styles.empty}>No reminders linked to this task.</Text>
        ) : null}
        {reminders.map((r) => (
          <View key={r.id} style={styles.subCard}>
            <Text style={styles.subTitle}>{r.title}</Text>
            {r.text ? <Text style={styles.body}>{r.text}</Text> : null}
            <Text style={styles.meta}>at {r.remindAt}</Text>
            <Text style={styles.meta}>
              {r.linkedSubitemId ? `subitem ${r.linkedSubitemId.slice(0, 8)}…` : 'task-level'}
              {r.localOnly ? ' · local-only' : ''}
            </Text>
            <SourceMetaPill source={sources[`reminder:${r.id}`] ?? null} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function SubitemRowView({
  subitem,
  source,
  onToggle,
  onRename,
  onPrivacy,
  onDelete,
}: {
  subitem: SubitemRow;
  source: ItemSourceMetaRow | null;
  onToggle: () => void;
  onRename: (t: string) => void;
  onPrivacy: (v: boolean) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(subitem.title);
  const isDone = subitem.status === 'done';
  return (
    <View style={styles.subCard}>
      {editing ? (
        <View>
          <TextInput style={styles.input} value={draft} onChangeText={setDraft} />
          <View style={styles.row}>
            <Pressable
              style={styles.primary}
              onPress={() => {
                onRename(draft.trim() || subitem.title);
                setEditing(false);
              }}
            >
              <Text style={styles.primaryLabel}>Save</Text>
            </Pressable>
            <Pressable
              style={styles.secondary}
              onPress={() => {
                setDraft(subitem.title);
                setEditing(false);
              }}
            >
              <Text style={styles.secondaryLabel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View>
          <View style={styles.row}>
            <Pressable onPress={onToggle} style={styles.checkbox}>
              <Text style={styles.checkboxLabel}>{isDone ? '☑' : '☐'}</Text>
            </Pressable>
            <Text
              style={[
                styles.subTitle,
                styles.flex,
                isDone ? styles.strike : null,
              ]}
            >
              {subitem.title}
            </Text>
          </View>
          <View style={styles.row}>
            <Pressable style={styles.miniSecondary} onPress={() => setEditing(true)}>
              <Text style={styles.miniSecondaryLabel}>Edit</Text>
            </Pressable>
            <Pressable style={styles.miniGhost} onPress={onDelete}>
              <Text style={styles.miniGhostLabel}>Remove</Text>
            </Pressable>
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Local-only</Text>
            <Switch value={subitem.localOnly} onValueChange={onPrivacy} />
          </View>
          <SourceMetaPill source={source} />
        </View>
      )}
    </View>
  );
}

function DocumentRowView({
  doc,
  source,
  onPrivacy,
  onSnippetChange,
  onDelete,
}: {
  doc: DocumentRow;
  source: ItemSourceMetaRow | null;
  onPrivacy: (v: boolean) => void;
  onSnippetChange: (t: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(doc.snippet ?? '');
  return (
    <View style={styles.subCard}>
      <Text style={styles.subTitle}>{doc.title}</Text>
      {doc.documentType ? <Text style={styles.meta}>type: {doc.documentType}</Text> : null}
      {editing ? (
        <View>
          <TextInput
            style={[styles.input, styles.multiline]}
            multiline
            value={draft}
            onChangeText={setDraft}
          />
          <View style={styles.row}>
            <Pressable
              style={styles.primary}
              onPress={() => {
                onSnippetChange(draft);
                setEditing(false);
              }}
            >
              <Text style={styles.primaryLabel}>Save snippet</Text>
            </Pressable>
            <Pressable
              style={styles.secondary}
              onPress={() => {
                setDraft(doc.snippet ?? '');
                setEditing(false);
              }}
            >
              <Text style={styles.secondaryLabel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          {doc.snippet ? <Text style={styles.body}>{doc.snippet}</Text> : null}
          <View style={styles.row}>
            <Pressable style={styles.miniSecondary} onPress={() => setEditing(true)}>
              <Text style={styles.miniSecondaryLabel}>Edit snippet</Text>
            </Pressable>
            <Pressable style={styles.miniGhost} onPress={onDelete}>
              <Text style={styles.miniGhostLabel}>Remove</Text>
            </Pressable>
          </View>
        </>
      )}
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Private / local-only</Text>
        <Switch value={doc.localOnly} onValueChange={onPrivacy} />
      </View>
      {doc.localOnly ? (
        <Text style={styles.privacyNote}>Excluded from AI context by default.</Text>
      ) : null}
      <SourceMetaPill source={source} />
    </View>
  );
}

function SourceMetaPill({ source }: { source: ItemSourceMetaRow | null }) {
  if (!source) return null;
  const isManual = source.proposalId.startsWith('manual:');
  return (
    <Text style={styles.sourcePill}>
      source: {isManual ? 'manual' : 'assistant proposal'}
      {source.clientRequestId ? ` · req ${source.clientRequestId.slice(0, 8)}…` : ''}
    </Text>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 14, padding: 18, paddingBottom: 60 },
  centered: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 20 },
  headerCard: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  sectionTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  title: { color: '#0f172a', flex: 1, fontSize: 22, fontWeight: '800' },
  subTitle: { color: '#0f172a', fontSize: 15, fontWeight: '600' },
  body: { color: '#475569', fontSize: 14, lineHeight: 21 },
  meta: { color: '#64748b', fontSize: 12 },
  empty: { color: '#475569', fontSize: 14 },
  label: { color: '#475569', fontSize: 12, fontWeight: '600' },
  input: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 14,
    padding: 10,
  },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  row: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flex: { flex: 1 },
  primary: {
    alignItems: 'center',
    backgroundColor: '#101828',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },
  secondary: {
    alignItems: 'center',
    borderColor: '#cbd5e1',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryLabel: { color: '#334155', fontSize: 14, fontWeight: '600' },
  danger: {
    alignItems: 'center',
    borderColor: '#fecaca',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dangerLabel: { color: '#b91c1c', fontSize: 14, fontWeight: '700' },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  switchLabel: { color: '#475569', flex: 1, fontSize: 13 },
  badge: {
    backgroundColor: '#dbeafe',
    borderRadius: 999,
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
    textTransform: 'uppercase',
  },
  subCard: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  checkbox: { paddingHorizontal: 4, paddingVertical: 4 },
  checkboxLabel: { color: '#0f172a', fontSize: 22 },
  strike: { color: '#94a3b8', textDecorationLine: 'line-through' },
  miniSecondary: {
    borderColor: '#cbd5e1',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  miniSecondaryLabel: { color: '#334155', fontSize: 12, fontWeight: '600' },
  miniGhost: { paddingHorizontal: 10, paddingVertical: 6 },
  miniGhostLabel: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  privacyNote: { color: '#92400e', fontSize: 12 },
  sourcePill: { color: '#94a3b8', fontSize: 11, fontStyle: 'italic' },
});
