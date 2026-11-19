// Numbers derived from a batch and its timeline.

import type { Batch, BatchEvent, BatchStatus, TargetMode } from '../db/types.ts';
import { abv } from './calc.ts';

/** The final gravity assumed when the user has not set a target: fully dry. */
export const DEFAULT_TARGET_FG = 1.0;

export interface GravityPoint {
  /** ISO date or date-time */
  date: string;
  sg: number;
}

/** Entries that can carry a gravity reading: plain readings, and the gravity after step feeding or backsweetening. */
const READING_TYPES = new Set(['gravity', 'feeding', 'backsweeten']);

const byTime = (a: BatchEvent, b: BatchEvent) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);

function readings(events: BatchEvent[]): BatchEvent[] {
  return events.filter((e) => READING_TYPES.has(e.type) && e.value != null && !e.deletedAt).sort(byTime);
}

/** The original gravity plus every gravity reading, oldest first. */
export function gravityPoints(batch: Batch, events: BatchEvent[]): GravityPoint[] {
  const points: GravityPoint[] = readings(events).map((e) => ({ date: e.date, sg: e.value as number }));
  if (batch.og != null) points.unshift({ date: batch.startDate, sg: batch.og });
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

/** OG as entered, or the first reading when no OG was entered. */
export function originalGravity(batch: Batch, events: BatchEvent[]): number | null {
  if (batch.og != null) return batch.og;
  return gravityPoints(batch, events)[0]?.sg ?? null;
}

/** Primary and Secondary: the stages where fermentation happens. */
export function isFermenting(status: BatchStatus): boolean {
  return status === 'primary' || status === 'secondary';
}

/**
 * Whether fermentation is finished: the stage decides. Aging and Bottled are done;
 * an archived batch counts by the stage it was archived from (Bottled if unknown).
 */
export function isFermentationComplete(batch: Batch): boolean {
  const status = batch.status === 'archived' ? (batch.statusBeforeArchive ?? 'bottled') : batch.status;
  return status === 'aging' || status === 'bottled';
}

export function targetFinalGravity(batch: Batch): number {
  return batch.targetFG ?? DEFAULT_TARGET_FG;
}

/** The final gravity reading when one is marked, otherwise the most recent gravity. */
export function currentGravity(batch: Batch, events: BatchEvent[]): number | null {
  const marked = finalReading(events);
  if (marked) return marked.value;
  const points = gravityPoints(batch, events);
  return points.length ? points[points.length - 1].sg : null;
}

/** The batch's final gravity reading, if one is marked. There is only ever one; the latest wins if old data has more. */
export function finalReading(events: BatchEvent[]): BatchEvent | null {
  const marked = readings(events).filter((e) => e.type === 'gravity' && e.final);
  return marked.length ? marked[marked.length - 1] : null;
}

/** The latest gravity reading on the timeline (not the OG), or null when there is none. */
export function finalGravity(events: BatchEvent[]): number | null {
  const all = readings(events);
  return all.length ? (all[all.length - 1].value as number) : null;
}

/** A rise in a plain gravity reading smaller than this is treated as hydrometer wobble, not added sugar. */
export const NOISE_RISE = 0.003;

/**
 * True when a "Stabilized" entry comes before this point on the timeline.
 * Entries logged in the same minute count in the order they were added; an
 * entry not saved yet (no createdAt) comes after everything already there.
 */
export function stabilizedBefore(events: BatchEvent[], date: string, createdAt = '\uffff'): boolean {
  return events.some((e) => e.type === 'stabilize' && !e.deletedAt && (e.date < date || (e.date === date && e.createdAt < createdAt)));
}

export interface GravityAnalysis {
  /** Points of gravity fermented so far: every drop between readings added up. Never goes down when a reading rises. */
  fermented: number;
  /** Points of gravity added by step feeding or backsweetening that are expected to ferment. */
  addedSugar: number;
  /** Whether any reading came after the OG, so there is something to measure. */
  hasReadings: boolean;
}

const isSugar = (e: BatchEvent): e is BatchEvent & { type: 'feeding' | 'backsweeten' } => e.type === 'feeding' || e.type === 'backsweeten';

/**
 * Whether sugar added by a feeding or backsweetening entry is expected to ferment.
 * Step feeding always is: adding fermentable sugar is the point of it.
 * Backsweetening only when "This will ferment" is ticked.
 */
export function sugarFerments(entry: BatchEvent): boolean {
  if (entry.type === 'feeding') return true;
  if (entry.type === 'backsweeten') return entry.ferments === true;
  return false;
}

/**
 * Walks the timeline in order, tracking the gravity level:
 * - A drop counts as fermented.
 * - A rise counts as added sugar when it is expected to ferment, and moves the level up either way:
 *   - On a step feeding entry: always counts.
 *   - On a backsweetening entry: counts only when "This will ferment" is ticked.
 *   - On a plain reading that follows a feeding or backsweetening entry logged without a
 *     gravity: that entry decides, so "add honey, then take a reading" works.
 *   - On any other plain reading: it counts if it rose by NOISE_RISE or more and the batch
 *     was not stabilized before it. A smaller rise is wobble and is ignored.
 *   A final reading (logged when fermentation ends) never counts as added sugar, and the walk
 *   stops there: readings after it don't change the ABV.
 * Every gravity is a timeline entry, so its place is its date: nothing is guessed.
 */
type Step = BatchEvent;

/** The entries the gravity walk goes through, in timeline order: readings, and feeding or backsweetening entries. */
export function gravitySteps(batch: Batch, events: BatchEvent[]): Step[] {
  const live = events.filter((e) => !e.deletedAt).sort(byTime);
  // When there is no OG, the first reading stands in for it.
  const skip = batch.og == null ? readings(live)[0] : undefined;
  return live.filter((e) => e !== skip && ((READING_TYPES.has(e.type) && e.value != null) || isSugar(e)));
}

export function analyzeGravity(batch: Batch, events: BatchEvent[]): GravityAnalysis {
  const og = originalGravity(batch, events);
  const result: GravityAnalysis = { fermented: 0, addedSugar: 0, hasReadings: false };
  if (og == null) return result;

  const steps = gravitySteps(batch, events);

  let level = og;
  // A feeding or backsweetening entry logged without a gravity, waiting for the next reading.
  let pending: (BatchEvent & { type: 'feeding' | 'backsweeten' }) | null = null;
  for (const event of steps) {
    const sg = event.value;
    if (sg == null) {
      if (event && isSugar(event)) pending = event;
      continue;
    }
    result.hasReadings = true;
    const source = isSugar(event) ? event : pending;
    if (event.type === 'gravity' && event.final) {
      // The final reading settles the ABV: later readings, up or down, no longer change it.
      if (sg <= level) result.fermented += level - sg;
      break;
    }
    pending = null;
    if (sg <= level) {
      result.fermented += level - sg;
      level = sg;
      continue;
    }
    const rise = sg - level;
    if (source) {
      if (sugarFerments(source)) result.addedSugar += rise;
      level = sg;
    } else if (rise >= NOISE_RISE - 1e-9) {
      // A real rise on a plain reading, such as sugar added without logging it. A final reading
      // is a measurement of where fermentation ended, never added sugar, so it only moves the level.
      // (A reading that was the final gravity once, final: false, is still a measurement.)
      if (event.final == null && !stabilizedBefore(events, event.date, event.createdAt)) result.addedSugar += rise;
      level = sg;
    }
    // Otherwise: wobble. The level stays where it was.
  }
  return result;
}

/**
 * The estimated ABV: the latest "Estimated ABV" entry, entered when there was no final
 * reading. A gravity reading logged after it replaces it, and deleting the entry removes it.
 */
export function abvEstimate(_batch: Batch, events: BatchEvent[]): number | null {
  const live = events.filter((e) => !e.deletedAt).sort(byTime);
  const estimates = live.filter((e) => e.type === 'estimate' && e.value != null);
  const latest = estimates[estimates.length - 1];
  if (!latest) return null;
  const after = live.slice(live.indexOf(latest) + 1);
  return after.some((e) => READING_TYPES.has(e.type) && e.value != null) ? null : latest.value;
}

/** ABV so far, or the estimate. Null until there is a reading after the OG, so a new batch shows a dash, not 0%. */
export function batchAbv(batch: Batch, events: BatchEvent[]): number | null {
  const estimate = abvEstimate(batch, events);
  if (estimate != null) return estimate;
  const analysis = analyzeGravity(batch, events);
  return analysis.hasReadings ? Math.max(0, analysis.fermented * 131.25) : null;
}

/** The OG plus any added sugar expected to ferment: what the potential ABV is worked out from. */
export function effectiveOG(batch: Batch, events: BatchEvent[]): number | null {
  const og = originalGravity(batch, events);
  return og == null ? null : og + analyzeGravity(batch, events).addedSugar;
}

export interface ProjectedAbv {
  /** The ABV if it ferments all the way to 1.000. */
  potential: number;
  /**
   * The target ABV. Aiming for an FG: the ABV at that FG, null when it's 1.000 (it would only
   * repeat the potential). Aiming for an ABV: that ABV, which additions don't change.
   */
  target: number | null;
  /** The final gravity the target implies: the target FG, or for an ABV target the FG it finishes at. */
  targetFG: number;
  mode: TargetMode;
}

export interface TargetSetting {
  targetMode?: TargetMode;
  targetFG?: number | null;
  targetAbv?: number | null;
}

/**
 * Where the batch could end up, from the OG plus any sugar added. Null without an OG.
 * With an ABV target, additions raise the FG it finishes at instead of the target:
 * OG 1.080 + 40 points fed, aiming for 14%, finishes around 1.120 - 14 / 131.25 = 1.013.
 */
export function projectedAbv(og: number | null, setting: TargetSetting | number): ProjectedAbv | null {
  if (og == null) return null;
  const target: TargetSetting = typeof setting === 'number' ? { targetFG: setting } : setting;
  const potential = abv(og, DEFAULT_TARGET_FG);
  if (target.targetMode === 'abv' && target.targetAbv != null) {
    return { potential, target: target.targetAbv, targetFG: og - target.targetAbv / 131.25, mode: 'abv' };
  }
  const fg = target.targetFG ?? DEFAULT_TARGET_FG;
  const isDefault = Math.abs(fg - DEFAULT_TARGET_FG) < 0.0005;
  return { potential, target: isDefault ? null : abv(og, fg), targetFG: fg, mode: 'fg' };
}

/**
 * True while fermenting once the measured ABV has reached the target ABV: a cue to stabilize.
 * Needs a target other than fully dry, and a measured ABV (not an estimate).
 */
export function targetReached(batch: Batch, events: BatchEvent[]): boolean {
  if (!isFermenting(batch.status) || abvEstimate(batch, events) != null) return false;
  const og = originalGravity(batch, events);
  const projected = projectedAbv(og == null ? null : og + analyzeGravity(batch, events).addedSugar, batch);
  const abvNow = batchAbv(batch, events);
  return projected?.target != null && abvNow != null && abvNow >= projected.target - 0.05;
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

export type ReviewEntryPlan =
  | { action: 'add'; rating: number }
  | { action: 'update'; id: string; rating: number }
  | { action: 'remove'; id: string }
  | { action: 'none' };

/**
 * Decides how the timeline records a change to the batch rating, keeping at
 * most one automatic "Batch rating" entry per day:
 * - No automatic entry today: add one.
 * - An automatic entry today: change its rating.
 * - Rating cleared: remove today's automatic entry. Earlier days stay.
 * Tasting entries, and rating entries edited by hand, are never touched.
 */
export function planReviewEntry(events: BatchEvent[], rating: number | null, now: string): ReviewEntryPlan {
  const todays = events
    .filter((e) => e.type === 'review' && e.auto && !e.deletedAt && sameDay(e.date, now))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (rating == null) return todays ? { action: 'remove', id: todays.id } : { action: 'none' };
  if (todays) return { action: 'update', id: todays.id, rating };
  return { action: 'add', rating };
}
