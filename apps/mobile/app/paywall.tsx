import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Purchases, { PURCHASES_ERROR_CODE } from 'react-native-purchases';
import { useAuth } from '../context/auth-context';
import { fetchBillingEntitlement } from '../lib/billing-api';
import { getAppConfig } from '../lib/config';
import { writeCachedEntitlement } from '../lib/entitlement-cache';
import { getAccessTokenForApi } from '../lib/auth-access-token';
import { ensurePurchasesConfigured } from '../lib/revenuecat-session';

function pickDefaultPackage(offerings: Awaited<ReturnType<typeof Purchases.getOfferings>>) {
  const current = offerings.current;
  if (!current?.availablePackages?.length) {
    return null;
  }
  const pkgs = current.availablePackages;
  const monthly = pkgs.find((p) => p.packageType === Purchases.PACKAGE_TYPE.MONTHLY);
  const annual = pkgs.find((p) => p.packageType === Purchases.PACKAGE_TYPE.ANNUAL);
  return monthly ?? annual ?? pkgs[0] ?? null;
}

export default function PaywallScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const config = getAppConfig();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceLabel, setPriceLabel] = useState<string | null>(null);

  const refreshOffering = useCallback(async () => {
    setError(null);
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      setLoading(false);
      setError('In-app purchases are only available on iOS and Android builds.');
      return;
    }
    if (!config.revenueCatApiKey) {
      setLoading(false);
      setError('RevenueCat is not configured. Set EXPO_PUBLIC_REVENUECAT_IOS_API_KEY or EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY.');
      return;
    }
    ensurePurchasesConfigured();
    if (!session) {
      setLoading(false);
      setError('Sign in to subscribe.');
      return;
    }
    try {
      const offerings = await Purchases.getOfferings();
      const pkg = pickDefaultPackage(offerings);
      setPriceLabel(pkg?.product.priceString ?? null);
      if (!pkg) {
        setError('No subscription packages are available yet. Check RevenueCat offerings.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load subscription packages.');
    } finally {
      setLoading(false);
    }
  }, [config.revenueCatApiKey, session]);

  useEffect(() => {
    void refreshOffering();
  }, [refreshOffering]);

  const syncBackendEntitlement = async () => {
    const token = await getAccessTokenForApi();
    if (!token) return;
    const snap = await fetchBillingEntitlement(config.apiBaseUrl, token);
    await writeCachedEntitlement(snap);
  };

  const onPurchase = async () => {
    if (!session) {
      Alert.alert('Sign in required', 'Create an account or sign in before purchasing.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      ensurePurchasesConfigured();
      const offerings = await Purchases.getOfferings();
      const pkg = pickDefaultPackage(offerings);
      if (!pkg) {
        setError('No package to purchase.');
        return;
      }
      await Purchases.purchasePackage(pkg);
      await Purchases.syncPurchasesForResult();
      await syncBackendEntitlement();
      Alert.alert('Thank you', 'Your purchase completed. Subscription status may take a moment to update.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: unknown) {
      const err = e as { code?: string; userCancelled?: boolean };
      if (err.userCancelled || err.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        return;
      }
      setError(e instanceof Error ? e.message : 'Purchase failed.');
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async () => {
    setBusy(true);
    setError(null);
    try {
      ensurePurchasesConfigured();
      await Purchases.restorePurchases();
      await Purchases.syncPurchasesForResult();
      await syncBackendEntitlement();
      Alert.alert('Restore complete', 'If you had an active subscription, it should appear in Settings shortly.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Upgrade to Pro</Text>
      <Text style={styles.body}>
        Unlock higher AI quotas and premium features. Purchases are processed by Apple or Google; the backend updates
        your plan after RevenueCat confirms the subscription.
      </Text>

      {priceLabel ? (
        <Text style={styles.price}>From {priceLabel} (store pricing may vary)</Text>
      ) : null}

      {loading ? (
        <View style={styles.rowCenter}>
          <ActivityIndicator />
          <Text style={styles.muted}>Loading packages…</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        onPress={() => void onPurchase()}
        disabled={busy || loading || !session}
        style={({ pressed }) => [styles.primary, (busy || loading || !session) && styles.disabled, pressed && styles.pressed]}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryLabel}>Subscribe</Text>}
      </Pressable>

      <Pressable
        onPress={() => void onRestore()}
        disabled={busy}
        style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
      >
        <Text style={styles.secondaryLabel}>Restore purchases</Text>
      </Pressable>

      <View style={styles.legal}>
        <Text style={styles.muted}>By subscribing you agree to our </Text>
        <Text style={styles.linkInline} onPress={() => void Linking.openURL(config.termsOfServiceUrl)}>
          Terms of Service
        </Text>
        <Text style={styles.muted}> and </Text>
        <Text style={styles.linkInline} onPress={() => void Linking.openURL(config.privacyPolicyUrl)}>
          Privacy Policy
        </Text>
        <Text style={styles.muted}>.</Text>
      </View>

      <Link href="/settings" style={styles.backLink}>
        <Text style={styles.backLinkText}>Back to Settings</Text>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 14, padding: 20, paddingBottom: 40 },
  title: { color: '#0f172a', fontSize: 22, fontWeight: '800' },
  body: { color: '#475569', fontSize: 15, lineHeight: 22 },
  price: { color: '#0f172a', fontSize: 16, fontWeight: '700' },
  rowCenter: { alignItems: 'center', flexDirection: 'row', gap: 10, marginVertical: 8 },
  muted: { color: '#64748b', fontSize: 14 },
  error: { color: '#b91c1c', fontSize: 14 },
  primary: {
    alignItems: 'center',
    backgroundColor: '#1d4ed8',
    borderRadius: 14,
    marginTop: 8,
    paddingVertical: 14,
  },
  primaryLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondary: {
    alignItems: 'center',
    borderColor: '#cbd5e1',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
  },
  secondaryLabel: { color: '#334155', fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.92 },
  legal: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  linkInline: { color: '#1d4ed8', fontSize: 14, fontWeight: '600' },
  backLink: { marginTop: 12 },
  backLinkText: { color: '#1d4ed8', fontSize: 15, fontWeight: '600' },
});
