// Numbers derived from a batch and its timeline.

import type { Batch, BatchEvent, BatchStatus } from '../db/types.ts';
import { abv } from './calc.ts';
import { toLocalMinute } from './format.ts';

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
 * - The final gravity sits where fermentation was marked complete (completedAt). Without that
 *   date it sits right after the last plain reading, so sugar added after fermentation finished
 *   (backsweetening) comes after it. Either way it never comes after stabilizing or after
 *   backsweetening that isn't meant to ferment, nor after backsweetening that is, unless a
 *   gravity reading follows it or the final gravity was entered after it was logged.
 */
export function analyzeGravity(batch: Batch, events: BatchEvent[]): GravityAnalysis {
  const og = originalGravity(batch, events);
  const result: GravityAnalysis = { fermented: 0, addedSugar: 0, hasReadings: false };
  if (og == null) return result;

  type Step = { sg: number | null; event: BatchEvent | null };
  const live = events.filter((e) => !e.deletedAt).sort(byTime);
  const withValue = readings(live);
  // When there is no OG, the first reading stands in for it.
  const skip = batch.og == null ? withValue[0] : undefined;
  const steps: Step[] = live
    .filter((e) => e !== skip && ((READING_TYPES.has(e.type) && e.value != null) || isSugar(e)))
    .map((e) => ({ sg: e.value, event: e }));

  if (isFermentationComplete(batch) && batch.fg != null) {
    const fgStep: Step = { sg: batch.fg, event: null };
    let at: number;
    if (batch.completedAt) {
      // completedAt is an exact moment (ISO). An entry comes after the final gravity if it is dated
      // a later minute, or the same minute and was added after fermentation was marked complete.
      const exact = batch.completedAt.length > 16;
      const minute = exact ? toLocalMinute(batch.completedAt) : batch.completedAt;
      at = steps.findIndex(
        (s) => !!s.event && (s.event.date.slice(0, 16) > minute || (exact && s.event.date.slice(0, 16) === minute && s.event.createdAt > (batch.completedAt as string))),
      );
      if (at < 0) at = steps.length;
    } else {
      let lastPlain = -1;
      steps.forEach((s, i) => {
        if (s.event?.type === 'gravity') lastPlain = i;
      });
      at = lastPlain + 1;
    }
    // Stabilizing, and backsweetening that isn't meant to ferment, only happen once fermentation
    // is done. So the final gravity always comes before them, even if fermentation was marked
    // complete later; otherwise the drop from a sweetened gravity back to the FG would count as alcohol.
    const stabilizedAt = live.find((e) => e.type === 'stabilize');
    const finished = steps.findIndex(
      (s) =>
        !!s.event &&
        ((s.event.type === 'backsweeten' && !sugarFerments(s.event)) ||
          // (Sugar the person says will ferment, such as a ticked backsweetening, is left where it is.)
          (!!stabilizedAt && !(isSugar(s.event) && sugarFerments(s.event)) && stabilizedBefore([stabilizedAt], s.event.date, s.event.createdAt))),
    );
    if (finished >= 0 && finished < at) at = finished;
    // Backsweetening ticked to ferment only adds to the ABV once a later measurement shows the drop:
    // a gravity reading after it, or a final gravity entered after it was logged. A final gravity
    // entered before the backsweetening was logged was measured before it, so it comes first.
    const fgEnteredAt = batch.completedAt && batch.completedAt.length > 16 ? batch.completedAt : null;
    for (let i = 0; i < at; i++) {
      const event = steps[i].event;
      if (event?.type !== 'backsweeten') continue;
      const confirmed =
        steps.slice(i + 1, at).some((s) => s.event?.type === 'gravity' && s.sg != null) || (fgEnteredAt != null && event.createdAt < fgEnteredAt);
      if (!confirmed) {
        at = i;
        break;
      }
    }
    steps.splice(at, 0, fgStep);
  }

  let level = og;
  // A feeding or backsweetening entry logged without a gravity, waiting for the next reading.
  let pending: (BatchEvent & { type: 'feeding' | 'backsweeten' }) | null = null;
  for (const { sg, event } of steps) {
    if (sg == null) {
      if (event && isSugar(event)) pending = event;
      continue;
    }
    result.hasReadings = true;
    const source = event && isSugar(event) ? event : pending;
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
    } else if (event && rise >= NOISE_RISE - 1e-9) {
      // A real rise on a plain reading, such as sugar added without logging it.
      if (!stabilizedBefore(events, event.date, event.createdAt)) result.addedSugar += rise;
      level = sg;
    }
    // Otherwise: wobble (or a final gravity above the level). The level stays where it was.
  }
  return result;
}

/** ABV so far. Null until there is a reading after the OG (or an FG), so a new batch shows a dash, not 0%. */
export function batchAbv(batch: Batch, events: BatchEvent[]): number | null {
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
