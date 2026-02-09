import { useState, useEffect, useCallback } from 'react';
import { Recipe } from '../types/recipe';
import {
  getRecipes,
  getRecipeById,
  searchRecipes,
  getFavorites,
  toggleFavorite as toggleFavoriteService,
} from '../services/recipeService';
import { subscribeRecipeDataChanges } from '../services/recipeDataSync';
import { useAuth } from './useAuth';

let recipesCache: Recipe[] | null = null;
const recipeByIdCache = new Map<string, Recipe>();
const favoritesCacheByUser = new Map<string, Recipe[]>();
const favoriteIdsCacheByUser = new Map<string, Set<string>>();

function updateRecipeCaches(recipes: Recipe[]) {
  recipesCache = recipes;
  recipeByIdCache.clear();
  recipes.forEach((recipe) => {
    recipeByIdCache.set(recipe.id, recipe);
  });
}

function mergeRecipeIntoCache(recipe: Recipe | null) {
  if (!recipe) return;
  recipeByIdCache.set(recipe.id, recipe);
  if (recipesCache) {
    const next = [...recipesCache];
    const index = next.findIndex((item) => item.id === recipe.id);
    if (index >= 0) {
      next[index] = recipe;
    } else {
      next.push(recipe);
    }
    recipesCache = next;
  }
}

/**
 * Hook for fetching and filtering recipes.
 */
export function useRecipes(filters?: {
  cuisine?: string;
  tag?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}) {
  const [recipes, setRecipes] = useState<Recipe[]>(() => recipesCache ?? []);
  const [loading, setLoading] = useState(() => !recipesCache);
  const [error, setError] = useState<string | null>(null);

  const fetchRecipes = useCallback(async (options?: { silent?: boolean }) => {
    const silent = !!options?.silent;
    try {
      if (!silent) {
        setLoading((recipesCache ?? []).length === 0);
      }
      setError(null);
      const data = await getRecipes(filters);
      setRecipes(data);
      updateRecipeCaches(data);
    } catch (err: any) {
      console.error('Failed to load recipes from Firestore:', err);
      const code = err?.code ? `${err.code}: ` : '';
      setError(`${code}${err?.message || 'Failed to load recipes'}`);
    } finally {
      setLoading(false);
    }
  }, [filters?.cuisine, filters?.tag, filters?.difficulty]);

  useEffect(() => {
    void fetchRecipes({ silent: !!recipesCache });
  }, [fetchRecipes]);

  useEffect(() => {
    return subscribeRecipeDataChanges(() => {
      void fetchRecipes({ silent: true });
    });
  }, [fetchRecipes]);

  return { recipes, loading, error, refetch: fetchRecipes };
}

/**
 * Hook for fetching a single recipe.
 */
export function useRecipe(recipeId: string) {
  const [recipe, setRecipe] = useState<Recipe | null>(() => {
    if (!recipeId) return null;
    return recipeByIdCache.get(recipeId) || null;
  });
  const [loading, setLoading] = useState(() => {
    if (!recipeId) return false;
    return !recipeByIdCache.has(recipeId);
  });
  const [error, setError] = useState<string | null>(null);

  const fetchRecipe = useCallback(async (options?: { silent?: boolean }) => {
    if (!recipeId) return;
    const silent = !!options?.silent;
    const cached = recipeByIdCache.get(recipeId) || null;
    if (cached) {
      setRecipe(cached);
      if (!silent) {
        setLoading(false);
      }
    } else if (!silent) {
      setLoading(true);
    }

    try {
      const data = await getRecipeById(recipeId);
      setRecipe(data);
      mergeRecipeIntoCache(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load recipe');
    } finally {
      setLoading(false);
    }
  }, [recipeId]);

  useEffect(() => {
    void fetchRecipe({ silent: true });
  }, [fetchRecipe]);

  useEffect(() => {
    return subscribeRecipeDataChanges(() => {
      void fetchRecipe({ silent: true });
    });
  }, [fetchRecipe]);

  return { recipe, loading, error, refetch: fetchRecipe };
}

/**
 * Hook for search functionality.
 */
export function useRecipeSearch() {
  const [results, setResults] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (term: string) => {
    if (!term.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await searchRecipes(term);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => setResults([]), []);

  return { results, loading, search, clear };
}

/**
 * Hook for managing favorites.
 */
export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Recipe[]>(() => {
    if (!user?.uid) return [];
    return favoritesCacheByUser.get(user.uid) ?? [];
  });
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => {
    if (!user?.uid) return new Set();
    return favoriteIdsCacheByUser.get(user.uid) ?? new Set();
  });
  const [loading, setLoading] = useState(() => {
    if (!user?.uid) return false;
    return !favoritesCacheByUser.has(user.uid);
  });

  useEffect(() => {
    if (user?.uid) return;
    setFavorites([]);
    setFavoriteIds(new Set());
    setLoading(false);
  }, [user?.uid]);

  const fetchFavorites = useCallback(async (options?: { silent?: boolean }) => {
    if (!user) return;
    const silent = !!options?.silent;
    try {
      if (!silent) {
        setLoading((favoritesCacheByUser.get(user.uid)?.length ?? 0) === 0);
      }
      const data = await getFavorites(user.uid);
      setFavorites(data);
      const ids = new Set(data.map((r) => r.id));
      setFavoriteIds(ids);
      favoritesCacheByUser.set(user.uid, data);
      favoriteIdsCacheByUser.set(user.uid, ids);
    } catch (err) {
      console.error('Failed to fetch favorites:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    void fetchFavorites({ silent: !!user?.uid && favoritesCacheByUser.has(user.uid) });
  }, [fetchFavorites]);

  useEffect(() => {
    return subscribeRecipeDataChanges(() => {
      void fetchFavorites({ silent: true });
    });
  }, [fetchFavorites]);

  const toggleFavorite = useCallback(
    async (recipeId: string) => {
      if (!user) return;
      try {
        const isNowFavorite = await toggleFavoriteService(user.uid, recipeId);
        // Optimistic update
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (isNowFavorite) {
            next.add(recipeId);
          } else {
            next.delete(recipeId);
          }
          return next;
        });
        // Refetch full list
        void fetchFavorites({ silent: true });
      } catch (err) {
        console.error('Failed to toggle favorite:', err);
      }
    },
    [user?.uid, fetchFavorites]
  );

  const isFavorite = useCallback(
    (recipeId: string) => favoriteIds.has(recipeId),
    [favoriteIds]
  );

  return { favorites, loading, toggleFavorite, isFavorite, refetch: fetchFavorites };
}
