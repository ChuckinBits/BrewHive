import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Batch, BatchEvent, Recipe } from '../db/types.ts';
import { applyRecipeChanges, otherBatchesFrom, ratingForUpdate, recipeChanges, recipeFieldsFromBatch, suggestRecipeName } from './recipeFromBatch.ts';

const base = { createdAt: '', updatedAt: '', deletedAt: null };
const batch = (patch: Partial<Batch> = {}): Batch => ({
  ...base,
  id: 'b1',
  name: 'Bramble Melomel #2',
  recipeId: null,
  beverageType: 'mead',
  style: 'Melomel',
  status: 'primary',
  startDate: '2026-11-01',
  volumeL: 3.785,
  og: 1.114,
  targetFG: 1.01,
  ingredients: [
    { id: 'l1', name: 'Clover honey', amount: '3 lb', stage: 'primary' },
    { id: 'l2', name: 'Oak cubes', amount: '1 oz', stage: 'aging' },
  ],
  icon: 'blackberry',
  color: '#4A2A5E',
  rating: 9,
  notes: '',
  ...patch,
});
const recipe = (patch: Partial<Recipe> = {}): Recipe => ({
  ...base,
  id: 'r1',
  name: 'Bramble Melomel',
  beverageType: 'mead',
  style: 'Melomel',
  batchSizeL: 3.785,
  targetOG: 1.114,
  targetFG: 1.01,
  ingredients: [
    { id: 'x1', name: 'Clover honey', amount: '3 lb', stage: 'primary' },
    { id: 'x2', name: 'Oak cubes', amount: '1 oz', stage: 'aging' },
  ],
  steps: ['Mix.'],
  icon: 'blackberry',
  color: '#4A2A5E',
  rating: 9,
  notes: 'Recipe notes',
  isPublished: false,
  ...patch,
});
const labels = (c: { fields: { label: string }[]; ingredients: { label: string }[] }) => ({ fields: c.fields.map((x) => x.label), ingredients: c.ingredients.map((x) => x.label) });
const vol = (l: number | null) => (l == null ? '–' : `${(l / 3.785411784).toFixed(2)} gal`);

test('a batch provides its type, style, size, gravities, staged ingredients, icon and color', () => {
  const f = recipeFieldsFromBatch(batch(), []);
  assert.equal(f.targetOG, 1.114);
  assert.equal(f.targetFG, 1.01);
  assert.equal(f.batchSizeL, 3.785);
  assert.deepEqual(f.ingredients.map((l) => [l.name, l.amount, l.stage]), [['Clover honey', '3 lb', 'primary'], ['Oak cubes', '1 oz', 'aging']]);
  assert.notEqual(f.ingredients[0].id, 'l1');
});

test('once fermentation is complete, the actual final gravity becomes the target FG', () => {
  const final: BatchEvent = { ...base, id: 'f', batchId: 'b1', type: 'gravity', date: '2026-11-20T10:00', value: 1.004, note: '', final: true };
  assert.equal(recipeFieldsFromBatch(batch({ status: 'aging' }), [final]).targetFG, 1.004);
  // Still fermenting: the batch's target, not the latest reading.
  assert.notEqual(recipeFieldsFromBatch(batch({ status: 'secondary' }), [final]).targetFG, 1.004);
});

test('without an OG, the first gravity reading is the target OG', () => {
  const reading: BatchEvent = { ...base, id: 'e', batchId: 'b1', type: 'gravity', date: '2026-11-02T10:00', value: 1.102, note: '' };
  assert.equal(recipeFieldsFromBatch(batch({ og: null }), [reading]).targetOG, 1.102);
});

test('the suggested recipe name drops a trailing batch number', () => {
  assert.equal(suggestRecipeName('Bramble Melomel #2'), 'Bramble Melomel');
  assert.equal(suggestRecipeName('Winter Spice'), 'Winter Spice');
});

test('an identical batch means the recipe is already up to date', () => {
  assert.deepEqual(labels(recipeChanges(recipe(), recipeFieldsFromBatch(batch(), []), vol)), { fields: [], ingredients: [] });
});

test('changes are listed field by field, and ingredients by name', () => {
  const next = recipeFieldsFromBatch(
    batch({
      og: 1.12,
      ingredients: [
        { id: 'l1', name: 'Clover honey', amount: '3.5 lb', stage: 'primary' },
        { id: 'l3', name: 'Vanilla bean', amount: '1', stage: 'secondary' },
      ],
    }),
    [],
  );
  const c = labels(recipeChanges(recipe(), next, vol));
  assert.deepEqual(c.fields, ['Target OG 1.114 → 1.120']);
  assert.deepEqual(c.ingredients, ['Changed Clover honey: 3 lb, Primary → 3.5 lb, Primary', 'Added Vanilla bean (1, Secondary)', 'Removed Oak cubes']);
});

test('a stage change counts as an ingredient change', () => {
  const next = recipeFieldsFromBatch(batch({ ingredients: [{ id: 'l1', name: 'Clover honey', amount: '3 lb', stage: 'primary' }, { id: 'l2', name: 'oak cubes', amount: '1 oz', stage: 'secondary' }] }), []);
  assert.deepEqual(labels(recipeChanges(recipe(), next, vol)).ingredients, ['Changed oak cubes: 1 oz, Aging → 1 oz, Secondary']);
});

test('other batches from the same recipe are found, not counting this one or deleted ones', () => {
  const all = [batch({ id: 'b1', recipeId: 'r1' }), batch({ id: 'b2', recipeId: 'r1' }), batch({ id: 'b3', recipeId: 'r1', deletedAt: 'x' }), batch({ id: 'b4', recipeId: 'r2' })];
  assert.deepEqual(otherBatchesFrom('r1', all, 'b1').map((b) => b.id), ['b2']);
});

test('a recipe keeps the batch\'s target ABV, and the update lists a change of target', () => {
  const fields = recipeFieldsFromBatch(batch({ targetMode: 'abv', targetAbv: 14 }), []);
  assert.equal(fields.targetMode, 'abv');
  assert.equal(fields.targetAbv, 14);
  const recipe = { ...fields, id: 'r', name: 'R', steps: [], notes: '', rating: null, isPublished: false, createdAt: '', updatedAt: '', deletedAt: null, targetMode: 'fg' as const, targetAbv: null };
  const changes = labels(recipeChanges(recipe, fields, () => ''));
  assert.ok(changes.fields.includes('Aims for FG → ABV'));
  assert.ok(changes.fields.includes('Target ABV none → 14%'));
});

test('a new recipe starts with the batch\'s rating', () => {
  assert.equal(recipeFieldsFromBatch(batch({ rating: 7 }), []).rating, 7);
  assert.equal(recipeFieldsFromBatch(batch({ rating: null }), []).rating, null);
});

test('an update brings the batch\'s new rating, and lists it', () => {
  const next = recipeFieldsFromBatch(batch({ rating: 8.5 }), []);
  assert.equal(ratingForUpdate(recipe({ rating: 7 }), next), 8.5);
  assert.deepEqual(labels(recipeChanges(recipe({ rating: 7 }), next, vol)).fields, ['Rating 7 → 8.5']);
  assert.deepEqual(labels(recipeChanges(recipe({ rating: null }), next, vol)).fields, ['Rating none → 8.5']);
});

test('an unrated batch leaves the recipe\'s rating alone', () => {
  const next = recipeFieldsFromBatch(batch({ rating: null }), []);
  assert.equal(ratingForUpdate(recipe({ rating: 7 }), next), 7);
  assert.deepEqual(labels(recipeChanges(recipe({ rating: 7 }), next, vol)), { fields: [], ingredients: [] });
});

// --- Picking which changes to apply

const changed = () =>
  recipeFieldsFromBatch(
    batch({
      og: 1.12,
      rating: 6,
      ingredients: [
        { id: 'l1', name: 'Clover honey', amount: '3.5 lb', stage: 'primary' },
        { id: 'l3', name: 'Vanilla bean', amount: '1', stage: 'secondary' },
      ],
    }),
    [],
  );

test('every change has a key to pick it by', () => {
  const c = recipeChanges(recipe(), changed(), vol);
  assert.deepEqual(c.fields.map((x) => x.key), ['og', 'rating']);
  assert.deepEqual(c.ingredients.map((x) => x.key), ['ingredient:clover honey', 'ingredient:vanilla bean', 'ingredient:oak cubes']);
});

test('applying every change matches the batch', () => {
  const next = changed();
  const all = new Set([...recipeChanges(recipe(), next, vol).fields, ...recipeChanges(recipe(), next, vol).ingredients].map((x) => x.key));
  const r = applyRecipeChanges(recipe(), next, all);
  assert.equal(r.targetOG, 1.12);
  assert.equal(r.rating, 6);
  assert.deepEqual(r.ingredients.map((l) => [l.name, l.amount]), [['Clover honey', '3.5 lb'], ['Vanilla bean', '1']]);
  assert.equal(r.name, 'Bramble Melomel', 'the name stays');
  assert.deepEqual(r.steps, ['Mix.'], 'and the steps');
});

test('unticked changes leave the recipe as it was', () => {
  // Only the OG and the vanilla bean: the rating, the honey amount and the oak cubes stay.
  const r = applyRecipeChanges(recipe(), changed(), new Set(['og', 'ingredient:vanilla bean']));
  assert.equal(r.targetOG, 1.12);
  assert.equal(r.rating, 9, 'rating unticked: still 9');
  assert.deepEqual(r.ingredients.map((l) => [l.name, l.amount]), [['Clover honey', '3 lb'], ['Oak cubes', '1 oz'], ['Vanilla bean', '1']]);
  assert.equal(r.ingredients[0].id, 'x1', 'kept lines keep their ids');
});

test('nothing picked changes nothing', () => {
  const before = recipe();
  assert.deepEqual(applyRecipeChanges(before, changed(), new Set()), before);
});
