# Apple Subscription & Voice Credit Limits Design

## Overview

Add a $2.99/month Apple subscription with 7-day free trial to ChefChat, gating voice cooking behind a credit system. RevenueCat handles the App Store lifecycle; Firebase enforces usage limits server-side.

## User Lifecycle

1. **Signup** — Soft trial auto-starts: 1,200 credits, 7-day window. No payment info required.
2. **Onboarding** — Voice feature screen shows "Includes 7-day free trial — no payment required."
3. **Cooking** — Credits consumed server-side per API call (STT, TTS, Chat). Client tracks remaining.
4. **Credits exhausted or trial expired** — Paywall shown before next voice session. Current session finishes gracefully (no mid-recipe cutoff).
5. **User subscribes** — RevenueCat handles Apple purchase → webhook updates Firestore → 12,000 credits/month.
6. **Renewals/cancellations** — Webhook keeps Firestore in sync automatically.
7. **After trial, no subscription** — Voice locks completely. All non-voice features (browse, favorites, shopping lists, import) remain free.

## Credit Limits

| Plan | Credits/Month | Estimated Sessions |
|---|---|---|
| Trial (soft, 7 days) | 1,200 | ~6–8 recipes |
| Pro ($2.99/mo) | 12,000 | ~60–80 recipes |
| Expired (no subscription) | 0 | Voice locked |

Credit cost per API call (already implemented in `voiceQuota.ts`):
- STT: 1 credit per ~1 second of audio (~32KB)
- TTS: 1 credit per 25 characters
- Chat/LLM: 1 credit per 40 characters

## Architecture

### Layer 1: RevenueCat SDK (Client)

**Package:** `react-native-purchases`

**Initialization** (in `app/_layout.tsx` or `src/services/subscriptionService.ts`):
- `Purchases.configure({ apiKey: '<apple_api_key>' })` on app start
- `Purchases.logIn(uid)` after Firebase auth resolves — associates RevenueCat user with Firebase UID so webhooks carry the correct user ID

**RevenueCat dashboard configuration:**
- Product: `chefchat_pro_monthly` ($2.99/mo with 7-day free trial in App Store Connect)
- Entitlement: `pro`
- Offering: `default` containing the monthly product

### Layer 2: Subscription Service (Client)

**New file:** `src/services/subscriptionService.ts`

- `getSubscriptionStatus()` — calls `Purchases.getCustomerInfo()`, checks for active `pro` entitlement
- `hasTrial()` — checks Firestore `trialEndsAt` vs. now for the soft trial
- `canStartVoiceSession()` — single gate: returns true if soft trial active with credits remaining, OR `pro` entitlement active with credits remaining
- `purchasePro()` — triggers `Purchases.purchasePackage()` for the monthly package
- `restorePurchases()` — triggers `Purchases.restorePurchases()`

### Layer 3: Subscription Store (Client)

**New file:** `src/stores/subscriptionStore.ts` (Zustand)

```
State:
  plan: 'trial' | 'pro' | 'expired'
  status: 'active' | 'trialing' | 'inactive' | 'canceled' | 'billing_issue'
  creditsUsed: number
  creditsLimit: number
  trialEndsAt: Date | null
  isLoading: boolean

Derived:
  creditsRemaining = creditsLimit - creditsUsed
  isTrialExpired = trialEndsAt !== null && now > trialEndsAt
  canUseVoice = (plan === 'trial' && !isTrialExpired && creditsRemaining > 0)
                || (plan === 'pro' && status === 'active' && creditsRemaining > 0)

Actions:
  hydrate() — fetch from RevenueCat + Firestore, called on app start & auth change
  refresh() — lightweight re-check, called before starting a cook session
```

### Layer 4: RevenueCat Webhook (Server)

**New Cloud Function:** `handleRevenueCatWebhook`

Receives POST from RevenueCat on subscription events. Validates shared secret header, extracts `app_user_id` (Firebase UID), updates Firestore:

| RevenueCat Event | Firestore Update |
|---|---|
| `INITIAL_PURCHASE` | `subscriptionPlan: 'pro'`, `subscriptionStatus: 'active'` |
| `RENEWAL` | `subscriptionStatus: 'active'`, reset monthly credit counter |
| `CANCELLATION` | `subscriptionStatus: 'canceled'` (still active until period ends) |
| `EXPIRATION` | `subscriptionPlan: 'free'`, `subscriptionStatus: 'inactive'` |
| `BILLING_ISSUE_DETECTED` | `subscriptionStatus: 'billing_issue'` |

On `RENEWAL`, also resets `users/{uid}/voiceUsage/{YYYY-MM}` so the user gets fresh 12,000 credits.

### Layer 5: Existing Quota Enforcement (Server — No Changes)

`voiceQuota.ts` already:
- Reads `subscriptionPlan` from user's Firestore doc
- Resolves credit limit based on plan
- Runs `consumeVoiceCredits()` in a Firestore transaction
- Throws `resource-exhausted` when limit exceeded

No modifications needed — RevenueCat webhook keeps the Firestore fields in sync.

## Paywall UI

### Soft mention (onboarding)

Update `app/(onboarding)/voice-feature.tsx` — add subtitle text: "Includes 7-day free trial — no payment required."

### Hard paywall (new component)

**New file:** `src/components/PaywallSheet.tsx` (bottom sheet)

Content:
- ChefChat icon
- "Unlock Voice Cooking" headline
- Three bullet points: hands-free cooking, smart substitutions, step-by-step guidance
- Price: "$2.99/month after 7-day free trial"
- "Start Free Trial" button → `purchasePro()`
- "Restore Purchases" text link → `restorePurchases()`
- Terms & Privacy links (Apple requirement)

### Trigger points

- **Recipe detail → "Start Cooking"** — `canStartVoiceSession()` check. If false, show `PaywallSheet` instead of navigating to cook screen.
- **Profile tab** — "ChefChat Pro" settings row showing current plan status. Tapping opens `PaywallSheet` if not subscribed, or shows manage subscription info if subscribed.

### Graceful finish

If credits run out during an active cooking session, do nothing until session ends. On next session start attempt, paywall appears. Credits may go slightly negative for the remainder of the current session — this is acceptable.

## Files Summary

### New Files
| File | Purpose |
|---|---|
| `src/services/subscriptionService.ts` | RevenueCat SDK wrapper (configure, login, purchase, restore, check entitlement) |
| `src/stores/subscriptionStore.ts` | Zustand store for subscription state, credit tracking, `canUseVoice` gate |
| `src/components/PaywallSheet.tsx` | Bottom sheet paywall UI |
| `functions/src/revenueCatWebhook.ts` | Cloud Function handling RevenueCat webhook events |

### Modified Files
| File | Change |
|---|---|
| `app/_layout.tsx` | Initialize RevenueCat, hydrate subscription store after auth |
| `app/(onboarding)/voice-feature.tsx` | Add "7-day free trial" subtitle |
| `app/(main)/recipe/[id].tsx` (or equivalent detail screen) | Gate "Start Cooking" behind `canStartVoiceSession()` |
| `app/(main)/profile.tsx` | Add "ChefChat Pro" status row |
| `functions/src/index.ts` | Export new `handleRevenueCatWebhook` function |
| `package.json` | Add `react-native-purchases` dependency |

### Unchanged
| File | Why |
|---|---|
| `functions/src/voiceQuota.ts` | Already enforces limits by reading `subscriptionPlan` from Firestore |
| `functions/src/chat.ts`, `tts.ts`, `stt.ts` | Already call `consumeVoiceCredits()` |
| `src/hooks/useVoice.ts` | No subscription awareness needed — server handles enforcement |
