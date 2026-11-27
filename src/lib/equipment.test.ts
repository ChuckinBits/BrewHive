import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Batch, BatchEvent, Equipment } from '../db/types.ts';
import { batchesIn, fillInOrder, gearIcon, guessGearIcon, vesselIcon, fillsAfterRemovingRack, groupVessels, numberedNames, priceTotal, sortGroups, fillsOf, fmtHeadspace, headspace, listNames, normalizeFills, rackedInto, suggestVesselName, vesselChoices, vesselsOf, vesselWarning, volumeAfterRack } from './equipment.ts';

const base = { createdAt: '', updatedAt: '', deletedAt: null };
const GAL = 3.785411784;
const vessel = (patch: Partial<Equipment> = {}): Equipment => ({ ...base, id: 'v1', name: 'Carboy A', kind: 'vessel', vesselType: 'carboy', capacityL: 5 * GAL, notes: '', ...patch });
const batch = (patch: Partial<Batch> = {}): Batch =>
  ({ ...base, id: 'b1', name: 'Traditional', recipeId: null, beverageType: 'mead', style: '', status: 'primary', startDate: '2026-11-01', volumeL: 4.5 * GAL, og: 1.1, ingredients: [], icon: '', color: '', rating: null, notes: '', vessels: [{ vesselId: 'v1', volumeL: null }], ...patch }) as Batch;
const rack = (patch: Partial<BatchEvent>): BatchEvent => ({ ...base, id: 'r', batchId: 'b1', type: 'rack', date: '2026-11-10T10:00', value: null, note: '', ...patch });
const fill = (vesselId: string, volumeL: number | null = null) => ({ vesselId, volumeL });

test('a vessel holds the batches in it that are not bottled, archived or deleted', () => {
  const all = [batch(), batch({ id: 'b2', status: 'bottled' }), batch({ id: 'b3', status: 'archived' }), batch({ id: 'b4', deletedAt: 'x' }), batch({ id: 'b5', vessels: [fill('v2')] })];
  assert.deepEqual(batchesIn('v1', all).map((b) => b.id), ['b1']);
});

test('older single-vessel data still reads (v0.3.0)', () => {
  const old = batch({ vessels: undefined, vesselId: 'v9' });
  assert.deepEqual(fillsOf(old), [fill('v9')]);
  assert.deepEqual(batchesIn('v9', [old]).map((b) => b.id), ['b1']);
  assert.deepEqual(rackedInto(rack({ vesselId: 'v2' })), [fill('v2')]);
  assert.deepEqual(rackedInto(rack({ vesselId: null })), [], 'racked somewhere untracked');
  assert.equal(rackedInto(rack({})), undefined, 'a racking that never tracked vessels');
});

test('a batch in several vessels: each one holds it, with its own amount', () => {
  const b = batch({ volumeL: 2 * GAL, vessels: [fill('j1', GAL), fill('j2', GAL)] });
  assert.deepEqual(batchesIn('j2', [b]).map((x) => x.id), ['b1']);
  const all = [vessel({ id: 'j1', name: 'Jug A', capacityL: GAL }), vessel({ id: 'j2', name: 'Jug B', capacityL: GAL })];
  assert.deepEqual(vesselsOf(b, all).map((x) => [x.vessel.name, x.volumeL]), [['Jug A', GAL], ['Jug B', GAL]]);
  assert.deepEqual(vesselsOf(batch(), [vessel()]).map((x) => x.volumeL), [4.5 * GAL], 'a lone vessel holds the whole batch');
});

test('headspace: what is left, in liters and percent', () => {
  assert.equal(fmtHeadspace(headspace(5 * GAL, 4.5 * GAL)!, 'gal'), '0.5 gal headspace (10%)');
  assert.equal(fmtHeadspace(headspace(5 * GAL, 5 * GAL)!, 'gal'), 'Full');
  assert.equal(fmtHeadspace(headspace(5 * GAL, 6 * GAL)!, 'gal'), '1 gal more than it holds');
  assert.equal(headspace(null, 4), null, 'no capacity: nothing to say');
  assert.equal(headspace(19, null), null, 'no volume: nothing to say');
});

test('an unnamed vessel is named from its capacity and type', () => {
  assert.equal(suggestVesselName('carboy', 5 * GAL, 'gal'), '5 gal carboy');
  assert.equal(suggestVesselName('bucket', 23, 'L'), '23 L bucket');
  assert.equal(suggestVesselName('keg', null, 'gal'), 'Keg');
});

test('picking a vessel warns when it is too small or already holds another batch', () => {
  assert.equal(vesselWarning(vessel(), 4.5 * GAL, 'b1', [batch()], 'gal'), null, 'fits, and it is this batch that is in it');
  assert.equal(vesselWarning(vessel({ capacityL: 3 * GAL }), 4.5 * GAL, 'b1', [], 'gal'), 'Carboy A holds 3 gal, less than the 4.5 gal of this batch.');
  assert.equal(vesselWarning(vessel({ capacityL: GAL }), 1.5 * GAL, 'b1', [], 'gal', true), 'Carboy A holds 1 gal, less than the 1.5 gal going in it.');
  assert.equal(vesselWarning(vessel(), 1, 'new', [batch({ name: 'Cyser' })], 'gal'), 'Carboy A already holds Cyser.');
});

test('free vessels come first when picking', () => {
  const all = [vessel({ id: 'v1', name: 'Carboy A' }), vessel({ id: 'v2', name: 'Bucket' }), { ...vessel({ id: 'g', name: 'Hydrometer' }), kind: 'gear' as const }];
  const choices = vesselChoices(all, [batch({ id: 'other', vessels: [fill('v2')] })], 'b1');
  assert.deepEqual(choices.map((c) => [c.vessel.name, c.holding.length]), [['Carboy A', 0], ['Bucket', 1]]);
});

test('several vessels fill in the order picked, the rest in the last', () => {
  assert.deepEqual(fillInOrder(2, [1, 1]), [1, 1]);
  assert.deepEqual(fillInOrder(2.5, [1, 1]), [1, 1.5], 'the last takes what is left, even past its size');
  assert.deepEqual(fillInOrder(1.5, [1, 1, 1]), [1, 0.5, 0]);
  assert.deepEqual(fillInOrder(3, [null, 1]), [3, 0], 'no capacity: it takes the rest');
  assert.deepEqual(fillInOrder(null, [1, 1]), [null, null]);
});

test('one vessel holds all of it; several keep their amounts and set the volume', () => {
  assert.deepEqual(normalizeFills([fill('a', 7)]), [fill('a')]);
  assert.equal(volumeAfterRack([fill('a', 1), fill('b', 0.8)], { volumeL: 2 }), 1.8, 'racking losses: the batch becomes 1.8');
  assert.equal(volumeAfterRack([fill('a')], { volumeL: 2 }), 2, 'one vessel: unchanged');
  assert.equal(volumeAfterRack([fill('a', 1), fill('b', null)], { volumeL: 2 }), 2, 'an amount missing: unchanged');
  assert.equal(listNames(['Jug A', 'Jug B', 'Jug C']), 'Jug A, Jug B and Jug C');
});

test('removing the racking that moved the batch puts it back where it was', () => {
  const into = [fill('j1', 3.785), fill('j2', 3.785)];
  const r1 = rack({ id: 'r1', date: '2026-11-10T10:00', fromVessels: [fill('v1')], vessels: into });
  const b = batch({ vessels: into });
  assert.deepEqual(fillsAfterRemovingRack(r1, b, [r1]), [fill('v1')]);
  const r2 = rack({ id: 'r2', date: '2026-11-20T10:00', fromVessels: into, vessels: into });
  assert.deepEqual(fillsAfterRemovingRack(r1, b, [r1, r2]), into, 'a later racking: nothing changes');
  assert.deepEqual(fillsAfterRemovingRack(rack({ id: 'r3' }), b, []), into, 'a racking without vessels changes nothing');
  assert.deepEqual(fillsAfterRemovingRack(rack({ id: 'r4', vessels: into }), b, []), [], 'from nowhere: back to no vessel');
});

test('vessels group by type and size, smallest first; sizes in different units still match', () => {
  const all = [
    vessel({ id: 'c2', name: 'Carboy 2', capacityL: GAL, capacityUnit: 'gal' }),
    vessel({ id: 'c1', name: 'Carboy 1', capacityL: 3.7854, capacityUnit: 'L' }),
    vessel({ id: 'h', name: 'Half', capacityL: GAL / 2 }),
    vessel({ id: 'b', name: 'Bucket', vesselType: 'bucket', capacityL: 2 * GAL }),
    vessel({ id: 'x', name: 'Mystery', capacityL: null }),
  ];
  const groups = groupVessels(all, 'gal');
  assert.deepEqual(groups.map((g) => [g.label, g.vessels.map((v) => v.id)]), [
    ['0.5 gal carboy', ['h']],
    ['1 gal carboy', ['c1', 'c2']],
    ['Carboy', ['x']],
    ['2 gal bucket', ['b']],
  ]);
});

test('price totals: what was paid, and how many have no price', () => {
  assert.deepEqual(priceTotal([vessel({ price: 7.99 }), vessel({ price: 7.99 }), vessel({ price: null })]), { total: 15.98, unpriced: 1 });
  assert.deepEqual(priceTotal([]), { total: 0, unpriced: 0 });
});

test('vessels added together are numbered, carrying on from ones already named that way', () => {
  assert.deepEqual(numberedNames('1 gal carboy', 3, []), ['1 gal carboy 1', '1 gal carboy 2', '1 gal carboy 3']);
  assert.deepEqual(numberedNames('1 gal carboy', 2, ['1 gal carboy 8', '1 gal carboy 3', '0.5 gal carboy 9']), ['1 gal carboy 9', '1 gal carboy 10']);
  assert.deepEqual(numberedNames('Jug (small)', 2, ['Jug (small) 1']), ['Jug (small) 2', 'Jug (small) 3'], 'names with brackets still match');
  assert.deepEqual(numberedNames('Big bucket', 1, ['Big bucket 1']), ['Big bucket'], 'one vessel keeps the plain name');
});

test('vessel lines sort by type, size, name or free first', () => {
  const all = [
    vessel({ id: 'c1', name: 'Carboy 1', capacityL: GAL }),
    vessel({ id: 'c2', name: 'Carboy 2', capacityL: GAL }),
    vessel({ id: 'big', name: 'Big carboy', capacityL: 5 * GAL }),
    vessel({ id: 'j1', name: 'Jar 1', vesselType: 'jar', capacityL: GAL / 2 }),
    vessel({ id: 'j2', name: 'Jar 2', vesselType: 'jar', capacityL: GAL / 2 }),
    vessel({ id: 'bk', name: 'Ale pail', vesselType: 'bucket', capacityL: 2 * GAL }),
  ];
  const groups = groupVessels(all, 'gal');
  const names = (sort: Parameters<typeof sortGroups>[1], batches: Batch[] = []) => sortGroups(groups, sort, batches).map((g) => (g.vessels.length === 1 ? g.vessels[0].name : g.label));
  assert.deepEqual(names('type'), ['1 gal carboy', 'Big carboy', 'Ale pail', '0.5 gal jar']);
  assert.deepEqual(names('size'), ['0.5 gal jar', '1 gal carboy', 'Ale pail', 'Big carboy']);
  assert.deepEqual(names('name'), ['0.5 gal jar', '1 gal carboy', 'Ale pail', 'Big carboy'], 'a lone vessel goes by its own name');
  const busy = [batch({ id: 'x', vessels: [fill('c1')] }), batch({ id: 'y', vessels: [fill('c2')] }), batch({ id: 'z', vessels: [fill('big')] })];
  assert.deepEqual(names('free', busy), ['0.5 gal jar', 'Ale pail', '1 gal carboy', 'Big carboy'], 'two free jars, then one free pail; the busy ones last, by type');
});

test('gear with a quantity counts each one in the total', () => {
  assert.deepEqual(priceTotal([{ ...vessel({ price: 1.5 }), kind: 'gear', quantity: 10 }, { ...vessel({ price: 12.99 }), kind: 'gear' }]), { total: 27.99, unpriced: 0 });
});

test('icons: each vessel type has its own, and other vessels and gear fall back', () => {
  assert.equal(vesselIcon('tank'), 'vessel-tank');
  assert.equal(vesselIcon('carboy'), 'batches');
  assert.equal(vesselIcon('other'), 'batches');
  assert.equal(vesselIcon(undefined), 'batches');
  assert.equal(gearIcon('siphon'), 'gear-siphon');
  assert.equal(gearIcon('other'), 'flask');
  assert.equal(gearIcon(undefined), 'flask');
});

test('guessGearIcon: a picture that fits the name, or none', () => {
  assert.equal(guessGearIcon('Triple scale hydrometer'), 'hydrometer');
  assert.equal(guessGearIcon('Brix refractometer'), 'refractometer');
  assert.equal(guessGearIcon('Auto-siphon'), 'siphon');
  assert.equal(guessGearIcon('Bottle capper'), 'capper');
  assert.equal(guessGearIcon('Bottle brush'), 'brush');
  assert.equal(guessGearIcon('Bottle filler'), 'bottle');
  assert.equal(guessGearIcon('pH meter'), 'ph');
  assert.equal(guessGearIcon('Star San spray'), 'spray');
  assert.equal(guessGearIcon('Mystery box'), null);
});
