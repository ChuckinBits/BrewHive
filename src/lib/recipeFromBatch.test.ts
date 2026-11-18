import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Batch, BatchEvent, Recipe } from '../db/types.ts';
import { otherBatchesFrom, recipeChanges, recipeFieldsFromBatch, suggestRecipeName } from './recipeFromBatch.ts';

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
  fg: null,
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
  rating: 7,
  notes: 'Recipe notes',
  isPublished: false,
  ...patch,
});
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
  assert.equal(recipeFieldsFromBatch(batch({ fermentationComplete: true, fg: 1.004 }), []).targetFG, 1.004);
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
  assert.deepEqual(recipeChanges(recipe(), recipeFieldsFromBatch(batch(), []), vol), { fields: [], ingredients: [] });
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
  const c = recipeChanges(recipe(), next, vol);
  assert.deepEqual(c.fields, ['Target OG 1.114 → 1.120']);
  assert.deepEqual(c.ingredients, ['Changed Clover honey: 3 lb, Primary → 3.5 lb, Primary', 'Added Vanilla bean (1, Secondary)', 'Removed Oak cubes']);
});

test('a stage change counts as an ingredient change', () => {
  const next = recipeFieldsFromBatch(batch({ ingredients: [{ id: 'l1', name: 'Clover honey', amount: '3 lb', stage: 'primary' }, { id: 'l2', name: 'oak cubes', amount: '1 oz', stage: 'secondary' }] }), []);
  assert.deepEqual(recipeChanges(recipe(), next, vol).ingredients, ['Changed oak cubes: 1 oz, Aging → 1 oz, Secondary']);
});

test('other batches from the same recipe are found, not counting this one or deleted ones', () => {
  const all = [batch({ id: 'b1', recipeId: 'r1' }), batch({ id: 'b2', recipeId: 'r1' }), batch({ id: 'b3', recipeId: 'r1', deletedAt: 'x' }), batch({ id: 'b4', recipeId: 'r2' })];
  assert.deepEqual(otherBatchesFrom('r1', all, 'b1').map((b) => b.id), ['b2']);
});
