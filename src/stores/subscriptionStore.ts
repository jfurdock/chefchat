import { doc, getDoc, getFirestore } from '@react-native-firebase/firestore';
import { create } from 'zustand';
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
      await configureRevenueCat();
      await loginRevenueCat(uid);

      const info = await getCustomerInfo();
      const hasPro = hasProEntitlement(info);

      const db = getFirestore();
      const userSnap = await getDoc(doc(db, 'users', uid));
      const userData = userSnap.data();

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

      const now = new Date();
      const cycleKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      const usageSnap = await getDoc(doc(db, 'users', uid, 'voiceUsage', cycleKey));
      const usageData = usageSnap.data();
      const creditsUsed = usageData?.totalCredits ?? 0;

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
    try {
      const info = await getCustomerInfo();
      const hasPro = hasProEntitlement(info);

      const db = getFirestore();
      const now = new Date();
      const cycleKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      const usageSnap = await getDoc(doc(db, 'users', uid, 'voiceUsage', cycleKey));
      const creditsUsed = usageSnap.data()?.totalCredits ?? 0;

      const current = get();
      let plan = current.plan;
      let status = current.status;

      if (hasPro && plan !== 'pro') {
        plan = 'pro';
        status = 'active';
      } else if (!hasPro && plan === 'pro') {
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
