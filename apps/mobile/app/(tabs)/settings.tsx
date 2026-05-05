import { useFocusEffect } from '@react-navigation/native';
import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Purchases from 'react-native-purchases';
import { subscriptionPlans, type GetSubscriptionResponse } from '@personal-assistant/shared';
import { useAuth } from '../../context/auth-context';
import { getAccessTokenForApi } from '../../lib/auth-access-token';
import { BillingApiError, fetchBillingEntitlement } from '../../lib/billing-api';
import { getAppConfig } from '../../lib/config';
import { getBroaderContextConsent, setBroaderContextConsent } from '../../lib/context-consent-storage';
import { readCachedEntitlement, writeCachedEntitlement } from '../../lib/entitlement-cache';
import { ensurePurchasesConfigured } from '../../lib/revenuecat-session';

function isPaidPlan(planId: string): boolean {
  return planId === 'plus' || planId === 'pro';
}

function formatRenewal(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const config = getAppConfig();
  const [broaderContext, setBroaderContext] = useState(false);
  const [entitlement, setEntitlement] = useState<GetSubscriptionResponse | null>(null);
  const [entitlementLoading, setEntitlementLoading] = useState(false);
  const [entitlementError, setEntitlementError] = useState<string | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);

  useEffect(() => {
    void getBroaderContextConsent().then(setBroaderContext);
  }, []);

  const loadEntitlement = useCallback(async () => {
    setEntitlementError(null);
    const cached = await readCachedEntitlement();
    if (cached) {
      setEntitlement(cached);
    }
    if (!session) {
      setEntitlement(null);
      return;
    }
    const token = await getAccessTokenForApi();
    if (!token) {
      setEntitlementError('Could not read session token.');
      return;
    }
    setEntitlementLoading(true);
    try {
      const snap = await fetchBillingEntitlement(config.apiBaseUrl, token);
      setEntitlement(snap);
      await writeCachedEntitlement(snap);
    } catch (e) {
      if (e instanceof BillingApiError && e.status === 401) {
        setEntitlementError('Session expired. Sign in again.');
      } else {
        setEntitlementError(e instanceof Error ? e.message : 'Could not load subscription.');
      }
    } finally {
      setEntitlementLoading(false);
    }
  }, [config.apiBaseUrl, session]);

  useFocusEffect(
    useCallback(() => {
      void loadEntitlement();
    }, [loadEntitlement]),
  );

  const onManageSubscription = async () => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      Alert.alert('Not available', 'Open subscription settings from an iOS or Android device.');
      return;
    }
    ensurePurchasesConfigured();
    if (!config.revenueCatApiKey) {
      Alert.alert(
        'Store not configured',
        'Add your RevenueCat public API key (EXPO_PUBLIC_REVENUECAT_IOS_API_KEY or EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY), then rebuild the native app.',
      );
      return;
    }
    try {
      await Purchases.showManageSubscriptions();
    } catch (e) {
      Alert.alert('Could not open subscriptions', e instanceof Error ? e.message : String(e));
    }
  };

  const onRestorePurchases = async () => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      Alert.alert('Not available', 'Restore is only supported on iOS and Android.');
      return;
    }
    setRestoreBusy(true);
    try {
      ensurePurchasesConfigured();
      if (!config.revenueCatApiKey) {
        Alert.alert('Store not configured', 'Add RevenueCat API keys to enable restore.');
        return;
      }
      await Purchases.restorePurchases();
      await Purchases.syncPurchasesForResult();
      await loadEntitlement();
      Alert.alert('Restore complete', 'Subscription status has been refreshed.');
    } catch (e) {
      Alert.alert('Restore failed', e instanceof Error ? e.message : String(e));
    } finally {
      setRestoreBusy(false);
    }
  };

  const planId = entitlement?.entitlement.planId ?? 'free';
  const status = entitlement?.entitlement.status ?? 'FREE';
  const freePlan = subscriptionPlans.find((p) => p.id === 'free');
  const paid = isPaidPlan(planId);
  const renewalLabel = formatRenewal(entitlement?.entitlement.expiresAt ?? null);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.sub}>API: {getAppConfig().apiBaseUrl}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Subscription</Text>
        {!session ? (
          <Text style={styles.cardBody}>Sign in to see your plan and sync purchases with your account.</Text>
        ) : (
          <>
            {entitlementLoading && !entitlement ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator />
                <Text style={styles.cardBody}>Loading plan…</Text>
              </View>
            ) : (
              <>
                {paid ? (
                  <>
                    <Text style={styles.planBadge}>Pro plan</Text>
                    {status === 'PAST_DUE' ? (
                      <Text style={styles.warn}>
                        We could not confirm your latest payment. Update your payment method in the store
                        subscription settings.
                      </Text>
                    ) : null}
                    <Text style={styles.cardBody}>
                      Status: {status.replace(/_/g, ' ')}
                      {renewalLabel ? `\nRenews or ends: ${renewalLabel}` : ''}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.planBadgeMuted}>Free plan</Text>
                    <Text style={styles.cardBody}>
                      {freePlan
                        ? `Includes about ${freePlan.monthlyMessageLimit} assistant messages per month (enforced on the server).`
                        : 'Upgrade for higher limits and premium features.'}
                    </Text>
                    <Link href="/paywall" asChild>
                      <Pressable style={({ pressed }) => [styles.primaryCta, pressed && styles.pressed]}>
                        <Text style={styles.primaryCtaLabel}>Upgrade to Pro</Text>
                      </Pressable>
                    </Link>
                  </>
                )}
              </>
            )}
            {entitlementError ? <Text style={styles.error}>{entitlementError}</Text> : null}
            {paid ? (
              <>
                <Pressable
                  onPress={() => void onManageSubscription()}
                  style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
                >
                  <Text style={styles.secondaryLabel}>Manage subscription</Text>
                </Pressable>
                <Pressable
                  onPress={() => void onRestorePurchases()}
                  disabled={restoreBusy}
                  style={({ pressed }) => [styles.secondary, pressed && styles.pressed, restoreBusy && styles.disabled]}
                >
                  {restoreBusy ? (
                    <ActivityIndicator />
                  ) : (
                    <Text style={styles.secondaryLabel}>Restore purchases</Text>
                  )}
                </Pressable>
              </>
            ) : session ? (
              <Pressable
                onPress={() => void onRestorePurchases()}
                disabled={restoreBusy}
                style={({ pressed }) => [styles.secondary, pressed && styles.pressed, restoreBusy && styles.disabled]}
              >
                {restoreBusy ? (
                  <ActivityIndicator />
                ) : (
                  <Text style={styles.secondaryLabel}>Restore purchases</Text>
                )}
              </Pressable>
            ) : null}
          </>
        )}
      </View>

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
  inlineRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  planBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ecfdf5',
    borderRadius: 8,
    color: '#047857',
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  planBadgeMuted: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  primaryCta: {
    alignItems: 'center',
    backgroundColor: '#1d4ed8',
    borderRadius: 14,
    marginTop: 4,
    paddingVertical: 12,
  },
  primaryCtaLabel: { color: '#fff', fontSize: 15, fontWeight: '700' },
  error: { color: '#b91c1c', fontSize: 13 },
  warn: { color: '#b45309', fontSize: 14, lineHeight: 20 },
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
    marginTop: 4,
    paddingVertical: 12,
  },
  pressed: { opacity: 0.92 },
  disabled: { opacity: 0.55 },
  secondaryLabel: { color: '#334155', fontSize: 15, fontWeight: '600' },
});
