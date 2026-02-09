# Apple Subscription Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add RevenueCat-powered Apple subscription ($2.99/mo + 7-day free trial) that gates voice cooking behind credit limits.

**Architecture:** RevenueCat SDK on client handles the App Store purchase flow. A Firebase Cloud Function webhook receives RevenueCat events and keeps Firestore subscription fields in sync. The existing `voiceQuota.ts` enforces credit limits server-side — no changes needed there. A Zustand store on the client hydrates from both RevenueCat and Firestore for optimistic UI gating.

**Tech Stack:** `react-native-purchases` (RevenueCat), Firebase Cloud Functions v1, Firestore, Zustand, Expo Router

**Design doc:** `docs/plans/2026-02-09-apple-subscription-design.md`

---

### Task 1: Install RevenueCat SDK

**Files:**
- Modify: `package.json`

**Step 1: Install the package**

Run: `npx expo install react-native-purchases`

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-native-purchases (RevenueCat SDK)"
```

---

### Task 2: Subscription Service (RevenueCat wrapper)

**Files:**
- Create: `src/services/subscriptionService.ts`
- Modify: `app.json` (add RevenueCat API key to extra/eas config if needed)

**Step 1: Create `src/services/subscriptionService.ts`**

```typescript
import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
  LOG_LEVEL,
} from 'react-native-purchases';
import Constants from 'expo-constants';

const REVENUECAT_API_KEY_IOS =
  Constants.expoConfig?.extra?.revenueCatApiKeyIos ?? '';

const ENTITLEMENT_PRO = 'pro';

let configured = false;

export async function configureRevenueCat(): Promise<void> {
  if (configured) return;
  if (!REVENUECAT_API_KEY_IOS) {
    console.warn('[RevenueCat] No API key configured, skipping init');
    return;
  }

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  Purchases.configure({ apiKey: REVENUECAT_API_KEY_IOS });
  configured = true;
}

export async function loginRevenueCat(uid: string): Promise<void> {
  if (!configured) return;
  await Purchases.logIn(uid);
}

export async function logoutRevenueCat(): Promise<void> {
  if (!configured) return;
  if (await Purchases.isAnonymous()) return;
  await Purchases.logOut();
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  return Purchases.getCustomerInfo();
}

export function hasProEntitlement(info: CustomerInfo | null): boolean {
  if (!info) return false;
  return typeof info.entitlements.active[ENTITLEMENT_PRO] !== 'undefined';
}

export async function fetchOfferings(): Promise<PurchasesPackage | null> {
  if (!configured) return null;
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages[0] ?? null;
}

export async function purchaseProPackage(): Promise<CustomerInfo | null> {
  const pkg = await fetchOfferings();
  if (!pkg) return null;
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  return Purchases.restorePurchases();
}
```

**Step 2: Add placeholder API key to `app.json`**

Inside the existing `expo.extra` section, add:

```json
"revenueCatApiKeyIos": ""
```

This stays empty in source control. The real key is set in EAS build secrets or local `.env`.

**Step 3: Commit**

```bash
git add src/services/subscriptionService.ts app.json
git commit -m "feat: add RevenueCat subscription service wrapper"
```

---

### Task 3: Subscription Zustand Store

**Files:**
- Create: `src/stores/subscriptionStore.ts`

**Step 1: Create `src/stores/subscriptionStore.ts`**

```typescript
import { create } from 'zustand';
import { doc, getDoc, getFirestore } from '@react-native-firebase/firestore';
import {
  configureRevenueCat,
  getCustomerInfo,
  hasProEntitlement,
  loginRevenueCat,
  logoutRevenueCat,
} from '@/src/services/subscriptionService';

type Plan = 'trial' | 'pro' | 'expired';
type Status = 'active' | 'trialing' | 'inactive' | 'canceled' | 'billing_issue';

interface SubscriptionState {
  plan: Plan;
  status: Status;
  creditsUsed: number;
  creditsLimit: number;
  trialEndsAt: Date | null;
  isLoading: boolean;
}

interface SubscriptionActions {
  hydrate: (uid: string) => Promise<void>;
  refresh: (uid: string) => Promise<void>;
  reset: () => void;
}

function canUseVoice(state: SubscriptionState): boolean {
  const remaining = state.creditsLimit - state.creditsUsed;
  if (remaining <= 0) return false;

  if (state.plan === 'pro' && state.status === 'active') return true;

  if (state.plan === 'trial') {
    if (!state.trialEndsAt) return false;
    return new Date() <= state.trialEndsAt;
  }

  return false;
}

const INITIAL_STATE: SubscriptionState = {
  plan: 'expired',
  status: 'inactive',
  creditsUsed: 0,
  creditsLimit: 0,
  trialEndsAt: null,
  isLoading: true,
};

export const useSubscriptionStore = create<
  SubscriptionState & SubscriptionActions & { canUseVoice: boolean }
>((set, get) => ({
  ...INITIAL_STATE,
  canUseVoice: false,

  hydrate: async (uid: string) => {
    set({ isLoading: true });

    try {
      // 1. Initialize RevenueCat & associate with Firebase UID
      await configureRevenueCat();
      await loginRevenueCat(uid);

      // 2. Check RevenueCat entitlement
      const info = await getCustomerInfo();
      const hasPro = hasProEntitlement(info);

      // 3. Fetch Firestore profile for trial + credit data
      const db = getFirestore();
      const userSnap = await getDoc(doc(db, 'users', uid));
      const userData = userSnap.data();

      // Determine plan
      let plan: Plan = 'expired';
      let status: Status = 'inactive';
      const trialEndsAt = userData?.trialEndsAt?.toDate?.() ?? null;

      if (hasPro) {
        plan = 'pro';
        status = 'active';
      } else if (trialEndsAt && new Date() <= trialEndsAt) {
        plan = 'trial';
        status = 'trialing';
      }

      // Fetch voice usage for current month
      const now = new Date();
      const cycleKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      const usageSnap = await getDoc(
        doc(db, 'users', uid, 'voiceUsage', cycleKey),
      );
      const usageData = usageSnap.data();
      const creditsUsed = usageData?.totalCredits ?? 0;

      // Determine limit based on plan
      const LIMITS = { trial: 1200, pro: 12000, expired: 0 } as const;
      const creditsLimit = LIMITS[plan];

      const newState: SubscriptionState = {
        plan,
        status,
        creditsUsed,
        creditsLimit,
        trialEndsAt,
        isLoading: false,
      };

      set({ ...newState, canUseVoice: canUseVoice(newState) });
    } catch (error) {
      console.error('[SubscriptionStore] hydrate failed:', error);
      set({ isLoading: false });
    }
  },

  refresh: async (uid: string) => {
    // Lightweight: just re-read Firestore usage + check entitlement
    try {
      const info = await getCustomerInfo();
      const hasPro = hasProEntitlement(info);

      const db = getFirestore();
      const now = new Date();
      const cycleKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      const usageSnap = await getDoc(
        doc(db, 'users', uid, 'voiceUsage', cycleKey),
      );
      const creditsUsed = usageSnap.data()?.totalCredits ?? 0;

      const current = get();
      let plan = current.plan;
      let status = current.status;

      if (hasPro && plan !== 'pro') {
        plan = 'pro';
        status = 'active';
      } else if (!hasPro && plan === 'pro') {
        // Subscription lapsed — check trial
        const trialEndsAt = current.trialEndsAt;
        if (trialEndsAt && new Date() <= trialEndsAt) {
          plan = 'trial';
          status = 'trialing';
        } else {
          plan = 'expired';
          status = 'inactive';
        }
      }

      const LIMITS = { trial: 1200, pro: 12000, expired: 0 } as const;
      const creditsLimit = LIMITS[plan];

      const newState: SubscriptionState = {
        ...current,
        plan,
        status,
        creditsUsed,
        creditsLimit,
        isLoading: false,
      };

      set({ ...newState, canUseVoice: canUseVoice(newState) });
    } catch (error) {
      console.error('[SubscriptionStore] refresh failed:', error);
    }
  },

  reset: () => {
    logoutRevenueCat().catch(() => {});
    set({ ...INITIAL_STATE, canUseVoice: false });
  },
}));
```

**Step 2: Commit**

```bash
git add src/stores/subscriptionStore.ts
git commit -m "feat: add subscription Zustand store with RevenueCat + Firestore hydration"
```

---

### Task 4: Initialize RevenueCat in Root Layout

**Files:**
- Modify: `app/_layout.tsx`

**Step 1: Import subscription store and add hydration**

In `app/_layout.tsx`, add the hydration call inside the `AuthGate` component. When the user authenticates (and profile loads), hydrate the subscription store.

At the top of the file, add import:
```typescript
import { useSubscriptionStore } from '@/src/stores/subscriptionStore';
```

Inside `AuthGate()`, after the existing `useEffect` that fetches onboarding status (after line 46), add:

```typescript
  const hydrateSubscription = useSubscriptionStore((s) => s.hydrate);
  const resetSubscription = useSubscriptionStore((s) => s.reset);

  // Hydrate subscription state when user authenticates
  useEffect(() => {
    if (!user) {
      resetSubscription();
      return;
    }
    void hydrateSubscription(user.uid);
  }, [user?.uid]);
```

**Step 2: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: hydrate subscription store on auth in root layout"
```

---

### Task 5: RevenueCat Webhook Cloud Function

**Files:**
- Create: `functions/src/revenueCatWebhook.ts`
- Modify: `functions/src/index.ts`

**Step 1: Create `functions/src/revenueCatWebhook.ts`**

```typescript
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Set this in Firebase config: firebase functions:config:set revenuecat.webhook_secret="your_secret"
// Or use environment variables in 2nd gen functions.
const WEBHOOK_SECRET = functions.config().revenuecat?.webhook_secret ?? '';

type RevenueCatEvent = {
  type: string;
  app_user_id: string;
  expiration_at_ms?: number;
  event_timestamp_ms?: number;
};

type RevenueCatPayload = {
  api_version: string;
  event: RevenueCatEvent;
};

const PLAN_UPDATES: Record<string, Partial<{
  subscriptionPlan: string;
  subscriptionStatus: string;
}>> = {
  INITIAL_PURCHASE: { subscriptionPlan: 'pro', subscriptionStatus: 'active' },
  RENEWAL: { subscriptionStatus: 'active' },
  CANCELLATION: { subscriptionStatus: 'canceled' },
  UNCANCELLATION: { subscriptionStatus: 'active' },
  EXPIRATION: { subscriptionPlan: 'free', subscriptionStatus: 'inactive' },
  BILLING_ISSUE_DETECTED: { subscriptionStatus: 'billing_issue' },
  SUBSCRIBER_ALIAS: {},
};

export const handleRevenueCatWebhook = functions.https.onRequest(
  async (req, res) => {
    // Only accept POST
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    // Validate webhook secret
    const authHeader = req.headers.authorization ?? '';
    if (WEBHOOK_SECRET && authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
      functions.logger.warn('[RevenueCat] Invalid webhook secret');
      res.status(401).send('Unauthorized');
      return;
    }

    const body = req.body as RevenueCatPayload;
    const event = body?.event;

    if (!event?.type || !event?.app_user_id) {
      functions.logger.warn('[RevenueCat] Malformed event:', body);
      res.status(400).send('Bad Request');
      return;
    }

    const uid = event.app_user_id;
    const eventType = event.type;

    functions.logger.info(
      `[RevenueCat] ${eventType} for user ${uid}`,
    );

    const update = PLAN_UPDATES[eventType];
    if (!update || Object.keys(update).length === 0) {
      // No-op event type (e.g. SUBSCRIBER_ALIAS)
      res.status(200).send('OK');
      return;
    }

    const userRef = db.collection('users').doc(uid);

    try {
      await userRef.update({
        ...update,
        subscriptionUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // On RENEWAL, reset the current month's voice usage
      if (eventType === 'RENEWAL') {
        const now = new Date();
        const cycleKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
        const usageRef = userRef.collection('voiceUsage').doc(cycleKey);

        await usageRef.set(
          {
            totalCredits: 0,
            features: { stt: 0, tts: 0, chat: 0 },
            plan: 'pro',
            limit: 12000,
            resetAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: false },
        );
      }

      res.status(200).send('OK');
    } catch (error) {
      functions.logger.error('[RevenueCat] Firestore update failed:', error);
      res.status(500).send('Internal Error');
    }
  },
);
```

**Step 2: Export from `functions/src/index.ts`**

Add this line:
```typescript
export { handleRevenueCatWebhook } from './revenueCatWebhook';
```

**Step 3: Commit**

```bash
git add functions/src/revenueCatWebhook.ts functions/src/index.ts
git commit -m "feat: add RevenueCat webhook Cloud Function for subscription sync"
```

---

### Task 6: PaywallSheet Component

**Files:**
- Create: `src/components/PaywallSheet.tsx`

**Step 1: Create `src/components/PaywallSheet.tsx`**

```typescript
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import {
  purchaseProPackage,
  restorePurchases,
  hasProEntitlement,
} from '@/src/services/subscriptionService';
import { useSubscriptionStore } from '@/src/stores/subscriptionStore';
import { useAuthStore } from '@/src/stores/authStore';

type PaywallSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSubscribed?: () => void;
};

const FEATURES = [
  { icon: 'mic-outline' as const, text: 'Hands-free voice cooking' },
  { icon: 'swap-horizontal-outline' as const, text: 'Smart ingredient substitutions' },
  { icon: 'footsteps-outline' as const, text: 'Step-by-step voice guidance' },
];

const chefHatIcon = require('@/assets/images/chefhat-icon.png');

export default function PaywallSheet({
  visible,
  onClose,
  onSubscribed,
}: PaywallSheetProps) {
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const uid = useAuthStore((s) => s.user?.uid);
  const hydrate = useSubscriptionStore((s) => s.hydrate);

  const handlePurchase = async () => {
    if (!uid) return;
    setPurchasing(true);
    try {
      const info = await purchaseProPackage();
      if (info && hasProEntitlement(info)) {
        await hydrate(uid);
        onSubscribed?.();
        onClose();
      }
    } catch (error: any) {
      if (error?.userCancelled) {
        // User cancelled — do nothing
      } else {
        Alert.alert('Purchase Failed', error?.message ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (!uid) return;
    setRestoring(true);
    try {
      const info = await restorePurchases();
      if (info && hasProEntitlement(info)) {
        await hydrate(uid);
        Alert.alert('Restored!', 'Your subscription has been restored.');
        onSubscribed?.();
        onClose();
      } else {
        Alert.alert('No Subscription Found', 'We could not find an active subscription to restore.');
      }
    } catch (error: any) {
      Alert.alert('Restore Failed', error?.message ?? 'Something went wrong.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color={Colors.light.textSecondary} />
        </TouchableOpacity>

        <View style={styles.content}>
          <Image source={chefHatIcon} style={styles.icon} />
          <Text style={styles.headline}>Unlock Voice Cooking</Text>
          <Text style={styles.subhead}>
            Let ChefChat guide you through every recipe, hands-free.
          </Text>

          <View style={styles.features}>
            {FEATURES.map((f) => (
              <View key={f.text} style={styles.featureRow}>
                <Ionicons name={f.icon} size={22} color={Colors.brand.sage} />
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.price}>$2.99/month after 7-day free trial</Text>

          <TouchableOpacity
            style={styles.purchaseButton}
            activeOpacity={0.8}
            onPress={handlePurchase}
            disabled={purchasing || restoring}
          >
            {purchasing ? (
              <ActivityIndicator color={Colors.brand.cream} />
            ) : (
              <Text style={styles.purchaseButtonText}>Start Free Trial</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestore}
            disabled={purchasing || restoring}
          >
            {restoring ? (
              <ActivityIndicator size="small" color={Colors.light.textSecondary} />
            ) : (
              <Text style={styles.restoreText}>Restore Purchases</Text>
            )}
          </TouchableOpacity>

          <View style={styles.legal}>
            <TouchableOpacity
              onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}
            >
              <Text style={styles.legalText}>Terms of Use</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}> · </Text>
            <TouchableOpacity
              onPress={() => Linking.openURL('https://chefchat.app/privacy')}
            >
              <Text style={styles.legalText}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.cream,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 8,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  icon: {
    width: 72,
    height: 72,
    marginBottom: 20,
  },
  headline: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subhead: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  features: {
    alignSelf: 'stretch',
    gap: 16,
    marginBottom: 32,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 16,
    color: Colors.light.text,
  },
  price: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 16,
  },
  purchaseButton: {
    backgroundColor: Colors.brand.sage,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 14,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: 16,
  },
  purchaseButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.brand.cream,
  },
  restoreButton: {
    paddingVertical: 8,
    marginBottom: 16,
  },
  restoreText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textDecorationLine: 'underline',
  },
  legal: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legalText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  legalDot: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
});
```

**Step 2: Commit**

```bash
git add src/components/PaywallSheet.tsx
git commit -m "feat: add paywall sheet component with purchase + restore flows"
```

---

### Task 7: Gate "Start Cooking" Behind Subscription Check

**Files:**
- Modify: `app/(main)/recipe/[id].tsx`

**Step 1: Add subscription gate**

Import the subscription store and PaywallSheet at the top of the file:
```typescript
import { useSubscriptionStore } from '@/src/stores/subscriptionStore';
import { useAuthStore } from '@/src/stores/authStore';
import PaywallSheet from '@/src/components/PaywallSheet';
```

Inside the component, add state and subscription reads:
```typescript
const [showPaywall, setShowPaywall] = useState(false);
const canUseVoice = useSubscriptionStore((s) => s.canUseVoice);
const refreshSubscription = useSubscriptionStore((s) => s.refresh);
const uid = useAuthStore((s) => s.user?.uid);
```

Add `useState` to the existing `react` import.

Replace the "Start Cooking" `onPress` handler (line 142):

From:
```typescript
onPress={() => router.push(`/(main)/recipe/cook/${recipe.id}`)}
```

To:
```typescript
onPress={async () => {
  if (uid) await refreshSubscription(uid);
  if (useSubscriptionStore.getState().canUseVoice) {
    router.push(`/(main)/recipe/cook/${recipe.id}`);
  } else {
    setShowPaywall(true);
  }
}}
```

Add the PaywallSheet modal right before the closing `</>` or at the end of the JSX:
```typescript
<PaywallSheet
  visible={showPaywall}
  onClose={() => setShowPaywall(false)}
  onSubscribed={() => router.push(`/(main)/recipe/cook/${recipe.id}`)}
/>
```

**Step 2: Commit**

```bash
git add app/(main)/recipe/[id].tsx
git commit -m "feat: gate Start Cooking behind subscription check with paywall"
```

---

### Task 8: Add "ChefChat Pro" Row to Profile

**Files:**
- Modify: `app/(main)/profile.tsx`

**Step 1: Add subscription status row**

Import at the top:
```typescript
import { useSubscriptionStore } from '@/src/stores/subscriptionStore';
import PaywallSheet from '@/src/components/PaywallSheet';
```

Inside the component, add:
```typescript
const subscriptionPlan = useSubscriptionStore((s) => s.plan);
const creditsUsed = useSubscriptionStore((s) => s.creditsUsed);
const creditsLimit = useSubscriptionStore((s) => s.creditsLimit);
const canUseVoice = useSubscriptionStore((s) => s.canUseVoice);
const [showPaywall, setShowPaywall] = useState(false);
```

Add `useState` to the existing `react` import if not already there.

After the "Dietary Preferences" menu item (after line 155), add:

```typescript
<TouchableOpacity
  style={styles.menuItem}
  onPress={() => {
    if (canUseVoice) {
      Linking.openURL('https://apps.apple.com/account/subscriptions');
    } else {
      setShowPaywall(true);
    }
  }}
>
  <Ionicons name="star-outline" size={22} color={Colors.light.text} />
  <View style={{ flex: 1 }}>
    <Text style={styles.menuText}>ChefChat Pro</Text>
    <Text style={{ fontSize: 12, color: Colors.light.textSecondary }}>
      {subscriptionPlan === 'pro'
        ? `${creditsLimit - creditsUsed} credits remaining`
        : subscriptionPlan === 'trial'
          ? `Trial · ${creditsLimit - creditsUsed} credits remaining`
          : 'Subscribe to unlock voice cooking'}
    </Text>
  </View>
  <Ionicons name="chevron-forward" size={20} color={Colors.light.textSecondary} />
</TouchableOpacity>
```

Add `import { Linking } from 'react-native'` if not already imported (it likely is via the existing imports).

Add the PaywallSheet at the end of the JSX (before the closing tag of the scroll container):

```typescript
<PaywallSheet
  visible={showPaywall}
  onClose={() => setShowPaywall(false)}
/>
```

**Step 2: Commit**

```bash
git add app/(main)/profile.tsx
git commit -m "feat: add ChefChat Pro status row to profile settings"
```

---

### Task 9: Onboarding Trial Mention

**Files:**
- Modify: `app/(onboarding)/voice-feature.tsx`

**Step 1: Add trial subtitle**

After the existing `body` Text element (line 22-23), add:

```typescript
<Text style={styles.trial}>
  Includes 7-day free trial — no payment required.
</Text>
```

Add the style:
```typescript
trial: {
  fontSize: 14,
  color: Colors.brand.sage,
  textAlign: 'center',
  fontWeight: '600',
  marginTop: 12,
},
```

**Step 2: Commit**

```bash
git add app/(onboarding)/voice-feature.tsx
git commit -m "feat: add free trial mention on onboarding voice feature screen"
```

---

### Task 10: Verification & Cleanup

**Step 1: TypeScript check**

Run: `npx tsc --noEmit`

Fix any type errors.

**Step 2: Build Cloud Functions**

Run: `cd functions && npm run build && cd ..`

Fix any compilation errors in the webhook function.

**Step 3: Verify the full dependency graph**

Ensure all imports resolve correctly by checking that `react-native-purchases` types are available.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve type errors from subscription integration"
```

---

## Post-Implementation: RevenueCat Dashboard Setup

These steps happen outside the codebase (manual RevenueCat/App Store Connect config):

1. Create RevenueCat project at https://app.revenuecat.com
2. Add iOS app with App Store Connect shared secret
3. Create entitlement `pro`
4. Create offering `default` with product `chefchat_pro_monthly`
5. In App Store Connect: create subscription group + $2.99/mo product with 7-day free trial
6. In RevenueCat: set webhook URL to `https://<region>-<project>.cloudfunctions.net/handleRevenueCatWebhook`
7. Set webhook auth header secret + configure in Firebase: `firebase functions:config:set revenuecat.webhook_secret="<secret>"`
8. Add RevenueCat API key to EAS build secrets or `app.json` extra
