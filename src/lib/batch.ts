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

/** Readings after the OG: the OG's own timeline entry is the starting point, not a reading. */
function readings(events: BatchEvent[]): BatchEvent[] {
  return events.filter((e) => READING_TYPES.has(e.type) && e.value != null && !e.deletedAt && !e.og).sort(byTime);
}

/** The timeline entry for the batch's OG, if there is one. */
export function ogEntry(events: BatchEvent[]): BatchEvent | null {
  return events.find((e) => e.og && e.type === 'gravity' && !e.deletedAt) ?? null;
}

/** The original gravity plus every gravity reading, oldest first. The OG is placed at its entry's date, or the start date. */
export function gravityPoints(batch: Batch, events: BatchEvent[]): GravityPoint[] {
  const points: GravityPoint[] = readings(events).map((e) => ({ date: e.date, sg: e.value as number }));
  if (batch.og != null) points.unshift({ date: ogEntry(events)?.date ?? batch.startDate, sg: batch.og });
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

/** Gravity readings marked as the final gravity, oldest first. There is normally one; old data can have more. */
export function markedFinals(events: BatchEvent[]): BatchEvent[] {
  return readings(events).filter((e) => e.type === 'gravity' && e.final === true);
}

/**
 * The batch's final gravity reading: the latest one marked final, as long as no sugar that is
 * expected to ferment comes after it (a step feeding, or backsweetening with "This will ferment").
 * While such sugar follows it, fermentation isn't over and there is no final reading. The mark
 * itself is kept, so unticking "This will ferment" or deleting the entry brings it back.
 */
export function finalReading(events: BatchEvent[]): BatchEvent | null {
  const marked = markedFinals(events);
  const last = marked[marked.length - 1];
  if (!last) return null;
  const live = events.filter((e) => !e.deletedAt).sort(byTime);
  const after = live.slice(live.indexOf(last) + 1);
  return after.some((e) => isSugar(e) && sugarFerments(e)) ? null : last;
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
  const live = events.filter((e) => !e.deletedAt && !e.og).sort(byTime);
  // When there is no OG, the first reading stands in for it.
  const skip = batch.og == null ? readings(live)[0] : undefined;
  return live.filter((e) => e !== skip && ((READING_TYPES.has(e.type) && e.value != null) || isSugar(e)));
}

export function analyzeGravity(batch: Batch, events: BatchEvent[]): GravityAnalysis {
  const og = originalGravity(batch, events);
  const result: GravityAnalysis = { fermented: 0, addedSugar: 0, hasReadings: false };
  if (og == null) return result;

  const steps = gravitySteps(batch, events);
  const final = finalReading(events);

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
    if (event === final) {
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
  return after.some((e) => READING_TYPES.has(e.type) && e.value != null && !e.og) ? null : latest.value;
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

/**
 * The driest finish counted as reachable. Meads often go below 1.000, sometimes down to 0.990;
 * an ABV target that would need to finish lower than this needs more sugar.
 */
export const DRIEST_FG = 0.99;

/**
 * Points of sugar (thousandths of gravity) an ABV target still needs, for a finish below what's
 * likely: the least if it finishes at DRIEST_FG, and enough to finish at 1.000.
 */
export function pointsNeeded(finish: number): { low: number; high: number } {
  // Counted from the finish as shown (three decimals), so the numbers on screen add up.
  const shown = Math.round(finish * 1000) / 1000;
  const points = (to: number) => Math.max(0, Math.round((to - shown) * 1000));
  return { low: points(DRIEST_FG), high: points(DEFAULT_TARGET_FG) };
}

/** "17–27", or one number when both ends are the same. */
export function fmtPoints({ low, high }: { low: number; high: number }): string {
  return low === high ? String(high) : `${low}–${high}`;
}

export interface ProjectedAbv {
  /**
   * The ABV if it ferments down to 1.000, or to the expected finish when that's below 1.000
   * (a target FG under 1.000, or an ABV target that finishes between 0.990 and 1.000).
   */
  potential: number;
  /** The gravity the potential is worked out to: 1.000, or the expected finish below it. */
  potentialFG: number;
  /** Whether the target is worth showing next to the potential: false when it would only repeat it. */
  showTarget: boolean;
  /** For an ABV target: whether it can finish at DRIEST_FG or above. Always true for an FG target. */
  reachable: boolean;
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
  if (target.targetMode === 'abv' && target.targetAbv != null) {
    const finish = og - target.targetAbv / 131.25;
    const reachable = finish >= DRIEST_FG - 1e-9;
    // Finishing between 0.990 and 1.000: the potential goes that low too. Out of reach: it stays at 1.000.
    const potentialFG = reachable ? Math.min(DEFAULT_TARGET_FG, finish) : DEFAULT_TARGET_FG;
    return { potential: abv(og, potentialFG), potentialFG, showTarget: true, reachable, target: target.targetAbv, targetFG: finish, mode: 'abv' };
  }
  const fg = target.targetFG ?? DEFAULT_TARGET_FG;
  const isDefault = Math.abs(fg - DEFAULT_TARGET_FG) < 0.0005;
  // A target FG below 1.000 is where you expect it to finish, so the potential follows it there.
  const potentialFG = Math.min(DEFAULT_TARGET_FG, fg);
  return {
    potential: abv(og, potentialFG),
    potentialFG,
    // Below 1.000 the target and potential are the same number: show it once.
    showTarget: !isDefault && fg > DEFAULT_TARGET_FG,
    reachable: true,
    target: isDefault ? null : abv(og, fg),
    targetFG: fg,
    mode: 'fg',
  };
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

// --- Progress: the chart, fermentation rate, attenuation, days to target

/** Backsweetening that isn't set to ferment adds sweetness, not something fermentation works through. */
const chartable = (e: BatchEvent) => !(e.type === 'backsweeten' && !sugarFerments(e));

/** The gravity chart's points: the OG and readings, leaving out backsweetening that won't ferment. */
export function chartPoints(batch: Batch, events: BatchEvent[]): GravityPoint[] {
  return gravityPoints(batch, events.filter(chartable));
}

/** A corner of the chart's line. Corners added for a step up carry no dot. */
export interface ChartVertex extends GravityPoint {
  corner?: true;
}

/**
 * The chart's line. Fermentation only lowers the gravity, so the line slopes down between readings,
 * but sugar goes in all at once: a rise is drawn flat up to the day the sugar went in, then straight
 * up. That day is the rising entry's own date, or the date of a step feeding or fermenting
 * backsweetening logged before it without a gravity.
 */
export function chartLine(batch: Batch, events: BatchEvent[]): ChartVertex[] {
  const points = chartPoints(batch, events);
  // Sugar entries logged without a gravity: the next rise happened on their date.
  const sugarDates = events
    .filter((e) => !e.deletedAt && isSugar(e) && sugarFerments(e) && e.value == null)
    .map((e) => e.date)
    .sort();
  const line: ChartVertex[] = [];
  points.forEach((point, i) => {
    const prev = points[i - 1];
    if (prev && point.sg > prev.sg) {
      const added = sugarDates.filter((d) => d > prev.date && d <= point.date)[0] ?? point.date;
      line.push({ date: added, sg: prev.sg, corner: true });
      if (added !== point.date) line.push({ date: added, sg: point.sg, corner: true });
    }
    line.push(point);
  });
  return line;
}

/** Hours since the epoch for a yyyy-mm-dd or local yyyy-mm-ddThh:mm string. */
const hoursOf = (date: string) => new Date(date.length === 10 ? `${date}T00:00` : date).getTime() / 3_600_000;

/**
 * Gravity points per day between the last two chart points (the OG counts as one). Null with fewer
 * than two, when they're under an hour apart, or when the last is a rise (sugar just added).
 */
export function fermentationRate(batch: Batch, events: BatchEvent[]): number | null {
  const points = chartPoints(batch, events);
  if (points.length < 2) return null;
  const [a, b] = points.slice(-2);
  const hours = hoursOf(b.date) - hoursOf(a.date);
  if (!(hours >= 1)) return null;
  const rate = ((a.sg - b.sg) * 1000) / (hours / 24);
  return rate < 0 ? null : rate;
}

/** Apparent attenuation in %: how much of the sugar (OG plus fermenting additions) has fermented. Null before any reading. */
export function attenuation(batch: Batch, events: BatchEvent[]): number | null {
  const og = effectiveOG(batch, events);
  const sg = currentGravity(batch, events);
  if (og == null || sg == null || og <= 1.0005 || !analyzeGravity(batch, events).hasReadings) return null;
  return Math.max(0, ((og - sg) / (og - 1)) * 100);
}

/**
 * About how many days until the target FG (1.000 without one) at the current rate. Fermentation slows,
 * so it's optimistic. Null unless fermenting with a rate, or once the target is reached.
 */
export function daysToTarget(batch: Batch, events: BatchEvent[]): { days: number; targetFG: number } | null {
  if (!isFermenting(batch.status) || finalReading(events)) return null;
  const rate = fermentationRate(batch, events);
  const sg = currentGravity(batch, events);
  const og = effectiveOG(batch, events);
  if (rate == null || rate < 0.1 || sg == null || og == null) return null;
  const targetFG = projectedAbv(og, batch)?.targetFG ?? DEFAULT_TARGET_FG;
  const points = (sg - targetFG) * 1000;
  if (points <= 0.5) return null;
  return { days: points / rate, targetFG };
}

/**
 * The gravity in the batch now: the latest reading of any kind, backsweetening included, or the OG
 * before any. Null when a backsweetening entry without a gravity came after the latest reading, since
 * then nobody knows it yet.
 */
export function gravityNow(batch: Batch, events: BatchEvent[]): number | null {
  const live = events.filter((e) => !e.deletedAt && !e.og).sort(byTime);
  const lastReading = readings(live).pop();
  const unknown = live.some((e) => e.type === 'backsweeten' && e.value == null && (!lastReading || byTime(e, lastReading) > 0));
  if (unknown) return null;
  return lastReading ? (lastReading.value as number) : originalGravity(batch, events);
}

/**
 * Timeline entries that show how sweet the batch is: backsweetening with a gravity, the final reading,
 * and gravity readings after backsweetening or stabilizing, when the sweetness is where it stays.
 */
export function sweetnessEntries(events: BatchEvent[]): Set<string> {
  const ids = new Set<string>();
  let settled = false;
  const final = finalReading(events);
  for (const e of events.filter((x) => !x.deletedAt).sort(byTime)) {
    if (e.type === 'stabilize' || e.type === 'backsweeten') settled = true;
    if (e.value == null || e.og) continue;
    if (e.type === 'backsweeten' || (e.type === 'gravity' && (settled || e === final))) ids.add(e.id);
  }
  return ids;
}

/** How sweet a finished mead at this gravity is, by the BJCP ranges (Dessert above them). */
export function sweetnessOf(sg: number): { label: string; range: string } {
  if (sg < 1.01) return { label: 'Dry', range: 'below 1.010' };
  if (sg < 1.025) return { label: 'Semi-sweet', range: '1.010–1.025' };
  if (sg <= 1.05) return { label: 'Sweet', range: '1.025–1.050' };
  return { label: 'Dessert', range: 'above 1.050' };
}
