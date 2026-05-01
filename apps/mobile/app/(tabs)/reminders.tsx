import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useLocalData } from '../../context/local-data-context';
import {
  getLocalDatabase,
  listRemindersDecrypted,
  setEntityLocalOnly,
  type ReminderListRow,
} from '../../lib/local-db';

export default function RemindersScreen() {
  const { ready, refreshKey, refresh } = useLocalData();
  const [items, setItems] = useState<ReminderListRow[]>([]);

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      const db = await getLocalDatabase();
      setItems(await listRemindersDecrypted(db));
    })();
  }, [ready, refreshKey]);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Reminders</Text>
      <Text style={styles.sub}>Stored encrypted locally.</Text>
      {items.length === 0 ? (
        <Text style={styles.empty}>No reminders yet.</Text>
      ) : (
        items.map((r) => (
          <View key={r.id} style={styles.card}>
            <Text style={styles.cardTitle}>{r.title}</Text>
            {r.text ? <Text style={styles.cardBody}>{r.text}</Text> : null}
            <Text style={styles.meta}>{r.remindAt}</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Local-only</Text>
              <Switch
                value={r.localOnly}
                onValueChange={(v) => {
                  void (async () => {
                    const db = await getLocalDatabase();
                    await setEntityLocalOnly(db, 'reminder', r.id, v);
                    refresh();
                  })();
                }}
              />
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 12, padding: 20, paddingBottom: 40 },
  title: { color: '#0f172a', fontSize: 22, fontWeight: '800' },
  sub: { color: '#64748b', fontSize: 14 },
  empty: { color: '#475569', fontSize: 15, marginTop: 12 },
  card: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  cardTitle: { color: '#0f172a', fontSize: 16, fontWeight: '700' },
  cardBody: { color: '#475569', fontSize: 14, lineHeight: 21 },
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
