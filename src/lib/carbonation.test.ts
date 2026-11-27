import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BatchEvent } from '../db/types.ts';
import { carbonationOf, carbonationSummary } from './carbonation.ts';

const entry = (over: Partial<BatchEvent>): BatchEvent =>
  ({ id: Math.random().toString(36), batchId: 'b1', type: 'carbonate', date: '2026-11-01T10:00', value: null, note: '', createdAt: '2026-11-01T10:00:00Z', updatedAt: '', ...over }) as BatchEvent;

test('carbonationOf: the latest Carbonated entry, skipping removed ones', () => {
  assert.equal(carbonationOf([]), null);
  assert.equal(carbonationOf([entry({ type: 'note' })]), null);
  const first = entry({ carbLevel: 'petillant', date: '2026-11-01T10:00' });
  const later = entry({ carbLevel: 'sparkling', date: '2026-11-05T10:00' });
  assert.equal(carbonationOf([later, first]), later);
  assert.equal(carbonationOf([first, { ...later, deletedAt: '2026-11-06' }]), first);
  assert.equal(carbonationOf([{ ...first, deletedAt: '2026-11-06' }]), null);
});

test('carbonationSummary: level, then how', () => {
  assert.equal(carbonationSummary(entry({ carbMethod: 'natural', carbLevel: 'sparkling', primer: 'Honey', primerAmount: '3/4 cup' })), 'Sparkling · natural, honey 3/4 cup');
  assert.equal(carbonationSummary(entry({ carbMethod: 'forced', carbLevel: 'petillant', psi: 12 })), 'Petillant · forced, 12 PSI');
  assert.equal(carbonationSummary(entry({ carbMethod: 'forced' })), 'Forced');
  assert.equal(carbonationSummary(entry({ carbMethod: 'natural', primer: 'Other', primerAmount: '2 tbsp' })), 'Natural, 2 tbsp');
});
