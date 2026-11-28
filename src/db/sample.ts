// Sample data so a new user can see how the app looks when it is in use.
// Dates are set relative to today, so the samples never look stale.

import { putMany } from './idb.ts';
import { ensureOgEntries, ensureStarterIngredients, ingredients } from './store.ts';
import type { Batch, BatchEvent, BatchStatus, CellarEntry, Equipment, EventType, GearIcon, IngredientCost, IngredientLine, IngredientStage, LibraryIngredient, Pour, Recipe, VesselType } from './types.ts';
import { L_PER_GAL } from '../lib/calc.ts';
import { daysFromToday, newId } from '../lib/format.ts';
import { entryFromLine, joinAmount } from '../lib/stages.ts';
import { planSplit } from '../lib/split.ts';

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
  'Lemon peel': { price: 2.99, quantity: 1, unit: 'oz' },
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
    ingredients: priced([...staged(blackberry.ingredients), line('Fermaid O', '3', 'g', 'split in 2'), { ...line('Oak cubes', '1', 'oz', 'medium toast'), stage: 'aging' }]),
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
    ingredients: priced([
      ...lines(['Wildflower honey', '3', 'lb'], ['Spring water', '1', 'gal', 'topped up'], ['Lalvin D47', '1', 'packet']),
      ...lines(['Cinnamon sticks', '2', ''], ['Clove', '4', ''], ['Oranges', '1', '', 'zest only']).map((l) => ({ ...l, stage: 'secondary' as const })),
    ]),
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
    volumeL: 5 * L_PER_GAL,
    og: null,
    targetFG: 1.0,
    ingredients: priced(
      lines(['Clover honey', '12', 'lb'], ['Strawberries', '15', 'lb', 'frozen, then thawed'], ['Spring water', '4', 'gal', 'topped up'], ['Pectic enzyme', '2.5', 'tsp'], ['Fermaid O', '10', 'g', 'split in 3'], ['Lalvin 71B', '1', 'packet']),
    ),
    icon: 'strawberry',
    color: '#E5646A',
    rating: null,
    notes: 'A big batch for summer. Freezing the berries first helps them give up their juice.',
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

  const b6 = batch({
    name: 'Lemon Hydromel',
    recipeId: null,
    beverageType: 'mead',
    style: 'Hydromel',
    status: 'aging',
    startDate: daysFromToday(-62),
    volumeL: 2.5 * L_PER_GAL,
    og: 1.05,
    targetFG: 1.0,
    ingredients: priced([
      ...lines(['Orange blossom honey', '4', 'lb'], ['Spring water', '2.5', 'gal', 'topped up'], ['Fermaid O', '5', 'g', 'split in 2'], ['Lalvin EC-1118', '1', 'packet']),
      { ...line('Lemon peel', '0.5', 'oz', 'zest of 2 lemons'), stage: 'secondary' as const },
    ]),
    icon: 'lemon',
    color: '#E9D46A',
    rating: 7.5,
    notes: 'Light and quick. Kegged and carbonated to drink young.',
  });

  // The first Bramble: bottled and archived, its bottles in the cellar. Archived batches sit on the shelf as books.
  const b0 = batch({
    name: 'Bramble Melomel #1',
    recipeId: blackberry.id,
    beverageType: 'mead',
    style: 'Melomel',
    status: 'archived',
    statusBeforeArchive: 'bottled',
    startDate: daysFromToday(-220),
    volumeL: L_PER_GAL,
    og: 1.104,
    targetFG: 1.0,
    ingredients: priced(staged(blackberry.ingredients)),
    icon: 'blackberry',
    color: '#4A2A5E',
    rating: null,
    notes: 'The first try at this recipe. #2 gets oak.',
  });

  // A cider split in two after primary: half stays plain, half goes on oak. The cider stops at Split,
  // and each half is a sub-batch with its own timeline from then on, made the way the app's split makes them.
  const splitDay = daysFromToday(-30) + 'T18:00';
  const cider = batch({
    name: 'Heirloom Cider',
    recipeId: null,
    beverageType: 'cider',
    style: 'Farmhouse',
    status: 'secondary',
    startDate: daysFromToday(-50),
    volumeL: 2 * L_PER_GAL,
    og: 1.052,
    targetFG: 1.0,
    ingredients: priced(lines(['Apple juice', '2', 'gal', 'no preservatives'], ['Pectic enzyme', '1', 'tsp'], ['Fermaid O', '2', 'g'], ['Lalvin 71B', '1', 'packet'])),
    icon: 'apple',
    color: '#E3C26A',
    rating: null,
    notes: 'Split in two to see what oak does to it.',
  });
  const split = planSplit(
    cider,
    [
      { name: 'Heirloom Cider A', vesselId: 'sample-jug-b', volumeL: L_PER_GAL },
      { name: 'Heirloom Cider B', vesselId: 'sample-jug-d', volumeL: L_PER_GAL },
    ],
    splitDay,
    newId,
  );
  const ciderSplit: Batch = split.parent;
  const ciderA: Batch = { ...split.children[0], ...stamp(), status: 'aging', rating: 7, notes: 'The plain half, for comparison.' };
  const ciderB: Batch = {
    ...split.children[1],
    ...stamp(),
    notes: 'On oak cubes.',
    ingredients: [...split.children[1].ingredients, ...priced([{ ...line('Oak cubes', '0.25', 'oz', 'medium toast'), stage: 'secondary' as const }])],
  };

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

  /** Ingredient entries for a batch's lines that went in at a time: those in `stage`, or just the named ones. */
  const logged = (b: Batch, date: string, which: IngredientStage | string[], note = ''): BatchEvent[] =>
    b.ingredients
      .filter((l) => (Array.isArray(which) ? which.includes(l.name) : (l.stage ?? 'primary') === which))
      .map((l) => ({ ...event(b.id, 'ingredient', date, null, note), ...entryFromLine(l), ingredientLineId: l.id }));
  /** An ingredient entry that isn't for a line on the list, such as a second nutrient addition. */
  const added = (b: Batch, date: string, name: string, quantity: string, unit: string): BatchEvent => {
    const ingredientId = libraryIds.get(name.toLowerCase());
    return { ...event(b.id, 'ingredient', date), ingredient: name, quantity, unit, amount: joinAmount(quantity, unit), ...(ingredientId ? { ingredientId } : {}) };
  };
  const yeastOf = (b: Batch) => b.ingredients.filter((l) => l.name.startsWith('Lalvin')).map((l) => l.name);
  const mustOf = (b: Batch) => b.ingredients.filter((l) => (l.stage ?? 'primary') === 'primary' && !l.name.startsWith('Lalvin')).map((l) => l.name);

  const sampleEvents: BatchEvent[] = [
    // The pectic enzyme isn't logged yet: its + Add shows how ingredients are ticked off.
    ...logged(b1, at(9, 17), mustOf(b1).filter((n) => !n.startsWith('Pectic') && n !== 'Fermaid O')),
    ...logged(b1, at(9), yeastOf(b1), 'Rehydrated first'),
    ...logged(b1, at(8), ['Fermaid O'], 'First half'),
    event(b1.id, 'note', at(8, 9), null, 'Punched down the fruit cap. Smells like jam already.'),
    event(b1.id, 'gravity', at(7), 1.096),
    added(b1, at(6), 'Fermaid O', '1.5', 'g'),
    event(b1.id, 'gravity', at(5), 1.071),
    event(b1.id, 'gravity', at(3), 1.048),
    event(b1.id, 'temperature', at(3, 19), 19.5),
    event(b1.id, 'ph', at(3, 19), 3.4),
    event(b1.id, 'gravity', at(1), 1.031, 'Airlock still busy'),

    ...logged(b2, at(34, 17), mustOf(b2)),
    ...logged(b2, at(34), yeastOf(b2)),
    event(b2.id, 'gravity', at(27), 1.05),
    event(b2.id, 'gravity', at(20), 1.018),
    event(b2.id, 'feeding', at(17), 1.034, 'Added 8 oz honey to push it a little stronger'),
    event(b2.id, 'gravity', at(13), 1.006),
    stage(b2.id, at(12), 'primary', 'secondary'),
    { ...event(b2.id, 'rack', at(12), null, 'Racked off the yeast'), fromVessels: [{ vesselId: 'sample-bucket', volumeL: null }], vessels: [{ vesselId: 'sample-jug-a', volumeL: null }] },
    ...logged(b2, at(12, 19), 'secondary'),
    { ...event(b2.id, 'tasting', at(4), null, 'Apple up front, cinnamon just showing. Pull the stick soon.'), rating: 7 },

    ...logged(b3, at(120, 17), mustOf(b3)),
    ...logged(b3, at(120), yeastOf(b3)),
    event(b3.id, 'gravity', at(106), 1.04),
    event(b3.id, 'gravity', at(92), 1.008),
    { ...event(b3.id, 'gravity', at(75), 1.002), final: true },
    stage(b3.id, at(74, 17), 'primary', 'secondary'),
    { ...event(b3.id, 'rack', at(74), null, 'Into the oak barrel, onto the spices'), fromVessels: [{ vesselId: 'sample-jug-c', volumeL: null }], vessels: [{ vesselId: 'sample-barrel', volumeL: null }] },
    ...logged(b3, at(74, 19), 'secondary'),
    { ...event(b3.id, 'moved', at(73)), place: 'Basement' },
    { ...event(b3.id, 'stabilize', at(60), null, 'Sorbate and sulfite'), method: 'Chemical' },
    stage(b3.id, at(60), 'secondary', 'aging'),
    // Stabilized, then backsweetened: Sugar added, not ticked to ferment.
    event(b3.id, 'backsweeten', at(55), 1.012, 'Wildflower honey to taste, about 4 oz'),

    ...logged(b5, at(210, 17), mustOf(b5).filter((n) => n !== 'Fermaid O')),
    ...logged(b5, at(210), yeastOf(b5)),
    ...logged(b5, at(209), ['Fermaid O'], 'First of three'),
    event(b5.id, 'gravity', at(196), 1.03),
    event(b5.id, 'gravity', at(180), 1.0),
    { ...event(b5.id, 'gravity', at(150), 0.998), final: true },
    stage(b5.id, at(95), 'aging', 'bottled', '5 × 750 mL'),
    // Bottle conditioned with a little honey.
    { ...event(b5.id, 'carbonate', at(95)), carbMethod: 'natural', carbLevel: 'sparkling', primer: 'Honey', primerAmount: '3 oz' },

    ...logged(b6, at(62, 17), mustOf(b6).filter((n) => n !== 'Fermaid O')),
    ...logged(b6, at(62), yeastOf(b6)),
    ...logged(b6, at(61), ['Fermaid O'], 'All at once: a small batch'),
    event(b6.id, 'gravity', at(56), 1.022),
    event(b6.id, 'gravity', at(49), 1.004),
    { ...event(b6.id, 'gravity', at(42), 0.998), final: true },
    stage(b6.id, at(41, 17), 'primary', 'secondary'),
    { ...event(b6.id, 'rack', at(41)), fromVessels: [{ vesselId: 'sample-carboy', volumeL: null }], vessels: [{ vesselId: 'sample-keg', volumeL: null }] },
    ...logged(b6, at(41, 19), 'secondary'),
    stage(b6.id, at(28), 'secondary', 'aging'),
    { ...event(b6.id, 'carbonate', at(21)), carbMethod: 'forced', carbLevel: 'petillant', psi: 12 },
    { ...event(b6.id, 'tasting', at(7), null, 'Bright and spritzy, like a honey lemonade. Gone too fast.'), rating: 7.5 },

    ...logged(b0, at(220, 17), mustOf(b0)),
    ...logged(b0, at(220), yeastOf(b0)),
    event(b0.id, 'gravity', at(213), 1.04),
    event(b0.id, 'gravity', at(200), 1.006),
    { ...event(b0.id, 'gravity', at(186), 0.999), final: true },
    stage(b0.id, at(185, 17), 'primary', 'secondary'),
    { ...event(b0.id, 'rack', at(185)), fromVessels: [{ vesselId: 'sample-bucket', volumeL: null }], vessels: [{ vesselId: 'sample-jug-a', volumeL: null }] },
    stage(b0.id, at(120), 'secondary', 'aging'),
    { ...event(b0.id, 'stabilize', at(90)), method: 'Chemical' },
    stage(b0.id, at(40), 'aging', 'bottled', '8 × 375 mL'),
    stage(b0.id, at(38), 'bottled', 'archived'),

    ...logged(ciderSplit, at(50, 17), mustOf(ciderSplit)),
    ...logged(ciderSplit, at(50), yeastOf(ciderSplit)),
    event(ciderSplit.id, 'gravity', at(44), 1.018),
    event(ciderSplit.id, 'gravity', at(37), 1.002),
    { ...event(ciderSplit.id, 'gravity', at(31), 1.0), final: true },
    stage(ciderSplit.id, at(30, 17), 'primary', 'secondary'),
    {
      ...event(ciderSplit.id, 'rack', splitDay, null, 'Half and half, to try oak on one'),
      fromVessels: [{ vesselId: 'sample-bucket', volumeL: null }],
      vessels: [{ vesselId: 'sample-jug-b', volumeL: L_PER_GAL }, { vesselId: 'sample-jug-d', volumeL: L_PER_GAL }],
    },
    stage(ciderA.id, at(14), 'secondary', 'aging'),
    { ...event(ciderA.id, 'tasting', at(6), null, 'Bone dry and crisp, like a farmhouse cider.'), rating: 7 },
    ...logged(ciderB, at(28), ['Oak cubes']),
    event(ciderB.id, 'gravity', at(14), 0.998),
    event(ciderB.id, 'note', at(14, 19), null, 'The oak is coming through. Two more weeks, then taste against A.'),
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
    carbonation: 'sparkling',
    icon: 'traditional',
    color: '#E8A33A',
    rating: 8,
    notes: '',
    ...stamp(),
  };
  const c2: CellarEntry = {
    id: newId(),
    batchId: b0.id,
    name: 'Bramble Melomel #1',
    style: 'Melomel',
    bottleSizeMl: 375,
    count: 6,
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
    { id: newId(), cellarEntryId: c2.id, date: daysFromToday(-8), count: 2, type: 'competition', note: 'County fair, melomel category. Second place; the judges said give it time.', rating: 7.5, ...stamp() },
  ];

  await putMany('recipes', [traditional, blackberry, cyser]);
  // Vessels, holding the batches still in one (bottled ones have left theirs), and a little gear.
  const vessel = (id: string, name: string, vesselType: VesselType, gallons: number, price: number | null, notes = ''): Equipment => ({
    id, name, kind: 'vessel', vesselType, capacityL: gallons * L_PER_GAL, capacityUnit: 'gal', price, notes, ...stamp(),
  });
  const gear = (id: string, name: string, icon: GearIcon, price: number | null, notes = '', quantity?: number): Equipment => ({
    id, name, kind: 'gear', icon, price, notes, ...(quantity ? { quantity } : {}), ...stamp(),
  });
  b1.vessels = [{ vesselId: 'sample-bucket', volumeL: null }];
  b2.vessels = [{ vesselId: 'sample-jug-a', volumeL: null }];
  b3.vessels = [{ vesselId: 'sample-barrel', volumeL: null }];
  b4.vessels = [{ vesselId: 'sample-conical', volumeL: null }];
  b6.vessels = [{ vesselId: 'sample-keg', volumeL: null }];
  // The cider's halves are in Jars B and C (the split set them); the cider itself has left its vessels.
  await putMany('equipment', [
    vessel('sample-bucket', 'Small bucket', 'bucket', 2, 14.99, 'Food-grade, with a grommet lid. Room for fruit in primary.'),
    vessel('sample-jug-a', 'Jar A', 'jar', 1, 7.99),
    vessel('sample-jug-b', 'Jar B', 'jar', 1, 7.99),
    vessel('sample-jug-c', 'Jar C', 'jar', 1, 7.99),
    vessel('sample-jug-d', 'Jar D', 'jar', 1, 7.99),
    vessel('sample-carboy', '5 gal carboy', 'carboy', 5, 39.99, 'Glass. For the day a batch grows up.'),
    vessel('sample-barrel', 'Oak barrel', 'barrel', 1, 64.99, 'Toasted American oak. Small barrels oak fast, so taste every couple of weeks.'),
    vessel('sample-keg', 'Ball lock keg', 'keg', 2.5, 89.99, 'For carbonating and serving on tap.'),
    vessel('sample-conical', 'Conical fermenter', 'tank', 7, 229.99, 'Stainless, with a dump valve for the yeast.'),
    gear('sample-hydrometer', 'Hydrometer', 'hydrometer', 12.99, 'Triple scale, with the test jar'),
    gear('sample-siphon', 'Auto-siphon', 'siphon', 14.99),
    gear('sample-ph', 'pH meter', 'ph', 24.99, 'Calibrate with the 4.0 and 7.0 buffers'),
    gear('sample-airlocks', 'Airlocks', 'airlock', 1.49, 'Three-piece', 6),
  ]);
  await putMany('batches', [b0, b1, b2, b3, b4, b5, b6, ciderSplit, ciderA, ciderB]);
  await putMany('events', sampleEvents);
  await putMany('cellar', [c1, c2]);
  await putMany('pours', samplePours);
  // Each sample batch's OG on its timeline.
  await ensureOgEntries();
}
