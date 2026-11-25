import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanRecord, cleanSettings } from './validate.ts';
import type { Settings } from './types.ts';

const stamp = { createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' };

test('cleanRecord skips what it cannot use', () => {
  assert.equal(cleanRecord('batches', null), null);
  assert.equal(cleanRecord('batches', []), null);
  assert.equal(cleanRecord('batches', { name: 'No id' }), null);
  assert.equal(cleanRecord('batches', { id: '', name: 'Empty id' }), null);
  assert.equal(cleanRecord('batches', { id: 'b1', name: 'No start', status: 'primary' }), null);
  assert.equal(cleanRecord('batches', { id: 'b1', name: 'Odd stage', status: 'fizzing', startDate: '2026-01-01' }), null);
  assert.equal(cleanRecord('events', { id: 'e1', batchId: 'b1', date: '2026-01-01T09:00', type: 'teleport' }), null);
  assert.equal(cleanRecord('cellar', { id: 'c1', name: 'Mead', bottledDate: '2026-01-01', count: '12', bottleSizeMl: 750 }), null);
  assert.equal(cleanRecord('pours', { id: 'p1', date: '2026-01-01', count: 1 }), null);
  assert.equal(cleanRecord('ingredients', { id: 'i1', name: 42 }), null);
});

test('cleanRecord tidies loose ends', () => {
  const batch = cleanRecord('batches', {
    id: 'b1',
    name: 'Traditional',
    status: 'primary',
    startDate: '2026-01-01',
    og: '1.100',
    beverageType: 'soda',
    ingredients: [{ id: 'l1', name: 'Honey', stage: 'later' }, { name: 'No id' }, 'junk'],
    ...stamp,
  });
  assert.ok(batch);
  assert.equal(batch.og, null);
  assert.equal(batch.beverageType, 'mead');
  assert.equal(batch.notes, '');
  assert.equal(batch.rating, null);
  assert.deepEqual(batch.ingredients, [{ id: 'l1', name: 'Honey', amount: '' }]);

  const event = cleanRecord('events', { id: 'e1', batchId: 'b1', date: '2026-01-01T09:00', type: 'status', value: 'x', toStatus: 'nowhere', ...stamp });
  assert.ok(event);
  assert.equal(event.value, null);
  assert.equal(event.note, '');
  assert.equal('toStatus' in event, false);

  const item = cleanRecord('ingredients', { id: 'i1', name: 'Honey', cost: { price: 'free' }, ...stamp });
  assert.ok(item);
  assert.equal(item.cost, null);
  assert.equal(item.category, 'other');

  const noStamp = cleanRecord('recipes', { id: 'r1', name: 'Plain' });
  assert.ok(noStamp);
  assert.equal(noStamp.updatedAt, '');
  assert.deepEqual(noStamp.steps, []);
});

test('cleanRecord keeps a good record as it is', () => {
  const event = { id: 'e1', batchId: 'b1', date: '2026-01-01T09:00', type: 'gravity', value: 1.05, note: 'Bubbling', final: true, ...stamp };
  assert.deepEqual(cleanRecord('events', event), event);
});

test('cleanSettings keeps only sensible fields', () => {
  const current: Settings = { id: 'app', units: 'us', tempUnit: 'F', theme: 'system', views: {}, sorts: {} };
  const next = cleanSettings(
    { id: 'app', units: 'metric', tempUnit: 'K', theme: 'dark', views: { batches: 'shelf' }, sorts: 5, currency: 'eur', hideIngredientAdd: true, admin: true },
    current,
  );
  assert.equal(next.units, 'metric');
  assert.equal(next.tempUnit, 'F');
  assert.equal(next.theme, 'dark');
  assert.deepEqual(next.views, { batches: 'shelf' });
  assert.deepEqual(next.sorts, {});
  assert.equal(next.currency, undefined);
  assert.equal(next.hideIngredientAdd, true);
  assert.equal('admin' in next, false);
  assert.deepEqual(cleanSettings('junk', current), current);
});
