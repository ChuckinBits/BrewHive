// Sample data so a new user can see how the app looks when it is in use.
// Dates are set relative to today, so the samples never look stale.

import { putMany } from './idb.ts';
import type { Batch, BatchEvent, BatchStatus, CellarEntry, EventType, IngredientLine, IngredientStage, Pour, Recipe } from './types.ts';
import { daysFromToday, newId } from '../lib/format.ts';

const stamp = () => {
  const now = new Date().toISOString();
  return { createdAt: now, updatedAt: now, deletedAt: null };
};

/** Copies recipe lines into a batch with fresh ids and a stage for each, by name. */
const staged = (from: IngredientLine[], stages: Record<string, IngredientStage> = {}): IngredientLine[] =>
  from.map((line) => ({ ...line, id: newId(), stage: stages[line.name] ?? 'primary' }));

const lines = (...pairs: [string, string][]): IngredientLine[] =>
  pairs.map(([name, amount]) => ({ id: newId(), name, amount }));

const at = (daysAgo: number, hour = 18) => `${daysFromToday(-daysAgo)}T${String(hour).padStart(2, '0')}:00:00`;

export async function loadSampleData(): Promise<void> {
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
    batchSizeL: 3.785,
    targetOG: 1.1,
    targetFG: 1.0,
    ingredients: lines(['Wildflower honey', '3 lb'], ['Spring water', 'to 1 gal'], ['Lalvin 71B yeast', '1 packet'], ['Fermaid O', '4 g, split in 3']),
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
    batchSizeL: 3.785,
    targetOG: 1.115,
    targetFG: 1.01,
    ingredients: lines(['Clover honey', '3 lb'], ['Blackberries, frozen', '2 lb'], ['Water', 'to 1 gal'], ['Lalvin EC-1118 yeast', '1 packet'], ['Pectic enzyme', '1/2 tsp']),
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
    batchSizeL: 3.785,
    targetOG: 1.09,
    targetFG: 1.005,
    ingredients: lines(['Apple juice, no preservatives', '1 gal'], ['Orange blossom honey', '1.5 lb'], ['Cinnamon stick', '1'], ['Lalvin D47 yeast', '1 packet']),
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
    volumeL: 3.785,
    og: 1.114,
    fermentationComplete: false,
    fg: null,
    targetFG: 1.01,
    ingredients: [...staged(blackberry.ingredients), { id: newId(), name: 'Oak cubes, medium toast', amount: '1 oz', quantity: '1', unit: 'oz', stage: 'aging' }],
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
    volumeL: 3.785,
    og: 1.092,
    fermentationComplete: false,
    fg: null,
    targetFG: 1.0,
    ingredients: staged(cyser.ingredients, { 'Cinnamon stick': 'secondary' }),
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
    volumeL: 3.785,
    og: 1.105,
    fermentationComplete: true,
    fg: 1.002,
    targetFG: 1.0,
    ingredients: lines(['Wildflower honey', '3 lb'], ['Cinnamon sticks', '2'], ['Cloves', '4'], ['Orange zest', '1 orange']),
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
    volumeL: 3.785,
    og: null,
    fermentationComplete: false,
    fg: null,
    targetFG: 1.0,
    ingredients: lines(['Clover honey', '2.5 lb'], ['Strawberries', '3 lb']),
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
    volumeL: 3.785,
    og: 1.1,
    fermentationComplete: true,
    fg: 0.998,
    targetFG: 1.0,
    ingredients: traditional.ingredients,
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
      .map((l) => ({ ...event(b1.id, 'ingredient', at(9, 17)), ingredient: l.name, amount: l.amount, ingredientLineId: l.id })),
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
    {
      ...event(b2.id, 'ingredient', at(12, 19)),
      ingredient: 'Cinnamon stick',
      amount: '1',
      ingredientLineId: b2.ingredients.find((l) => l.name === 'Cinnamon stick')?.id,
    },
    { ...event(b2.id, 'tasting', at(4), null, 'Apple up front, cinnamon just showing. Pull the stick soon.'), rating: 7 },

    event(b3.id, 'pitch', at(120)),
    event(b3.id, 'gravity', at(106), 1.04),
    event(b3.id, 'gravity', at(92), 1.008),
    event(b3.id, 'gravity', at(75), 1.002),
    event(b3.id, 'rack', at(74)),
    { ...event(b3.id, 'moved', at(73)), place: 'Basement' },
    { ...event(b3.id, 'stabilize', at(60), null, 'Sorbate and sulfite'), method: 'Chemical' },
    stage(b3.id, at(60), 'secondary', 'aging'),

    event(b5.id, 'pitch', at(210)),
    event(b5.id, 'gravity', at(196), 1.03),
    event(b5.id, 'gravity', at(180), 1.0),
    event(b5.id, 'gravity', at(150), 0.998),
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
}
