import { useState, useEffect, useCallback } from 'react';
import { Recipe } from '../types/recipe';
import {
  getRecipes,
  getRecipeById,
  searchRecipes,
  getFavorites,
  toggleFavorite as toggleFavoriteService,
} from '../services/recipeService';
import { useAuth } from './useAuth';

/**
 * Hook for fetching and filtering recipes.
 */
export function useRecipes(filters?: {
  cuisine?: string;
  tag?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecipes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getRecipes(filters);
      setRecipes(data);
    } catch (err: any) {
      console.error('Failed to load recipes from Firestore:', err);
      const code = err?.code ? `${err.code}: ` : '';
      setError(`${code}${err?.message || 'Failed to load recipes'}`);
    } finally {
      setLoading(false);
    }
  }, [filters?.cuisine, filters?.tag, filters?.difficulty]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  return { recipes, loading, error, refetch: fetchRecipes };
}

/**
 * Hook for fetching a single recipe.
 */
export function useRecipe(recipeId: string) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recipeId) return;

    let cancelled = false;

    async function fetch() {
      try {
        setLoading(true);
        const data = await getRecipeById(recipeId);
        if (!cancelled) setRecipe(data);
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  return { recipe, loading, error };
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
  const [favorites, setFavorites] = useState<Recipe[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await getFavorites(user.uid);
      setFavorites(data);
      setFavoriteIds(new Set(data.map((r) => r.id)));
    } catch (err) {
      console.error('Failed to fetch favorites:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchFavorites();
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
        fetchFavorites();
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
