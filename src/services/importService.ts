import { getApp } from '@react-native-firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  arrayUnion,
} from '@react-native-firebase/firestore';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { getAuth } from '@react-native-firebase/auth';
import { Ingredient, Step } from '../types/recipe';

/**
 * Extracts text from an image using Firebase Cloud Function
 * @param imageBase64 - Base64 encoded image data
 * @returns Promise resolving to extracted text
 * @throws Error with readable message if extraction fails
 */
export async function extractTextFromImage(imageBase64: string): Promise<string> {
  try {
    const app = getApp();
    const functions = getFunctions(app);

    const extractRecipeText = httpsCallable(functions, 'extractRecipeText');
    const result = await extractRecipeText({ imageBase64 });

    if (result.data && typeof result.data === 'object') {
      const data = result.data as Record<string, unknown>;
      if (typeof data.text === 'string') {
        return data.text;
      }
    }

    throw new Error('Invalid response from text extraction service');
  } catch (error) {
    if (error instanceof Error) {
      if (
        /not[_-]?found/i.test(error.message) ||
        /extractrecipetext/i.test(error.message)
      ) {
        throw new Error(
          'OCR service is not deployed yet. Use URL import/manual entry, or deploy the extractRecipeText Cloud Function.'
        );
      }
      if (error.message.includes('PERMISSION_DENIED')) {
        throw new Error(
          'Permission denied. Please ensure Cloud Function permissions are configured correctly.'
        );
      }
      if (error.message.includes('UNAVAILABLE')) {
        throw new Error('Text extraction service is temporarily unavailable. Please try again.');
      }
      throw new Error(`Failed to extract text from image: ${error.message}`);
    }
    throw new Error('Failed to extract text from image. Unknown error.');
  }
}

/**
 * Parses OCR text into Ingredient objects
 * @param text - OCR extracted text
 * @returns Array of parsed Ingredient objects
 */
export function parseIngredientsFromText(text: string): Ingredient[] {
  const ingredients: Ingredient[] = [];

  const lines = text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);

  const produceKeywords = [
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
  ];

  const proteinKeywords = [
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
  ];

  const dairyKeywords = ['milk', 'cream', 'cheese', 'butter', 'yogurt', 'sour cream'];

  const spiceKeywords = [
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
  ];

  const pantryKeywords = [
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
  ];

  const commonUnits = [
    'cup',
    'cups',
    'tbsp',
    'tablespoon',
    'tsp',
    'teaspoon',
    'oz',
    'ounce',
    'lb',
    'pound',
    'g',
    'gram',
    'ml',
    'liter',
    'pinch',
    'dash',
    'clove',
    'cloves',
    'can',
    'cans',
    'bunch',
    'package',
    'pkg',
  ];

  const determineCategory = (ingredientName: string): Ingredient['category'] => {
    const nameLower = ingredientName.toLowerCase();

    if (produceKeywords.some((keyword) => nameLower.includes(keyword))) {
      return 'produce';
    }
    if (proteinKeywords.some((keyword) => nameLower.includes(keyword))) {
      return 'protein';
    }
    if (dairyKeywords.some((keyword) => nameLower.includes(keyword))) {
      return 'dairy';
    }
    if (spiceKeywords.some((keyword) => nameLower.includes(keyword))) {
      return 'spice';
    }
    if (pantryKeywords.some((keyword) => nameLower.includes(keyword))) {
      return 'pantry';
    }

    return 'other';
  };

  for (const line of lines) {
    // Try to parse pattern: quantity unit name
    const quantityUnitNameMatch = line.match(/^([\d.\/\s]+)\s+(\w+)\s+(.+)$/);

    if (quantityUnitNameMatch) {
      const quantityStr = quantityUnitNameMatch[1].trim();
      const possibleUnit = quantityUnitNameMatch[2].toLowerCase();
      const name = quantityUnitNameMatch[3].trim();

      // Check if possibleUnit is actually a unit
      const isUnit = commonUnits.some((unit) => unit.toLowerCase() === possibleUnit);

      if (isUnit) {
        const quantity = parseFloat(quantityStr);

        if (!isNaN(quantity)) {
          ingredients.push({
            name,
            quantity,
            unit: possibleUnit,
            isOptional: false,
            category: determineCategory(name),
          });
          continue;
        }
      }
    }

    // Try to parse pattern: quantity name (no unit)
    const quantityNameMatch = line.match(/^([\d.\/\s]+)\s+(.+)$/);

    if (quantityNameMatch) {
      const quantityStr = quantityNameMatch[1].trim();
      const name = quantityNameMatch[2].trim();
      const quantity = parseFloat(quantityStr);

      if (!isNaN(quantity) && name.length > 0) {
        ingredients.push({
          name,
          quantity,
          unit: '',
          isOptional: false,
          category: determineCategory(name),
        });
        continue;
      }
    }

    // If no quantity, just add as ingredient with quantity 1
    if (line.length > 0) {
      ingredients.push({
        name: line,
        quantity: 1,
        unit: '',
        isOptional: false,
        category: determineCategory(line),
      });
    }
  }

  return ingredients;
}

/**
 * Parses OCR text into Step objects
 * @param text - OCR extracted text
 * @returns Array of parsed Step objects
 */
export function parseStepsFromText(text: string): Step[] {
  const steps: Step[] = [];

  // Split by numbered patterns (1., 2., etc.) or by double newlines
  const stepTexts = text
    .split(/(?:\n\n+)|(?:^\d+\.\s+)/m)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (let i = 0; i < stepTexts.length; i++) {
    let instruction = stepTexts[i];

    // Remove leading numbers/bullets if present
    instruction = instruction.replace(/^[\d+.)\-*\s]+/, '').trim();

    if (instruction.length > 0) {
      steps.push({
        number: i + 1,
        instruction,
        timerRequired: false,
      });
    }
  }

  return steps;
}

export interface ScrapedRecipeData {
  title: string;
  description: string;
  imageUri: string | null;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  ingredients: Ingredient[];
  steps: Step[];
  sourceUrl: string;
}

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

function decodeHtmlEntities(value: string): string {
  let decoded = value;
  for (const [entity, replacement] of Object.entries(HTML_ENTITY_MAP)) {
    decoded = decoded.split(entity).join(replacement);
  }
  decoded = decoded.replace(/&#(\d+);/g, (_, code) => {
    const parsed = Number(code);
    return Number.isFinite(parsed) ? String.fromCharCode(parsed) : _;
  });
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    const parsed = parseInt(hex, 16);
    return Number.isFinite(parsed) ? String.fromCharCode(parsed) : _;
  });
  return decoded;
}

function stripHtmlTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function normalizeImportUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) throw new Error('Please enter a recipe URL.');

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error('That URL does not look valid. Try a full recipe page link.');
  }

  if (!/^https?:$/i.test(parsed.protocol)) {
    throw new Error('Only HTTP or HTTPS recipe URLs are supported.');
  }
  return parsed.toString();
}

function toTypeList(input: unknown): string[] {
  if (Array.isArray(input)) return input.map((item) => String(item).toLowerCase());
  if (typeof input === 'string') return [input.toLowerCase()];
  return [];
}

function safeParseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function findRecipeObject(candidate: unknown): Record<string, any> | null {
  if (!candidate) return null;

  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      const found = findRecipeObject(item);
      if (found) return found;
    }
    return null;
  }

  if (typeof candidate !== 'object') return null;
  const obj = candidate as Record<string, any>;

  if (toTypeList(obj['@type']).some((type) => type.includes('recipe'))) {
    return obj;
  }

  if (obj['@graph']) {
    const foundInGraph = findRecipeObject(obj['@graph']);
    if (foundInGraph) return foundInGraph;
  }

  for (const value of Object.values(obj)) {
    const nested = findRecipeObject(value);
    if (nested) return nested;
  }

  return null;
}

function extractMetaContent(html: string, key: string, attr: 'name' | 'property' = 'property'): string {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    `<meta[^>]*${attr}=["']${escapedKey}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    'i'
  );
  const match = html.match(regex);
  return match?.[1] ? stripHtmlTags(match[1]) : '';
}

function extractTitleTag(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch?.[1] ? stripHtmlTags(titleMatch[1]) : '';
}

function normalizeImageUrl(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const cleaned = value.trim();
    return cleaned || null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = normalizeImageUrl(item);
      if (parsed) return parsed;
    }
    return null;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return normalizeImageUrl(obj.url || obj['@id']);
  }
  return null;
}

function parseIso8601DurationMinutes(value: string): number | null {
  const match = value.match(
    /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i
  );
  if (!match) return null;

  const days = Number(match[1] || 0);
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  const seconds = Number(match[4] || 0);
  const totalMinutes = days * 1440 + hours * 60 + minutes + seconds / 60;
  return Number.isFinite(totalMinutes) && totalMinutes > 0 ? Math.round(totalMinutes) : null;
}

function parseHumanDurationMinutes(value: string): number | null {
  const normalized = value.toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return null;

  // "1:30" => 90 min, "0:45" => 45 min
  const clockMatch = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (clockMatch) {
    const hours = Number(clockMatch[1]);
    const minutes = Number(clockMatch[2]);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      return Math.max(0, Math.round(hours * 60 + minutes));
    }
  }

  let totalMinutes = 0;

  const dayMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(d|day|days)\b/);
  if (dayMatch) totalMinutes += Number(dayMatch[1]) * 1440;

  const hourMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b/);
  if (hourMatch) totalMinutes += Number(hourMatch[1]) * 60;

  const minuteMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes)\b/);
  if (minuteMatch) totalMinutes += Number(minuteMatch[1]);

  const secondMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds)\b/);
  if (secondMatch) totalMinutes += Number(secondMatch[1]) / 60;

  if (totalMinutes > 0) return Math.max(1, Math.round(totalMinutes));

  if (/^\d+(\.\d+)?$/.test(normalized)) {
    const raw = Number(normalized);
    if (Number.isFinite(raw) && raw > 0) {
      // Treat plain numeric strings as minutes.
      return Math.max(1, Math.round(raw));
    }
  }

  return null;
}

function parseRecipeDurationMinutes(value: unknown): number | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = parseRecipeDurationMinutes(item);
      if (parsed !== null) return parsed;
    }
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return (
      parseRecipeDurationMinutes(obj['@value']) ||
      parseRecipeDurationMinutes(obj.value) ||
      parseRecipeDurationMinutes(obj.duration) ||
      parseRecipeDurationMinutes(obj.text)
    );
  }

  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const fromIso = parseIso8601DurationMinutes(trimmed);
  if (fromIso !== null) return fromIso;

  return parseHumanDurationMinutes(trimmed);
}

function extractRecipeInstructions(value: unknown): string[] {
  if (!value) return [];

  if (typeof value === 'string') {
    return value
      .split(/\r?\n+/)
      .map((line) => stripHtmlTags(line))
      .filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractRecipeInstructions(item));
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === 'string') return [stripHtmlTags(obj.text)];
    if (Array.isArray(obj.itemListElement)) return extractRecipeInstructions(obj.itemListElement);
    if (typeof obj.name === 'string') return [stripHtmlTags(obj.name)];
  }

  return [];
}

function dedupePreserveOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of items) {
    const normalized = item.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(item.trim());
  }
  return output;
}

function normalizeIngredientLines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return dedupePreserveOrder(
    value
      .map((item) => (typeof item === 'string' ? stripHtmlTags(item) : ''))
      .filter(Boolean)
  );
}

function extractItemPropList(html: string, itemProp: string): string[] {
  const escaped = itemProp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    `<(?:li|span|p)[^>]*itemprop=["']${escaped}["'][^>]*>([\\s\\S]*?)<\\/(?:li|span|p)>`,
    'gi'
  );
  const output: string[] = [];
  let match: RegExpExecArray | null = regex.exec(html);
  while (match) {
    const text = stripHtmlTags(match[1]);
    if (text) output.push(text);
    match = regex.exec(html);
  }
  return dedupePreserveOrder(output);
}

export async function scrapeRecipeFromUrl(rawUrl: string): Promise<ScrapedRecipeData> {
  const sourceUrl = normalizeImportUrl(rawUrl);

  let response: Response;
  try {
    response = await fetch(sourceUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
      },
    });
  } catch {
    throw new Error('Could not load that URL. Check your connection and try again.');
  }

  if (!response.ok) {
    throw new Error(`Recipe page request failed (${response.status}).`);
  }

  const html = await response.text();
  if (!html || html.length < 200) {
    throw new Error('The page content was empty or blocked.');
  }

  const scriptRegex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const jsonCandidates: unknown[] = [];
  let scriptMatch: RegExpExecArray | null = scriptRegex.exec(html);
  while (scriptMatch) {
    const parsed = safeParseJson(scriptMatch[1].trim());
    if (parsed) jsonCandidates.push(parsed);
    scriptMatch = scriptRegex.exec(html);
  }

  let recipeObject: Record<string, any> | null = null;
  for (const candidate of jsonCandidates) {
    const found = findRecipeObject(candidate);
    if (found) {
      recipeObject = found;
      break;
    }
  }

  const title =
    stripHtmlTags(recipeObject?.name || '') ||
    extractMetaContent(html, 'og:title') ||
    extractMetaContent(html, 'twitter:title', 'name') ||
    extractTitleTag(html);

  const description =
    stripHtmlTags(recipeObject?.description || '') ||
    extractMetaContent(html, 'description', 'name') ||
    extractMetaContent(html, 'og:description');

  const imageUri =
    normalizeImageUrl(recipeObject?.image) ||
    extractMetaContent(html, 'og:image') ||
    null;

  const prepTimeFromSchema = parseRecipeDurationMinutes(recipeObject?.prepTime);
  const cookTimeFromSchema = parseRecipeDurationMinutes(recipeObject?.cookTime);
  const totalTimeFromSchema = parseRecipeDurationMinutes(recipeObject?.totalTime);

  let prepTimeMinutes = prepTimeFromSchema ?? 0;
  let cookTimeMinutes = cookTimeFromSchema ?? 0;
  if (totalTimeFromSchema !== null) {
    if (prepTimeFromSchema === null && cookTimeFromSchema === null) {
      cookTimeMinutes = totalTimeFromSchema;
    } else if (prepTimeFromSchema === null && cookTimeFromSchema !== null) {
      prepTimeMinutes = Math.max(0, totalTimeFromSchema - cookTimeFromSchema);
    } else if (prepTimeFromSchema !== null && cookTimeFromSchema === null) {
      cookTimeMinutes = Math.max(0, totalTimeFromSchema - prepTimeFromSchema);
    }
  }

  const fromJsonIngredients = normalizeIngredientLines(recipeObject?.recipeIngredient);
  const ingredientLines = fromJsonIngredients.length
    ? fromJsonIngredients
    : extractItemPropList(html, 'recipeIngredient');
  const fromJsonInstructions = dedupePreserveOrder(
    extractRecipeInstructions(recipeObject?.recipeInstructions)
  );
  const instructionLinesRaw = fromJsonInstructions.length
    ? fromJsonInstructions
    : extractItemPropList(html, 'recipeInstructions');

  const instructionLines = instructionLinesRaw
    .map((line) => line.replace(/^\d+[.)]\s*/, '').trim())
    .filter(Boolean);

  const ingredients = parseIngredientsFromText(ingredientLines.join('\n'));
  const steps = parseStepsFromText(instructionLines.join('\n\n'));

  if (!title) {
    throw new Error('Could not find a recipe title on that page.');
  }
  if (!ingredients.length) {
    throw new Error('Could not find ingredients on that page.');
  }
  if (!steps.length) {
    throw new Error('Could not find step-by-step instructions on that page.');
  }

  return {
    title,
    description,
    imageUri,
    prepTimeMinutes,
    cookTimeMinutes,
    ingredients,
    steps,
    sourceUrl,
  };
}

interface SaveRecipeParams {
  title: string;
  description: string;
  imageUri: string | null;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  ingredients: Ingredient[];
  steps: Step[];
  importMethod: 'photo' | 'manual' | 'url';
}

function sanitizeIngredientsForFirestore(ingredients: Ingredient[]): Ingredient[] {
  return ingredients
    .map((ingredient) => {
      const base: Ingredient = {
        name: `${ingredient.name || ''}`.trim(),
        quantity:
          typeof ingredient.quantity === 'number' && Number.isFinite(ingredient.quantity)
            ? ingredient.quantity
            : 0,
        unit: `${ingredient.unit || ''}`.trim(),
        isOptional: !!ingredient.isOptional,
        category: ingredient.category || 'other',
      };
      if (typeof ingredient.preparation === 'string' && ingredient.preparation.trim()) {
        base.preparation = ingredient.preparation.trim();
      }
      return base;
    })
    .filter((ingredient) => ingredient.name.length > 0 && ingredient.quantity > 0);
}

function sanitizeStepsForFirestore(steps: Step[]): Step[] {
  return steps
    .map((step, index) => {
      const base: Step = {
        number:
          typeof step.number === 'number' && Number.isFinite(step.number)
            ? step.number
            : index + 1,
        instruction: `${step.instruction || ''}`.trim(),
        timerRequired: !!step.timerRequired,
      };
      if (typeof step.duration === 'number' && Number.isFinite(step.duration) && step.duration > 0) {
        base.duration = step.duration;
      }
      if (typeof step.tips === 'string' && step.tips.trim()) {
        base.tips = step.tips.trim();
      }
      return base;
    })
    .filter((step) => step.instruction.length > 0);
}

/**
 * Saves imported recipe to Firestore
 * @param params - Recipe data to save
 * @returns Promise resolving to the new recipe ID
 * @throws Error if user is not authenticated or save fails
 */
export async function saveImportedRecipe(params: SaveRecipeParams): Promise<string> {
  const auth = getAuth();
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error('User must be authenticated to save recipes');
  }

  try {
    const app = getApp();
    const firestore = getFirestore(app);

    const sanitizedIngredients = sanitizeIngredientsForFirestore(params.ingredients);
    const sanitizedSteps = sanitizeStepsForFirestore(params.steps);
    if (!sanitizedIngredients.length || !sanitizedSteps.length) {
      throw new Error(
        'Imported recipe is missing valid ingredients or instructions after cleanup. Please review and edit.'
      );
    }

    // Create new recipe document
    const recipesCollection = collection(firestore, 'recipes');

    const newRecipeRef = await addDoc(recipesCollection, {
      title: `${params.title || ''}`.trim(),
      description: `${params.description || ''}`.trim(),
      imageUrl: params.imageUri || '',
      ingredients: sanitizedIngredients,
      steps: sanitizedSteps,
      createdBy: currentUser.uid,
      importMethod: params.importMethod,
      servings: 4,
      cuisine: '',
      tags: ['imported'],
      prepTimeMinutes:
        typeof params.prepTimeMinutes === 'number' && Number.isFinite(params.prepTimeMinutes)
          ? Math.max(0, Math.round(params.prepTimeMinutes))
          : 0,
      cookTimeMinutes:
        typeof params.cookTimeMinutes === 'number' && Number.isFinite(params.cookTimeMinutes)
          ? Math.max(0, Math.round(params.cookTimeMinutes))
          : 0,
      substitutions: {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const recipeId = newRecipeRef.id;

    // Add recipe ID to user's favorites
    const userDocRef = doc(firestore, 'users', currentUser.uid);
    await updateDoc(userDocRef, {
      favorites: arrayUnion(recipeId),
    });

    return recipeId;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('PERMISSION_DENIED')) {
        throw new Error(
          'Permission denied. Please ensure Firestore permissions are configured correctly.'
        );
      }
      throw new Error(`Failed to save recipe: ${error.message}`);
    }
    throw new Error('Failed to save recipe. Unknown error.');
  }
}
