import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starterIngredients } from './starterIngredients.ts';
import { DEFAULT_CATEGORIES, INGREDIENT_UNITS } from './types.ts';

for (const imperial of [true, false]) {
  test(`starter ingredients are well formed (${imperial ? 'US' : 'metric'} units)`, () => {
    const list = starterIngredients(imperial);
    assert.equal(list.length, 95);
    for (const item of list) assert.ok(item.notes.length > 20, `${item.name} has a note`);
    assert.equal(new Set(list.map((i) => i.id)).size, list.length, 'ids are unique');
    assert.equal(new Set(list.map((i) => i.name.toLowerCase())).size, list.length, 'names are unique');
    const categories = new Set(DEFAULT_CATEGORIES.map((c) => c.id));
    const units = new Set(INGREDIENT_UNITS.map((u) => u.id));
    for (const item of list) {
      assert.ok(categories.has(item.category), `${item.name}: category ${item.category}`);
      assert.ok(units.has(item.defaultUnit), `${item.name}: unit ${item.defaultUnit}`);
    }
  });
}

test('the ids of the original starters never change, so devices never get them twice', () => {
  const ids = new Set(starterIngredients(true).map((i) => i.id));
  for (const id of ['starter-wildflower-honey', 'starter-apple-juice', 'starter-lalvin-71b', 'starter-wine-tannin', 'starter-oak-cubes', 'starter-nagardo']) assert.ok(ids.has(id), id);
});

test('new starters in their categories', () => {
  const find = (name: string) => starterIngredients(true).find((i) => i.name === name);
  assert.equal(find('Wine tannin')?.category, 'oak', 'Wine tannin is in Tannins (id oak)');
  assert.equal(find('Meadowfoam honey')?.category, 'honey');
  assert.equal(find('Coffee')?.category, 'spice', 'Coffee is a spice');
  assert.equal(find('Cacao nibs')?.category, 'spice');
  assert.equal(find("Fleischmann's")?.category, 'yeast');
  assert.equal(find('Maple syrup')?.defaultUnit, 'fl oz');
  assert.equal(starterIngredients(false).find((i) => i.name === 'Maple syrup')?.defaultUnit, 'mL');
});
