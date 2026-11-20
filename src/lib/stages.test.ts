import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BatchEvent, BatchStatus, IngredientLine } from '../db/types.ts';
import { addedLines, currentIngredientStage, groupByStage, joinAmount, splitAmount, stageForNewIngredient, timelineSections, entryFromLine, lineFromEntry } from './stages.ts';

const base = { createdAt: '2026-11-01T00:00:00Z', updatedAt: '', deletedAt: null };
const line = (id: string, stage?: IngredientLine['stage'], amount = ''): IngredientLine => ({ id, name: id, amount, stage });
const ev = (id: string, date: string, patch: Partial<BatchEvent> = {}): BatchEvent => ({ ...base, id, batchId: 'b', type: 'note', date, value: null, note: '', ...patch });
const stage = (id: string, date: string, from: BatchStatus, to: BatchStatus) => ev(id, date, { type: 'status', fromStatus: from, toStatus: to });

test('ingredients group by stage in stage order, skipping empty stages; old lines count as Primary', () => {
  const groups = groupByStage([line('raisins', 'secondary'), line('honey'), line('sugar', 'bottling'), line('yeast', 'primary')]);
  assert.deepEqual(
    groups.map((g) => [g.stage, g.lines.map((l) => l.id)]),
    [
      ['primary', ['honey', 'yeast']],
      ['secondary', ['raisins']],
      ['bottling', ['sugar']],
    ],
  );
});

test('the current ingredient stage: none while planned, Bottling once bottled', () => {
  assert.equal(currentIngredientStage('planned'), null);
  assert.equal(currentIngredientStage('primary'), 'primary');
  assert.equal(currentIngredientStage('aging'), 'aging');
  assert.equal(currentIngredientStage('bottled'), 'bottling');
  assert.equal(stageForNewIngredient('planned'), 'primary');
});

test('an ingredient counts as added while a timeline entry points at it', () => {
  const entry = ev('e1', '2026-11-05T10:00', { type: 'ingredient', ingredientLineId: 'honey' });
  assert.equal(addedLines([entry]).get('honey')?.id, 'e1');
  assert.equal(addedLines([{ ...entry, deletedAt: '2026-11-06T00:00:00Z' }]).has('honey'), false);
});

test('amounts split back into quantity and unit, keeping unusual text whole', () => {
  assert.deepEqual(splitAmount(line('a', undefined, '3 lb')), { quantity: '3', unit: 'lb' });
  assert.deepEqual(splitAmount(line('a', undefined, '1/2 tsp')), { quantity: '1/2', unit: 'tsp' });
  assert.deepEqual(splitAmount(line('a', undefined, '2')), { quantity: '2', unit: '' });
  assert.deepEqual(splitAmount(line('a', undefined, 'to 1 gal')), { quantity: 'to 1 gal', unit: '' });
  assert.deepEqual(splitAmount(line('a', undefined, '4 g, split in 3')), { quantity: '4 g, split in 3', unit: '' });
  assert.equal(joinAmount('3', 'lb'), '3 lb');
  assert.equal(joinAmount('2', ''), '2');
  assert.equal(joinAmount('', 'lb'), '', 'no quantity, no amount');
});

test('the timeline splits into stage sections, newest first, each stage entry opening its section', () => {
  const events = [
    ev('pitch', '2026-11-01T10:00'),
    ev('reading', '2026-11-05T10:00'),
    stage('to-sec', '2026-11-10T10:00', 'primary', 'secondary'),
    ev('rack', '2026-11-10T11:00'),
    stage('to-aging', '2026-11-20T10:00', 'secondary', 'aging'),
  ];
  assert.deepEqual(
    timelineSections(events, 'aging').map((s) => [s.stage, s.events.map((e) => e.id)]),
    [
      ['aging', ['to-aging']],
      ['secondary', ['rack', 'to-sec']],
      ['primary', ['reading', 'pitch']],
    ],
  );
});

test('a timeline with no stage entries is one section in the batch\'s stage', () => {
  assert.deepEqual(
    timelineSections([ev('a', '2026-11-01T10:00')], 'aging').map((s) => s.stage),
    ['aging'],
  );
});

test('old stage entries without a stored stage are read from their wording', () => {
  const old = ev('old', '2026-11-10T10:00', { type: 'status', note: 'Moved to Aging' });
  assert.deepEqual(
    timelineSections([ev('a', '2026-11-01T10:00'), old], 'aging').map((s) => s.stage),
    ['aging', 'primary'],
  );
});

test('the unit list is A to Z after "no unit", with each short form spelled out', async () => {
  const { INGREDIENT_UNITS, unitLabel } = await import('../db/types.ts');
  const names = INGREDIENT_UNITS.slice(1).map((u) => u.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  assert.equal(unitLabel(INGREDIENT_UNITS[0]), 'No unit (a count)');
  assert.equal(unitLabel(INGREDIENT_UNITS.find((u) => u.id === 'lb')!), 'Pound (lb)');
  assert.equal(unitLabel(INGREDIENT_UNITS.find((u) => u.id === 'cup')!), 'Cup');
});

test('a timeline entry and its ingredient line carry the same name, amount and library link', () => {
  const line = { id: 'l1', name: 'Honey', amount: '3 lb', quantity: '3', unit: 'lb', stage: 'primary' as const, ingredientId: 'i1', cost: { price: 24.99, quantity: 12, unit: 'lb' } };
  assert.deepEqual(entryFromLine(line), { ingredient: 'Honey', amount: '3 lb', quantity: '3', unit: 'lb', ingredientId: 'i1' });
  const less = lineFromEntry(line, { ingredient: 'Honey', amount: '2.5 lb', quantity: '2.5', unit: 'lb', ingredientId: 'i1' });
  assert.equal(less.amount, '2.5 lb');
  assert.equal(less.stage, 'primary', 'keeps its stage');
  assert.deepEqual(less.cost, line.cost, 'keeps the price it was saved with');
  const other = lineFromEntry(line, { ingredient: 'Clover honey', amount: '3 lb', quantity: '3', unit: 'lb', ingredientId: 'i2' });
  assert.equal(other.name, 'Clover honey');
  assert.equal(other.cost, undefined, 'another ingredient drops the old price');
});
