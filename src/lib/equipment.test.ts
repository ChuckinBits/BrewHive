import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Batch, BatchEvent, Equipment } from '../db/types.ts';
import { batchesIn, fmtHeadspace, headspace, suggestVesselName, vesselAfterRemovingRack, vesselChoices, vesselWarning } from './equipment.ts';

const base = { createdAt: '', updatedAt: '', deletedAt: null };
const GAL = 3.785411784;
const vessel = (patch: Partial<Equipment> = {}): Equipment => ({ ...base, id: 'v1', name: 'Carboy A', kind: 'vessel', vesselType: 'carboy', capacityL: 5 * GAL, notes: '', ...patch });
const batch = (patch: Partial<Batch> = {}): Batch =>
  ({ ...base, id: 'b1', name: 'Traditional', recipeId: null, beverageType: 'mead', style: '', status: 'primary', startDate: '2026-11-01', volumeL: 4.5 * GAL, og: 1.1, ingredients: [], icon: '', color: '', rating: null, notes: '', vesselId: 'v1', ...patch }) as Batch;
const rack = (patch: Partial<BatchEvent>): BatchEvent => ({ ...base, id: 'r', batchId: 'b1', type: 'rack', date: '2026-11-10T10:00', value: null, note: '', ...patch });

test('a vessel holds the batches in it that are not bottled, archived or deleted', () => {
  const all = [batch(), batch({ id: 'b2', status: 'bottled' }), batch({ id: 'b3', status: 'archived' }), batch({ id: 'b4', deletedAt: 'x' }), batch({ id: 'b5', vesselId: 'v2' })];
  assert.deepEqual(batchesIn('v1', all).map((b) => b.id), ['b1']);
});

test('headspace: what is left, in liters and percent', () => {
  const h = headspace(5 * GAL, 4.5 * GAL)!;
  assert.equal(fmtHeadspace(h, 'gal'), '0.5 gal headspace (10%)');
  assert.equal(fmtHeadspace(headspace(5 * GAL, 5 * GAL)!, 'gal'), 'Full');
  assert.equal(fmtHeadspace(headspace(5 * GAL, 6 * GAL)!, 'gal'), '1 gal more than it holds');
  assert.equal(headspace(null, 4), null, 'no capacity: nothing to say');
  assert.equal(headspace(19, null), null, 'no batch volume: nothing to say');
});

test('an unnamed vessel is named from its capacity and type', () => {
  assert.equal(suggestVesselName('carboy', 5 * GAL, 'gal'), '5 gal carboy');
  assert.equal(suggestVesselName('bucket', 23, 'L'), '23 L bucket');
  assert.equal(suggestVesselName('keg', null, 'gal'), 'Keg');
});

test('picking a vessel warns when it is too small or already holds another batch', () => {
  assert.equal(vesselWarning(vessel(), batch(), [batch()], 'gal'), null, 'fits, and it is this batch that is in it');
  assert.equal(vesselWarning(vessel({ capacityL: 3 * GAL }), batch(), [], 'gal'), 'Carboy A holds 3 gal, less than this batch\'s 4.5 gal.');
  assert.equal(vesselWarning(vessel(), batch({ id: 'new' }), [batch({ name: 'Cyser' })], 'gal'), 'Carboy A already holds Cyser.');
});

test('free vessels come first when picking', () => {
  const all = [vessel({ id: 'v1', name: 'Carboy A' }), vessel({ id: 'v2', name: 'Bucket' }), { ...vessel({ id: 'g', name: 'Hydrometer' }), kind: 'gear' as const }];
  const choices = vesselChoices(all, [batch({ id: 'other', vesselId: 'v2' })], 'b1');
  assert.deepEqual(choices.map((c) => [c.vessel.name, c.holding.length]), [['Carboy A', 0], ['Bucket', 1]]);
});

test('removing the racking that moved the batch puts it back where it was', () => {
  const r1 = rack({ id: 'r1', date: '2026-11-10T10:00', fromVesselId: 'v1', vesselId: 'v2' });
  const b = batch({ vesselId: 'v2' });
  assert.equal(vesselAfterRemovingRack(r1, b, [r1]), 'v1');
  const r2 = rack({ id: 'r2', date: '2026-11-20T10:00', fromVesselId: 'v2', vesselId: 'v2' });
  assert.equal(vesselAfterRemovingRack(r1, b, [r1, r2]), 'v2', 'a later racking into a vessel: nothing changes');
  assert.equal(vesselAfterRemovingRack(rack({ id: 'r3' }), b, []), 'v2', 'a racking without a vessel changes nothing');
  assert.equal(vesselAfterRemovingRack(rack({ id: 'r4', vesselId: 'v2' }), b, []), null, 'from nowhere: back to no vessel');
});
