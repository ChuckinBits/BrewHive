import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IngredientLine } from '../db/types.ts';
import { costOf, costSummary, localeCurrency, pricePer, unitsCompatible } from './cost.ts';

const near = (a: number | null, b: number, d = 0.005) => assert.ok(a != null && Math.abs(a - b) < d, `${a} ≈ ${b}`);

test('weights convert to weights, volumes to volumes, never across', () => {
  const honey = { price: 24.99, quantity: 12, unit: 'lb' };
  near(costOf(3, 'lb', honey), 6.2475);
  near(costOf(1, 'kg', honey), 4.592, 0.01);
  near(pricePer('lb', honey), 2.0825);
  assert.equal(costOf(2, 'cup', honey), null, 'cups of honey bought by the pound');
  const juice = { price: 6, quantity: 1, unit: 'gal' };
  near(costOf(1, 'L', juice), 1.585, 0.001);
  assert.equal(unitsCompatible('tsp', 'mL'), true);
  assert.equal(unitsCompatible('tsp', 'g'), false);
});

test('counts only match the same unit', () => {
  const yeast = { price: 1.5, quantity: 1, unit: 'packet' };
  near(costOf(2, 'packet', yeast), 3);
  assert.equal(costOf(2, '', yeast), null);
  near(costOf(3, '', { price: 4, quantity: 2, unit: '' }), 6);
});

test('a summary totals what it can and says why the rest is left out', () => {
  const line = (name: string, quantity: string, unit: string) => ({ id: name, name, amount: '', quantity, unit }) as IngredientLine;
  const costs: Record<string, { price: number; quantity: number; unit: string } | null> = {
    Honey: { price: 24.99, quantity: 12, unit: 'lb' },
    Yeast: { price: 1.5, quantity: 1, unit: 'packet' },
    Berries: null,
    Cinnamon: { price: 5, quantity: 1, unit: 'oz' },
    Water: { price: 1, quantity: 1, unit: 'gal' },
  };
  const s = costSummary([line('Honey', '3', 'lb'), line('Yeast', '1', 'packet'), line('Berries', '2', 'lb'), line('Cinnamon', '2', ''), line('Water', '', 'gal')], (l) => costs[l.name]);
  near(s.total, 6.2475 + 1.5);
  assert.equal(s.counted, 2);
  assert.deepEqual(s.missing, [
    { name: 'Berries', reason: 'no cost' },
    { name: 'Cinnamon', reason: 'units' },
    { name: 'Water', reason: 'no amount' },
  ]);
});

test('default currency from the locale', () => {
  assert.equal(localeCurrency('en-US'), 'USD');
  assert.equal(localeCurrency('de-DE'), 'EUR');
  assert.equal(localeCurrency('en-GB'), 'GBP');
  assert.equal(localeCurrency('fr'), 'USD');
});
