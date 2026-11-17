import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Batch, BatchEvent, BatchStatus } from '../db/types.ts';
import {
  batchAbv,
  currentGravity,
  defaultFerments,
  effectiveOG,
  gravityPoints,
  isFermentationComplete,
  planStatusEntry,
  projectedAbv,
  stageWhenComplete,
  targetFinalGravity,
} from './batch.ts';

const base = { createdAt: '', updatedAt: '', deletedAt: null };

const batch = (patch: Partial<Batch> = {}): Batch => ({
  ...base,
  id: 'b1',
  name: 'Test',
  recipeId: null,
  beverageType: 'mead',
  style: '',
  status: 'primary',
  startDate: '2026-11-01',
  volumeL: null,
  og: 1.1,
  fg: null,
  ingredients: [],
  icon: 'traditional',
  color: '#E8A33A',
  rating: null,
  notes: '',
  ...patch,
});

const stageEntry = (id: string, date: string, from: BatchStatus, to: BatchStatus, auto = true): BatchEvent => ({
  ...base,
  id,
  batchId: 'b1',
  type: 'status',
  date,
  value: null,
  note: '',
  fromStatus: from,
  toStatus: to,
  auto,
});

const reading = (date: string, sg: number): BatchEvent => ({ ...base, id: date, batchId: 'b1', type: 'gravity', date, value: sg, note: '' });

test('potential ABV assumes fermentation to 1.000, with no separate target', () => {
  const p = projectedAbv(1.1, 1.0);
  assert.ok(Math.abs((p?.potential ?? 0) - 13.125) < 1e-9);
  assert.equal(p?.target, null);
});

test('a target FG other than 1.000 adds a target ABV beside the potential', () => {
  const p = projectedAbv(1.1, 1.01);
  assert.ok(Math.abs((p?.potential ?? 0) - 13.125) < 1e-9);
  assert.ok(Math.abs((p?.target ?? 0) - 11.8125) < 1e-9);
});

test('marking fermentation complete moves Planned and Primary batches to Secondary, never backwards', () => {
  assert.equal(stageWhenComplete('planned'), 'secondary');
  assert.equal(stageWhenComplete('primary'), 'secondary');
  assert.equal(stageWhenComplete('secondary'), 'secondary');
  assert.equal(stageWhenComplete('aging'), 'aging');
  assert.equal(stageWhenComplete('bottled'), 'bottled');
});

test('no projected ABV without an OG', () => {
  assert.equal(projectedAbv(null, 1.0), null);
});

test('batches saved before the flag existed count as complete when they had an FG', () => {
  assert.equal(isFermentationComplete(batch({ fg: 0.998 })), true);
  assert.equal(isFermentationComplete(batch({ fg: null })), false);
  assert.equal(isFermentationComplete(batch({ fg: 0.998, fermentationComplete: false })), false);
  assert.equal(targetFinalGravity(batch()), 1.0);
});

test('the FG only counts once fermentation is complete', () => {
  const events = [reading('2026-11-05T10:00', 1.02)];
  assert.equal(currentGravity(batch({ fg: 0.998, fermentationComplete: false }), events), 1.02);
  assert.equal(currentGravity(batch({ fg: 0.998, fermentationComplete: true }), events), 0.998);
  assert.ok(Math.abs((batchAbv(batch({ fg: 0.998, fermentationComplete: true }), []) ?? 0) - 13.3875) < 1e-9);
});

test('the first stage tap of the day adds an automatic entry', () => {
  const plan = planStatusEntry([], 'primary', 'aging', '2026-11-17T09:00');
  assert.equal(plan.action, 'add');
  if (plan.action === 'add') {
    assert.equal(plan.entry.toStatus, 'aging');
    assert.equal(plan.entry.fromStatus, 'primary');
    assert.equal(plan.entry.auto, true);
  }
});

test('a second tap the same day replaces the automatic entry', () => {
  const events = [stageEntry('e1', '2026-11-17T09:00', 'primary', 'aging')];
  assert.deepEqual(planStatusEntry(events, 'aging', 'secondary', '2026-11-17T09:05'), {
    action: 'replace',
    id: 'e1',
    toStatus: 'secondary',
    date: '2026-11-17T09:05',
  });
});

test('tapping back to the starting stage removes the entry', () => {
  const events = [stageEntry('e1', '2026-11-17T09:00', 'primary', 'aging')];
  assert.deepEqual(planStatusEntry(events, 'aging', 'primary', '2026-11-17T09:05'), { action: 'remove', id: 'e1' });
});

test('a tap on a new day adds a new entry', () => {
  const events = [stageEntry('e1', '2026-11-16T09:00', 'primary', 'aging')];
  assert.equal(planStatusEntry(events, 'aging', 'secondary', '2026-11-17T09:00').action, 'add');
});

test('entries added or edited by hand are never replaced', () => {
  const events = [stageEntry('e1', '2026-11-17T09:00', 'primary', 'aging', false)];
  assert.equal(planStatusEntry(events, 'aging', 'secondary', '2026-11-17T09:05').action, 'add');
});

test('tapping the current stage does nothing', () => {
  assert.equal(planStatusEntry([], 'aging', 'aging', '2026-11-17T09:00').action, 'none');
});

// --- Step feeding and backsweetening (issue #3) ------------------------------

const entry = (type: BatchEvent['type'], date: string, value: number | null = null, patch: Partial<BatchEvent> = {}): BatchEvent => ({
  ...base,
  id: `${type}-${date}`,
  batchId: 'b1',
  type,
  date,
  value,
  note: '',
  ...patch,
});

const near = (actual: number | null | undefined, expected: number) =>
  assert.ok(actual != null && Math.abs(actual - expected) < 1e-6, `${actual} is not ${expected}`);

test('a step feeding raises the potential ABV (issue example: 13.1% to 15.75%)', () => {
  const b = batch({ og: 1.1 });
  const events = [reading('2026-11-05T10:00', 1.02), entry('feeding', '2026-11-06T10:00', 1.04)];
  near(effectiveOG(b, events), 1.12);
  near(projectedAbv(effectiveOG(b, events), 1.0)?.potential, 15.75);
});

test('a higher reading never lowers the ABV (issue example: stays 10.5%)', () => {
  const b = batch({ og: 1.1 });
  const before = [reading('2026-11-05T10:00', 1.02)];
  near(batchAbv(b, before), 10.5);
  const after = [...before, entry('feeding', '2026-11-06T10:00', 1.04)];
  near(batchAbv(b, after), 10.5);
  // ...and keeps growing as the new sugar ferments.
  near(batchAbv(b, [...after, reading('2026-11-10T10:00', 1.01)]), 14.4375);
});

test('backsweetening after stabilizing does not count toward the potential', () => {
  const b = batch({ og: 1.1 });
  const events = [reading('2026-11-05T10:00', 1.0), entry('stabilize', '2026-11-06T10:00'), entry('backsweeten', '2026-11-07T10:00', 1.015)];
  near(effectiveOG(b, events), 1.1);
  near(batchAbv(b, events), 13.125);
});

test('backsweetening without stabilizing is expected to ferment', () => {
  const b = batch({ og: 1.1 });
  const events = [reading('2026-11-05T10:00', 1.0), entry('backsweeten', '2026-11-07T10:00', 1.015)];
  near(effectiveOG(b, events), 1.115);
});

test('"This will ferment" overrides the default either way', () => {
  const b = batch({ og: 1.1 });
  const stabilized = [reading('2026-11-05T10:00', 1.0), entry('stabilize', '2026-11-06T10:00')];
  near(effectiveOG(b, [...stabilized, entry('backsweeten', '2026-11-07T10:00', 1.015, { ferments: true })]), 1.115);
  near(effectiveOG(b, [reading('2026-11-05T10:00', 1.02), entry('feeding', '2026-11-06T10:00', 1.04, { ferments: false })]), 1.1);
});

test('a plain reading that rises 0.003 or more counts as added sugar', () => {
  const b = batch({ og: 1.1 });
  near(effectiveOG(b, [reading('2026-11-05T10:00', 1.02), reading('2026-11-06T10:00', 1.025)]), 1.105);
});

test('a plain reading that rises less than 0.003 is wobble and changes nothing', () => {
  const b = batch({ og: 1.1 });
  const events = [reading('2026-11-05T10:00', 1.02), reading('2026-11-06T10:00', 1.022), reading('2026-11-07T10:00', 1.01)];
  near(effectiveOG(b, events), 1.1);
  // The wobble does not inflate the ABV: 1.100 to 1.010 is 11.8125%.
  near(batchAbv(b, events), 11.8125);
});

test('a big rise on a plain reading after stabilizing moves the level but adds no sugar', () => {
  const b = batch({ og: 1.1 });
  const events = [reading('2026-11-05T10:00', 1.0), entry('stabilize', '2026-11-06T10:00'), reading('2026-11-07T10:00', 1.012)];
  near(effectiveOG(b, events), 1.1);
  near(batchAbv(b, events), 13.125);
});

test('feeding entries without a gravity change nothing', () => {
  const b = batch({ og: 1.1 });
  near(effectiveOG(b, [reading('2026-11-05T10:00', 1.02), entry('feeding', '2026-11-06T10:00')]), 1.1);
});

test('the gravity after feeding appears on the chart', () => {
  const points = gravityPoints(batch({ og: 1.1 }), [reading('2026-11-05T10:00', 1.02), entry('feeding', '2026-11-06T10:00', 1.04)]);
  assert.deepEqual(points.map((p) => p.sg), [1.1, 1.02, 1.04]);
});

test('defaultFerments: feeding always, backsweetening unless stabilized', () => {
  assert.equal(defaultFerments('feeding', true), true);
  assert.equal(defaultFerments('backsweeten', false), true);
  assert.equal(defaultFerments('backsweeten', true), false);
});
