
Here’s a Commity-specific version of the same plan (product name + entitlement naming), without repeating the full generic essay.

Naming in RevenueCat (Commity)

• Entitlement (example identifier): commity_pro
• Display name in dashboard can be “Commity Pro”; the identifier is what your code checks.
• Offering: e.g. default (set as current).
• Packages in that offering: map to your store products
• monthly, yearly, lifetime (these are your store product IDs; keep them identical on iOS/Android when possible).

In code, use one constant everywhere:

export const COMMITY_PRO_ENTITLEMENT = 'commity_pro';

If Commity is Expo (very likely for modern RN apps)

1. Install dev client + SDKs (RevenueCat Expo doc: Expo installation (https://www.revenuecat.com/docs/getting-started/installation/expo)):

npx expo install expo-dev-client
npx expo install react-native-purchases react-native-purchases-ui

2. Real purchases need a development build (not Expo Go for full native IAP). After native install, use EAS as in that doc.

3. Keys in .env (do not commit):

EXPO_PUBLIC_RC_IOS_API_KEY=...
EXPO_PUBLIC_RC_ANDROID_API_KEY=...

Use separate iOS/Android public SDK keys from RevenueCat → Project settings → API keys.

4. At startup: Purchases.configure with the right key per Platform.OS, then optional Purchases.logIn(commityUserId) when the user signs in.

5. Pro check:

const info = await Purchases.getCustomerInfo();
const isPro = typeof info.entitlements.active[COMMITY_PRO_ENTITLEMENT] !== 'undefined';

6. Paywall (UI package): RevenueCatUI.presentPaywallIfNeeded({ requiredEntitlementIdentifier: COMMITY_PRO_ENTITLEMENT }) — see Displaying Paywalls
   (https://www.revenuecat.com/docs/tools/paywalls/displaying-paywalls).

7. Customer Center (optional): RevenueCatUI.presentCustomerCenter() — plan limits noted in Customer Center (https://www.revenuecat.com/docs/tools/customer-center); RN API in Customer Center React Native
   (https://www.revenuecat.com/docs/tools/customer-center/customer-center-react-native).

If Commity is bare React Native

Use npm install react-native-purchases react-native-purchases-ui, pod install, and follow React Native installation (https://www.revenuecat.com/docs/getting-started/installation/reactnative). The JS code
(configure, entitlement id, paywall) is the same idea.

────────────────────────────────────────

To tailor this to your repo exactly, I need one line from you: Is Commity on Expo (with app.json / expo-router) or bare RN? If you paste your package.json dependencies block (no secrets), I’ll align file paths
(e.g. app/_layout.tsx vs App.tsx) and auth hook (logIn after Supabase session).
