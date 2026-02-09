import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Recipe } from '@/src/types/recipe';
import {
  ShoppingItem,
  mergeIngredientsForRecipe,
  removeRecipeFromItems,
  sanitizeShoppingItems,
} from '@/src/utils/ingredientMerger';

export interface MenuEntry {
  recipeId: string;
  recipeTitle: string;
  recipeImageUrl: string;
  addedAt: number;
  totalIngredients: number;
}

export interface ShoppingState {
  menuEntries: MenuEntry[];
  shoppingItems: ShoppingItem[];
  celebrationRecipeId: string | null;
  celebrationRecipeTitle: string | null;
}

export interface ShoppingActions {
  addRecipeToShoppingList: (recipe: Recipe) => void;
  removeRecipeFromShoppingList: (recipeId: string) => void;
  toggleShoppingItem: (itemId: string) => void;
  checkRecipeCompletion: (recipeId: string) => boolean;
  dismissCelebration: () => void;
  setCelebration: (recipeId: string, recipeTitle: string) => void;
  isRecipeOnShoppingList: (recipeId: string) => boolean;
  getRecipeCompletionStatus: (
    recipeId: string
  ) => { checked: number; total: number };
  isAllShoppingDone: () => boolean;
  resetShoppingList: () => void;
}

type ShoppingStore = ShoppingState & ShoppingActions;

const initialState: ShoppingState = {
  menuEntries: [],
  shoppingItems: [],
  celebrationRecipeId: null,
  celebrationRecipeTitle: null,
};

export const useShoppingStore = create<ShoppingStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      addRecipeToShoppingList: (recipe: Recipe) => {
        set((state) => {
          // Check if recipe already exists in menu
          const recipeExists = state.menuEntries.some(
            (entry) => entry.recipeId === recipe.id
          );

          if (recipeExists) {
            return state; // Recipe already on list
          }

          // Create menu entry
          const menuEntry: MenuEntry = {
            recipeId: recipe.id,
            recipeTitle: recipe.title,
            recipeImageUrl: recipe.imageUrl,
            addedAt: Date.now(),
            totalIngredients: recipe.ingredients.length,
          };

          // Merge ingredients into shopping items
          const updatedShoppingItems = mergeIngredientsForRecipe(
            state.shoppingItems,
            {
              id: recipe.id,
              title: recipe.title,
              ingredients: recipe.ingredients,
            }
          );

          return {
            ...state,
            menuEntries: [...state.menuEntries, menuEntry],
            shoppingItems: updatedShoppingItems,
          };
        });
      },

      removeRecipeFromShoppingList: (recipeId: string) => {
        set((state) => {
          // Remove from menu entries
          const updatedMenuEntries = state.menuEntries.filter(
            (entry) => entry.recipeId !== recipeId
          );

          // Remove recipe ingredients from shopping items
          const updatedShoppingItems = removeRecipeFromItems(
            state.shoppingItems,
            recipeId
          );

          return {
            ...state,
            menuEntries: updatedMenuEntries,
            shoppingItems: updatedShoppingItems,
          };
        });
      },

      toggleShoppingItem: (itemId: string) => {
        set((state) => {
          const updatedShoppingItems = sanitizeShoppingItems(state.shoppingItems.map((item) =>
            item.id === itemId ? { ...item, checked: !item.checked } : item
          ));

          return {
            ...state,
            shoppingItems: updatedShoppingItems,
          };
        });
      },

      checkRecipeCompletion: (recipeId: string): boolean => {
        const state = get();
        const sanitizedItems = sanitizeShoppingItems(state.shoppingItems);

        // Find all items associated with this recipe
        const recipeItems = sanitizedItems.filter((item) =>
          item.sourceRecipes.some((src) => src.recipeId === recipeId)
        );

        if (recipeItems.length === 0) {
          return false; // Recipe not on list
        }

        // Check if all items are checked
        return recipeItems.every((item) => item.checked);
      },

      getRecipeCompletionStatus: (
        recipeId: string
      ): { checked: number; total: number } => {
        const state = get();
        const sanitizedItems = sanitizeShoppingItems(state.shoppingItems);

        // Find all items associated with this recipe
        const recipeItems = sanitizedItems.filter((item) =>
          item.sourceRecipes.some((src) => src.recipeId === recipeId)
        );

        const checkedCount = recipeItems.filter((item) => item.checked).length;

        return {
          checked: checkedCount,
          total: recipeItems.length,
        };
      },

      isAllShoppingDone: (): boolean => {
        const state = get();
        const sanitizedItems = sanitizeShoppingItems(state.shoppingItems);
        if (sanitizedItems.length === 0) {
          return false; // No items to complete
        }
        return sanitizedItems.every((item) => item.checked);
      },

      dismissCelebration: () => {
        set((state) => ({
          ...state,
          celebrationRecipeId: null,
          celebrationRecipeTitle: null,
        }));
      },

      setCelebration: (recipeId: string, recipeTitle: string) => {
        set((state) => ({
          ...state,
          celebrationRecipeId: recipeId,
          celebrationRecipeTitle: recipeTitle,
        }));
      },

      isRecipeOnShoppingList: (recipeId: string): boolean => {
        const state = get();
        return state.menuEntries.some((entry) => entry.recipeId === recipeId);
      },

      resetShoppingList: () => {
        set(initialState);
      },
    }),
    {
      name: 'chefchat_shopping_store',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persistedState: any) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return initialState;
        }

        const state = persistedState as ShoppingState;
        return {
          ...state,
          shoppingItems: sanitizeShoppingItems(state.shoppingItems || []),
        };
      },
    }
  )
);
