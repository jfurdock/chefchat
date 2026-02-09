# ChefChat Subscriptions (Apple + Voice Credits)

## What is already implemented
- User profile now supports:
  - `subscriptionPlan`: `free | trial | pro`
  - `subscriptionStatus`: `inactive | trialing | active | canceled`
  - `trialEndsAt`, `trialStartedAt`
- Cloud Functions now enforce monthly voice credits:
  - Trial: `1200`
  - Free: `300`
  - Pro: `12000`
- Limits are enforced in:
  - `transcribeAudio`
  - `synthesizeSpeech`
  - `inworldChat`

## App Store setup
1. In App Store Connect, create an auto-renewable subscription:
   - Product ID example: `com.chefchat.pro.monthly`
   - Price: `$2.99 / month`
   - Intro offer: `7-day free trial`
2. Add the product to your app and submit metadata for review.

## Recommended purchase integration
Use RevenueCat for receipt validation and subscription state webhooks.

### Why
- Avoids writing raw App Store receipt validation logic.
- Handles renewal / grace period / cancel state changes.
- Easier Firebase sync with webhooks.

### Firebase mapping (webhook -> Firestore)
When RevenueCat reports active entitlement:
- `users/{uid}.subscriptionPlan = 'pro'`
- `users/{uid}.subscriptionStatus = 'active'` (or `trialing`)

When entitlement ends:
- `users/{uid}.subscriptionPlan = 'free'`
- `users/{uid}.subscriptionStatus = 'canceled'`

## Trial behavior
- New users default to `subscriptionPlan='trial'`.
- Trial period is 7 days from signup/profile creation.
- After trial ends without active paid subscription, quota falls back to `free`.

## Notes
- Do not expose any client-write path for `subscriptionPlan` or `subscriptionStatus`.
- Keep updates server-side only (webhook / trusted backend).
