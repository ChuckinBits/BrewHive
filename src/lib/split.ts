// Splitting a batch into sub-batches: the batch stops (marked Split) and each part carries on in its
// own vessel as a batch of its own. A sub-batch's timeline starts with the batch's history up to the
// split, and its ingredients are the batch's, scaled to its share of the volume, so its costs follow.

import type { Batch, BatchEvent, IngredientLine } from '../db/types.ts';
import { joinAmount, splitAmount } from './stages.ts';
import { parseNum } from './format.ts';

/** One part of a split: its name, the vessel it's in and how much. */
export interface SplitPart {
  name: string;
  vesselId: string;
  volumeL: number | null;
}

/** "Bramble Melomel #2 A", "… B": letters in order. */
export function splitNames(name: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${name} ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) + 1 : ''}`);
}

/** Each part's share of the batch: by volume when all are known, otherwise equal. */
export function shares(parts: Pick<SplitPart, 'volumeL'>[]): number[] {
  const total = parts.reduce((s, p) => s + (p.volumeL ?? 0), 0);
  if (parts.some((p) => p.volumeL == null) || total <= 0) return parts.map(() => 1 / parts.length);
  return parts.map((p) => (p.volumeL ?? 0) / total);
}

/** "3" scaled by 0.5 is "1.5"; amounts kept to two decimals, without trailing zeros. */
const scaled = (n: number) => String(Math.round(n * 100) / 100);

/** An ingredient line with its amount scaled. Lines whose amount isn't a number ("a handful") stay as they are. */
export function scaleLine(line: IngredientLine, factor: number): IngredientLine {
  const { quantity, unit } = splitAmount(line);
  const n = parseNum(quantity);
  if (n == null) return line;
  const q = scaled(n * factor);
  return { ...line, quantity: q, unit, amount: joinAmount(q, unit) };
}

/** Why these parts can't be split, or null when they can. */
export function splitProblem(parts: SplitPart[]): string | null {
  if (parts.length < 2) return 'A split needs at least two vessels.';
  if (parts.some((p) => !p.name.trim())) return 'Give each part a name.';
  if (parts.some((p) => p.volumeL != null && p.volumeL <= 0)) return 'Each part needs some volume: more than 0.';
  return null;
}

/**
 * The sub-batches and the batch after a split on `date`. Sub-batches keep the batch's start date,
 * stage, recipe, gravities and look, start unrated, and keep the ingredient lines' ids, so what the
 * batch already logged counts as logged for them.
 */
export function planSplit(parent: Batch, parts: SplitPart[], date: string, newId: () => string): { parent: Batch; children: Batch[] } {
  const share = shares(parts);
  const children = parts.map((part, i): Batch => {
    const { vesselId: _older, statusBeforeArchive: _a, splitAt: _s, statusBeforeSplit: _b, ...rest } = parent;
    return {
      ...rest,
      id: newId(),
      name: part.name.trim(),
      volumeL: part.volumeL ?? (parent.volumeL != null ? parent.volumeL * share[i] : null),
      ingredients: parent.ingredients.map((line) => scaleLine(line, share[i])),
      vessels: [{ vesselId: part.vesselId, volumeL: null }],
      rating: null,
      notes: '',
      parentId: parent.id,
      splitAt: date,
      createdAt: undefined as unknown as string,
      deletedAt: null,
    };
  });
  return { parent: { ...parent, status: 'split', statusBeforeSplit: parent.status, splitAt: date, vessels: [] }, children };
}

/**
 * A batch's timeline: its own entries, and for a sub-batch the entries of the batch it was split from
 * up to the split (and that batch's, if it was split from another). `inherited` are the ids of those,
 * which belong to the earlier batch.
 */
export function timelineOf(batch: Batch, allBatches: Batch[], allEvents: BatchEvent[]): { events: BatchEvent[]; inherited: Set<string> } {
  const own = allEvents.filter((e) => e.batchId === batch.id && !e.deletedAt);
  const inherited = new Set<string>();
  let child: Batch = batch;
  const seen = new Set([batch.id]);
  const merged = [...own];
  while (child.parentId && child.splitAt && !seen.has(child.parentId)) {
    const parent = allBatches.find((b) => b.id === child.parentId);
    if (!parent) break;
    seen.add(parent.id);
    const cutoff = child.splitAt;
    for (const e of allEvents) {
      if (e.batchId === parent.id && !e.deletedAt && e.date <= cutoff) {
        merged.push(e);
        inherited.add(e.id);
      }
    }
    child = parent;
  }
  return { events: merged, inherited };
}

/** The sub-batches a batch was split into, in name order. */
export function subBatchesOf(parent: Batch, all: Batch[]): Batch[] {
  return all.filter((b) => b.parentId === parent.id && !b.deletedAt).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

/** A split can be undone while none of its sub-batches has an entry of its own or has moved on a stage. */
export function canUndoSplit(parent: Batch, children: Batch[], allEvents: BatchEvent[]): boolean {
  if (parent.status !== 'split') return false;
  const ids = new Set(children.map((c) => c.id));
  return children.every((c) => c.status === parent.statusBeforeSplit) && !allEvents.some((e) => ids.has(e.batchId) && !e.deletedAt);
}
