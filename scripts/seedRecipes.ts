/**
 * Firestore Recipe Seed Script
 *
 * Run with: npx ts-node scripts/seedRecipes.ts
 *
 * Prerequisites:
 *   1. Install: npm install -D ts-node firebase-admin
 *   2. Download a Firebase Admin SDK service account key from:
 *      Firebase Console → Project Settings → Service Accounts → Generate New Private Key
 *   3. Save it as `scripts/serviceAccountKey.json` (gitignored)
 *   4. Update the FIREBASE_PROJECT_ID below
 */

import * as admin from 'firebase-admin';
import * as path from 'path';

// --- CONFIG ---
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'serviceAccountKey.json');
const FIREBASE_PROJECT_ID = 'YOUR_PROJECT_ID'; // <-- Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(SERVICE_ACCOUNT_PATH),
  projectId: FIREBASE_PROJECT_ID,
});

const db = admin.firestore();

// ─── Recipe Data ────────────────────────────────────────────────────────────

const recipes = [
  {
    title: 'Classic Spaghetti Aglio e Olio',
    description:
      'A simple Roman pasta with garlic, olive oil, and chili flakes. Ready in 20 minutes with pantry staples.',
    imageUrl: '',
    prepTimeMinutes: 5,
    cookTimeMinutes: 15,
    servings: 4,
    difficulty: 'easy',
    cuisine: 'Italian',
    tags: ['quick', 'vegetarian', 'pantry-friendly'],
    ingredients: [
      { name: 'spaghetti', quantity: 400, unit: 'g', isOptional: false, category: 'pantry' },
      { name: 'garlic', quantity: 6, unit: 'cloves', preparation: 'thinly sliced', isOptional: false, category: 'produce' },
      { name: 'extra virgin olive oil', quantity: 0.33, unit: 'cup', isOptional: false, category: 'pantry' },
      { name: 'red pepper flakes', quantity: 0.5, unit: 'tsp', isOptional: false, category: 'spice' },
      { name: 'fresh parsley', quantity: 0.25, unit: 'cup', preparation: 'chopped', isOptional: false, category: 'produce' },
      { name: 'parmesan cheese', quantity: 0.5, unit: 'cup', preparation: 'grated', isOptional: true, category: 'dairy' },
      { name: 'salt', quantity: 1, unit: 'tbsp', isOptional: false, category: 'spice' },
    ],
    steps: [
      { number: 1, instruction: 'Bring a large pot of heavily salted water to a boil. Cook spaghetti according to package directions until al dente. Reserve 1 cup of pasta water before draining.', duration: 600, timerRequired: true, tips: 'The pasta water is starchy and will help the sauce cling to the noodles.' },
      { number: 2, instruction: 'While the pasta cooks, heat the olive oil in a large skillet over medium-low heat. Add the sliced garlic and red pepper flakes.', duration: null, timerRequired: false },
      { number: 3, instruction: 'Cook the garlic slowly, stirring occasionally, until it turns light golden. Be careful not to burn it — it goes from golden to bitter very quickly.', duration: 180, timerRequired: false, tips: 'Keep the heat low. If the garlic starts browning too fast, remove the pan from heat briefly.' },
      { number: 4, instruction: 'Add the drained spaghetti directly to the skillet with the garlic oil. Toss well, adding a splash of the reserved pasta water to create a light sauce.', duration: null, timerRequired: false },
      { number: 5, instruction: 'Remove from heat. Toss in the chopped parsley, and season with salt to taste. Serve with grated parmesan if desired.', duration: null, timerRequired: false },
    ],
    substitutions: {
      'spaghetti': [
        { name: 'linguine', ratio: 'same amount', notes: 'Works perfectly as a substitute.' },
        { name: 'gluten-free spaghetti', ratio: 'same amount', notes: 'Cook time may vary slightly.' },
      ],
      'red pepper flakes': [
        { name: 'fresh chili', ratio: '1 small chili, sliced', notes: 'Adds a fresher heat.' },
      ],
      'parsley': [
        { name: 'basil', ratio: 'same amount', notes: 'Different flavor profile but works well.' },
      ],
      'parmesan cheese': [
        { name: 'pecorino romano', ratio: 'same amount', notes: 'Saltier and sharper in flavor.' },
        { name: 'nutritional yeast', ratio: '2 tbsp', notes: 'Vegan option with a cheesy flavor.' },
      ],
    },
  },
  {
    title: 'One-Pan Lemon Herb Chicken Thighs',
    description:
      'Juicy chicken thighs roasted with lemon, garlic, and herbs. Minimal prep, maximum flavor.',
    imageUrl: '',
    prepTimeMinutes: 10,
    cookTimeMinutes: 35,
    servings: 4,
    difficulty: 'easy',
    cuisine: 'American',
    tags: ['one-pan', 'gluten-free', 'high-protein'],
    ingredients: [
      { name: 'chicken thighs', quantity: 6, unit: 'pieces', preparation: 'bone-in, skin-on', isOptional: false, category: 'protein' },
      { name: 'lemon', quantity: 2, unit: 'whole', preparation: '1 juiced, 1 sliced', isOptional: false, category: 'produce' },
      { name: 'garlic', quantity: 4, unit: 'cloves', preparation: 'minced', isOptional: false, category: 'produce' },
      { name: 'olive oil', quantity: 2, unit: 'tbsp', isOptional: false, category: 'pantry' },
      { name: 'dried oregano', quantity: 1, unit: 'tsp', isOptional: false, category: 'spice' },
      { name: 'dried thyme', quantity: 1, unit: 'tsp', isOptional: false, category: 'spice' },
      { name: 'paprika', quantity: 0.5, unit: 'tsp', isOptional: false, category: 'spice' },
      { name: 'salt', quantity: 1, unit: 'tsp', isOptional: false, category: 'spice' },
      { name: 'black pepper', quantity: 0.5, unit: 'tsp', isOptional: false, category: 'spice' },
    ],
    steps: [
      { number: 1, instruction: 'Preheat your oven to 425 degrees Fahrenheit (220 Celsius).', duration: null, timerRequired: false },
      { number: 2, instruction: 'In a small bowl, mix the olive oil, lemon juice, minced garlic, oregano, thyme, paprika, salt, and pepper.', duration: null, timerRequired: false },
      { number: 3, instruction: 'Pat the chicken thighs dry with paper towels. Place them skin-side up in a baking dish or cast iron skillet. Pour the herb mixture over the chicken, rubbing it in well.', duration: null, timerRequired: false, tips: 'Patting the chicken dry helps the skin get crispy.' },
      { number: 4, instruction: 'Tuck the lemon slices around the chicken pieces.', duration: null, timerRequired: false },
      { number: 5, instruction: 'Roast in the oven for 35 minutes, or until the internal temperature reaches 165 degrees Fahrenheit and the skin is golden and crispy.', duration: 2100, timerRequired: true, tips: 'If the skin isn\'t crispy enough, broil for the last 2-3 minutes.' },
      { number: 6, instruction: 'Let the chicken rest for 5 minutes before serving. Spoon the pan juices over the top.', duration: 300, timerRequired: true },
    ],
    substitutions: {
      'chicken thighs': [
        { name: 'chicken drumsticks', ratio: '8 drumsticks', notes: 'Slightly less meat per piece but same cook time.' },
        { name: 'chicken breasts', ratio: '4 breasts', notes: 'Reduce cook time to 25 minutes. Less forgiving if overcooked.' },
      ],
      'dried oregano': [
        { name: 'Italian seasoning', ratio: '2 tsp', notes: 'A blend that includes oregano plus other herbs.' },
      ],
      'lemon': [
        { name: 'lime', ratio: 'same amount', notes: 'Slightly different citrus flavor but works well.' },
      ],
    },
  },
  {
    title: 'Thai Basil Stir-Fry (Pad Krapao)',
    description:
      'A spicy, aromatic Thai stir-fry with ground pork, fresh basil, and chilies. Street food flavor in 15 minutes.',
    imageUrl: '',
    prepTimeMinutes: 5,
    cookTimeMinutes: 10,
    servings: 2,
    difficulty: 'medium',
    cuisine: 'Thai',
    tags: ['quick', 'spicy', 'street-food'],
    ingredients: [
      { name: 'ground pork', quantity: 300, unit: 'g', isOptional: false, category: 'protein' },
      { name: 'Thai basil leaves', quantity: 1, unit: 'cup', preparation: 'packed', isOptional: false, category: 'produce' },
      { name: 'Thai chilies', quantity: 4, unit: 'pieces', preparation: 'roughly chopped', isOptional: false, category: 'produce' },
      { name: 'garlic', quantity: 4, unit: 'cloves', preparation: 'minced', isOptional: false, category: 'produce' },
      { name: 'soy sauce', quantity: 1.5, unit: 'tbsp', isOptional: false, category: 'pantry' },
      { name: 'oyster sauce', quantity: 1, unit: 'tbsp', isOptional: false, category: 'pantry' },
      { name: 'fish sauce', quantity: 1, unit: 'tsp', isOptional: false, category: 'pantry' },
      { name: 'sugar', quantity: 1, unit: 'tsp', isOptional: false, category: 'pantry' },
      { name: 'vegetable oil', quantity: 2, unit: 'tbsp', isOptional: false, category: 'pantry' },
      { name: 'jasmine rice', quantity: 2, unit: 'cups', preparation: 'cooked', isOptional: false, category: 'pantry' },
      { name: 'eggs', quantity: 2, unit: 'pieces', isOptional: true, category: 'protein' },
    ],
    steps: [
      { number: 1, instruction: 'Make sure your rice is already cooked and ready. Prepare all ingredients before you start — this cooks fast.', duration: null, timerRequired: false, tips: 'Thai stir-fries move quickly. Have everything chopped and measured before turning on the heat.' },
      { number: 2, instruction: 'Heat the oil in a wok or large skillet over high heat until it just begins to smoke.', duration: null, timerRequired: false },
      { number: 3, instruction: 'Add the garlic and chilies. Stir-fry for about 30 seconds until fragrant.', duration: 30, timerRequired: false },
      { number: 4, instruction: 'Add the ground pork. Break it up with your spatula and stir-fry on high heat until cooked through and slightly caramelized, about 3 to 4 minutes.', duration: 240, timerRequired: false },
      { number: 5, instruction: 'Add the soy sauce, oyster sauce, fish sauce, and sugar. Stir everything together for about 30 seconds.', duration: null, timerRequired: false },
      { number: 6, instruction: 'Remove from heat and fold in the Thai basil leaves. They will wilt from the residual heat.', duration: null, timerRequired: false, tips: 'Adding basil off-heat preserves its aroma.' },
      { number: 7, instruction: 'If making a fried egg, fry it separately in a bit of oil until the edges are crispy but the yolk is still runny.', duration: null, timerRequired: false },
      { number: 8, instruction: 'Serve over jasmine rice with the fried egg on top.', duration: null, timerRequired: false },
    ],
    substitutions: {
      'ground pork': [
        { name: 'ground chicken', ratio: 'same amount', notes: 'Lighter flavor, very traditional in Thailand too.' },
        { name: 'firm tofu', ratio: '300g, crumbled', notes: 'Press and crumble for a vegetarian version.' },
      ],
      'Thai basil': [
        { name: 'Italian basil', ratio: 'same amount', notes: 'Different flavor but acceptable in a pinch. The taste will be less peppery.' },
      ],
      'Thai chilies': [
        { name: 'serrano peppers', ratio: '2 peppers', notes: 'Less heat than Thai chilies.' },
        { name: 'red pepper flakes', ratio: '1 tsp', notes: 'Convenient but lacks the fresh chili flavor.' },
      ],
      'oyster sauce': [
        { name: 'hoisin sauce', ratio: '1 tbsp', notes: 'Sweeter but provides similar umami depth.' },
      ],
      'fish sauce': [
        { name: 'soy sauce', ratio: '1 tsp extra soy sauce', notes: 'Loses the funky depth of fish sauce, but still savory.' },
      ],
    },
  },
  {
    title: 'Classic Beef Tacos',
    description:
      'Seasoned ground beef tacos with fresh toppings. A family favorite that comes together in under 30 minutes.',
    imageUrl: '',
    prepTimeMinutes: 10,
    cookTimeMinutes: 15,
    servings: 4,
    difficulty: 'easy',
    cuisine: 'Mexican',
    tags: ['family-friendly', 'quick', 'customizable'],
    ingredients: [
      { name: 'ground beef', quantity: 500, unit: 'g', isOptional: false, category: 'protein' },
      { name: 'taco shells', quantity: 8, unit: 'pieces', isOptional: false, category: 'pantry' },
      { name: 'onion', quantity: 1, unit: 'medium', preparation: 'diced', isOptional: false, category: 'produce' },
      { name: 'garlic', quantity: 2, unit: 'cloves', preparation: 'minced', isOptional: false, category: 'produce' },
      { name: 'chili powder', quantity: 2, unit: 'tsp', isOptional: false, category: 'spice' },
      { name: 'cumin', quantity: 1, unit: 'tsp', isOptional: false, category: 'spice' },
      { name: 'paprika', quantity: 0.5, unit: 'tsp', isOptional: false, category: 'spice' },
      { name: 'salt', quantity: 0.5, unit: 'tsp', isOptional: false, category: 'spice' },
      { name: 'tomato paste', quantity: 2, unit: 'tbsp', isOptional: false, category: 'pantry' },
      { name: 'water', quantity: 0.25, unit: 'cup', isOptional: false, category: 'other' },
      { name: 'shredded lettuce', quantity: 2, unit: 'cups', isOptional: false, category: 'produce' },
      { name: 'tomato', quantity: 2, unit: 'medium', preparation: 'diced', isOptional: false, category: 'produce' },
      { name: 'shredded cheddar cheese', quantity: 1, unit: 'cup', isOptional: true, category: 'dairy' },
      { name: 'sour cream', quantity: 0.5, unit: 'cup', isOptional: true, category: 'dairy' },
      { name: 'lime', quantity: 1, unit: 'whole', preparation: 'cut into wedges', isOptional: true, category: 'produce' },
    ],
    steps: [
      { number: 1, instruction: 'Heat a large skillet over medium-high heat. Add the ground beef and diced onion. Cook, breaking up the meat with a spoon, until the beef is browned and the onion is soft, about 6 to 7 minutes. Drain any excess fat.', duration: 420, timerRequired: false },
      { number: 2, instruction: 'Add the minced garlic, chili powder, cumin, paprika, and salt. Stir and cook for 1 minute until fragrant.', duration: 60, timerRequired: false },
      { number: 3, instruction: 'Stir in the tomato paste and water. Reduce heat to medium-low and simmer for 5 minutes until the sauce thickens and coats the meat.', duration: 300, timerRequired: true, tips: 'If it gets too thick, add a splash more water.' },
      { number: 4, instruction: 'While the meat simmers, warm the taco shells according to package directions.', duration: null, timerRequired: false },
      { number: 5, instruction: 'Set up your toppings: lettuce, diced tomato, shredded cheese, sour cream, and lime wedges.', duration: null, timerRequired: false },
      { number: 6, instruction: 'Spoon the seasoned beef into the taco shells and top with your favorite toppings. Squeeze lime over the top and enjoy.', duration: null, timerRequired: false },
    ],
    substitutions: {
      'ground beef': [
        { name: 'ground turkey', ratio: 'same amount', notes: 'Leaner option, slightly different flavor.' },
        { name: 'black beans', ratio: '1 can (400g), drained', notes: 'Vegetarian option. Mash half for texture.' },
      ],
      'taco shells': [
        { name: 'flour tortillas', ratio: '8 small tortillas', notes: 'Warm in a dry skillet for 30 seconds each side.' },
        { name: 'lettuce wraps', ratio: '8 large lettuce leaves', notes: 'Low-carb option using iceberg or butter lettuce.' },
      ],
      'sour cream': [
        { name: 'Greek yogurt', ratio: 'same amount', notes: 'Higher protein, very similar taste and texture.' },
      ],
      'cheddar cheese': [
        { name: 'Monterey Jack', ratio: 'same amount', notes: 'Melts beautifully, milder flavor.' },
        { name: 'cotija cheese', ratio: '0.5 cup, crumbled', notes: 'More authentic Mexican flavor. Salty and crumbly.' },
      ],
    },
  },
  {
    title: 'Vegetable Fried Rice',
    description:
      'A quick and satisfying one-wok meal. Perfect for using up leftover rice and whatever vegetables you have on hand.',
    imageUrl: '',
    prepTimeMinutes: 10,
    cookTimeMinutes: 10,
    servings: 3,
    difficulty: 'easy',
    cuisine: 'Chinese',
    tags: ['vegetarian', 'quick', 'leftover-friendly'],
    ingredients: [
      { name: 'cooked rice', quantity: 3, unit: 'cups', preparation: 'day-old, cold', isOptional: false, category: 'pantry' },
      { name: 'eggs', quantity: 2, unit: 'pieces', preparation: 'beaten', isOptional: false, category: 'protein' },
      { name: 'carrot', quantity: 1, unit: 'medium', preparation: 'diced small', isOptional: false, category: 'produce' },
      { name: 'frozen peas', quantity: 0.5, unit: 'cup', isOptional: false, category: 'produce' },
      { name: 'green onions', quantity: 3, unit: 'stalks', preparation: 'sliced', isOptional: false, category: 'produce' },
      { name: 'garlic', quantity: 2, unit: 'cloves', preparation: 'minced', isOptional: false, category: 'produce' },
      { name: 'soy sauce', quantity: 2, unit: 'tbsp', isOptional: false, category: 'pantry' },
      { name: 'sesame oil', quantity: 1, unit: 'tsp', isOptional: false, category: 'pantry' },
      { name: 'vegetable oil', quantity: 2, unit: 'tbsp', isOptional: false, category: 'pantry' },
      { name: 'white pepper', quantity: 0.25, unit: 'tsp', isOptional: true, category: 'spice' },
    ],
    steps: [
      { number: 1, instruction: 'Heat 1 tablespoon of vegetable oil in a wok or large skillet over high heat. Pour in the beaten eggs and scramble them quickly until just set, about 30 seconds. Remove and set aside.', duration: 30, timerRequired: false, tips: 'Don\'t overcook the eggs — they\'ll cook more when mixed back in.' },
      { number: 2, instruction: 'Add the remaining tablespoon of oil to the same wok over high heat. Add the diced carrot and stir-fry for 2 minutes until slightly tender.', duration: 120, timerRequired: false },
      { number: 3, instruction: 'Add the garlic, frozen peas, and the white parts of the green onions. Stir-fry for 1 minute.', duration: 60, timerRequired: false },
      { number: 4, instruction: 'Add the cold rice to the wok. Press it flat against the wok and let it sear for 30 seconds before tossing. Repeat this a few times to get some lightly crispy grains.', duration: null, timerRequired: false, tips: 'Cold, day-old rice works best because it\'s drier and won\'t get mushy.' },
      { number: 5, instruction: 'Drizzle the soy sauce around the edges of the wok so it sizzles and caramelizes slightly. Toss everything together.', duration: null, timerRequired: false },
      { number: 6, instruction: 'Add the scrambled eggs back in, breaking them into small pieces. Add the sesame oil and white pepper. Toss to combine.', duration: null, timerRequired: false },
      { number: 7, instruction: 'Garnish with the green parts of the green onions and serve immediately.', duration: null, timerRequired: false },
    ],
    substitutions: {
      'cooked rice': [
        { name: 'cauliflower rice', ratio: '3 cups', notes: 'Low-carb option. Cook separately first, then add at step 4.' },
      ],
      'frozen peas': [
        { name: 'edamame', ratio: 'same amount', notes: 'More protein, similar texture.' },
        { name: 'corn kernels', ratio: 'same amount', notes: 'Adds sweetness.' },
      ],
      'soy sauce': [
        { name: 'tamari', ratio: 'same amount', notes: 'Gluten-free alternative with similar flavor.' },
        { name: 'coconut aminos', ratio: '3 tbsp', notes: 'Milder and slightly sweet. Use a bit more.' },
      ],
      'sesame oil': [
        { name: 'toasted sesame seeds', ratio: '1 tbsp', notes: 'Sprinkle on top for a similar nutty flavor without the oil.' },
      ],
    },
  },
];

// ─── Seed Function ──────────────────────────────────────────────────────────

async function seed() {
  console.log('Seeding recipes...\n');

  const batch = db.batch();

  for (const recipe of recipes) {
    const ref = db.collection('recipes').doc();
    batch.set(ref, {
      ...recipe,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`  + ${recipe.title}`);
  }

  await batch.commit();
  console.log(`\nDone! Seeded ${recipes.length} recipes.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
