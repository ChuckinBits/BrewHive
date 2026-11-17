// Numbers derived from a batch and its timeline.

import type { Batch, BatchEvent, BatchStatus } from '../db/types.ts';
import { abv } from './calc.ts';

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

/** FG when set, otherwise the most recent reading. */
export function currentGravity(batch: Batch, events: BatchEvent[]): number | null {
  if (batch.fg != null) return batch.fg;
  const points = gravityPoints(batch, events);
  return points.length ? points[points.length - 1].sg : null;
}

/** ABV so far. Null until there is a reading after the OG (or an FG), so a new batch shows a dash, not 0%. */
export function batchAbv(batch: Batch, events: BatchEvent[]): number | null {
  const og = originalGravity(batch, events);
  const hasLaterReading = batch.fg != null || gravityPoints(batch, events).length > 1;
  const sg = currentGravity(batch, events);
  return og != null && sg != null && hasLaterReading ? abv(og, sg) : null;
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
