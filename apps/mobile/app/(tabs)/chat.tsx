import type {AssistantActionProposal} from '@personal-assistant/shared';
import {summarizeAssistantProposalForLog} from '@personal-assistant/shared';
import {useFocusEffect} from '@react-navigation/native';
import {randomUUID} from 'expo-crypto';
import {Link} from 'expo-router';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  Keyboard,
  TextInput,
  View,
} from 'react-native';
import {useAuth} from '../../context/auth-context';
import {useLocalData} from '../../context/local-data-context';
import {getAccessTokenForApi} from '../../lib/auth-access-token';
import {applyAssistantProposal} from '../../lib/apply-assistant-proposal';
import {appendAssistantExecutionLog} from '../../lib/assistant-execution-log';
import {AssistantApiError, postAssistantChat} from '../../lib/assistant-api';
import {loadAssistantChatContextPacket} from '../../lib/chat-context-loader';
import {getAppConfig} from '../../lib/config';
import {
  getLocalDatabase,
  insertChatMessage,
  loadRecentChatMessagesDecrypted,
  type LocalChatMessage,
  undoLastAppliedCreate,
} from '../../lib/local-db';
import {encryptLocalContent} from '../../lib/local-content-crypto';
import type {ProposalDraftFields} from '../../lib/merge-proposal-draft';
import {mergeProposalWithDraft} from '../../lib/merge-proposal-draft';

function proposalSummary(p: AssistantActionProposal): string {
  switch (p.type) {
    case 'create_task':
      return `Task: ${p.payload.title}`;
    case 'create_subitem':
      return `Subitem under ${p.payload.taskLocalId}: ${p.payload.title}`;
    case 'upsert_document':
      return `Document on ${p.payload.taskLocalId}: ${p.payload.title}`;
    case 'schedule_reminder':
      return `Reminder: ${p.payload.title} @ ${p.payload.remindAt}`;
    case 'update_item':
      return `Update ${p.payload.kind} ${p.payload.localId}`;
    case 'delete_item':
      return `Delete ${p.payload.kind} ${p.payload.localId}`;
    case 'noop':
      return 'No action';
  }
}

function proposalDraftSeed(p: AssistantActionProposal): ProposalDraftFields {
  switch (p.type) {
    case 'create_task':
      return {title: p.payload.title, description: p.payload.description ?? ''};
    case 'create_subitem':
      return {taskLocalId: p.payload.taskLocalId, title: p.payload.title};
    case 'upsert_document':
      return {
        taskLocalId: p.payload.taskLocalId,
        title: p.payload.title,
        documentType: p.payload.documentType ?? '',
        bodySnippet: p.payload.bodySnippet ?? '',
      };
    case 'schedule_reminder':
      return {
        title: p.payload.title,
        text: p.payload.text ?? '',
        remindAt: p.payload.remindAt,
        linkedTaskLocalId: p.payload.linkedTaskLocalId ?? '',
        linkedSubitemLocalId: p.payload.linkedSubitemLocalId ?? '',
      };
    default:
      return {};
  }
}

export default function ChatScreen() {
  const {session, isLoading, signOut} = useAuth();
  const {refresh} = useLocalData();
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<LocalChatMessage[]>([]);
  const [proposals, setProposals] = useState<AssistantActionProposal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [expandedProposalId, setExpandedProposalId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ProposalDraftFields>>({});
  const [lastClientRequestId, setLastClientRequestId] = useState<string | null>(null);
  const messagesScrollRef = useRef<ScrollView | null>(null);

  const undoHint = useMemo(() => 'Undo removes the last assistant-created task, subitem, document, or reminder.', []);

  const reloadChatMessages = useCallback(async () => {
    if (!session) return;
    try {
      const db = await getLocalDatabase();
      const rows = await loadRecentChatMessagesDecrypted(db);
      setChatMessages(rows.filter((r) => r.role === 'user' || r.role === 'assistant'));
    } catch {
      // Keep displayed history on transient DB/read errors.
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void reloadChatMessages();
    }, [reloadChatMessages]),
  );

  async function send() {
    const token = await getAccessTokenForApi();
    if (!token) {
      setError('Not signed in');
      return;
    }
    setMessage('')
    setError(null);
    setSending(true);
    setProposals([]);
    const trimmed = message.trim();
    if (!trimmed) {
      setError('Enter a message');
      setSending(false);
      return;
    }

    const clientRequestId = randomUUID();
    const createdAt = new Date().toISOString();

    try {
      const db = await getLocalDatabase();
      const userMsgId = await insertChatMessage(db, {
        role: 'user',
        bodyCipher: await encryptLocalContent(trimmed),
        clientRequestId,
        createdAt,
      });

      setChatMessages((prev) => [
        ...prev,
        {
          id: userMsgId,
          role: 'user',
          body: trimmed,
          clientRequestId,
          createdAt,
        },
      ]);

      const context = await loadAssistantChatContextPacket();

      const {apiBaseUrl} = getAppConfig();
      const res = await postAssistantChat(apiBaseUrl, token, {
        message: trimmed,
        clientRequestId,
        context,
      });

      setProposals(res.proposals);
      setLastClientRequestId(clientRequestId);

      const assistantCreatedAt = new Date().toISOString();
      const assistantMsgId = await insertChatMessage(db, {
        role: 'assistant',
        bodyCipher: await encryptLocalContent(res.reply),
        clientRequestId,
        createdAt: assistantCreatedAt,
      });

      setChatMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: 'assistant',
          body: res.reply,
          clientRequestId,
          createdAt: assistantCreatedAt,
        },
      ]);

      refresh();
    } catch (e) {
      if (e instanceof AssistantApiError) {
        setError(`${e.status}: ${e.responseBody.slice(0, 500)}`);
      } else if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('Request failed');
      }
      await reloadChatMessages();
    } finally {
      setSending(false);
    }
  }

  async function onAccept(proposal: AssistantActionProposal) {
    const merged = mergeProposalWithDraft(proposal, drafts[proposal.proposalId]);
    await appendAssistantExecutionLog({
      phase: 'chat_accept_proposal_start',
      clientRequestId: lastClientRequestId ?? null,
      proposalId: merged.proposalId,
      actionType: merged.type,
      functionOrEndpoint: 'ChatScreen.onAccept',
      payloadSummary: summarizeAssistantProposalForLog(merged),
    });
    try {
      const db = await getLocalDatabase();
      await applyAssistantProposal(db, merged, {
        clientRequestId: lastClientRequestId ?? undefined,
        messagePreview: message.trim().slice(0, 240),
      });
      await appendAssistantExecutionLog({
        phase: 'chat_accept_proposal_complete',
        clientRequestId: lastClientRequestId ?? null,
        proposalId: merged.proposalId,
        actionType: merged.type,
        functionOrEndpoint: 'ChatScreen.onAccept',
        payloadSummary: summarizeAssistantProposalForLog(merged),
        resultStatus: 'success',
      });
      setProposals((prev) => prev.filter((x) => x.proposalId !== proposal.proposalId));
      setExpandedProposalId(null);
      refresh();
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      await appendAssistantExecutionLog({
        phase: 'chat_accept_proposal_failed',
        clientRequestId: lastClientRequestId ?? null,
        proposalId: merged.proposalId,
        actionType: merged.type,
        functionOrEndpoint: 'ChatScreen.onAccept',
        payloadSummary: summarizeAssistantProposalForLog(merged),
        resultStatus: 'failure',
        errorName: err.name,
        errorMessage: err.message.slice(0, 500),
        errorStackHead: err.stack?.split('\n').slice(0, 8).join('\n'),
      });
      setError(e instanceof Error ? e.message : 'Apply failed');
    }
  }

  function toggleDraft(proposalId: string, proposal: AssistantActionProposal) {
    setExpandedProposalId((prev) => (prev === proposalId ? null : proposalId));
    setDrafts((d) => ({
      ...d,
      [proposalId]: {...proposalDraftSeed(proposal), ...d[proposalId]},
    }));
  }

  function updateDraft(proposalId: string, patch: ProposalDraftFields) {
    setDrafts((d) => ({
      ...d,
      [proposalId]: {...d[proposalId], ...patch},
    }));
  }

  useEffect(() => {
    const showEvent = 'keyboardDidShow';

    const sub = Keyboard.addListener(showEvent, () => {
      setTimeout(() => {
        messagesScrollRef.current?.scrollToEnd({animated: true});
      }, 50);
    });

    return () => sub.remove();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator/>
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
    <KeyboardAvoidingView style={{flex: 1}} behavior="height">

      <View style={styles.chatContainer}>

        <ScrollView
          ref={messagesScrollRef}
          style={styles.messagesScroll}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => messagesScrollRef.current?.scrollToEnd({animated: true})}
        >
          <Text style={styles.screenTitle}>Assistant chat</Text>
          <Text style={styles.meta}>API: {getAppConfig().apiBaseUrl}</Text>
          {chatMessages.map((row) => (
            <View
              key={row.id}
              style={[styles.messageCard, row.role === 'user' ? styles.userMessageCard : styles.assistantMessageCard]}
            >
              <Text style={styles.messageRole}>{row.role === 'user' ? 'You' : 'Assistant'}</Text>
              <Text style={styles.cardBody}>{row.body}</Text>
            </View>
          ))}
          {proposals.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Proposals</Text>
              {proposals.map((p) => (
                <View key={p.proposalId} style={styles.proposalBlock}>
                  <Text style={styles.proposalLine}>
                    • [{p.confirmationTier}] {proposalSummary(p)}
                  </Text>
                  {expandedProposalId === p.proposalId ? proposalEditors(p, drafts[p.proposalId], updateDraft) : null}
                  <View style={styles.proposalActions}>
                    {p.type !== 'noop' ? (
                      <Pressable
                        onPress={() => void onAccept(p)}
                        style={({pressed}) => [styles.miniPrimary, pressed && styles.buttonPressed]}
                      >
                        <Text style={styles.miniPrimaryLabel}>Accept</Text>
                      </Pressable>
                    ) : null}
                    {(p.type === 'create_task' ||
                      p.type === 'create_subitem' ||
                      p.type === 'upsert_document' ||
                      p.type === 'schedule_reminder') && (
                      <Pressable
                        onPress={() => toggleDraft(p.proposalId, p)}
                        style={({pressed}) => [styles.miniSecondary, pressed && styles.buttonPressed]}
                      >
                        <Text style={styles.miniSecondaryLabel}>
                          {expandedProposalId === p.proposalId ? 'Hide edit' : 'Edit'}
                        </Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => setProposals((prev) => prev.filter((x) => x.proposalId !== p.proposalId))}
                      style={({pressed}) => [styles.miniGhost, pressed && styles.buttonPressed]}
                    >
                      <Text style={styles.miniGhostLabel}>Dismiss</Text>
                    </Pressable>
                  </View>
                  {(p.type === 'update_item' || p.type === 'delete_item') && (
                    <Text style={styles.proposalHint}>Structured edits apply directly from the
                      proposal payload.</Text>
                  )}
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.composerContainer}>
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
            style={({pressed}) => [styles.button, pressed && styles.buttonPressed, sending && styles.buttonDisabled]}
          >
            {sending ? (
              <ActivityIndicator color="#fff"/>
            ) : (
              <Text style={styles.buttonLabel}>Send</Text>
            )}
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </View>
    </KeyboardAvoidingView>

  );
}

function proposalEditors(
  p: AssistantActionProposal,
  draft: ProposalDraftFields | undefined,
  updateDraft: (proposalId: string, patch: ProposalDraftFields) => void,
) {
  const seed = proposalDraftSeed(p);
  const d = {...seed, ...draft};

  switch (p.type) {
    case 'create_task':
      return (
        <View style={styles.editBox}>
          <Text style={styles.editLabel}>Title</Text>
          <TextInput
            style={styles.editInput}
            value={d.title ?? ''}
            onChangeText={(t) => updateDraft(p.proposalId, {title: t})}
          />
          <Text style={styles.editLabel}>Description</Text>
          <TextInput
            multiline
            style={[styles.editInput, styles.editMultiline]}
            value={d.description ?? ''}
            onChangeText={(t) => updateDraft(p.proposalId, {description: t})}
          />
        </View>
      );
    case 'create_subitem':
      return (
        <View style={styles.editBox}>
          <Text style={styles.editLabel}>Parent task local id</Text>
          <TextInput
            style={styles.editInput}
            value={d.taskLocalId ?? ''}
            onChangeText={(t) => updateDraft(p.proposalId, {taskLocalId: t})}
          />
          <Text style={styles.editLabel}>Title</Text>
          <TextInput
            style={styles.editInput}
            value={d.title ?? ''}
            onChangeText={(t) => updateDraft(p.proposalId, {title: t})}
          />
        </View>
      );
    case 'upsert_document':
      return (
        <View style={styles.editBox}>
          <Text style={styles.editLabel}>Task local id</Text>
          <TextInput
            style={styles.editInput}
            value={d.taskLocalId ?? ''}
            onChangeText={(t) => updateDraft(p.proposalId, {taskLocalId: t})}
          />
          <Text style={styles.editLabel}>Title</Text>
          <TextInput
            style={styles.editInput}
            value={d.title ?? ''}
            onChangeText={(t) => updateDraft(p.proposalId, {title: t})}
          />
          <Text style={styles.editLabel}>Document type</Text>
          <TextInput
            style={styles.editInput}
            value={d.documentType ?? ''}
            onChangeText={(t) => updateDraft(p.proposalId, {documentType: t})}
          />
          <Text style={styles.editLabel}>Snippet</Text>
          <TextInput
            multiline
            style={[styles.editInput, styles.editMultiline]}
            value={d.bodySnippet ?? ''}
            onChangeText={(t) => updateDraft(p.proposalId, {bodySnippet: t})}
          />
        </View>
      );
    case 'schedule_reminder':
      return (
        <View style={styles.editBox}>
          <Text style={styles.editLabel}>Title</Text>
          <TextInput
            style={styles.editInput}
            value={d.title ?? ''}
            onChangeText={(t) => updateDraft(p.proposalId, {title: t})}
          />
          <Text style={styles.editLabel}>Text</Text>
          <TextInput
            style={styles.editInput}
            value={d.text ?? ''}
            onChangeText={(t) => updateDraft(p.proposalId, {text: t})}
          />
          <Text style={styles.editLabel}>Remind at (ISO datetime)</Text>
          <TextInput
            style={styles.editInput}
            value={d.remindAt ?? ''}
            onChangeText={(t) => updateDraft(p.proposalId, {remindAt: t})}
          />
          <Text style={styles.editLabel}>Linked task local id (optional)</Text>
          <TextInput
            style={styles.editInput}
            value={d.linkedTaskLocalId ?? ''}
            onChangeText={(t) => updateDraft(p.proposalId, {linkedTaskLocalId: t})}
          />
          <Text style={styles.editLabel}>Linked subitem local id (optional)</Text>
          <TextInput
            style={styles.editInput}
            value={d.linkedSubitemLocalId ?? ''}
            onChangeText={(t) => updateDraft(p.proposalId, {linkedSubitemLocalId: t})}
          />
        </View>
      );
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  chatContainer: {
    flex: 1,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    gap: 14,
    padding: 20,
    paddingBottom: 16,
  },
  screenTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '800',
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
    maxHeight: 140,
    minHeight: 88,
    padding: 12,
    textAlignVertical: 'top',
  },
  composerContainer: {
    backgroundColor: '#f8fafc',
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    gap: 10,
    padding: 16,
    paddingBottom: 20,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#101828',
    borderRadius: 14,
    paddingVertical: 14,
  },
  buttonPressed: {opacity: 0.92},
  buttonDisabled: {opacity: 0.6},
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
  hint: {
    color: '#64748b',
    fontSize: 12,
    marginTop: -4,
  },
  messageCard: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  userMessageCard: {
    alignSelf: 'flex-end',
    backgroundColor: '#e0efff',
    borderColor: '#bfdbfe',
    maxWidth: '92%',
  },
  assistantMessageCard: {
    alignSelf: 'stretch',
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
  },
  messageRole: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
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
  proposalBlock: {
    borderTopColor: '#f1f5f9',
    borderTopWidth: 1,
    gap: 8,
    paddingTop: 10,
  },
  proposalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  proposalHint: {
    color: '#94a3b8',
    fontSize: 12,
  },
  miniPrimary: {
    backgroundColor: '#101828',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  miniPrimaryLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  miniSecondary: {
    borderColor: '#cbd5e1',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  miniSecondaryLabel: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  miniGhost: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  miniGhostLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  editBox: {
    gap: 8,
    marginTop: 8,
  },
  editLabel: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  editInput: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 14,
    padding: 10,
  },
  editMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  link: {marginTop: 4},
  linkText: {
    color: '#1d4ed8',
    fontSize: 15,
    fontWeight: '600',
  },
});
