import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Batch, BatchEvent, BatchStatus } from '../db/types.ts';
import { batchAbv, currentGravity, isFermentationComplete, planStatusEntry, projectedAbv, stageWhenComplete, targetFinalGravity } from './batch.ts';

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
