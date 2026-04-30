import { Link } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { AssistantActionProposal } from '@personal-assistant/shared';
import { useAuth } from '../context/auth-context';
import { getAccessTokenForApi } from '../lib/auth-access-token';
import { AssistantApiError, postAssistantChat } from '../lib/assistant-api';
import { getAppConfig } from '../lib/config';

function proposalSummary(p: AssistantActionProposal): string {
  switch (p.type) {
    case 'create_task':
      return `Task: ${p.payload.title}`;
    case 'create_note':
      return `Note: ${p.payload.title}`;
    case 'schedule_reminder':
      return `Reminder: ${p.payload.title} @ ${p.payload.remindAt}`;
    case 'create_goal':
      return `Goal: ${p.payload.title}`;
    case 'update_item':
      return `Update ${p.payload.kind} ${p.payload.localId}`;
    case 'delete_item':
      return `Delete ${p.payload.kind} ${p.payload.localId}`;
    case 'noop':
      return 'No action';
  }
}

export default function ChatScreen() {
  const { session, isLoading, signOut } = useAuth();
  const [message, setMessage] = useState('Remind me to water plants tomorrow');
  const [reply, setReply] = useState<string | null>(null);
  const [proposals, setProposals] = useState<AssistantActionProposal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function send() {
    const token = await getAccessTokenForApi();
    if (!token) {
      setError('Not signed in');
      return;
    }
    setError(null);
    setSending(true);
    setReply(null);
    setProposals([]);
    try {
      const { apiBaseUrl } = getAppConfig();
      const trimmed = message.trim();
      if (!trimmed) {
        setError('Enter a message');
        return;
      }
      const res = await postAssistantChat(apiBaseUrl, token, { message: trimmed });
      setReply(res.reply);
      setProposals(res.proposals);
    } catch (e) {
      if (e instanceof AssistantApiError) {
        setError(`${e.status}: ${e.responseBody.slice(0, 500)}`);
      } else if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('Request failed');
      }
    } finally {
      setSending(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Sign in to use chat</Text>
        <Link href="/sign-in" style={styles.link}>
          <Text style={styles.linkText}>Go to sign in</Text>
        </Link>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Home</Text>
        </Link>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.meta}>API: {getAppConfig().apiBaseUrl}</Text>
      <TextInput
        multiline
        onChangeText={setMessage}
        placeholder="Message"
        style={styles.input}
        value={message}
      />
      <Pressable
        disabled={sending}
        onPress={() => void send()}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, sending && styles.buttonDisabled]}
      >
        {sending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonLabel}>Send to assistant</Text>
        )}
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {reply ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reply</Text>
          <Text style={styles.cardBody}>{reply}</Text>
        </View>
      ) : null}
      {proposals.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Proposals</Text>
          {proposals.map((p) => (
            <Text key={p.proposalId} style={styles.proposalLine}>
              • [{p.confirmationTier}] {proposalSummary(p)}
            </Text>
          ))}
        </View>
      ) : null}
      <Pressable
        onPress={() => void signOut()}
        style={({ pressed }) => [styles.secondary, pressed && styles.buttonPressed]}
      >
        <Text style={styles.secondaryLabel}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: 14,
    padding: 20,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    gap: 12,
    padding: 20,
  },
  title: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '700',
  },
  meta: {
    color: '#64748b',
    fontSize: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 100,
    padding: 12,
    textAlignVertical: 'top',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#101828',
    borderRadius: 14,
    paddingVertical: 14,
  },
  buttonPressed: { opacity: 0.92 },
  buttonDisabled: { opacity: 0.6 },
  buttonLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondary: {
    alignItems: 'center',
    borderColor: '#cbd5e1',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
    paddingVertical: 12,
  },
  secondaryLabel: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '600',
  },
  error: {
    color: '#b91c1c',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  cardTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  cardBody: {
    color: '#334155',
    fontSize: 15,
    lineHeight: 22,
  },
  proposalLine: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  link: { marginTop: 4 },
  linkText: {
    color: '#1d4ed8',
    fontSize: 15,
    fontWeight: '600',
  },
});
