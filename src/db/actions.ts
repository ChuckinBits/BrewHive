// Writes that touch more than one record.

import { batches, events } from './store.ts';
import type { Batch, BatchStatus, VesselFill } from './types.ts';
import { fillsOf, normalizeFills, volumeAfterRack } from '../lib/equipment.ts';
import { planReviewEntry, planStatusEntry } from '../lib/batch.ts';
import { newId, nowLocal } from '../lib/format.ts';
import { planSplit, subBatchesOf, type SplitPart } from '../lib/split.ts';

/**
 * Moves a batch to a new stage and records it on the timeline, keeping at
 * most one automatic stage entry per day (see planStatusEntry).
 */
export async function changeStatus(batch: Batch, to: BatchStatus, patch: Partial<Batch> = {}): Promise<void> {
  if (to === batch.status) return;
  await batches.save({ ...batch, ...patch, status: to });
  await recordStatusEntry(batch.id, batch.status, to);
}

/**
 * Racks the batch into a vessel (or out of tracking, with null): a Racked entry that records where
 * it went and where it came from, and the batch's vessel follows.
 */
export async function rackInto(batchId: string, fills: VesselFill[], date = nowLocal(), note = ''): Promise<void> {
  // Read fresh: racking is offered right after a stage change, which saved the batch.
  const batch = await batches.get(batchId);
  if (!batch) return;
  const vessels = normalizeFills(fills);
  await events.save({ batchId, type: 'rack', date, value: null, note, vessels, fromVessels: fillsOf(batch), fromVolumeL: batch.volumeL });
  await batches.save(withVessels(batch, vessels));
}

/** The batch in these vessels: several with amounts that add up differently change its volume (racking losses). */
export function withVessels(batch: Batch, vessels: VesselFill[]): Batch {
  const { vesselId: _older, ...rest } = batch;
  return { ...rest, vessels, volumeL: volumeAfterRack(vessels, batch) };
}

/**
 * Splits a batch into sub-batches, one per part, from `date` on (the racking that put it in their
 * vessels). The batch becomes Split; each sub-batch is a batch of its own in its vessel.
 */
export async function splitBatch(parentId: string, parts: SplitPart[], date: string): Promise<Batch[]> {
  const parent = await batches.get(parentId);
  if (!parent) return [];
  const plan = planSplit(parent, parts, date, newId);
  const saved: Batch[] = [];
  for (const child of plan.children) saved.push(await batches.save(child));
  await batches.save(plan.parent);
  return saved;
}

/** Undoes a split nothing has happened in since: the sub-batches go, and the batch carries on in their vessels. */
export async function undoSplit(parentId: string): Promise<void> {
  const parent = await batches.get(parentId);
  if (!parent || parent.status !== 'split') return;
  const children = subBatchesOf(parent, await batches.list());
  for (const child of children) await batches.remove(child.id);
  const { splitAt: _s, statusBeforeSplit, ...rest } = parent;
  await batches.save({ ...rest, status: statusBeforeSplit ?? 'secondary', vessels: children.flatMap((c) => fillsOf(c).map((f) => ({ vesselId: f.vesselId, volumeL: c.volumeL }))) });
}

/** Archives a batch, remembering its stage so it can be unarchived. */
export async function archiveBatch(batch: Batch): Promise<void> {
  if (batch.status === 'archived') return;
  await changeStatus(batch, 'archived', { statusBeforeArchive: batch.status });
}

/** Puts an archived batch back in the stage it was in before. Batches without one go back to Bottled. */
export async function unarchiveBatch(batch: Batch): Promise<void> {
  if (batch.status !== 'archived') return;
  const back = batch.statusBeforeArchive && batch.statusBeforeArchive !== 'archived' ? batch.statusBeforeArchive : 'bottled';
  await changeStatus(batch, back, { statusBeforeArchive: null });
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
