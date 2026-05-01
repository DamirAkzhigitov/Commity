import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useAuth } from '../../context/auth-context';
import { getBroaderContextConsent, setBroaderContextConsent } from '../../lib/context-consent-storage';
import { getAppConfig } from '../../lib/config';

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const [broaderContext, setBroaderContext] = useState(false);

  useEffect(() => {
    void getBroaderContextConsent().then(setBroaderContext);
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.sub}>API: {getAppConfig().apiBaseUrl}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Session</Text>
        <Text style={styles.cardBody}>
          {session ? `Signed in${session.user?.email ? `: ${session.user.email}` : ''}` : 'Not signed in'}
        </Text>
        {!session ? (
          <Link href="/sign-in" style={styles.link}>
            <Text style={styles.linkText}>Go to sign in</Text>
          </Link>
        ) : (
          <Pressable
            onPress={() => void signOut()}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryLabel}>Sign out</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Assistant context privacy</Text>
        <Text style={styles.cardBody}>
          Local-only rows stay off the outbound context packet unless you enable this. Items marked local-only are
          never sent with includeInAi true (they stay off-model).
        </Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Include local-only in context packet shape</Text>
          <Switch
            value={broaderContext}
            onValueChange={(v) => {
              setBroaderContext(v);
              void setBroaderContextConsent(v);
            }}
          />
        </View>
      </View>

      <Link href="/" style={styles.link}>
        <Text style={styles.linkText}>Marketing home</Text>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 16, padding: 20, paddingBottom: 40 },
  title: { color: '#0f172a', fontSize: 22, fontWeight: '800' },
  sub: { color: '#64748b', fontSize: 13 },
  card: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
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
  switchLabel: { color: '#334155', flex: 1, fontSize: 14 },
  link: { marginTop: 4 },
  linkText: { color: '#1d4ed8', fontSize: 15, fontWeight: '600' },
  secondary: {
    alignItems: 'center',
    borderColor: '#cbd5e1',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
    paddingVertical: 12,
  },
  pressed: { opacity: 0.92 },
  secondaryLabel: { color: '#334155', fontSize: 15, fontWeight: '600' },
});
