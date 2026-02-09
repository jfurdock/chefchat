import { Ingredient } from '@/src/types/recipe';

export interface ShoppingItem {
  id: string;
  ingredientName: string;
  displayName: string;
  mergedQuantity: number;
  unit: string;
  category: string;
  preparation?: string;
  sourceRecipes: { recipeId: string; recipeTitle: string; quantity: number }[];
  checked: boolean;
}

const INGREDIENT_CATEGORY_KEYWORDS: Record<string, string[]> = {
  produce: [
    'lettuce',
    'tomato',
    'onion',
    'garlic',
    'pepper',
    'carrot',
    'celery',
    'potato',
    'mushroom',
    'herb',
    'basil',
    'parsley',
    'cilantro',
    'lemon',
    'lime',
    'avocado',
    'spinach',
    'kale',
    'broccoli',
    'corn',
    'bean',
    'pea',
    'zucchini',
    'cucumber',
    'apple',
    'banana',
    'berry',
    'fruit',
    'vegetable',
  ],
  protein: [
    'chicken',
    'beef',
    'pork',
    'turkey',
    'fish',
    'salmon',
    'shrimp',
    'tofu',
    'steak',
    'lamb',
    'bacon',
    'sausage',
    'egg',
  ],
  dairy: ['milk', 'cream', 'cheese', 'butter', 'yogurt', 'sour cream'],
  spice: [
    'salt',
    'pepper',
    'cumin',
    'paprika',
    'oregano',
    'thyme',
    'rosemary',
    'cinnamon',
    'nutmeg',
    'chili',
    'cayenne',
    'turmeric',
  ],
  pantry: [
    'flour',
    'sugar',
    'oil',
    'vinegar',
    'rice',
    'pasta',
    'noodle',
    'bread',
    'broth',
    'stock',
    'sauce',
    'honey',
    'syrup',
    'baking',
  ],
};

const NON_INGREDIENT_WORDS = new Set([
  'item',
  'items',
  'with',
  'without',
  'and',
  'or',
  'the',
  'a',
  'an',
  'some',
  'any',
  'this',
  'that',
  'these',
  'those',
  'ingredient',
  'ingredients',
  'for',
  'to',
  'of',
]);

const IGNORED_INGREDIENTS = new Set([
  'salt',
  'pepper',
  'black pepper',
  'ground black pepper',
  'ground pepper',
  'white pepper',
  'kosher salt',
  'sea salt',
  'water',
  'cold water',
  'warm water',
  'hot water',
  'ice water',
  'boiling water',
]);

const PEPPER_PRODUCE_TERMS = ['bell pepper', 'jalapeno', 'serrano', 'habanero', 'capsicum', 'chili pepper'];

const CATEGORY_ALIASES: Record<string, Ingredient['category']> = {
  produce: 'produce',
  protein: 'protein',
  dairy: 'dairy',
  pantry: 'pantry',
  spice: 'spice',
  other: 'other',
  'meat & seafood': 'protein',
  'spices & seasonings': 'spice',
};

function sanitizeIngredientName(name: string): string {
  const cleaned = name
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\binto\s+(?:small|medium|large)?\s*(?:chunks?|pieces?|slices?|cubes?|strips?)\b.*$/i, ' ')
    .replace(/\b(?:cut|chop(?:ped)?|dice(?:d)?|mince(?:d)?|slice(?:d)?|halve(?:d)?)\s+(?:into\s+)?(?:small|medium|large)?\s*(?:chunks?|pieces?|slices?|cubes?|strips?)\b.*$/i, ' ')
    .replace(/\b(?:for serving|to taste)\b.*$/i, ' ')
    .replace(/[^a-zA-Z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';

  const tokens = cleaned
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .filter((token) => !NON_INGREDIENT_WORDS.has(token.toLowerCase()));

  return tokens.join(' ').trim();
}

function sanitizeUnit(unit: string): string {
  const normalized = unit.trim().toLowerCase();
  if (normalized === 'item' || normalized === 'items') {
    return '';
  }
  return normalized;
}

function toDisplayName(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      const first = word.charAt(0);
      if (!first) return word;
      return `${first.toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(' ')
    .trim();
}

export function cleanIngredientDisplayName(name: string): string {
  const cleaned = sanitizeIngredientName(name || '');
  if (!cleaned) {
    return (name || '').trim();
  }
  return toDisplayName(cleaned);
}

function inferCategoryFromName(name: string): Ingredient['category'] {
  const normalized = name.toLowerCase();

  // Pantry liquids/powders like broth/stock should not be treated as protein.
  if (/\b(broth|stock|bouillon)\b/.test(normalized)) {
    return 'pantry';
  }

  for (const [category, keywords] of Object.entries(INGREDIENT_CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return category as Ingredient['category'];
    }
  }
  return 'other';
}

function shouldSkipIngredient(name: string): boolean {
  const normalized = sanitizeIngredientName(name).toLowerCase();
  if (!normalized) return true;

  if (PEPPER_PRODUCE_TERMS.some((term) => normalized.includes(term))) {
    return false;
  }

  return IGNORED_INGREDIENTS.has(normalized);
}

export function shouldDisplayShoppingIngredient(name: string): boolean {
  return !shouldSkipIngredient(name);
}

function normalizeCategory(
  value: string | undefined,
  ingredientName: string
): Ingredient['category'] {
  if (/\b(broth|stock|bouillon)\b/.test(ingredientName.toLowerCase())) {
    return 'pantry';
  }

  const normalized = `${value || ''}`.trim().toLowerCase();
  if (normalized) {
    const direct = CATEGORY_ALIASES[normalized];
    if (direct && direct !== 'other') return direct;
    if (direct === 'other' && ingredientName.trim()) {
      return inferCategoryFromName(ingredientName);
    }
    if (direct) return direct;
  }
  return inferCategoryFromName(ingredientName);
}

/**
 * Normalizes an ingredient name and unit to create a consistent key for merging.
 * Case-insensitive matching to handle "Flour" vs "flour", etc.
 */
export function normalizeIngredientKey(name: string, unit: string): string {
  const normalizedName = sanitizeIngredientName(name).toLowerCase().trim();
  const normalizedUnit = sanitizeUnit(unit);
  return `${normalizedName}|${normalizedUnit}`;
}

export function sanitizeShoppingItems(existingItems: ShoppingItem[]): ShoppingItem[] {
  return existingItems
    .map((item) => {
      const normalizedName = sanitizeIngredientName(item.ingredientName || item.displayName || '');
      const normalizedUnit = sanitizeUnit(item.unit || '');
      return {
        ...item,
        ingredientName: normalizedName || item.ingredientName,
        displayName: normalizedName ? toDisplayName(normalizedName) : item.displayName,
        unit: normalizedUnit,
        category: normalizeCategory(item.category, normalizedName || item.ingredientName || ''),
      };
    })
    .filter((item) => !shouldSkipIngredient(item.ingredientName || item.displayName));
}

/**
 * Maps ingredient categories to grocery store sections.
 */
export function mapCategoryToStoreSection(category: string, ingredientName = ''): string {
  const categoryMap: Record<string, string> = {
    produce: 'Produce',
    protein: 'Meat & Seafood',
    dairy: 'Dairy',
    pantry: 'Pantry',
    spice: 'Spices & Seasonings',
    other: 'Other',
  };

  const normalizedCategory = normalizeCategory(category, ingredientName);
  return categoryMap[normalizedCategory] || 'Other';
}

/**
 * Generates a unique ID for a shopping item based on ingredient key.
 */
function generateShoppingItemId(key: string): string {
  return `shopping_${key.replace(/\|/g, '_')}`;
}

/**
 * Merges ingredients from a recipe into existing shopping items.
 * Same ingredient + unit → sum quantities
 * Different units for same ingredient → keep separate rows
 */
export function mergeIngredientsForRecipe(
  existingItems: ShoppingItem[],
  recipe: {
    id: string;
    title: string;
    ingredients: Ingredient[];
  }
): ShoppingItem[] {
  const items = sanitizeShoppingItems(existingItems);
  const itemMap = new Map<string, ShoppingItem>();

  // Build map of existing items by their normalized key
  items.forEach((item) => {
    const key = normalizeIngredientKey(item.ingredientName, item.unit);
    itemMap.set(key, item);
  });

  // Process each ingredient from the recipe
  recipe.ingredients.forEach((ingredient) => {
    const sanitizedName = sanitizeIngredientName(ingredient.name || '');
    if (!sanitizedName) return;
    if (shouldSkipIngredient(sanitizedName)) return;

    const unit = sanitizeUnit(ingredient.unit || '');
    const quantity =
      typeof ingredient.quantity === 'number' && Number.isFinite(ingredient.quantity)
        ? ingredient.quantity
        : 0;
    if (quantity <= 0) return;

    const key = normalizeIngredientKey(sanitizedName, unit);
    const itemId = generateShoppingItemId(key);

    if (itemMap.has(key)) {
      // Item already exists: merge quantities and add source recipe
      const existingItem = itemMap.get(key)!;
      existingItem.ingredientName = sanitizedName;
      existingItem.displayName = toDisplayName(sanitizedName);
      existingItem.category = normalizeCategory(existingItem.category, sanitizedName);
      existingItem.mergedQuantity += quantity;

      // Check if this recipe is already in sourceRecipes
      const existingSourceIndex = existingItem.sourceRecipes.findIndex(
        (src) => src.recipeId === recipe.id
      );

      if (existingSourceIndex !== -1) {
        // Recipe already in list: update quantity
        existingItem.sourceRecipes[existingSourceIndex].quantity += quantity;
      } else {
        // New recipe: add to sourceRecipes
        existingItem.sourceRecipes.push({
          recipeId: recipe.id,
          recipeTitle: recipe.title,
          quantity,
        });
      }
    } else {
      // New item: create it
      const newItem: ShoppingItem = {
        id: itemId,
        ingredientName: sanitizedName,
        displayName: toDisplayName(sanitizedName),
        mergedQuantity: quantity,
        unit,
        category: normalizeCategory(ingredient.category, sanitizedName),
        preparation: ingredient.preparation,
        sourceRecipes: [
          {
            recipeId: recipe.id,
            recipeTitle: recipe.title,
            quantity,
          },
        ],
        checked: false,
      };

      itemMap.set(key, newItem);
    }
  });

  // Convert map back to array
  return Array.from(itemMap.values());
}

/**
 * Removes a recipe's ingredients from existing shopping items.
 * Subtracts quantities and removes items that reach 0.
 */
export function removeRecipeFromItems(
  existingItems: ShoppingItem[],
  recipeId: string
): ShoppingItem[] {
  return sanitizeShoppingItems(existingItems)
    .map((item) => {
      // Find the source recipe entry
      const sourceIndex = item.sourceRecipes.findIndex(
        (src) => src.recipeId === recipeId
      );

      if (sourceIndex === -1) {
        // Recipe not in this item's sources
        return item;
      }

      // Subtract the quantity
      const quantityToSubtract = item.sourceRecipes[sourceIndex].quantity;
      const updatedItem = { ...item };
      updatedItem.mergedQuantity -= quantityToSubtract;

      // Remove the source recipe
      updatedItem.sourceRecipes = updatedItem.sourceRecipes.filter(
        (src) => src.recipeId !== recipeId
      );

      return updatedItem;
    })
    .filter((item) => item.mergedQuantity > 0); // Remove items with 0 quantity
}
