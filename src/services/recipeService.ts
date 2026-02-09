import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  documentId,
  FirebaseFirestoreTypes,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from '@react-native-firebase/firestore';
import { Recipe, UserProfile } from '../types/recipe';
import { notifyRecipeDataChanged } from './recipeDataSync';

type RecipeDocument = Omit<Recipe, 'id'>;
type PartialRecipeDocument = Partial<RecipeDocument> & Record<string, unknown>;

const db = getFirestore(getApp());
const recipesRef = collection(
  db,
  'recipes'
) as FirebaseFirestoreTypes.CollectionReference<RecipeDocument>;
const usersRef = collection(
  db,
  'users'
) as FirebaseFirestoreTypes.CollectionReference<UserProfile>;

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function normalizeDifficulty(value: unknown): 'easy' | 'medium' | 'hard' {
  const raw = String(value || '').toLowerCase();
  if (raw === 'easy' || raw === 'medium' || raw === 'hard') return raw;
  return 'easy';
}

function normalizeRecipeData(
  recipeDoc: FirebaseFirestoreTypes.QueryDocumentSnapshot<RecipeDocument> | FirebaseFirestoreTypes.DocumentSnapshot<RecipeDocument>
): Recipe | null {
  const data = recipeDoc.data() as PartialRecipeDocument | undefined;
  if (!data) return null;

  return {
    id: recipeDoc.id,
    title: asString(data.title, 'Untitled Recipe'),
    description: asString(data.description),
    imageUrl: asString(data.imageUrl),
    prepTimeMinutes: asNumber(data.prepTimeMinutes, 0),
    cookTimeMinutes: asNumber(data.cookTimeMinutes, 0),
    servings: asNumber(data.servings, 1),
    difficulty: normalizeDifficulty(data.difficulty),
    cuisine: asString(data.cuisine, 'General'),
    tags: asStringArray(data.tags),
    ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
    steps: Array.isArray(data.steps) ? data.steps : [],
    substitutions:
      data.substitutions && typeof data.substitutions === 'object'
        ? (data.substitutions as Recipe['substitutions'])
        : {},
    createdAt: (data.createdAt as Recipe['createdAt']) ?? (null as unknown as Recipe['createdAt']),
    updatedAt: (data.updatedAt as Recipe['updatedAt']) ?? (null as unknown as Recipe['updatedAt']),
  };
}

/**
 * Fetch all recipes, optionally filtered by cuisine or tags.
 */
export async function getRecipes(filters?: {
  cuisine?: string;
  tag?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}): Promise<Recipe[]> {
  let recipeQuery: FirebaseFirestoreTypes.Query<RecipeDocument> = recipesRef;

  if (filters?.cuisine) {
    recipeQuery = query(recipeQuery, where('cuisine', '==', filters.cuisine));
  }
  if (filters?.difficulty) {
    recipeQuery = query(recipeQuery, where('difficulty', '==', filters.difficulty));
  }
  if (filters?.tag) {
    recipeQuery = query(recipeQuery, where('tags', 'array-contains', filters.tag));
  }
  const snapshot = await getDocs(recipeQuery);
  const recipes = snapshot.docs
    .map((recipeDoc: FirebaseFirestoreTypes.QueryDocumentSnapshot<RecipeDocument>) =>
      normalizeRecipeData(recipeDoc)
    )
    .filter((recipe: Recipe | null): recipe is Recipe => recipe !== null);

  recipes.sort((a: Recipe, b: Recipe) => a.title.localeCompare(b.title));
  return recipes;
}

/**
 * Fetch a single recipe by ID.
 */
export async function getRecipeById(recipeId: string): Promise<Recipe | null> {
  const recipeSnapshot = await getDoc(doc(recipesRef, recipeId));
  if (!recipeSnapshot.exists) return null;
  return normalizeRecipeData(
    recipeSnapshot as FirebaseFirestoreTypes.DocumentSnapshot<RecipeDocument>
  );
}

/**
 * Search recipes by title (client-side substring match).
 * For production, consider Algolia or a Firestore full-text search extension.
 */
export async function searchRecipes(searchTerm: string): Promise<Recipe[]> {
  // Firestore doesn't support substring search natively.
  // Fetch all and filter client-side (fine for <500 recipes).
  const allRecipes = await getRecipes();
  const term = searchTerm.toLowerCase();
  return allRecipes.filter(
    (r) =>
      r.title.toLowerCase().includes(term) ||
      r.description.toLowerCase().includes(term) ||
      r.tags.some((t) => t.toLowerCase().includes(term))
  );
}

/**
 * Toggle a recipe as favorite for a user.
 */
export async function toggleFavorite(userId: string, recipeId: string): Promise<boolean> {
  const userDoc = doc(usersRef, userId);
  const userSnapshot = await getDoc(userDoc);
  let userData = userSnapshot.data() as UserProfile | undefined;

  // Older accounts may exist in Auth without a Firestore profile document yet.
  // Create the profile lazily so favorites always work.
  if (!userData) {
    const authUser = getAuth().currentUser;
    const profileSeed = {
      uid: userId,
      displayName: authUser?.displayName ?? '',
      email: authUser?.email ?? '',
      favorites: [],
      dietaryPreferences: [],
      cookingHistory: [],
      skillLevel: null,
      preferredVoiceName: null,
      onboardingCompleted: false,
      createdAt: serverTimestamp(),
    };
    await setDoc(userDoc, profileSeed, { merge: true });
    userData = {
      ...profileSeed,
      createdAt: null as unknown as UserProfile['createdAt'],
    };
  }

  const favorites: string[] = userData?.favorites || [];
  const isFavorite = favorites.includes(recipeId);

  if (isFavorite) {
    await updateDoc(userDoc, {
      favorites: arrayRemove(recipeId),
    });
  } else {
    await updateDoc(userDoc, {
      favorites: arrayUnion(recipeId),
    });
  }

  notifyRecipeDataChanged();

  return !isFavorite; // returns new favorite status
}

/**
 * Get a user's favorite recipes.
 */
export async function getFavorites(userId: string): Promise<Recipe[]> {
  const userDoc = await getDoc(doc(usersRef, userId));
  const userData = userDoc.data() as UserProfile | undefined;

  if (!userData || !userData.favorites?.length) return [];

  // Firestore 'in' query supports max 30 items per batch
  const favoriteIds: string[] = userData.favorites;
  const batches: Promise<Recipe[]>[] = [];

  for (let i = 0; i < favoriteIds.length; i += 30) {
    const batch = favoriteIds.slice(i, i + 30);
    batches.push(
      getDocs(query(recipesRef, where(documentId(), 'in', batch))).then((snap) =>
        snap.docs
          .map((recipeDoc: FirebaseFirestoreTypes.QueryDocumentSnapshot<RecipeDocument>) =>
            normalizeRecipeData(recipeDoc)
          )
          .filter((recipe: Recipe | null): recipe is Recipe => recipe !== null)
      )
    );
  }

  const results = await Promise.all(batches);
  return results.flat();
}

/**
 * Get all unique cuisines from the recipe collection.
 */
export async function getCuisines(): Promise<string[]> {
  const recipes = await getRecipes();
  const cuisines = new Set(recipes.map((r) => r.cuisine));
  return Array.from(cuisines).sort();
}
