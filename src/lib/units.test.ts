import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upgradeSettings, volumeUnitOf } from './units.ts';

test('the units setting gives gallons or liters', () => {
  assert.equal(volumeUnitOf({ units: 'us' }), 'gal');
  assert.equal(volumeUnitOf({ units: 'metric' }), 'L');
});

test('older settings with volumeUnit become units', () => {
  assert.deepEqual(upgradeSettings({ id: 'app', volumeUnit: 'gal', tempUnit: 'F' }), { id: 'app', units: 'us', tempUnit: 'F' });
  assert.deepEqual(upgradeSettings({ id: 'app', volumeUnit: 'L', tempUnit: 'C' }), { id: 'app', units: 'metric', tempUnit: 'C' });
});

test('current settings pass through, and nothing is made up', () => {
  assert.deepEqual(upgradeSettings({ id: 'app', units: 'metric' }), { id: 'app', units: 'metric' });
  assert.deepEqual(upgradeSettings({ id: 'app', units: 'us', volumeUnit: 'L' }), { id: 'app', units: 'us' }, 'units wins over a leftover volumeUnit');
  assert.deepEqual(upgradeSettings({ id: 'app' }), { id: 'app' }, 'neither: the default applies');
});
