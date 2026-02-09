import {
  createUserWithEmailAndPassword,
  FirebaseAuthTypes,
  getAuth,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from '@react-native-firebase/auth';
import {
  collection,
  doc,
  FirebaseFirestoreTypes,
  getFirestore,
  serverTimestamp,
  setDoc,
} from '@react-native-firebase/firestore';
import { UserProfile } from '../types/recipe';

/**
 * Create a new user with email/password and initialize their Firestore profile.
 */
export async function signUp(
  email: string,
  password: string,
  displayName: string
): Promise<FirebaseAuthTypes.UserCredential> {
  const auth = getAuth();
  const db = getFirestore();
  const credential = await createUserWithEmailAndPassword(auth, email, password);

  // Update the Firebase Auth display name
  await credential.user.updateProfile({ displayName });

  // Create the Firestore user profile
  const userProfile: Omit<UserProfile, 'createdAt'> & { createdAt: FirebaseFirestoreTypes.FieldValue } = {
    uid: credential.user.uid,
    displayName,
    email,
    favorites: [],
    dietaryPreferences: [],
    cookingHistory: [],
    skillLevel: null,
    onboardingCompleted: false,
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(collection(db, 'users'), credential.user.uid), userProfile);

  return credential;
}

/**
 * Sign in with email/password.
 */
export async function signIn(
  email: string,
  password: string
): Promise<FirebaseAuthTypes.UserCredential> {
  return signInWithEmailAndPassword(getAuth(), email, password);
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
  return firebaseSignOut(getAuth());
}

/**
 * Send a password reset email.
 */
export async function resetPassword(email: string): Promise<void> {
  return sendPasswordResetEmail(getAuth(), email);
}

/**
 * Get the current authenticated user (or null).
 */
export function getCurrentUser(): FirebaseAuthTypes.User | null {
  return getAuth().currentUser;
}
