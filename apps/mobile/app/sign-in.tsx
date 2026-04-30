import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../context/auth-context';

export default function SignInScreen() {
  const router = useRouter();
  const { signInWithPassword, isLoading, isSupabaseConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Supabase not configured</Text>
        <Text style={styles.hint}>
          Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in apps/mobile/.env (see
          repo .env.example).
        </Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Back home</Text>
        </Link>
      </View>
    );
  }

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      const { error: e } = await signInWithPassword(email.trim(), password);
      if (e) {
        setError(e.message);
        return;
      }
      router.replace('/chat');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="you@example.com"
          style={styles.input}
          value={email}
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          style={styles.input}
          value={password}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          disabled={busy}
          onPress={() => void onSubmit()}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, busy && styles.buttonDisabled]}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonLabel}>Sign in</Text>
          )}
        </Pressable>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Back home</Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
    fontSize: 20,
    fontWeight: '700',
  },
  hint: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  error: {
    color: '#b91c1c',
    fontSize: 14,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#1d4ed8',
    borderRadius: 14,
    paddingVertical: 14,
  },
  buttonPressed: { opacity: 0.9 },
  buttonDisabled: { opacity: 0.6 },
  buttonLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  link: { marginTop: 8 },
  linkText: {
    color: '#1d4ed8',
    fontSize: 15,
    fontWeight: '600',
  },
});
