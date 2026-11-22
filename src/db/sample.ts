// Sample data so a new user can see how the app looks when it is in use.
// Dates are set relative to today, so the samples never look stale.

import { putMany } from './idb.ts';
import { ensureOgEntries, ensureStarterIngredients, ingredients } from './store.ts';
import type { Batch, BatchEvent, BatchStatus, CellarEntry, EventType, IngredientCost, IngredientLine, IngredientStage, LibraryIngredient, Pour, Recipe } from './types.ts';
import { L_PER_GAL } from '../lib/calc.ts';
import { daysFromToday, newId } from '../lib/format.ts';
import { entryFromLine, joinAmount } from '../lib/stages.ts';

// Ingredients only the samples use (the rest are starter ingredients), priced so the samples show costs. Fixed ids: added once, never overwriting yours.
const SAMPLE_INGREDIENTS: Pick<LibraryIngredient, 'id' | 'name' | 'category' | 'defaultUnit' | 'notes' | 'cost'>[] = [
  { id: 'sample-spring-water', name: 'Spring water', category: 'other', defaultUnit: 'gal', notes: '', cost: { price: 1.49, quantity: 1, unit: 'gal' } },
  { id: 'sample-oranges', name: 'Oranges', category: 'fruit', defaultUnit: '', notes: '', cost: { price: 0.89, quantity: 1, unit: '' } },
];

// Prices for the starter ingredients the samples use. Loading sample data gives them these prices,
// only where an ingredient has no price yet, so a price you set is never replaced.
const SAMPLE_PRICES: Record<string, IngredientCost> = {
  'Wildflower honey': { price: 24.99, quantity: 12, unit: 'lb' },
  'Clover honey': { price: 19.99, quantity: 12, unit: 'lb' },
  'Orange blossom honey': { price: 29.99, quantity: 12, unit: 'lb' },
  'Apple juice': { price: 6.99, quantity: 1, unit: 'gal' },
  'Lalvin 71B': { price: 1.49, quantity: 1, unit: 'packet' },
  'Lalvin EC-1118': { price: 1.29, quantity: 1, unit: 'packet' },
  'Lalvin D47': { price: 1.49, quantity: 1, unit: 'packet' },
  'Fermaid O': { price: 14.99, quantity: 100, unit: 'g' },
  'Pectic enzyme': { price: 3.99, quantity: 24, unit: 'tsp' },
  'Cinnamon sticks': { price: 5.99, quantity: 12, unit: '' },
  'Oak cubes': { price: 7.99, quantity: 3, unit: 'oz' },
  Blackberries: { price: 8.99, quantity: 2, unit: 'lb' },
  Strawberries: { price: 3.99, quantity: 1, unit: 'lb' },
  Clove: { price: 4.49, quantity: 60, unit: '' },
};

const stamp = () => {
  const now = new Date().toISOString();
  return { createdAt: now, updatedAt: now, deletedAt: null };
};

/** Copies recipe lines into a batch with fresh ids and a stage for each, by name. */
const staged = (from: IngredientLine[], stages: Record<string, IngredientStage> = {}): IngredientLine[] =>
  from.map((line) => ({ ...line, id: newId(), stage: stages[line.name] ?? 'primary' }));

/** Library ids and prices by name, filled in when the sample data loads. */
let libraryIds = new Map<string, string>();
let libraryCosts = new Map<string, IngredientCost>();

/** One ingredient line, linked to the library ingredient of that name: name, quantity, unit and an optional note on the amount. */
const line = (name: string, quantity: string, unit: string, note = ''): IngredientLine => {
  const ingredientId = libraryIds.get(name.toLowerCase());
  return { id: newId(), name, quantity, unit, amount: [joinAmount(quantity, unit), note].filter(Boolean).join(', '), ...(ingredientId ? { ingredientId } : {}) };
};
const lines = (...items: Parameters<typeof line>[]): IngredientLine[] => items.map((args) => line(...args));

/** Batch lines keep the price they were bought at: the library's price, as when any batch is saved. */
const priced = (from: IngredientLine[]): IngredientLine[] =>
  from.map((l) => {
    const cost = libraryCosts.get(l.name.toLowerCase());
    return cost ? { ...l, cost } : l;
  });

const at = (daysAgo: number, hour = 18) => `${daysFromToday(-daysAgo)}T${String(hour).padStart(2, '0')}:00:00`;

export async function loadSampleData(): Promise<void> {
  // The samples use the starter ingredients, plus a few of their own.
  await ensureStarterIngredients();
  const existing = await ingredients.list();
  for (const item of SAMPLE_INGREDIENTS) if (!existing.some((i) => i.id === item.id)) await ingredients.save(item);
  // Starter ingredients the samples use get a price, unless they already have one.
  for (const item of await ingredients.list()) {
    const price = SAMPLE_PRICES[item.name];
    if (price && !item.cost) await ingredients.save({ ...item, cost: price });
  }
  const library = await ingredients.list();
  libraryIds = new Map(library.map((i) => [i.name.toLowerCase(), i.id]));
  libraryCosts = new Map(library.filter((i) => i.cost).map((i) => [i.name.toLowerCase(), i.cost as IngredientCost]));

  const recipe = (data: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'isPublished'>): Recipe => ({
    ...data,
    id: newId(),
    isPublished: false,
    ...stamp(),
  });

  const traditional = recipe({
    name: 'First Traditional',
    beverageType: 'mead',
    style: 'Traditional',
    batchSizeL: L_PER_GAL,
    targetOG: 1.1,
    targetFG: 1.0,
    ingredients: lines(['Wildflower honey', '3', 'lb'], ['Spring water', '1', 'gal', 'topped up'], ['Lalvin 71B', '1', 'packet'], ['Fermaid O', '4', 'g', 'split in 3']),
    steps: [
      'Sanitize everything that touches the mead.',
      'Mix the honey into half the water until dissolved, then top up to 1 gallon.',
      'Take an OG reading, then pitch the yeast.',
      'Add nutrients on days 1, 2 and 4.',
      'Rack off the sediment once gravity is stable, then age until clear.',
    ],
    icon: 'traditional',
    color: '#E8A33A',
    rating: 8,
    notes: 'A forgiving first recipe. Dry, clean and ready to drink in about three months.',
  });

  const blackberry = recipe({
    name: 'Bramble Melomel',
    beverageType: 'mead',
    style: 'Melomel',
    batchSizeL: L_PER_GAL,
    targetOG: 1.115,
    targetFG: 1.01,
    ingredients: lines(['Clover honey', '3', 'lb'], ['Blackberries', '2', 'lb', 'frozen'], ['Spring water', '1', 'gal', 'topped up'], ['Lalvin EC-1118', '1', 'packet'], ['Pectic enzyme', '0.5', 'tsp']),
    steps: [
      'Thaw the blackberries and add them to a sanitized bucket with pectic enzyme.',
      'Dissolve the honey in water and pour it over the fruit.',
      'Pitch the yeast. Punch the fruit cap down daily for the first week.',
      'Rack off the fruit after 2 to 3 weeks.',
      'Age at least 6 months.',
    ],
    icon: 'blackberry',
    color: '#4A2A5E',
    rating: 9,
    notes: 'Deep purple and jammy. Gets much better with a year in the bottle.',
  });

  const cyser = recipe({
    name: 'Orchard Cyser',
    beverageType: 'mead',
    style: 'Cyser',
    batchSizeL: L_PER_GAL,
    targetOG: 1.09,
    targetFG: 1.005,
    ingredients: lines(['Apple juice', '1', 'gal', 'no preservatives'], ['Orange blossom honey', '1.5', 'lb'], ['Cinnamon sticks', '1', ''], ['Lalvin D47', '1', 'packet']).map((l) =>
      l.name === 'Cinnamon sticks' ? { ...l, stage: 'secondary' as const } : l,
    ),
    steps: ['Warm a little juice and dissolve the honey in it.', 'Combine with the rest of the juice, take an OG reading and pitch the yeast.', 'Add the cinnamon stick in secondary for 1 to 2 weeks, tasting as you go.'],
    icon: 'apple',
    color: '#D9B44A',
    rating: null,
    notes: '',
  });

  const batch = (data: Omit<Batch, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Batch => ({ ...data, id: newId(), ...stamp() });

  const b1 = batch({
    name: 'Bramble Melomel #2',
    recipeId: blackberry.id,
    beverageType: 'mead',
    style: 'Melomel',
    status: 'primary',
    startDate: daysFromToday(-9),
    volumeL: L_PER_GAL,
    og: 1.114,
    targetFG: 1.01,
    ingredients: priced([...staged(blackberry.ingredients), { ...line('Oak cubes', '1', 'oz', 'medium toast'), stage: 'aging' }]),
    icon: 'blackberry',
    color: '#4A2A5E',
    rating: null,
    notes: '',
  });
  const b2 = batch({
    name: 'Orchard Cyser',
    recipeId: cyser.id,
    beverageType: 'mead',
    style: 'Cyser',
    status: 'secondary',
    startDate: daysFromToday(-34),
    volumeL: L_PER_GAL,
    og: 1.092,
    targetFG: 1.0,
    ingredients: priced(staged(cyser.ingredients, { 'Cinnamon sticks': 'secondary' })),
    icon: 'apple',
    color: '#D9B44A',
    rating: 7,
    notes: '',
  });
  const b3 = batch({
    name: 'Winter Spice',
    recipeId: null,
    beverageType: 'mead',
    style: 'Metheglin',
    status: 'aging',
    startDate: daysFromToday(-120),
    volumeL: L_PER_GAL,
    og: 1.105,
    targetFG: 1.0,
    ingredients: priced(lines(['Wildflower honey', '3', 'lb'], ['Cinnamon sticks', '2', ''], ['Clove', '4', ''], ['Oranges', '1', '', 'zest only'])),
    icon: 'cinnamon',
    color: '#B5672F',
    rating: 8.5,
    notes: 'Go easy on the cloves next time.',
  });
  const b4 = batch({
    name: 'Strawberry Sunrise',
    recipeId: null,
    beverageType: 'mead',
    style: 'Melomel',
    status: 'planned',
    startDate: daysFromToday(7),
    volumeL: L_PER_GAL,
    og: null,
    targetFG: 1.0,
    ingredients: priced(lines(['Clover honey', '2.5', 'lb'], ['Strawberries', '3', 'lb'])),
    icon: 'strawberry',
    color: '#E5646A',
    rating: null,
    notes: 'Waiting on a free carboy.',
  });
  const b5 = batch({
    name: 'First Traditional',
    recipeId: traditional.id,
    beverageType: 'mead',
    style: 'Traditional',
    status: 'bottled',
    startDate: daysFromToday(-210),
    volumeL: L_PER_GAL,
    og: 1.1,
    targetFG: 1.0,
    ingredients: priced(staged(traditional.ingredients)),
    icon: 'traditional',
    color: '#E8A33A',
    rating: 8,
    notes: '',
  });

  const event = (batchId: string, type: EventType, date: string, value: number | null = null, note = ''): BatchEvent => ({
    id: newId(),
    batchId,
    type,
    date,
    value,
    note,
    ...stamp(),
  });

  const stage = (batchId: string, date: string, fromStatus: BatchStatus, toStatus: BatchStatus, note = ''): BatchEvent => ({
    ...event(batchId, 'status', date, null, note),
    fromStatus,
    toStatus,
    auto: false,
  });

  const sampleEvents: BatchEvent[] = [
    ...b1.ingredients
      .filter((l) => l.stage === 'primary' && !l.name.startsWith('Pectic'))
      .map((l) => ({ ...event(b1.id, 'ingredient', at(9, 17)), ...entryFromLine(l), ingredientLineId: l.id })),
    event(b1.id, 'pitch', at(9), null, 'EC-1118, rehydrated'),
    event(b1.id, 'nutrient', at(8), null, 'Fermaid O, 1.5 g'),
    event(b1.id, 'gravity', at(7), 1.096),
    event(b1.id, 'nutrient', at(6), null, 'Fermaid O, 1.5 g'),
    event(b1.id, 'gravity', at(5), 1.071),
    event(b1.id, 'gravity', at(3), 1.048),
    event(b1.id, 'temperature', at(3, 19), 19.5),
    event(b1.id, 'gravity', at(1), 1.031, 'Airlock still busy'),

    event(b2.id, 'pitch', at(34)),
    event(b2.id, 'gravity', at(27), 1.05),
    event(b2.id, 'gravity', at(20), 1.018),
    event(b2.id, 'feeding', at(17), 1.034, 'Added 8 oz honey to push it a little stronger'),
    event(b2.id, 'gravity', at(13), 1.006),
    stage(b2.id, at(12), 'primary', 'secondary'),
    event(b2.id, 'rack', at(12), null, 'Racked off the yeast'),
    ...b2.ingredients
      .filter((l) => l.name === 'Cinnamon sticks')
      .map((l) => ({ ...event(b2.id, 'ingredient', at(12, 19)), ...entryFromLine(l), ingredientLineId: l.id })),
    { ...event(b2.id, 'tasting', at(4), null, 'Apple up front, cinnamon just showing. Pull the stick soon.'), rating: 7 },

    event(b3.id, 'pitch', at(120)),
    event(b3.id, 'gravity', at(106), 1.04),
    event(b3.id, 'gravity', at(92), 1.008),
    { ...event(b3.id, 'gravity', at(75), 1.002), final: true },
    event(b3.id, 'rack', at(74)),
    { ...event(b3.id, 'moved', at(73)), place: 'Basement' },
    { ...event(b3.id, 'stabilize', at(60), null, 'Sorbate and sulfite'), method: 'Chemical' },
    stage(b3.id, at(60), 'secondary', 'aging'),

    event(b5.id, 'pitch', at(210)),
    event(b5.id, 'gravity', at(196), 1.03),
    event(b5.id, 'gravity', at(180), 1.0),
    { ...event(b5.id, 'gravity', at(150), 0.998), final: true },
    stage(b5.id, at(95), 'aging', 'bottled', '5 × 750 mL'),
  ];

  const c1: CellarEntry = {
    id: newId(),
    batchId: b5.id,
    name: 'First Traditional',
    style: 'Traditional',
    bottleSizeMl: 750,
    count: 3,
    bottledDate: daysFromToday(-95),
    bestAfter: daysFromToday(-5),
    location: 'Hall closet, top shelf',
    abv: 13.4,
    icon: 'traditional',
    color: '#E8A33A',
    rating: 8,
    notes: '',
    ...stamp(),
  };
  const c2: CellarEntry = {
    id: newId(),
    batchId: null,
    name: 'Bramble Melomel #1',
    style: 'Melomel',
    bottleSizeMl: 375,
    count: 8,
    bottledDate: daysFromToday(-40),
    bestAfter: daysFromToday(140),
    location: 'Basement rack',
    abv: 13.8,
    icon: 'blackberry',
    color: '#4A2A5E',
    rating: null,
    notes: 'Still young. Try one at six months.',
    ...stamp(),
  };

  const samplePours: Pour[] = [
    { id: newId(), cellarEntryId: c1.id, date: daysFromToday(-30), count: 1, type: 'drank', note: 'Dry and floral. A little hot still.', rating: 7, ...stamp() },
    { id: newId(), cellarEntryId: c1.id, date: daysFromToday(-12), count: 1, type: 'gifted', note: 'For the neighbors', rating: null, ...stamp() },
  ];

  await putMany('recipes', [traditional, blackberry, cyser]);
  await putMany('batches', [b1, b2, b3, b4, b5]);
  await putMany('events', sampleEvents);
  await putMany('cellar', [c1, c2]);
  await putMany('pours', samplePours);
  // Each sample batch's OG on its timeline.
  await ensureOgEntries();
}
