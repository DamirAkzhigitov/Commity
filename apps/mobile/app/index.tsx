import { subscriptionPlans, type Task } from '@personal-assistant/shared';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const sampleTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Plan the first MVP slice',
    description: 'Turn chat into structured tasks, notes, and reminders.',
    status: 'in_progress',
    priority: 'high',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-2',
    title: 'Track AI usage cost',
    description: 'Every backend AI call should write usage records.',
    status: 'todo',
    priority: 'urgent',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default function HomeScreen() {
  const plusPlan = subscriptionPlans.find((plan) => plan.id === 'plus');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>AI personal assistant</Text>
        <Text style={styles.title}>Chat that becomes action.</Text>
        <Text style={styles.subtitle}>
          Capture tasks, remember notes, schedule reminders, and keep goals moving with a
          backend-controlled OpenAI bridge.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>MVP Tasks</Text>
        {sampleTasks.map((task) => (
          <View key={task.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{task.title}</Text>
              <Text style={styles.badge}>{task.priority}</Text>
            </View>
            <Text style={styles.cardBody}>{task.description}</Text>
            <Text style={styles.meta}>Status: {task.status.replace('_', ' ')}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Suggested Plan</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{plusPlan?.name ?? 'Plus'} subscription</Text>
          <Text style={styles.cardBody}>
            Includes AI quota, cloud memory, and proactive reminders while keeping usage
            limits enforced on the backend.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
    padding: 20,
  },
  hero: {
    backgroundColor: '#101828',
    borderRadius: 28,
    gap: 12,
    padding: 24,
  },
  eyebrow: {
    color: '#7dd3fc',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 40,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 16,
    lineHeight: 24,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: '#0f172a',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  cardBody: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 21,
  },
  badge: {
    backgroundColor: '#dbeafe',
    borderRadius: 999,
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
    textTransform: 'uppercase',
  },
  meta: {
    color: '#64748b',
    fontSize: 13,
  },
});
