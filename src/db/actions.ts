// Writes that touch more than one record.

import { batches, events } from './store.ts';
import type { Batch, BatchStatus } from './types.ts';
import { planReviewEntry, planStatusEntry } from '../lib/batch.ts';
import { nowLocal } from '../lib/format.ts';

/**
 * Moves a batch to a new stage and records it on the timeline, keeping at
 * most one automatic stage entry per day (see planStatusEntry).
 */
export async function changeStatus(batch: Batch, to: BatchStatus): Promise<void> {
  if (to === batch.status) return;
  await batches.save({ ...batch, status: to });
  await recordStatusEntry(batch.id, batch.status, to);
}

/** Records a stage change on the timeline, following the one-automatic-entry-per-day rule. */
export async function recordStatusEntry(batchId: string, from: BatchStatus, to: BatchStatus): Promise<void> {
  const timeline = (await events.list()).filter((e) => e.batchId === batchId);
  const plan = planStatusEntry(timeline, from, to, nowLocal());
  if (plan.action === 'add') {
    await events.save({ batchId, ...plan.entry });
  } else if (plan.action === 'replace') {
    const entry = timeline.find((e) => e.id === plan.id);
    if (entry) await events.save({ ...entry, toStatus: plan.toStatus, date: plan.date });
  } else if (plan.action === 'remove') {
    await events.remove(plan.id);
  }
}

/**
 * Sets the batch rating by hand and records it on the timeline, keeping at most
 * one automatic "Batch rating" entry per day (see planReviewEntry).
 */
export async function setBatchRating(batch: Batch, rating: number | null): Promise<void> {
  await batches.save({ ...batch, rating });
  const timeline = (await events.list()).filter((e) => e.batchId === batch.id);
  const now = nowLocal();
  const plan = planReviewEntry(timeline, rating, now);
  if (plan.action === 'add') {
    await events.save({ batchId: batch.id, type: 'review', date: now, value: null, note: '', rating: plan.rating, auto: true });
  } else if (plan.action === 'update') {
    const entry = timeline.find((e) => e.id === plan.id);
    if (entry) await events.save({ ...entry, rating: plan.rating, date: now });
  } else if (plan.action === 'remove') {
    await events.remove(plan.id);
  }
}
