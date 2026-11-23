// Stages of a batch: which ingredients go in when, which have been added,
// and where the timeline changes stage.

import {
  BATCH_STATUSES,
  INGREDIENT_STAGES,
  INGREDIENT_UNITS,
  type BatchEvent,
  type BatchStatus,
  type IngredientLine,
  type IngredientStage,
} from '../db/types.ts';

export function stageOf(line: IngredientLine): IngredientStage {
  return line.stage ?? 'primary';
}

export function ingredientStageLabel(stage: IngredientStage): string {
  return INGREDIENT_STAGES.find((s) => s.id === stage)?.label ?? stage;
}

/**
 * The ingredient stage a batch is in right now, or null when it has not started
 * or is archived. A bottled batch is at Bottling.
 */
export function currentIngredientStage(status: BatchStatus): IngredientStage | null {
  if (status === 'planned' || status === 'archived') return null;
  if (status === 'bottled') return 'bottling';
  return status;
}

/** The stage new ingredients go in when added from the timeline: the current one, or Primary before the batch starts. */
export function stageForNewIngredient(status: BatchStatus): IngredientStage {
  return currentIngredientStage(status) ?? 'primary';
}

/**
 * The stage a batch was in at a date, from its stage change entries: the newest one at or before it.
 * Before the first one, the stage that entry moved from (Primary if it doesn't say); with no stage
 * changes at all, the batch's stage now.
 */
export function statusAt(date: string, current: BatchStatus, entries: BatchEvent[]): BatchStatus {
  const changes = entries.filter((e) => e.type === 'status' && e.toStatus && !e.deletedAt).sort((a, b) => a.date.localeCompare(b.date));
  if (changes.length === 0) return current;
  const at = date.slice(0, 16);
  const last = changes.filter((e) => e.date.slice(0, 16) <= at).pop();
  if (last?.toStatus) return last.toStatus;
  // Before the first change: the stage it moved from, when that comes earlier. A batch logged as
  // Bottled and given its history afterwards says it moved from Bottled, which can't be.
  const order: BatchStatus[] = ['primary', 'secondary', 'aging', 'bottled'];
  const from = changes[0].fromStatus;
  const to = changes[0].toStatus as BatchStatus;
  return from && order.includes(from) && (!order.includes(to) || order.indexOf(from) < order.indexOf(to)) ? from : 'primary';
}

/** The ingredient stage something added at a date belongs in: the batch's stage then, or Primary. */
export function ingredientStageAt(date: string, current: BatchStatus, entries: BatchEvent[]): IngredientStage {
  return stageForNewIngredient(statusAt(date, current, entries));
}

export interface IngredientGroup {
  stage: IngredientStage;
  lines: IngredientLine[];
}

/** Ingredients grouped by stage, in stage order, keeping their order within a stage. Empty stages are left out. */
export function groupByStage(lines: IngredientLine[]): IngredientGroup[] {
  return INGREDIENT_STAGES.map((s) => ({ stage: s.id, lines: lines.filter((l) => stageOf(l) === s.id) })).filter((g) => g.lines.length > 0);
}

/** The timeline entry that ticked off each ingredient line, by line id. The earliest one counts. */
export function addedLines(events: BatchEvent[]): Map<string, BatchEvent> {
  const added = new Map<string, BatchEvent>();
  for (const e of [...events].sort((a, b) => a.date.localeCompare(b.date))) {
    if (e.type === 'ingredient' && e.ingredientLineId && !e.deletedAt && !added.has(e.ingredientLineId)) added.set(e.ingredientLineId, e);
  }
  return added;
}

/** Joins a quantity and unit into the amount shown, such as "3 lb". */
export function joinAmount(quantity: string, unit: string): string {
  // A unit with no quantity says nothing ("lb"), so there's no amount.
  if (!quantity.trim()) return '';
  return [quantity.trim(), unit.trim()].filter(Boolean).join(' ');
}

/** Splits an amount like "3 lb" or "1/2 tsp" back into quantity and unit, for editing older lines. */
export function splitAmount(line: IngredientLine): { quantity: string; unit: string } {
  if (line.quantity != null || line.unit != null) return { quantity: line.quantity ?? '', unit: line.unit ?? '' };
  const text = line.amount.trim();
  const match = /^([\d.,/\s½¼¾⅓⅔-]*\d[\d.,/½¼¾⅓⅔]*)\s*(.*)$/.exec(text);
  if (!match) return { quantity: text, unit: '' };
  const unit = match[2].trim();
  // Keep units we offer as they are; anything else stays as written (for example "to 1 gal").
  if (unit === '' || INGREDIENT_UNITS.some((u) => u.id === unit)) return { quantity: match[1].trim(), unit };
  return { quantity: text, unit: '' };
}

/** What a timeline entry takes from the ingredient it logs: name, amount and library link. */
export function entryFromLine(line: IngredientLine): Pick<BatchEvent, 'ingredient' | 'amount' | 'quantity' | 'unit' | 'ingredientId'> {
  return { ingredient: line.name, amount: line.amount, quantity: line.quantity, unit: line.unit, ingredientId: line.ingredientId };
}

/** An ingredient line updated from a timeline entry. The line keeps its stage; its saved price stays unless it's now another ingredient. */
export function lineFromEntry(line: IngredientLine, entry: Pick<BatchEvent, 'ingredient' | 'amount' | 'quantity' | 'unit' | 'ingredientId'>): IngredientLine {
  const sameItem = line.ingredientId === entry.ingredientId;
  return { ...line, name: entry.ingredient ?? line.name, amount: entry.amount ?? '', quantity: entry.quantity, unit: entry.unit, ingredientId: entry.ingredientId, cost: sameItem ? line.cost : undefined };
}

// --- Timeline sections --------------------------------------------------------

export interface TimelineSection {
  stage: BatchStatus;
  /** Entries in this stage, newest first. A "Moved to Secondary" entry opens (sits at the bottom of) the Secondary section. */
  events: BatchEvent[];
}

function stageOfEntry(e: BatchEvent): BatchStatus | undefined {
  if (e.type !== 'status') return undefined;
  if (e.toStatus) return e.toStatus;
  // Entries made before stages were stored: read the stage from the wording.
  return BATCH_STATUSES.find((s) => e.note.toLowerCase().includes(s.label.toLowerCase()))?.id;
}

/**
 * Splits a timeline (any order) into stage sections, newest first, for the
 * dividers. The stage before the first stage entry is that entry's starting
 * stage, or the batch's own stage when there are no stage entries.
 */
export function timelineSections(events: BatchEvent[], currentStatus: BatchStatus): TimelineSection[] {
  const oldestFirst = [...events].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const firstStage = oldestFirst.find((e) => stageOfEntry(e) !== undefined);
  let stage: BatchStatus = firstStage ? (firstStage.fromStatus ?? 'primary') : currentStatus;
  const sections: TimelineSection[] = [];
  for (const e of oldestFirst) {
    const next = stageOfEntry(e);
    if (next !== undefined) stage = next;
    const last = sections[sections.length - 1];
    if (last && last.stage === stage) last.events.push(e);
    else sections.push({ stage, events: [e] });
  }
  return sections.reverse().map((s) => ({ ...s, events: s.events.reverse() }));
}

/** Drops ingredients without a name and trims the rest, before saving. */
export function cleanIngredients(lines: IngredientLine[]): IngredientLine[] {
  return lines.map((line) => ({ ...line, name: line.name.trim(), amount: line.amount.trim() })).filter((line) => line.name !== '');
}
