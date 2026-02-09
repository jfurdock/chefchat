import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

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

export const handleRevenueCatWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

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

  functions.logger.info(`[RevenueCat] ${eventType} for user ${uid}`);

  const update = PLAN_UPDATES[eventType];
  if (!update || Object.keys(update).length === 0) {
    res.status(200).send('OK');
    return;
  }

  const userRef = db.collection('users').doc(uid);

  try {
    await userRef.update({
      ...update,
      subscriptionUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

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
});
