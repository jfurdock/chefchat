import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage,
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
