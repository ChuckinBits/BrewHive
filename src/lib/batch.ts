// Numbers derived from a batch and its timeline.

import type { Batch, BatchEvent, BatchStatus } from '../db/types.ts';
import { abv } from './calc.ts';

/** The final gravity assumed when the user has not set a target: fully dry. */
export const DEFAULT_TARGET_FG = 1.0;

export interface GravityPoint {
  /** ISO date or date-time */
  date: string;
  sg: number;
}

/** The original gravity plus every gravity reading, oldest first. */
export function gravityPoints(batch: Batch, events: BatchEvent[]): GravityPoint[] {
  const points: GravityPoint[] = events
    .filter((e) => e.type === 'gravity' && e.value != null)
    .map((e) => ({ date: e.date, sg: e.value as number }));
  if (batch.og != null) points.push({ date: batch.startDate, sg: batch.og });
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

/** OG as entered, or the first reading when no OG was entered. */
export function originalGravity(batch: Batch, events: BatchEvent[]): number | null {
  if (batch.og != null) return batch.og;
  return gravityPoints(batch, events)[0]?.sg ?? null;
}

/**
 * Whether fermentation is finished. Batches saved before this flag existed
 * count as finished when they had a final gravity.
 */
export function isFermentationComplete(batch: Batch): boolean {
  return batch.fermentationComplete ?? batch.fg != null;
}

export function targetFinalGravity(batch: Batch): number {
  return batch.targetFG ?? DEFAULT_TARGET_FG;
}

/** The final gravity once fermentation is complete, otherwise the most recent reading. */
export function currentGravity(batch: Batch, events: BatchEvent[]): number | null {
  if (isFermentationComplete(batch) && batch.fg != null) return batch.fg;
  const points = gravityPoints(batch, events);
  return points.length ? points[points.length - 1].sg : null;
}

/** ABV so far. Null until there is a reading after the OG (or an FG), so a new batch shows a dash, not 0%. */
export function batchAbv(batch: Batch, events: BatchEvent[]): number | null {
  const og = originalGravity(batch, events);
  const hasFinal = isFermentationComplete(batch) && batch.fg != null;
  const hasLaterReading = hasFinal || gravityPoints(batch, events).length > 1;
  const sg = currentGravity(batch, events);
  return og != null && sg != null && hasLaterReading ? abv(og, sg) : null;
}

export interface ProjectedAbv {
  /** The ABV if it ferments all the way to 1.000. */
  potential: number;
  /** The ABV at the batch's target final gravity. Null when the target is 1.000, so it would only repeat the potential. */
  target: number | null;
}

/** Where the batch could end up. Shown before and after fermentation completes. Null without an OG. */
export function projectedAbv(og: number | null, targetFG: number): ProjectedAbv | null {
  if (og == null) return null;
  const isDefault = Math.abs(targetFG - DEFAULT_TARGET_FG) < 0.0005;
  return { potential: abv(og, DEFAULT_TARGET_FG), target: isDefault ? null : abv(og, targetFG) };
}

/**
 * The stage a batch moves to when fermentation is marked complete: Secondary,
 * if it is still in Planned or Primary. A batch already further along stays put.
 */
export function stageWhenComplete(status: BatchStatus): BatchStatus {
  return status === 'planned' || status === 'primary' ? 'secondary' : status;
}

/** The same calendar day, comparing yyyy-mm-dd or local date-time strings. */
const sameDay = (a: string, b: string) => a.slice(0, 10) === b.slice(0, 10);

export type StatusEntryPlan =
  | { action: 'add'; entry: Pick<BatchEvent, 'type' | 'date' | 'value' | 'note' | 'toStatus' | 'fromStatus' | 'auto'> }
  | { action: 'replace'; id: string; toStatus: BatchStatus; date: string }
  | { action: 'remove'; id: string }
  | { action: 'none' };

/**
 * Decides how the timeline records a tap on a stage button, keeping at most
 * one automatic stage entry per day:
 * - No automatic entry today: add one.
 * - An automatic entry today: change it to the new stage. If the new stage is
 *   the one the batch was in before that entry, remove the entry instead.
 * Entries the user added or edited by hand are never touched.
 */
export function planStatusEntry(events: BatchEvent[], from: BatchStatus, to: BatchStatus, now: string): StatusEntryPlan {
  if (from === to) return { action: 'none' };
  const todays = events
    .filter((e) => e.type === 'status' && e.auto && !e.deletedAt && sameDay(e.date, now))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (todays) {
    if (todays.fromStatus === to) return { action: 'remove', id: todays.id };
    return { action: 'replace', id: todays.id, toStatus: to, date: now };
  }
  return { action: 'add', entry: { type: 'status', date: now, value: null, note: '', toStatus: to, fromStatus: from, auto: true } };
}

/** How full the carboy is drawn, 0 to 1. */
export function fillLevel(status: BatchStatus): number {
  switch (status) {
    case 'planned':
      return 0;
    case 'primary':
      return 0.92;
    case 'secondary':
      return 0.86;
    case 'aging':
      return 0.82;
    default:
      return 0.05;
  }
}

export function isActive(status: BatchStatus): boolean {
  return status !== 'bottled' && status !== 'archived';
}
