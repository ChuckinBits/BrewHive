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
 * The ingredient stage a batch is in right now, or null when it has not started.
 * A bottled (or archived) batch is at Bottling.
 */
export function currentIngredientStage(status: BatchStatus): IngredientStage | null {
  if (status === 'planned') return null;
  if (status === 'bottled' || status === 'archived') return 'bottling';
  return status;
}

/** The stage new ingredients go in when added from the timeline: the current one, or Primary before the batch starts. */
export function stageForNewIngredient(status: BatchStatus): IngredientStage {
  return currentIngredientStage(status) ?? 'primary';
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
  if (unit === '' || INGREDIENT_UNITS.includes(unit)) return { quantity: match[1].trim(), unit };
  return { quantity: text, unit: '' };
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
