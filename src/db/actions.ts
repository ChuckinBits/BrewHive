// Writes that touch more than one record.

import { batches, events } from './store.ts';
import type { Batch, BatchStatus } from './types.ts';
import { planStatusEntry } from '../lib/batch.ts';
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
