import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Batch, BatchEvent } from '../db/types.ts';
import { canUndoSplit, planSplit, scaleLine, shares, splitNames, splitProblem, subBatchesOf, timelineOf } from './split.ts';

const base = { createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', deletedAt: null };
const GAL = 3.785411784;
const batch = (patch: Partial<Batch> = {}): Batch =>
  ({
    ...base,
    id: 'p',
    name: 'Bramble',
    recipeId: 'r1',
    beverageType: 'mead',
    style: 'Melomel',
    status: 'secondary',
    startDate: '2026-11-01',
    volumeL: 2 * GAL,
    og: 1.1,
    ingredients: [
      { id: 'l1', name: 'Clover honey', amount: '6 lb', quantity: '6', unit: 'lb', cost: { price: 30, quantity: 12, unit: 'lb' } },
      { id: 'l2', name: 'Yeast', amount: '1 packet', quantity: '1', unit: 'packet' },
      { id: 'l3', name: 'Oak', amount: 'a handful' },
    ],
    icon: 'grape',
    color: '#4A2A5E',
    rating: 8,
    notes: 'Parent notes',
    vessels: [{ vesselId: 'j1', volumeL: GAL }, { vesselId: 'j2', volumeL: GAL }],
    ...patch,
  }) as Batch;
const ev = (id: string, batchId: string, date: string, patch: Partial<BatchEvent> = {}): BatchEvent => ({ ...base, id, batchId, type: 'note', date, value: null, note: '', ...patch });

test('sub-batches are named with letters', () => {
  assert.deepEqual(splitNames('Bramble', 3), ['Bramble A', 'Bramble B', 'Bramble C']);
});

test('shares follow the volumes, or are equal without them', () => {
  assert.deepEqual(shares([{ volumeL: 1 }, { volumeL: 3 }]), [0.25, 0.75]);
  assert.deepEqual(shares([{ volumeL: 1 }, { volumeL: null }]), [0.5, 0.5]);
});

test('ingredient amounts scale with the share; words stay as they are', () => {
  assert.equal(scaleLine({ id: 'a', name: 'Honey', amount: '6 lb', quantity: '6', unit: 'lb' }, 0.5).amount, '3 lb');
  assert.equal(scaleLine({ id: 'a', name: 'Honey', amount: '1 1/2 lb', quantity: '1 1/2', unit: 'lb' }, 1 / 3).amount, '0.5 lb');
  assert.equal(scaleLine({ id: 'b', name: 'Oak', amount: 'a handful' }, 0.5).amount, 'a handful');
  assert.equal(scaleLine({ id: 'c', name: 'Yeast', amount: '1 packet', quantity: '1', unit: 'packet' }, 0.5).amount, '0.5 packet');
});

test('a split needs two parts, names and some volume in each', () => {
  assert.match(splitProblem([{ name: 'A', vesselId: 'j1', volumeL: 1 }])!, /at least two/);
  assert.match(splitProblem([{ name: 'A', vesselId: 'j1', volumeL: 1 }, { name: ' ', vesselId: 'j2', volumeL: 1 }])!, /name/);
  assert.match(splitProblem([{ name: 'A', vesselId: 'j1', volumeL: 1 }, { name: 'B', vesselId: 'j2', volumeL: 0 }])!, /more than 0/);
  assert.equal(splitProblem([{ name: 'A', vesselId: 'j1', volumeL: 1 }, { name: 'B', vesselId: 'j2', volumeL: null }]), null);
});

test('planning a split: the batch is Split, each part a batch of its own', () => {
  let n = 0;
  const plan = planSplit(batch(), [
    { name: 'Bramble A', vesselId: 'j1', volumeL: GAL },
    { name: 'Bramble B', vesselId: 'j2', volumeL: GAL },
  ], '2026-11-20T10:00', () => `c${++n}`);
  assert.equal(plan.parent.status, 'split');
  assert.equal(plan.parent.statusBeforeSplit, 'secondary');
  assert.equal(plan.parent.splitAt, '2026-11-20T10:00');
  assert.deepEqual(plan.parent.vessels, [], 'its vessels go to the sub-batches');
  const [a, b] = plan.children;
  assert.deepEqual([a.id, a.name, a.status, a.startDate, a.parentId, a.splitAt], ['c1', 'Bramble A', 'secondary', '2026-11-01', 'p', '2026-11-20T10:00']);
  assert.deepEqual(a.vessels, [{ vesselId: 'j1', volumeL: null }]);
  assert.equal(a.volumeL, GAL);
  assert.deepEqual(a.ingredients.map((l) => [l.id, l.amount]), [['l1', '3 lb'], ['l2', '0.5 packet'], ['l3', 'a handful']], 'halved; the line ids stay, so what was logged stays logged');
  assert.deepEqual(a.ingredients[0].cost, { price: 30, quantity: 12, unit: 'lb' }, 'the price per amount is kept, so the cost halves with the amount');
  assert.deepEqual([a.recipeId, a.og, a.icon, a.rating, a.notes], ['r1', 1.1, 'grape', null, ''], 'same recipe, OG and look; unrated, no notes');
  assert.equal(b.vessels![0].vesselId, 'j2');
});

test('a sub-batch\'s timeline starts with the batch\'s history up to the split', () => {
  const parent = batch({ status: 'split', splitAt: '2026-11-20T10:00' });
  const child = batch({ id: 'c1', parentId: 'p', splitAt: '2026-11-20T10:00' });
  const all = [ev('e1', 'p', '2026-11-05T10:00'), ev('e2', 'p', '2026-11-20T10:00'), ev('e3', 'p', '2026-11-25T10:00'), ev('e4', 'c1', '2026-11-22T10:00'), { ...ev('e5', 'p', '2026-11-06T10:00'), deletedAt: 'x' }];
  const t = timelineOf(child, [parent, child], all);
  assert.deepEqual(t.events.map((e) => e.id).sort(), ['e1', 'e2', 'e4']);
  assert.deepEqual([...t.inherited].sort(), ['e1', 'e2']);
  // Split again: the grandchild reaches back through both.
  const grand = batch({ id: 'g1', parentId: 'c1', splitAt: '2026-11-23T10:00' });
  assert.deepEqual(timelineOf(grand, [parent, child, grand], all).events.map((e) => e.id).sort(), ['e1', 'e2', 'e4']);
});

test('a split can be undone until something happens on a sub-batch', () => {
  const parent = batch({ status: 'split', statusBeforeSplit: 'secondary' });
  const kids = [batch({ id: 'c1', name: 'B A', parentId: 'p' }), batch({ id: 'c2', name: 'B B', parentId: 'p' })];
  assert.deepEqual(subBatchesOf(parent, [parent, ...kids]).map((k) => k.id), ['c1', 'c2']);
  assert.equal(canUndoSplit(parent, kids, []), true);
  assert.equal(canUndoSplit(parent, kids, [ev('x', 'c2', '2026-11-22T10:00')]), false, 'an entry on one');
  assert.equal(canUndoSplit(parent, [kids[0], { ...kids[1], status: 'aging' }], []), false, 'one moved on a stage');
});
