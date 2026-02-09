import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const { FieldValue, Timestamp } = admin.firestore;

const FREE_TRIAL_DAYS = 7;
const MONTHLY_LIMITS = {
  free: 300,
  trial: 1200,
  pro: 12000,
} as const;

export type VoiceFeature = 'stt' | 'tts' | 'chat';
export type VoicePlan = keyof typeof MONTHLY_LIMITS;

type UserProfileLike = {
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  trialStartedAt?: admin.firestore.Timestamp | Date | string | null;
  trialEndsAt?: admin.firestore.Timestamp | Date | string | null;
  createdAt?: admin.firestore.Timestamp | Date | string | null;
};

function toDate(input: unknown): Date | null {
  if (!input) return null;
  if (input instanceof Timestamp) return input.toDate();
  if (input instanceof Date) return input;
  if (typeof input === 'string') {
    const parsed = new Date(input);
    return Number.isNaN(parsed.valueOf()) ? null : parsed;
  }
  return null;
}

function cycleKeyFromDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function resolvePlan(profile: UserProfileLike, now: Date): {
  plan: VoicePlan;
  trialEndsAt: Date;
} {
  const subscriptionPlan = (profile.subscriptionPlan || '').toLowerCase();
  const subscriptionStatus = (profile.subscriptionStatus || '').toLowerCase();
  const hasActivePaidSubscription =
    subscriptionPlan === 'pro' &&
    (subscriptionStatus === 'active' || subscriptionStatus === 'trialing');

  if (hasActivePaidSubscription) {
    return {
      plan: 'pro',
      trialEndsAt: new Date(now.getTime() + FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000),
    };
  }

  const trialStartedAt =
    toDate(profile.trialStartedAt) || toDate(profile.createdAt) || now;
  const trialEndsAt =
    toDate(profile.trialEndsAt) ||
    new Date(trialStartedAt.getTime() + FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000);

  if (now <= trialEndsAt) {
    return {
      plan: 'trial',
      trialEndsAt,
    };
  }

  return {
    plan: 'free',
    trialEndsAt,
  };
}

export function estimateTtsCredits(text: string): number {
  const normalizedLength = Math.max(0, text.trim().length);
  return Math.max(1, Math.ceil(normalizedLength / 25));
}

export function estimateChatCredits(text: string): number {
  const normalizedLength = Math.max(0, text.trim().length);
  return Math.max(1, Math.ceil(normalizedLength / 40));
}

export function estimateSttCredits(audioBase64: string): number {
  const approxBytes = Math.ceil((audioBase64.length * 3) / 4);
  // Roughly one credit per second for 16k mono LINEAR16 payloads.
  return Math.max(1, Math.ceil(approxBytes / 32000));
}

export async function consumeVoiceCredits(params: {
  uid: string;
  feature: VoiceFeature;
  amount: number;
}): Promise<{
  plan: VoicePlan;
  used: number;
  limit: number;
  remaining: number;
  cycleKey: string;
}> {
  const uid = params.uid;
  const feature = params.feature;
  const amount = Math.max(1, Math.round(params.amount));
  const now = new Date();
  const cycleKey = cycleKeyFromDate(now);

  const userRef = db.collection('users').doc(uid);
  const usageRef = userRef.collection('voiceUsage').doc(cycleKey);

  return db.runTransaction(async (tx) => {
    const [userSnap, usageSnap] = await Promise.all([tx.get(userRef), tx.get(usageRef)]);
    const profile = (userSnap.data() || {}) as UserProfileLike;
    const { plan, trialEndsAt } = resolvePlan(profile, now);
    const limit = MONTHLY_LIMITS[plan];

    const usedBeforeRaw = usageSnap.exists ? usageSnap.data()?.totalCredits : 0;
    const usedBefore =
      typeof usedBeforeRaw === 'number' && Number.isFinite(usedBeforeRaw)
        ? usedBeforeRaw
        : 0;
    const usedAfter = usedBefore + amount;

    if (usedAfter > limit) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Voice usage limit reached for this month. Upgrade to Pro or wait for the next billing cycle.'
      );
    }

    const userPatch: Record<string, unknown> = {};
    if (!profile.subscriptionPlan) userPatch.subscriptionPlan = 'trial';
    if (!profile.subscriptionStatus) userPatch.subscriptionStatus = 'inactive';
    if (!profile.trialStartedAt) userPatch.trialStartedAt = Timestamp.fromDate(now);
    if (!profile.trialEndsAt) userPatch.trialEndsAt = Timestamp.fromDate(trialEndsAt);
    if (Object.keys(userPatch).length > 0) {
      tx.set(userRef, userPatch, { merge: true });
    }

    tx.set(
      usageRef,
      {
        uid,
        cycleKey,
        plan,
        limit,
        totalCredits: FieldValue.increment(amount),
        [`features.${feature}`]: FieldValue.increment(amount),
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: usageSnap.exists ? usageSnap.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      plan,
      used: usedAfter,
      limit,
      remaining: Math.max(0, limit - usedAfter),
      cycleKey,
    };
  });
}
