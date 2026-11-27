// Carbonation: a batch is carbonated from its latest Carbonated entry on. Removing the entry makes it still again.

import { CARB_LEVELS, CARB_METHODS, type BatchEvent, type CarbLevel } from '../db/types.ts';

/** The batch's latest Carbonated entry, or null while it's still. Takes the batch's timeline (a sub-batch's includes its parent's). */
export function carbonationOf(timeline: BatchEvent[]): BatchEvent | null {
  let latest: BatchEvent | null = null;
  for (const e of timeline) {
    if (e.type !== 'carbonate' || e.deletedAt) continue;
    if (!latest || e.date > latest.date || (e.date === latest.date && e.createdAt > latest.createdAt)) latest = e;
  }
  return latest;
}

export const carbLevelLabel = (level: CarbLevel | undefined) => CARB_LEVELS.find((l) => l.id === level)?.label ?? '';

/** A Carbonated entry in a few words: "Sparkling · natural, honey 3/4 cup" or "Petillant · forced, 12 PSI". */
export function carbonationSummary(entry: BatchEvent): string {
  const method = (CARB_METHODS.find((m) => m.id === entry.carbMethod)?.label ?? 'Natural').toLowerCase();
  const detail =
    entry.carbMethod === 'forced'
      ? entry.psi != null
        ? `${entry.psi} PSI`
        : ''
      : [entry.primer && entry.primer !== 'Other' ? entry.primer.toLowerCase() : '', entry.primerAmount?.trim() ?? ''].filter(Boolean).join(' ');
  const how = [method, detail].filter(Boolean).join(', ');
  const level = carbLevelLabel(entry.carbLevel);
  return level ? `${level} · ${how}` : how.charAt(0).toUpperCase() + how.slice(1);
}
