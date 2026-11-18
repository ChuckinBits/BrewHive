import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Batch, CellarEntry } from '../db/types.ts';
import { inCellarFilter, shouldAskToArchive, shouldResetArchivePrompt } from './cellar.ts';

const batch = (patch: Partial<Batch> = {}) => ({ id: 'b1', status: 'bottled', ...patch }) as Batch;
const entry = (count: number, batchId: string | null = 'b1') => ({ id: Math.random().toString(), batchId, count }) as CellarEntry;

test('asks once every entry from a bottled batch is empty', () => {
  assert.equal(shouldAskToArchive(batch(), [entry(0)]), true);
  assert.equal(shouldAskToArchive(batch(), [entry(0), entry(2)]), false, 'a second size still has bottles');
  assert.equal(shouldAskToArchive(batch(), [entry(0), entry(0), entry(3, 'other')]), true, 'other batches do not count');
});

test('does not ask for other statuses, after Not now, or without a batch', () => {
  assert.equal(shouldAskToArchive(batch({ status: 'archived' }), [entry(0)]), false);
  assert.equal(shouldAskToArchive(batch({ status: 'aging' }), [entry(0)]), false);
  assert.equal(shouldAskToArchive(batch({ archivePromptDismissed: true }), [entry(0)]), false);
  assert.equal(shouldAskToArchive(null, [entry(0, null)]), false);
  assert.equal(shouldAskToArchive(batch(), []), false, 'no cellar entries at all');
});

test('Not now resets once bottles come back', () => {
  assert.equal(shouldResetArchivePrompt(batch({ archivePromptDismissed: true }), [entry(1)]), true);
  assert.equal(shouldResetArchivePrompt(batch({ archivePromptDismissed: true }), [entry(0)]), false);
  assert.equal(shouldResetArchivePrompt(batch(), [entry(1)]), false);
});

test('cellar filters', () => {
  assert.equal(inCellarFilter(entry(2), 'in'), true);
  assert.equal(inCellarFilter(entry(0), 'in'), false);
  assert.equal(inCellarFilter(entry(0), 'empty'), true);
  assert.equal(inCellarFilter(entry(0), 'all'), true);
});
