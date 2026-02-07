#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_CSV_PATH = path.resolve(process.cwd(), 'recipes_rows.csv');
const DEFAULT_COLLECTION = 'recipes';
const DEFAULT_SERVICE_ACCOUNT = path.resolve(process.cwd(), 'scripts', 'serviceAccountKey.json');
const DEFAULT_BATCH_SIZE = 400;

const FRACTION_MAP = {
  '1/2': 0.5,
  '1/3': 1 / 3,
  '2/3': 2 / 3,
  '1/4': 0.25,
  '3/4': 0.75,
  '1/8': 0.125,
  '3/8': 0.375,
  '5/8': 0.625,
  '7/8': 0.875,
};

const UNICODE_FRACTIONS = {
  '¼': '1/4',
  '½': '1/2',
  '¾': '3/4',
  '⅐': '1/7',
  '⅑': '1/9',
  '⅒': '1/10',
  '⅓': '1/3',
  '⅔': '2/3',
  '⅕': '1/5',
  '⅖': '2/5',
  '⅗': '3/5',
  '⅘': '4/5',
  '⅙': '1/6',
  '⅚': '5/6',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
};

const KNOWN_UNITS = new Set([
  'cup', 'cups', 'tablespoon', 'tablespoons', 'tbsp', 'teaspoon', 'teaspoons', 'tsp',
  'ounce', 'ounces', 'oz', 'fluid', 'fl', 'pound', 'pounds', 'lb', 'lbs', 'gram', 'grams', 'g',
  'kilogram', 'kilograms', 'kg', 'milliliter', 'milliliters', 'ml', 'liter', 'liters', 'l',
  'clove', 'cloves', 'slice', 'slices', 'piece', 'pieces', 'whole', 'stalk', 'stalks', 'can',
  'cans', 'sprig', 'sprigs', 'pinch', 'dash', 'head', 'heads',
]);

function parseArgs(argv) {
  const args = {
    csvPath: DEFAULT_CSV_PATH,
    collection: DEFAULT_COLLECTION,
    serviceAccountPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_SERVICE_ACCOUNT,
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    dryRun: false,
    limit: 0,
    batchSize: DEFAULT_BATCH_SIZE,
    merge: true,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--no-merge') {
      args.merge = false;
    } else if (arg === '--csv' && argv[i + 1]) {
      args.csvPath = path.resolve(process.cwd(), argv[++i]);
    } else if (arg === '--collection' && argv[i + 1]) {
      args.collection = argv[++i];
    } else if (arg === '--service-account' && argv[i + 1]) {
      args.serviceAccountPath = path.resolve(process.cwd(), argv[++i]);
    } else if (arg === '--project-id' && argv[i + 1]) {
      args.projectId = argv[++i];
    } else if (arg === '--limit' && argv[i + 1]) {
      args.limit = Number.parseInt(argv[++i], 10) || 0;
    } else if (arg === '--batch-size' && argv[i + 1]) {
      args.batchSize = Number.parseInt(argv[++i], 10) || DEFAULT_BATCH_SIZE;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Import recipes CSV into Firestore.

Usage:
  node scripts/importRecipesCsv.js [options]

Options:
  --csv <path>             CSV file path (default: ./recipes_rows.csv)
  --collection <name>      Firestore collection (default: recipes)
  --service-account <path> Firebase Admin service account JSON path
  --project-id <id>        Optional Firebase project id override
  --limit <n>              Import only first n rows (for testing)
  --batch-size <n>         Firestore batch size (default: 400)
  --dry-run                Parse and validate only, do not write to Firestore
  --no-merge               Replace documents instead of merge writes
  --help                   Show this help

Examples:
  node scripts/importRecipesCsv.js --dry-run --limit 5
  node scripts/importRecipesCsv.js --service-account scripts/serviceAccountKey.json
  node scripts/importRecipesCsv.js --project-id your-project-id
`.trim());
}

function parseCsv(csvText) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const ch = csvText[i];
    const next = i + 1 < csvText.length ? csvText[i + 1] : '';

    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    if (ch === '\r') {
      continue;
    }

    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toInt(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toFloat(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseJsonField(value, fallback) {
  if (!value || typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseTimestamp(value) {
  if (!value) return null;
  let normalized = String(value).trim();
  if (!normalized) return null;
  normalized = normalized.replace(' ', 'T').replace(/\+00$/, 'Z');
  normalized = normalized.replace(/\.(\d{3})\d+Z$/, '.$1Z');
  const parsedDate = new Date(normalized);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return parsedDate;
}

function parseServings(yieldsServings, yieldsText) {
  const direct = toInt(yieldsServings, 0);
  if (direct > 0) return direct;
  const match = String(yieldsText || '').match(/(\d+)/);
  if (!match) return 1;
  return toInt(match[1], 1);
}

function deriveDifficulty(totalMinutes) {
  if (totalMinutes <= 30) return 'easy';
  if (totalMinutes <= 75) return 'medium';
  return 'hard';
}

function normalizeTag(tag) {
  return String(tag || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildTags(category, cuisine, siteName) {
  const set = new Set();
  String(category || '')
    .split(',')
    .map(normalizeTag)
    .filter(Boolean)
    .forEach((tag) => set.add(tag));

  const cuisineTag = normalizeTag(cuisine);
  if (cuisineTag) set.add(cuisineTag);

  const siteTag = normalizeTag(siteName);
  if (siteTag) set.add(siteTag);

  return Array.from(set);
}

function normalizeFractions(text) {
  let output = text;
  Object.entries(UNICODE_FRACTIONS).forEach(([unicodeChar, asciiFraction]) => {
    output = output.split(unicodeChar).join(` ${asciiFraction} `);
  });
  return output.replace(/\s+/g, ' ').trim();
}

function parseFractionToken(token) {
  const clean = token.replace(',', '.');
  if (FRACTION_MAP[clean] !== undefined) return FRACTION_MAP[clean];
  if (/^\d+\/\d+$/.test(clean)) {
    const [num, denom] = clean.split('/').map((n) => Number.parseFloat(n));
    if (denom && Number.isFinite(num) && Number.isFinite(denom)) {
      return num / denom;
    }
  }
  const parsed = Number.parseFloat(clean);
  if (Number.isFinite(parsed)) return parsed;
  return null;
}

function inferIngredientCategory(name) {
  const text = name.toLowerCase();
  if (/(chicken|beef|pork|turkey|fish|salmon|shrimp|egg|tofu|beans|lentil)/.test(text)) {
    return 'protein';
  }
  if (/(milk|cheese|butter|cream|yogurt)/.test(text)) {
    return 'dairy';
  }
  if (/(salt|pepper|paprika|cumin|oregano|thyme|chili|spice)/.test(text)) {
    return 'spice';
  }
  if (/(rice|pasta|flour|oil|sugar|sauce|vinegar|bread|broth|stock)/.test(text)) {
    return 'pantry';
  }
  if (/(onion|garlic|tomato|lettuce|carrot|pepper|basil|ginger|lemon|lime|parsley)/.test(text)) {
    return 'produce';
  }
  return 'other';
}

function parseIngredientLine(line) {
  const raw = normalizeFractions(String(line || '').trim());
  if (!raw) return null;

  const tokens = raw.split(/\s+/).filter(Boolean);
  let quantity = 1;
  let tokenIndex = 0;

  const first = parseFractionToken(tokens[tokenIndex]);
  if (first !== null) {
    quantity = first;
    tokenIndex += 1;

    const second = parseFractionToken(tokens[tokenIndex]);
    if (second !== null && second < 1) {
      quantity += second;
      tokenIndex += 1;
    }

    if (tokens[tokenIndex] === '-' || tokens[tokenIndex] === 'to') {
      tokenIndex += 1;
      const rangeValue = parseFractionToken(tokens[tokenIndex]);
      if (rangeValue !== null) tokenIndex += 1;
    }
  }

  let unit = 'item';
  if (tokenIndex < tokens.length) {
    const firstUnit = tokens[tokenIndex].toLowerCase();
    const secondUnit = tokenIndex + 1 < tokens.length ? `${firstUnit} ${tokens[tokenIndex + 1].toLowerCase()}` : '';

    if (KNOWN_UNITS.has(secondUnit)) {
      unit = secondUnit;
      tokenIndex += 2;
    } else if (KNOWN_UNITS.has(firstUnit)) {
      unit = firstUnit;
      tokenIndex += 1;
    }
  }

  const name = tokens.slice(tokenIndex).join(' ').replace(/^\W+/, '').trim() || raw;

  return {
    name,
    quantity: Number.isFinite(quantity) && quantity > 0 ? Number.parseFloat(quantity.toFixed(3)) : 1,
    unit,
    isOptional: /\boptional\b/i.test(raw),
    category: inferIngredientCategory(name),
  };
}

function parseIngredients(ingredientsJson) {
  const list = Array.isArray(ingredientsJson) ? ingredientsJson : [];
  return list
    .map((line) => parseIngredientLine(line))
    .filter(Boolean);
}

function parseSteps(instructionsList, instructionText) {
  const list = Array.isArray(instructionsList) ? instructionsList : [];
  const normalized = list.length > 0
    ? list
    : String(instructionText || '')
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean);

  return normalized.map((instruction, index) => ({
    number: index + 1,
    instruction: String(instruction).trim(),
    timerRequired: false,
  }));
}

function removeUndefinedDeep(value) {
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(removeUndefinedDeep);
  if (value && typeof value === 'object') {
    const output = {};
    Object.entries(value).forEach(([key, entryValue]) => {
      if (entryValue === undefined) return;
      output[key] = removeUndefinedDeep(entryValue);
    });
    return output;
  }
  return value;
}

function buildRecipeDocument(record) {
  const prepTimeMinutes = toInt(record.prep_time_minutes, 0);
  const cookTimeMinutes = toInt(record.cook_time_minutes, 0);
  const totalTimeMinutes = toInt(record.total_time_minutes, prepTimeMinutes + cookTimeMinutes);

  const ingredientsJson = parseJsonField(record.ingredients_json, []);
  const instructionsListJson = parseJsonField(record.instructions_list_json, []);
  const nutrientsJson = parseJsonField(record.nutrients_json, {});

  return removeUndefinedDeep({
    title: normalizeText(record.title) || 'Untitled Recipe',
    description: normalizeText(record.description),
    imageUrl: normalizeText(record.image_url),
    prepTimeMinutes,
    cookTimeMinutes,
    servings: parseServings(record.yields_servings, record.yields_text),
    difficulty: deriveDifficulty(totalTimeMinutes),
    cuisine: normalizeText(record.cuisine) || 'General',
    tags: buildTags(record.category, record.cuisine, record.site_name),
    ingredients: parseIngredients(ingredientsJson),
    steps: parseSteps(instructionsListJson, record.instructions_text),
    substitutions: {},
    source: {
      canonicalUrl: normalizeText(record.canonical_url),
      host: normalizeText(record.host),
      siteName: normalizeText(record.site_name),
      author: normalizeText(record.author),
      language: normalizeText(record.language),
      ratings: toFloat(record.ratings, 0),
      ratingsCount: toInt(record.ratings_count, 0),
      yieldsText: normalizeText(record.yields_text),
      totalTimeMinutes,
    },
    nutrients: nutrientsJson && typeof nutrientsJson === 'object' ? nutrientsJson : {},
    _timestamps: {
      createdAtDate: parseTimestamp(record.created_at),
      updatedAtDate: parseTimestamp(record.updated_at),
    },
  });
}

function parseRowsToRecords(csvRows) {
  if (!Array.isArray(csvRows) || csvRows.length < 2) {
    throw new Error('CSV appears empty or missing data rows.');
  }

  const headers = csvRows[0].map((h) => String(h).trim());
  const records = [];

  for (let rowIndex = 1; rowIndex < csvRows.length; rowIndex += 1) {
    const row = csvRows[rowIndex];
    if (!row || row.length === 0) continue;
    if (row.length === 1 && String(row[0]).trim() === '') continue;

    const record = {};
    for (let i = 0; i < headers.length; i += 1) {
      record[headers[i]] = row[i] !== undefined ? row[i] : '';
    }
    records.push(record);
  }

  return records;
}

function getDocumentId(record, index) {
  const raw = normalizeText(record.id);
  if (raw) return raw;

  const canonical = normalizeText(record.canonical_url)
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);

  if (canonical) return canonical;
  return `recipe_${index + 1}`;
}

async function run() {
  const args = parseArgs(process.argv);

  if (!fs.existsSync(args.csvPath)) {
    throw new Error(`CSV not found: ${args.csvPath}`);
  }

  const csvText = fs.readFileSync(args.csvPath, 'utf8');
  const csvRows = parseCsv(csvText);
  const records = parseRowsToRecords(csvRows);
  const selected = args.limit > 0 ? records.slice(0, args.limit) : records;

  console.log(`Parsed ${records.length} row(s) from ${path.basename(args.csvPath)}.`);
  if (args.limit > 0) {
    console.log(`Using first ${selected.length} row(s) due to --limit=${args.limit}.`);
  }

  const documents = selected.map((record, index) => {
    const doc = buildRecipeDocument(record);
    return {
      id: getDocumentId(record, index),
      doc,
    };
  });

  console.log(`Prepared ${documents.length} document(s) for collection "${args.collection}".`);
  if (documents.length > 0) {
    const preview = documents[0];
    console.log('Sample document preview:', JSON.stringify({
      id: preview.id,
      title: preview.doc.title,
      servings: preview.doc.servings,
      difficulty: preview.doc.difficulty,
      tags: preview.doc.tags.slice(0, 5),
      ingredientsCount: preview.doc.ingredients.length,
      stepsCount: preview.doc.steps.length,
    }, null, 2));
  }

  if (args.dryRun) {
    console.log('Dry run complete. No Firestore writes performed.');
    return;
  }

  if (!fs.existsSync(args.serviceAccountPath)) {
    throw new Error(
      `Service account JSON not found at ${args.serviceAccountPath}. ` +
      'Set --service-account or GOOGLE_APPLICATION_CREDENTIALS.'
    );
  }

  let admin;
  try {
    admin = require('firebase-admin');
  } catch {
    throw new Error(
      'firebase-admin is not installed. Run: npm install firebase-admin'
    );
  }

  const serviceAccount = require(args.serviceAccountPath);
  const projectId = args.projectId || serviceAccount.project_id;

  if (!projectId) {
    throw new Error(
      'Missing Firebase project id. Provide --project-id or use a service account with project_id.'
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId,
  });

  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });

  let batch = db.batch();
  let batchCount = 0;
  let totalWritten = 0;

  for (let i = 0; i < documents.length; i += 1) {
    const { id, doc } = documents[i];
    const createdAtDate = doc._timestamps && doc._timestamps.createdAtDate;
    const updatedAtDate = doc._timestamps && doc._timestamps.updatedAtDate;
    delete doc._timestamps;

    const payload = {
      ...doc,
      createdAt: createdAtDate instanceof Date
        ? admin.firestore.Timestamp.fromDate(createdAtDate)
        : admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: updatedAtDate instanceof Date
        ? admin.firestore.Timestamp.fromDate(updatedAtDate)
        : admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = db.collection(args.collection).doc(id);
    batch.set(ref, payload, { merge: args.merge });
    batchCount += 1;

    if (batchCount >= args.batchSize || i === documents.length - 1) {
      await batch.commit();
      totalWritten += batchCount;
      console.log(`Committed ${totalWritten}/${documents.length} documents...`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  console.log(`Import complete. Wrote ${totalWritten} documents to "${args.collection}" in project "${projectId}".`);
}

run().catch((error) => {
  console.error('Import failed:', error.message);
  process.exit(1);
});
