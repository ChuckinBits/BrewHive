// Cellar rules that don't depend on the screen.

import type { Batch, CellarEntry } from '../db/types.ts';

export type CellarFilter = 'in' | 'empty' | 'all';

export const CELLAR_FILTERS: { id: CellarFilter; label: string }[] = [
  { id: 'in', label: 'In cellar' },
  { id: 'empty', label: 'Empty' },
  { id: 'all', label: 'All' },
];

export function inCellarFilter(entry: CellarEntry, filter: CellarFilter): boolean {
  if (filter === 'in') return entry.count > 0;
  if (filter === 'empty') return entry.count === 0;
  return true;
}

/** Bottles left across every cellar entry from a batch. */
export function bottlesLeftFromBatch(batchId: string, entries: CellarEntry[]): number {
  return entries.filter((e) => e.batchId === batchId).reduce((sum, e) => sum + e.count, 0);
}

/**
 * After a pour: should we ask to archive the batch? Only for a batch still in
 * Bottled, once every entry from it is empty, and not after "Not now".
 */
export function shouldAskToArchive(batch: Batch | null | undefined, entries: CellarEntry[]): boolean {
  if (!batch || batch.status !== 'bottled' || batch.archivePromptDismissed) return false;
  if (!entries.some((e) => e.batchId === batch.id)) return false;
  return bottlesLeftFromBatch(batch.id, entries) === 0;
}

/** "Not now" holds only while the batch stays empty: once bottles come back, it may ask again. */
export function shouldResetArchivePrompt(batch: Batch | null | undefined, entries: CellarEntry[]): boolean {
  return !!batch?.archivePromptDismissed && bottlesLeftFromBatch(batch.id, entries) > 0;
}
