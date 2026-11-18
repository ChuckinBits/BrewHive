import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bottlingError, bottlingNote, lineBottleMl, newLine, suggestCount, totalMl, type BottleLine } from './bottling.ts';

const GAL = 3785.41;
const line = (count: string, size: string, unit: BottleLine['unit'] = 'ml', container = ''): BottleLine => ({ id: count + size, count, size, unit, container, countTyped: true });

test('default count from the batch volume, rounded down', () => {
  assert.equal(suggestCount(GAL, 750), 5);
  assert.equal(suggestCount(2 * GAL, 750), 10);
  assert.equal(suggestCount(null, 750), 5);
  assert.equal(suggestCount(GAL, 375), 10);
  assert.equal(suggestCount(1500, 750), 2, 'exact fits are not lost to rounding');
});

test('units convert to mL (US cup, pint and quart)', () => {
  assert.equal(Math.round(lineBottleMl(line('1', '1', 'pint'))!), 473);
  assert.equal(Math.round(lineBottleMl(line('1', '1', 'quart'))!), 946);
  assert.equal(Math.round(lineBottleMl(line('1', '1', 'cup'))!), 237);
  assert.equal(Math.round(lineBottleMl(line('1', '12', 'floz'))!), 355);
  assert.equal(lineBottleMl(line('1', '1.5', 'l')), 1500);
  assert.equal(lineBottleMl(line('1', 'abc')), null);
});

test('several sizes: total, note and the next suggestion', () => {
  const lines = [line('2', '750'), line('3', '500'), line('2', '375')];
  assert.equal(totalMl(lines), 3750);
  assert.equal(bottlingNote(lines), '2 × 750 mL, 3 × 500 mL, 2 × 375 mL');
  assert.equal(newLine(GAL, [line('3', '750')]).count, '2', '1 gal minus 3 × 750 mL leaves room for 2 more');
  assert.equal(bottlingNote([line('1', '1890', 'other', 'Growler'), line('6', '12', 'floz')]), '1 × Growler (1.89 L), 6 × 12 fl oz');
});

test('validation', () => {
  assert.equal(bottlingError([line('2', '750')]), null);
  assert.match(bottlingError([line('0', '750')])!, /how many/);
  assert.match(bottlingError([line('2', '')])!, /size/);
  assert.match(bottlingError([line('2', '1000', 'other')])!, /container/);
});
