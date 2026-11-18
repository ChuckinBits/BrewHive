import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtTempBoth, fmtVolumeBoth, tempToInput } from './format.ts';

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
