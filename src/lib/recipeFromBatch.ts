// Saving a batch as a recipe, and seeing what an update would change.

import type { Batch, BatchEvent, IngredientLine, Recipe } from '../db/types.ts';
import { BEVERAGE_TYPES } from '../db/types.ts';
import { finalGravity, finalReading, isFermentationComplete, originalGravity, targetFinalGravity } from './batch.ts';
import { fmtSG, newId } from './format.ts';
import { ingredientStageLabel, stageOf } from './stages.ts';

/** The recipe fields a batch provides. Name, notes, steps and rating are handled separately. */
export type RecipeFields = Pick<Recipe, 'beverageType' | 'style' | 'batchSizeL' | 'volumeUnit' | 'targetOG' | 'targetFG' | 'ingredients' | 'icon' | 'extraIcons' | 'color'>;

/**
 * What a batch puts into its recipe. The target FG is the batch's final
 * gravity once fermentation is complete, and its target final gravity before
 * that. Ingredients get fresh ids, so editing the recipe never changes the batch.
 */
export function recipeFieldsFromBatch(batch: Batch, events: BatchEvent[]): RecipeFields {
  return {
    beverageType: batch.beverageType,
    style: batch.style,
    batchSizeL: batch.volumeL,
    volumeUnit: batch.volumeUnit,
    targetOG: originalGravity(batch, events),
    // Once fermentation is done, where it actually finished; until then, the batch's target.
    targetFG: (isFermentationComplete(batch) ? (finalReading(events)?.value ?? finalGravity(events)) : null) ?? targetFinalGravity(batch),
    ingredients: batch.ingredients.map((line) => ({ ...line, id: newId(), stage: stageOf(line) })),
    icon: batch.icon,
    extraIcons: batch.extraIcons ?? [],
    color: batch.color,
  };
}

/** A recipe name from a batch name: "Bramble Melomel #2" becomes "Bramble Melomel". */
export function suggestRecipeName(batchName: string): string {
  return batchName.replace(/\s*#\d+\s*$/, '').trim() || batchName.trim();
}

const key = (line: IngredientLine) => line.name.trim().toLowerCase();

function describeLine(line: IngredientLine): string {
  return [line.amount, ingredientStageLabel(stageOf(line))].filter(Boolean).join(', ');
}

export interface RecipeChanges {
  /** One line per changed field, such as "Target OG 1.110 → 1.114". */
  fields: string[];
  /** Ingredient changes, matched by name, such as "Added Oak cubes (1 oz, Aging)". */
  ingredients: string[];
}

/** What updating the recipe with these fields would change. Empty lists mean it is already up to date. */
export function recipeChanges(recipe: Recipe, next: RecipeFields, formatVolume: (liters: number | null) => string): RecipeChanges {
  const fields: string[] = [];
  const typeLabel = (id: string) => BEVERAGE_TYPES.find((t) => t.id === id)?.label ?? id;
  const sameNumber = (a: number | null, b: number | null, places: number) => (a == null ? null : Number(a.toFixed(places))) === (b == null ? null : Number(b.toFixed(places)));

  if (recipe.beverageType !== next.beverageType) fields.push(`Type ${typeLabel(recipe.beverageType)} → ${typeLabel(next.beverageType)}`);
  if (recipe.style.trim() !== next.style.trim()) fields.push(`Style ${recipe.style || 'none'} → ${next.style || 'none'}`);
  if (!sameNumber(recipe.batchSizeL, next.batchSizeL, 2)) fields.push(`Batch size ${formatVolume(recipe.batchSizeL)} → ${formatVolume(next.batchSizeL)}`);
  if (!sameNumber(recipe.targetOG, next.targetOG, 3)) fields.push(`Target OG ${fmtSG(recipe.targetOG)} → ${fmtSG(next.targetOG)}`);
  if (!sameNumber(recipe.targetFG, next.targetFG, 3)) fields.push(`Target FG ${fmtSG(recipe.targetFG)} → ${fmtSG(next.targetFG)}`);
  if (recipe.icon !== next.icon) fields.push('Icon');
  if (recipe.color.toLowerCase() !== next.color.toLowerCase()) fields.push('Color');

  const ingredients: string[] = [];
  const before = new Map(recipe.ingredients.map((l) => [key(l), l]));
  const after = new Map(next.ingredients.map((l) => [key(l), l]));
  for (const [k, line] of after) {
    const old = before.get(k);
    if (!old) ingredients.push(`Added ${line.name} (${describeLine(line)})`);
    else if (old.amount.trim() !== line.amount.trim() || stageOf(old) !== stageOf(line)) {
      ingredients.push(`Changed ${line.name}: ${describeLine(old) || 'no amount'} → ${describeLine(line) || 'no amount'}`);
    }
  }
  for (const [k, line] of before) if (!after.has(k)) ingredients.push(`Removed ${line.name}`);
  return { fields, ingredients };
}

/** The other batches started from this recipe, which an update would leave on the older version. */
export function otherBatchesFrom(recipeId: string, batches: Batch[], exceptBatchId: string): Batch[] {
  return batches.filter((b) => b.recipeId === recipeId && b.id !== exceptBatchId && !b.deletedAt);
}
