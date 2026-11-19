import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Batch, BatchEvent, BatchStatus } from '../db/types.ts';
import {
  abvEstimate,
  finalReading,
  analyzeGravity,
  batchAbv,
  currentGravity,
  effectiveOG,
  gravityPoints,
  isFermentationComplete,
  planReviewEntry,
  planStatusEntry,
  projectedAbv,
  sugarFerments,
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
const final = (date: string, sg: number): BatchEvent => ({ ...reading(date, sg), final: true });

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

test('no projected ABV without an OG', () => {
  assert.equal(projectedAbv(null, 1.0), null);
});

test('the stage says whether fermentation is done (issue #26)', () => {
  for (const status of ['planned', 'primary', 'secondary'] as const) assert.equal(isFermentationComplete(batch({ status })), false, status);
  for (const status of ['aging', 'bottled'] as const) assert.equal(isFermentationComplete(batch({ status })), true, status);
  assert.equal(isFermentationComplete(batch({ status: 'archived', statusBeforeArchive: 'secondary' })), false);
  assert.equal(isFermentationComplete(batch({ status: 'archived', statusBeforeArchive: null })), true);
  assert.equal(targetFinalGravity(batch()), 1.0);
});

test('the current gravity is the latest reading; a final reading is just a reading', () => {
  const events = [reading('2026-11-05T10:00', 1.02), final('2026-11-09T10:00', 0.998)];
  assert.equal(currentGravity(batch(), events), 0.998);
  near(batchAbv(batch({ status: 'aging' }), events), 13.3875);
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

test('backsweetening does not ferment unless the box is ticked, stabilized or not (issue #6)', () => {
  const b = batch({ og: 1.1 });
  const events = [reading('2026-11-05T10:00', 1.0), entry('backsweeten', '2026-11-07T10:00', 1.015)];
  near(effectiveOG(b, events), 1.1);
  near(effectiveOG(b, [reading('2026-11-05T10:00', 1.0), entry('backsweeten', '2026-11-07T10:00', 1.015, { ferments: true })]), 1.115);
  const stabilized = [reading('2026-11-05T10:00', 1.0), entry('stabilize', '2026-11-06T10:00')];
  near(effectiveOG(b, [...stabilized, entry('backsweeten', '2026-11-07T10:00', 1.015, { ferments: true })]), 1.115);
});

test('step feeding always ferments, even with an old "won\'t ferment" setting saved (issue #6)', () => {
  const b = batch({ og: 1.1 });
  near(effectiveOG(b, [reading('2026-11-05T10:00', 1.02), entry('feeding', '2026-11-06T10:00', 1.04, { ferments: false })]), 1.12);
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

test('sugarFerments: feeding always, backsweetening only when ticked', () => {
  assert.equal(sugarFerments(entry('feeding', '2026-11-06T10:00')), true);
  assert.equal(sugarFerments(entry('backsweeten', '2026-11-06T10:00')), false);
  assert.equal(sugarFerments(entry('backsweeten', '2026-11-06T10:00', null, { ferments: true })), true);
});

// --- Backsweetening after fermentation is complete (follow-up to issue #3) ----

test('final reading, then stabilized and backsweetened with "This will ferment": the potential counts it', () => {
  const events = [final('2026-11-09T10:00', 1.0), entry('stabilize', '2026-11-10T10:00'), entry('backsweeten', '2026-11-11T10:00', 1.015, { ferments: true })];
  near(effectiveOG(batch({ og: 1.1 }), events), 1.115);
  near(batchAbv(batch({ og: 1.1 }), events), 13.125);
});

test('ticked backsweetening that ferments out: the drop after it is ABV, once a reading shows it', () => {
  const events = [reading('2026-11-08T10:00', 1.0), entry('backsweeten', '2026-11-11T10:00', 1.015, { ferments: true }), final('2026-11-20T10:00', 0.998)];
  near(effectiveOG(batch({ og: 1.1 }), events), 1.115);
  near(batchAbv(batch({ og: 1.1 }), events), (0.1 + 0.017) * 131.25);
});

test('stabilized and backsweetened without ticking the box: the potential and ABV stay put', () => {
  const events = [final('2026-11-09T10:00', 1.0), entry('stabilize', '2026-11-10T10:00'), entry('backsweeten', '2026-11-11T10:00', 1.015)];
  near(effectiveOG(batch({ og: 1.1 }), events), 1.1);
  near(batchAbv(batch({ og: 1.1 }), events), 13.125);
});

test('a backsweetening entry without a gravity hands its setting to the next reading', () => {
  const stabilized = [reading('2026-11-08T10:00', 1.0), entry('stabilize', '2026-11-10T10:00')];
  const ticked = [...stabilized, entry('backsweeten', '2026-11-11T10:00', null, { ferments: true }), reading('2026-11-11T11:00', 1.015)];
  near(effectiveOG(batch({ og: 1.1 }), ticked), 1.115);
  const unticked = [...stabilized, entry('backsweeten', '2026-11-11T10:00'), reading('2026-11-11T11:00', 1.015)];
  near(effectiveOG(batch({ og: 1.1 }), unticked), 1.1);
});

test('a feeding entry without a gravity lets the next reading count even a small rise', () => {
  const events = [reading('2026-11-05T10:00', 1.02), entry('feeding', '2026-11-06T10:00'), reading('2026-11-06T11:00', 1.022)];
  near(effectiveOG(batch({ og: 1.1 }), events), 1.102);
});

test('stabilized and backsweetened in the same minute: the order they were added decides', () => {
  const stab = entry('stabilize', '2026-11-11T10:00', null, { createdAt: '2026-11-11T17:00:01Z' });
  const sweet = entry('backsweeten', '2026-11-11T10:00', 1.015, { createdAt: '2026-11-11T17:00:30Z' });
  const b = batch({ og: 1.1 });
  near(effectiveOG(b, [reading('2026-11-08T10:00', 1.0), stab, sweet]), 1.1);
  near(effectiveOG(b, [reading('2026-11-08T10:00', 1.0), stab, { ...sweet, ferments: true }]), 1.115);
});

// --- Batch rating entries (issue #8) -----------------------------------------

const review = (id: string, date: string, rating: number, auto = true): BatchEvent => ({ ...base, id, batchId: 'b1', type: 'review', date, value: null, note: '', rating, auto });

test('the first batch rating of the day adds an entry', () => {
  assert.deepEqual(planReviewEntry([], 8, '2026-11-18T09:00'), { action: 'add', rating: 8 });
});

test('changing the rating again the same day updates that entry', () => {
  assert.deepEqual(planReviewEntry([review('r1', '2026-11-18T09:00', 8)], 7.5, '2026-11-18T09:10'), { action: 'update', id: 'r1', rating: 7.5 });
});

test('a new day gets its own entry, so the rating can be tracked over time', () => {
  assert.deepEqual(planReviewEntry([review('r1', '2026-11-17T09:00', 8)], 7, '2026-11-18T09:00'), { action: 'add', rating: 7 });
});

test('clearing removes only today\'s entry, never earlier ones', () => {
  const events = [review('old', '2026-11-17T09:00', 8), review('today', '2026-11-18T09:00', 7)];
  assert.deepEqual(planReviewEntry(events, null, '2026-11-18T09:30'), { action: 'remove', id: 'today' });
  assert.deepEqual(planReviewEntry([review('old', '2026-11-17T09:00', 8)], null, '2026-11-18T09:30'), { action: 'none' });
});

test('tastings and rating entries edited by hand are never replaced', () => {
  const tasting: BatchEvent = { ...base, id: 't1', batchId: 'b1', type: 'tasting', date: '2026-11-18T09:00', value: null, note: '', rating: 9 };
  assert.deepEqual(planReviewEntry([tasting], 6, '2026-11-18T09:10'), { action: 'add', rating: 6 });
  assert.deepEqual(planReviewEntry([review('r1', '2026-11-18T09:00', 8, false)], 6, '2026-11-18T09:10'), { action: 'add', rating: 6 });
  assert.deepEqual(planReviewEntry([tasting], null, '2026-11-18T09:10'), { action: 'none' });
});

// --- Every gravity is a timeline reading (issue #26) ------------------------

test('backsweetening that does not ferment never adds to the ABV (Pink Lady Cyser)', () => {
  const finished = [reading('2026-11-05T10:00', 1.0), final('2026-11-06T10:00', 0.998)];
  const sweet = entry('backsweeten', '2026-11-08T10:00', 1.012);
  const expected = (1.1 - 0.998) * 131.25;
  const b = batch({ status: 'aging' });
  near(batchAbv(b, [...finished, sweet]), expected);
  near(batchAbv(b, [...finished, sweet, reading('2026-11-09T10:00', 1.012)]), expected);
  near(batchAbv(b, finished), expected);
});

test('ticked backsweetening or step feeding only raise the ABV once a later reading shows the drop', () => {
  const b = batch({ og: 1.08, status: 'aging' });
  const finished = [reading('2026-10-20T10:00', 1.0), final('2026-10-25T10:00', 0.998)];
  const base = (1.08 - 0.998) * 131.25;
  const sweet = entry('backsweeten', '2026-10-27T10:00', 1.025, { ferments: true });
  near(batchAbv(b, [...finished, sweet]), base);
  near(batchAbv(b, [...finished, sweet, reading('2026-11-17T10:00', 1.01)]), base + (1.025 - 1.01) * 131.25);
  const feed = entry('feeding', '2026-10-27T10:00', 1.02);
  near(batchAbv(b, [...finished, feed]), base);
  near(batchAbv(b, [...finished, feed, reading('2026-11-18T10:00', 1.0)]), base + 0.02 * 131.25);
  // The potential still counts the feeding: it is expected to ferment.
  near(effectiveOG(b, [...finished, feed]), 1.08 + 0.022);
});

test('Grape Pyment: a final reading above an earlier reading is never counted as added sugar', () => {
  // OG 1.080, readings down to 1.000, final reading 1.010, backsweetened (ticked) to 1.030,
  // reading 1.020, step-fed to 1.040: 20 + 20 points fed, not 50.
  const events = [
    reading('2026-10-10T10:00', 1.0),
    final('2026-10-15T10:00', 1.01),
    entry('backsweeten', '2026-10-20T10:00', 1.03, { ferments: true }),
    reading('2026-10-25T10:00', 1.02),
    entry('feeding', '2026-10-26T10:00', 1.04),
  ];
  near(analyzeGravity(batch({ og: 1.08, status: 'secondary' }), events).addedSugar, 0.04);
});

test('an estimated ABV stands in until a later reading replaces it', () => {
  const events = [reading('2026-11-05T10:00', 1.02)];
  const b = batch({ status: 'bottled', abvEstimate: 12, abvEstimateAt: '2026-11-10T10:00' });
  assert.equal(abvEstimate(b, events), 12);
  assert.equal(batchAbv(b, events), 12);
  const later = [...events, reading('2026-11-12T10:00', 1.0)];
  assert.equal(abvEstimate(b, later), null);
  near(batchAbv(b, later), 13.125);
});

test('a reading in the same minute as the estimate, logged after it, replaces it', () => {
  const b = batch({ status: 'bottled', abvEstimate: 12, abvEstimateAt: '2026-11-10T10:00', abvEstimateSavedAt: '2026-11-10T17:00:10.000Z' });
  assert.equal(abvEstimate(b, [{ ...reading('2026-11-10T10:00', 1.0), createdAt: '2026-11-10T17:00:30.000Z' }]), null);
  assert.equal(abvEstimate(b, [{ ...reading('2026-11-10T10:00', 1.0), createdAt: '2026-11-10T16:59:00.000Z' }]), 12);
});

test('finalReading: the marked gravity reading, or null', () => {
  assert.equal(finalReading([reading('2026-11-05T10:00', 1.02)]), null);
  const f = final('2026-11-09T10:00', 1.0);
  assert.equal(finalReading([reading('2026-11-05T10:00', 1.02), f, reading('2026-11-12T10:00', 1.001)]), f);
  assert.equal(finalReading([{ ...f, deletedAt: '2026-11-10T00:00:00Z' }]), null);
});
