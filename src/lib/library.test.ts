import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CATEGORIES, type IngredientLine, type LibraryIngredient } from '../db/types.ts';
import { starterIngredients } from '../db/starterIngredients.ts';
import { categoryOf, filterIngredients, lineIsIngredient } from './library.ts';

const item = (name: string, category: string): LibraryIngredient =>
  ({ id: name, name, category, defaultUnit: '', notes: '', createdAt: '', updatedAt: '', deletedAt: null }) as LibraryIngredient;
const all = [item('Wildflower honey', 'honey'), item('Clover honey', 'honey'), item('Lalvin 71B', 'yeast'), item('Mystery', 'gone')];

test('search matches every word, in any order, ignoring case', () => {
  assert.deepEqual(filterIngredients(all, 'HONEY', null, DEFAULT_CATEGORIES).map((i) => i.name), ['Clover honey', 'Wildflower honey']);
  assert.deepEqual(filterIngredients(all, 'honey wild', null, DEFAULT_CATEGORIES).map((i) => i.name), ['Wildflower honey']);
});

test('a category narrows the list; an unknown category counts as Other', () => {
  assert.deepEqual(filterIngredients(all, '', 'yeast', DEFAULT_CATEGORIES).map((i) => i.name), ['Lalvin 71B']);
  assert.equal(categoryOf(all[3], DEFAULT_CATEGORIES).id, 'other');
  assert.deepEqual(filterIngredients(all, '', 'other', DEFAULT_CATEGORIES).map((i) => i.name), ['Mystery']);
});

test('a line is a library ingredient by its link, or by name for older lines', () => {
  const honey = all[0];
  const line = (patch: Partial<IngredientLine>) => ({ id: 'l', name: 'Wildflower Honey ', amount: '3 lb', ...patch }) as IngredientLine;
  assert.equal(lineIsIngredient(line({}), honey), true);
  assert.equal(lineIsIngredient(line({ ingredientId: 'Wildflower honey' }), honey), true);
  assert.equal(lineIsIngredient(line({ ingredientId: 'other-id' }), honey), false, 'a link to something else wins over the name');
});

test('starter ingredients have unique fixed ids and real categories', () => {
  const starters = starterIngredients(true);
  assert.equal(new Set(starters.map((s) => s.id)).size, starters.length);
  assert.ok(starters.every((s) => s.id.startsWith('starter-') && DEFAULT_CATEGORIES.some((c) => c.id === s.category)));
  assert.equal(starters.find((s) => s.name === 'Wildflower honey')?.defaultUnit, 'lb');
  assert.equal(starterIngredients(false).find((s) => s.name === 'Wildflower honey')?.defaultUnit, 'kg');
  assert.ok(starters.some((s) => s.name === 'Nagardo'));
});
