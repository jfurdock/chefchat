import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';
import Constants from 'expo-constants';

function readRuntimeEnv(name: string): string {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process;
  return proc?.env?.[name] ?? '';
}

const REVENUECAT_API_KEY_IOS =
  Constants.expoConfig?.extra?.revenueCatApiKeyIos ||
  readRuntimeEnv('EXPO_PUBLIC_REVENUECAT_API_KEY_IOS');

const ENTITLEMENT_PRO = 'pro';

let configured = false;
let disabled = false;

function warnNativeModuleUnavailable(error?: unknown): void {
  console.warn(
    '[RevenueCat] Native module unavailable. Use a rebuilt dev client (not Expo Go) after installing react-native-purchases.',
    error,
  );
}

export async function configureRevenueCat(): Promise<void> {
  if (disabled) return;
  if (configured) return;
  if (!REVENUECAT_API_KEY_IOS) {
    console.warn(
      '[RevenueCat] No iOS API key configured. Set expo.extra.revenueCatApiKeyIos or EXPO_PUBLIC_REVENUECAT_API_KEY_IOS.',
    );
    return;
  }

  try {
    if (__DEV__) {
      await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    Purchases.configure({ apiKey: REVENUECAT_API_KEY_IOS });
    configured = true;
  } catch (error) {
    warnNativeModuleUnavailable(error);
    disabled = true;
  }
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

async function ensureConfiguredOrThrow(): Promise<void> {
  await configureRevenueCat();
  if (configured) return;
  throw new Error(
    'Purchases are unavailable in this build. Use a rebuilt dev client/TestFlight build with RevenueCat configured.',
  );
}

export async function fetchOfferings(): Promise<PurchasesPackage | null> {
  await ensureConfiguredOrThrow();
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages[0] ?? null;
}

export async function purchaseProPackage(): Promise<CustomerInfo> {
  const pkg = await fetchOfferings();
  if (!pkg) {
    throw new Error(
      'No subscription offering is available. Verify your RevenueCat offering/products for this app.',
    );
  }
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo> {
  await ensureConfiguredOrThrow();
  return Purchases.restorePurchases();
}
