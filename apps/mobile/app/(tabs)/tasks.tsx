import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useLocalData } from '../../context/local-data-context';
import {
  getLocalDatabase,
  listDocumentsByTaskDecrypted,
  listRemindersLinkedToTaskDecrypted,
  listSubitemsByTaskDecrypted,
  listTasksDecrypted,
  setEntityLocalOnly,
  type TaskListRow,
  undoLastAppliedCreate,
} from '../../lib/local-db';

type TaskCard = TaskListRow & {
  subitemCount: number;
  documentCount: number;
  reminderCount: number;
  privateDocCount: number;
};

export default function TasksScreen() {
  const { ready, refreshKey, refresh } = useLocalData();
  const [items, setItems] = useState<TaskCard[]>([]);
  const [undoMessage, setUndoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      const db = await getLocalDatabase();
      const tasks = await listTasksDecrypted(db);
      const cards: TaskCard[] = [];
      for (const t of tasks) {
        const subs = await listSubitemsByTaskDecrypted(db, t.id);
        const docs = await listDocumentsByTaskDecrypted(db, t.id);
        const rems = await listRemindersLinkedToTaskDecrypted(
          db,
          t.id,
          subs.map((s) => s.id),
        );
        cards.push({
          ...t,
          subitemCount: subs.length,
          documentCount: docs.length,
          reminderCount: rems.length,
          privateDocCount: docs.filter((d) => d.localOnly).length,
        });
      }
      setItems(cards);
    })();
  }, [ready, refreshKey]);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <Text style={styles.title}>Tasks</Text>
          <Text style={styles.sub}>Outcome-oriented, encrypted local SQLite.</Text>
        </View>
        <Link href="/task/new" asChild>
          <Pressable style={styles.primary}>
            <Text style={styles.primaryLabel}>New task</Text>
          </Pressable>
        </Link>
      </View>

      <Pressable
        style={styles.undoCard}
        onPress={() => {
          void (async () => {
            const db = await getLocalDatabase();
            const ok = await undoLastAppliedCreate(db);
            setUndoMessage(ok ? 'Last create undone.' : 'Nothing to undo.');
            refresh();
          })();
        }}
      >
        <Text style={styles.undoLabel}>Undo last create (manual or assistant)</Text>
        {undoMessage ? <Text style={styles.undoHint}>{undoMessage}</Text> : null}
      </Pressable>

      {items.length === 0 ? (
        <Text style={styles.empty}>
          No tasks yet — add one manually or accept a proposal from Chat.
        </Text>
      ) : (
        items.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => router.push({ pathname: '/task/[id]', params: { id: t.id } })}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{t.title}</Text>
              <Text style={styles.badge}>{t.priority}</Text>
            </View>
            {t.description ? <Text style={styles.cardBody}>{t.description}</Text> : null}
            <Text style={styles.meta}>
              status: {t.status.replace('_', ' ')} · {t.subitemCount} subitem
              {t.subitemCount === 1 ? '' : 's'} · {t.documentCount} doc
              {t.documentCount === 1 ? '' : 's'}
              {t.privateDocCount > 0 ? ` (${t.privateDocCount} private)` : ''} ·{' '}
              {t.reminderCount} reminder{t.reminderCount === 1 ? '' : 's'}
            </Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Local-only (omit from AI context)</Text>
              <Switch
                value={t.localOnly}
                onValueChange={(v) => {
                  void (async () => {
                    const db = await getLocalDatabase();
                    await setEntityLocalOnly(db, 'task', t.id, v);
                    refresh();
                  })();
                }}
              />
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 12, padding: 20, paddingBottom: 40 },
  headerRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  title: { color: '#0f172a', fontSize: 22, fontWeight: '800' },
  sub: { color: '#64748b', fontSize: 14 },
  empty: { color: '#475569', fontSize: 15, marginTop: 12 },
  primary: {
    alignItems: 'center',
    backgroundColor: '#101828',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },
  undoCard: {
    backgroundColor: '#fef9c3',
    borderColor: '#fde68a',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  undoLabel: { color: '#713f12', fontSize: 13, fontWeight: '700' },
  undoHint: { color: '#854d0e', fontSize: 12, marginTop: 4 },
  card: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  cardPressed: { opacity: 0.85 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  cardTitle: { color: '#0f172a', flex: 1, fontSize: 16, fontWeight: '700' },
  cardBody: { color: '#475569', fontSize: 14, lineHeight: 21 },
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
  meta: { color: '#64748b', fontSize: 13 },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 8,
  },
  switchLabel: { color: '#475569', flex: 1, fontSize: 13 },
});
