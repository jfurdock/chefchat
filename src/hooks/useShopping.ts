import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useShoppingStore } from '@/src/stores/shoppingStore';
import { Recipe } from '@/src/types/recipe';

/**
 * Hook that provides a convenient interface to the shopping store
 * with additional helper methods for common shopping list operations.
 */
export function useShopping() {
  const router = useRouter();

  // Get all state and actions from the store
  const menuEntries = useShoppingStore((s) => s.menuEntries);
  const shoppingItems = useShoppingStore((s) => s.shoppingItems);
  const celebrationRecipeId = useShoppingStore((s) => s.celebrationRecipeId);
  const celebrationRecipeTitle = useShoppingStore((s) => s.celebrationRecipeTitle);

  const addRecipeToShoppingList = useShoppingStore(
    (s) => s.addRecipeToShoppingList
  );
  const removeRecipeFromShoppingList = useShoppingStore(
    (s) => s.removeRecipeFromShoppingList
  );
  const toggleShoppingItem = useShoppingStore((s) => s.toggleShoppingItem);
  const checkRecipeCompletion = useShoppingStore(
    (s) => s.checkRecipeCompletion
  );
  const setCelebration = useShoppingStore((s) => s.setCelebration);
  const dismissCelebration = useShoppingStore((s) => s.dismissCelebration);
  const isRecipeOnShoppingList = useShoppingStore(
    (s) => s.isRecipeOnShoppingList
  );
  const getRecipeCompletionStatus = useShoppingStore(
    (s) => s.getRecipeCompletionStatus
  );
  const isAllShoppingDone = useShoppingStore((s) => s.isAllShoppingDone);
  const resetShoppingList = useShoppingStore((s) => s.resetShoppingList);

  /**
   * Adds a recipe to the shopping list.
   * Optionally navigates to the shopping tab.
   */
  const addRecipeAndNavigate = useCallback(
    (recipe: Recipe, navigateToShopping: boolean = true) => {
      addRecipeToShoppingList(recipe);
      if (navigateToShopping) {
        router.push('/(main)/shopping');
      }
    },
    [addRecipeToShoppingList, router]
  );

  /**
   * Toggles a shopping item and checks if any recipe is now complete.
   * If a recipe becomes complete, shows the celebration modal.
   */
  const toggleItemAndCheckCompletion = useCallback(
    (itemId: string) => {
      // Toggle the item
      toggleShoppingItem(itemId);

      // Get the item to find which recipes it belongs to
      const latestItems = useShoppingStore.getState().shoppingItems;
      const item = latestItems.find((i) => i.id === itemId);
      if (!item) return;

      // Check completion for each source recipe
      for (const source of item.sourceRecipes) {
        const isComplete = checkRecipeCompletion(source.recipeId);

        // If recipe just became complete, show celebration
        if (isComplete) {
          setCelebration(source.recipeId, source.recipeTitle);
          break; // Only show one celebration at a time
        }
      }
    },
    [toggleShoppingItem, checkRecipeCompletion, setCelebration]
  );

  return {
    // State
    menuEntries,
    shoppingItems,
    celebrationRecipeId,
    celebrationRecipeTitle,

    // Store actions
    addRecipeToShoppingList,
    removeRecipeFromShoppingList,
    toggleShoppingItem,
    checkRecipeCompletion,
    setCelebration,
    dismissCelebration,
    isRecipeOnShoppingList,
    getRecipeCompletionStatus,
    isAllShoppingDone,
    resetShoppingList,

    // Convenience methods
    addRecipeAndNavigate,
    toggleItemAndCheckCompletion,
  };
}
