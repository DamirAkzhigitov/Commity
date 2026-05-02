import { router } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalData } from '../../context/local-data-context';
import { createTaskManual, getLocalDatabase } from '../../lib/local-db';

const PRIORITIES: Array<'low' | 'medium' | 'high' | 'urgent'> = ['low', 'medium', 'high', 'urgent'];

export default function NewTaskScreen() {
  const { refresh } = useLocalData();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [subitemDraft, setSubitemDraft] = useState('');
  const [subitems, setSubitems] = useState<string[]>([]);
  const [docTitle, setDocTitle] = useState('');
  const [docSnippet, setDocSnippet] = useState('');
  const [docPrivate, setDocPrivate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function pushSubitem() {
    const t = subitemDraft.trim();
    if (!t) return;
    setSubitems((p) => [...p, t]);
    setSubitemDraft('');
  }
  function removeSubitem(index: number) {
    setSubitems((p) => p.filter((_, i) => i !== index));
  }

  async function save() {
    setError(null);
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    try {
      const db = await getLocalDatabase();
      const id = await createTaskManual(db, {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        subitems: subitems.map((s) => ({ title: s })),
        documents: docTitle.trim()
          ? [
              {
                title: docTitle.trim(),
                snippet: docSnippet.trim() || null,
                localOnly: docPrivate,
              },
            ]
          : [],
      });
      refresh();
      router.replace({ pathname: '/task/[id]', params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>New task</Text>
      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="What outcome are you going for?"
      />

      <Text style={styles.label}>Description (optional)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        multiline
        value={description}
        onChangeText={setDescription}
        placeholder="Why does this matter? Acceptance?"
      />

      <Text style={styles.label}>Priority</Text>
      <View style={styles.row}>
        {PRIORITIES.map((p) => (
          <Pressable
            key={p}
            onPress={() => setPriority(p)}
            style={[styles.pill, priority === p ? styles.pillActive : null]}
          >
            <Text style={[styles.pillLabel, priority === p ? styles.pillLabelActive : null]}>
              {p}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Subitems</Text>
      {subitems.map((s, i) => (
        <View key={`${s}-${i}`} style={styles.row}>
          <Text style={[styles.body, styles.flex]}>{i + 1}. {s}</Text>
          <Pressable onPress={() => removeSubitem(i)} style={styles.miniGhost}>
            <Text style={styles.miniGhostLabel}>Remove</Text>
          </Pressable>
        </View>
      ))}
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.flex]}
          value={subitemDraft}
          onChangeText={setSubitemDraft}
          placeholder="Add a step"
        />
        <Pressable style={styles.secondary} onPress={pushSubitem}>
          <Text style={styles.secondaryLabel}>Add step</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Initial document (optional)</Text>
      <TextInput
        style={styles.input}
        value={docTitle}
        onChangeText={setDocTitle}
        placeholder="Document title"
      />
      <TextInput
        style={[styles.input, styles.multiline]}
        multiline
        value={docSnippet}
        onChangeText={setDocSnippet}
        placeholder="Optional short snippet"
      />
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Mark document private / local-only</Text>
        <Switch value={docPrivate} onValueChange={setDocPrivate} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.row}>
        <Pressable style={styles.primary} disabled={saving} onPress={() => void save()}>
          <Text style={styles.primaryLabel}>{saving ? 'Saving…' : 'Create task'}</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryLabel}>Cancel</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 12, padding: 18, paddingBottom: 60 },
  title: { color: '#0f172a', fontSize: 22, fontWeight: '800' },
  label: { color: '#475569', fontSize: 12, fontWeight: '600', marginTop: 4 },
  input: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 14,
    padding: 10,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  row: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flex: { flex: 1 },
  body: { color: '#334155', fontSize: 14 },
  pill: {
    borderColor: '#cbd5e1',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillActive: { backgroundColor: '#101828', borderColor: '#101828' },
  pillLabel: { color: '#334155', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  pillLabelActive: { color: '#fff' },
  primary: {
    alignItems: 'center',
    backgroundColor: '#101828',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },
  secondary: {
    alignItems: 'center',
    borderColor: '#cbd5e1',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  secondaryLabel: { color: '#334155', fontSize: 14, fontWeight: '600' },
  miniGhost: { paddingHorizontal: 10, paddingVertical: 6 },
  miniGhostLabel: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 4,
  },
  switchLabel: { color: '#475569', flex: 1, fontSize: 13 },
  error: { color: '#b91c1c', fontSize: 13 },
});
