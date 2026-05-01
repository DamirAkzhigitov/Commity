import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useLocalData } from '../../context/local-data-context';
import {
  getLocalDatabase,
  listNotesDecrypted,
  setEntityLocalOnly,
  type NoteListRow,
} from '../../lib/local-db';

export default function NotesScreen() {
  const { ready, refreshKey, refresh } = useLocalData();
  const [items, setItems] = useState<NoteListRow[]>([]);

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      const db = await getLocalDatabase();
      setItems(await listNotesDecrypted(db));
    })();
  }, [ready, refreshKey]);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Notes</Text>
      <Text style={styles.sub}>Stored encrypted locally.</Text>
      {items.length === 0 ? (
        <Text style={styles.empty}>No notes yet.</Text>
      ) : (
        items.map((n) => (
          <View key={n.id} style={styles.card}>
            <Text style={styles.cardTitle}>{n.title}</Text>
            <Text style={styles.cardBody}>{n.body}</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Local-only</Text>
              <Switch
                value={n.localOnly}
                onValueChange={(v) => {
                  void (async () => {
                    const db = await getLocalDatabase();
                    await setEntityLocalOnly(db, 'note', n.id, v);
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
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 8,
  },
  switchLabel: { color: '#475569', flex: 1, fontSize: 13 },
});
