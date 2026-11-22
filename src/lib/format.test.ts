import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtDateTime, parseNum, fmtTempBoth, fmtVolumeBoth, tempToInput } from './format.ts';

test('a record in the default unit shows one value', () => {
  assert.equal(fmtVolumeBoth(3.785411784, 'gal', 'gal'), '1 gal');
  assert.equal(fmtVolumeBoth(3.785411784, undefined, 'gal'), '1 gal', 'older records without a unit use the default');
  assert.equal(fmtTempBoth(20, undefined, 'C'), '20 °C');
});

test('a record in the other unit shows both, default in brackets', () => {
  assert.equal(fmtVolumeBoth(19, 'L', 'gal'), '19 L (5.02 gal)');
  assert.equal(fmtTempBoth(20, 'C', 'F'), '20 °C (68 °F)');
  assert.equal(fmtTempBoth(20, 'F', 'C'), '68 °F (20 °C)');
});

test('temperature inputs start in the entry unit', () => {
  assert.equal(tempToInput(20, 'F'), '68');
  assert.equal(tempToInput(20, 'C'), '20');
});

test('fmtDateTime gives the day and a 12-hour time', () => {
  const year = new Date().getFullYear();
  assert.equal(fmtDateTime(`${year}-11-03T14:05`), 'Nov 3, 2:05 PM');
  assert.equal(fmtDateTime(`${year}-11-03T00:30`), 'Nov 3, 12:30 AM');
  assert.equal(fmtDateTime('2020-01-02T12:00'), 'Jan 2, 2020, 12:00 PM');
  assert.equal(fmtDateTime('2020-01-02'), 'Jan 2, 2020');
});

test('parseNum reads fractions', () => {
  assert.equal(parseNum('1/2'), 0.5);
  assert.equal(parseNum('1 1/2'), 1.5);
  assert.equal(parseNum('½'), 0.5);
  assert.equal(parseNum('1½'), 1.5);
  assert.equal(parseNum('2 ¾'), 2.75);
  assert.equal(parseNum('11/2'), 5.5, 'eleven halves');
  assert.equal(parseNum('1/0'), null);
  assert.equal(parseNum('1,5'), 1.5);
  assert.equal(parseNum('a/b'), null);
  assert.equal(parseNum('3'), 3);
});
