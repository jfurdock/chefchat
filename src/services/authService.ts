import {
  AppleAuthProvider,
  FirebaseAuthTypes,
  getAuth,
  signOut as firebaseSignOut,
  updateProfile as firebaseUpdateProfile,
} from '@react-native-firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from '@react-native-firebase/firestore';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { UserProfile } from '../types/recipe';

const FREE_TRIAL_DAYS = 7;

function normalizeFirstName(value?: string | null): string {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0];
}

function normalizeEmail(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    throw new Error('Please enter an email address.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new Error('Please enter a valid email address.');
  }
  return trimmed;
}

function validatePassword(value: string): string {
  if (!value) {
    throw new Error('Please enter your password.');
  }
  if (value.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }
  return value;
}

function fallbackDisplayName(user: FirebaseAuthTypes.User): string {
  if (user.displayName?.trim()) return user.displayName.trim();

  const emailLocalPart = user.email?.split('@')[0]?.trim();
  if (emailLocalPart) {
    const cooked = emailLocalPart.replace(/[._-]+/g, ' ').trim();
    if (cooked) {
      const first = cooked.split(/\s+/)[0];
      return `${first.charAt(0).toUpperCase()}${first.slice(1)}`;
    }
  }

  const phone = user.phoneNumber?.replace(/^\+/, '') || '';
  if (phone.length >= 4) return `Chef ${phone.slice(-4)}`;
  return 'Chef';
}

async function ensureUserProfile(
  user: FirebaseAuthTypes.User,
  firstName?: string
): Promise<void> {
  const db = getFirestore();
  const userDocRef = doc(collection(db, 'users'), user.uid);
  const userDocSnap = await getDoc(userDocRef);
  const preferredFirstName = normalizeFirstName(firstName);

  const normalizedDisplayName =
    preferredFirstName || user.displayName?.trim() || fallbackDisplayName(user);

  if (!user.displayName && normalizedDisplayName) {
    await firebaseUpdateProfile(user, { displayName: normalizedDisplayName });
  }

  if (!userDocSnap.exists()) {
    const trialEndsAt = Timestamp.fromMillis(
      Date.now() + FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000
    );

    const userProfile = {
      uid: user.uid,
      displayName: normalizedDisplayName,
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      favorites: [],
      dietaryPreferences: [],
      cookingHistory: [],
      skillLevel: null,
      preferredVoiceName: null,
      onboardingCompleted: false,
      subscriptionPlan: 'trial',
      subscriptionStatus: 'inactive',
      trialEndsAt,
      trialStartedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    };

    await setDoc(userDocRef, userProfile, { merge: true });
    return;
  }

  const currentData = userDocSnap.data() as Partial<UserProfile> | undefined;
  const patch: Record<string, unknown> = {};

  if (!currentData?.displayName && normalizedDisplayName) {
    patch.displayName = normalizedDisplayName;
  }
  if (!currentData?.phoneNumber && user.phoneNumber) {
    patch.phoneNumber = user.phoneNumber;
  }
  if (!currentData?.email && user.email) {
    patch.email = user.email;
  }
  if (!currentData?.subscriptionPlan) {
    patch.subscriptionPlan = 'trial';
  }
  if (!currentData?.subscriptionStatus) {
    patch.subscriptionStatus = 'inactive';
  }
  if (!currentData?.trialEndsAt) {
    patch.trialEndsAt = Timestamp.fromMillis(
      Date.now() + FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000
    );
  }

  if (Object.keys(patch).length > 0) {
    await updateDoc(userDocRef, patch as any);
  }
}

export async function signInWithEmailPassword(
  rawEmail: string,
  password: string
): Promise<void> {
  const email = normalizeEmail(rawEmail);
  if (!password) {
    throw new Error('Please enter your password.');
  }

  const credential = await getAuth().signInWithEmailAndPassword(email, password);
  await ensureUserProfile(credential.user);
}

export async function signUpWithEmailPassword(
  rawEmail: string,
  password: string,
  firstName?: string
): Promise<void> {
  const email = normalizeEmail(rawEmail);
  const validPassword = validatePassword(password);

  const credential = await getAuth().createUserWithEmailAndPassword(email, validPassword);
  await ensureUserProfile(credential.user, firstName);
}

export async function signInWithAppleProvider(): Promise<void> {
  if (Platform.OS !== 'ios') {
    throw new Error('Apple Sign In is only available on iOS devices.');
  }

  const isAppleAuthAvailable = await AppleAuthentication.isAvailableAsync();
  if (!isAppleAuthAvailable) {
    throw new Error('Apple Sign In is not available on this device.');
  }

  const appleCredential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  const identityToken = appleCredential.identityToken;
  if (!identityToken) {
    throw new Error('Apple Sign In did not return an identity token.');
  }

  const firebaseCredential = AppleAuthProvider.credential(identityToken);
  const credential = await getAuth().signInWithCredential(firebaseCredential);
  await ensureUserProfile(credential.user, appleCredential.fullName?.givenName ?? undefined);
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
  return firebaseSignOut(getAuth());
}

/**
 * Get the current authenticated user (or null).
 */
export function getCurrentUser(): FirebaseAuthTypes.User | null {
  return getAuth().currentUser;
}
