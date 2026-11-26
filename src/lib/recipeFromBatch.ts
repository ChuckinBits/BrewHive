// Saving a batch as a recipe, and seeing what an update would change.

import type { Batch, BatchEvent, IngredientLine, Recipe } from '../db/types.ts';
import { BEVERAGE_TYPES } from '../db/types.ts';
import { finalGravity, finalReading, isFermentationComplete, originalGravity, targetFinalGravity } from './batch.ts';
import { fmtRating, fmtSG, newId } from './format.ts';
import { ingredientStageLabel, stageOf } from './stages.ts';

/** The recipe fields a batch provides. Name, notes and steps are handled separately. */
export type RecipeFields = Pick<Recipe, 'beverageType' | 'style' | 'batchSizeL' | 'volumeUnit' | 'targetOG' | 'targetFG' | 'targetMode' | 'targetAbv' | 'ingredients' | 'icon' | 'extraIcons' | 'color' | 'rating'>;

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
    targetMode: batch.targetMode ?? 'fg',
    targetAbv: batch.targetAbv ?? null,
    // A recipe uses current prices, so the batch's saved costs stay with the batch.
    ingredients: batch.ingredients.map(({ cost: _cost, ...line }) => ({ ...line, id: newId(), stage: stageOf(line) })),
    icon: batch.icon,
    extraIcons: batch.extraIcons ?? [],
    color: batch.color,
    // The batch's rating, which a new recipe starts with and an update brings over. An unrated batch
    // (one just started from the recipe, say) leaves the recipe's rating alone: see ratingForUpdate.
    rating: batch.rating,
  };
}

/** The recipe's rating after an update from a batch: the batch's, unless the batch isn't rated. */
export function ratingForUpdate(recipe: Recipe, next: RecipeFields): number | null {
  return next.rating ?? recipe.rating;
}

/** A recipe name from a batch name: "Bramble Melomel #2" becomes "Bramble Melomel". */
export function suggestRecipeName(batchName: string): string {
  return batchName.replace(/\s*#\d+\s*$/, '').trim() || batchName.trim();
}

const key = (line: IngredientLine) => line.name.trim().toLowerCase();

function describeLine(line: IngredientLine): string {
  return [line.amount, ingredientStageLabel(stageOf(line))].filter(Boolean).join(', ');
}

/** One change an update would make. `key` names it for picking: a field ("og"), or "ingredient:<name>". */
export interface RecipeChange {
  key: string;
  /** Such as "Target OG 1.110 → 1.114" or "Added Oak cubes (1 oz, Aging)". */
  label: string;
}

export interface RecipeChanges {
  /** One per changed field. */
  fields: RecipeChange[];
  /** Ingredient changes, matched by name. */
  ingredients: RecipeChange[];
}

const sameNumber = (a: number | null, b: number | null, places: number) => (a == null ? null : Number(a.toFixed(places))) === (b == null ? null : Number(b.toFixed(places)));
const mode = (m: string | undefined) => (m === 'abv' ? 'ABV' : 'FG');
const sameIcons = (recipe: Recipe, next: RecipeFields) => recipe.icon === next.icon && (recipe.extraIcons ?? []).join() === (next.extraIcons ?? []).join();
const ingredientChanged = (old: IngredientLine, line: IngredientLine) => old.amount.trim() !== line.amount.trim() || stageOf(old) !== stageOf(line);

/** What updating the recipe with these fields would change. Empty lists mean it is already up to date. */
export function recipeChanges(recipe: Recipe, next: RecipeFields, formatVolume: (liters: number | null) => string): RecipeChanges {
  const fields: RecipeChange[] = [];
  const add = (key: string, label: string) => fields.push({ key, label });
  const typeLabel = (id: string) => BEVERAGE_TYPES.find((t) => t.id === id)?.label ?? id;

  if (recipe.beverageType !== next.beverageType) add('type', `Type ${typeLabel(recipe.beverageType)} → ${typeLabel(next.beverageType)}`);
  if (recipe.style.trim() !== next.style.trim()) add('style', `Style ${recipe.style || 'none'} → ${next.style || 'none'}`);
  if (!sameNumber(recipe.batchSizeL, next.batchSizeL, 2)) add('size', `Batch size ${formatVolume(recipe.batchSizeL)} → ${formatVolume(next.batchSizeL)}`);
  if (!sameNumber(recipe.targetOG, next.targetOG, 3)) add('og', `Target OG ${fmtSG(recipe.targetOG)} → ${fmtSG(next.targetOG)}`);
  if (!sameNumber(recipe.targetFG, next.targetFG, 3)) add('fg', `Target FG ${fmtSG(recipe.targetFG)} → ${fmtSG(next.targetFG)}`);
  if (mode(recipe.targetMode) !== mode(next.targetMode)) add('mode', `Aims for ${mode(recipe.targetMode)} → ${mode(next.targetMode)}`);
  if (!sameNumber(recipe.targetAbv ?? null, next.targetAbv ?? null, 1)) add('abv', `Target ABV ${recipe.targetAbv != null ? `${recipe.targetAbv}%` : 'none'} → ${next.targetAbv != null ? `${next.targetAbv}%` : 'none'}`);
  const rating = ratingForUpdate(recipe, next);
  const rated = (r: number | null) => (r == null ? 'none' : fmtRating(r));
  if (rating !== recipe.rating) add('rating', `Rating ${rated(recipe.rating)} → ${rated(rating)}`);
  if (!sameIcons(recipe, next)) add('icon', 'Icon');
  if (recipe.color.toLowerCase() !== next.color.toLowerCase()) add('color', 'Color');

  const ingredients: RecipeChange[] = [];
  const before = new Map(recipe.ingredients.map((l) => [key(l), l]));
  const after = new Map(next.ingredients.map((l) => [key(l), l]));
  for (const [k, line] of after) {
    const old = before.get(k);
    if (!old) ingredients.push({ key: `ingredient:${k}`, label: `Added ${line.name} (${describeLine(line)})` });
    else if (ingredientChanged(old, line)) {
      ingredients.push({ key: `ingredient:${k}`, label: `Changed ${line.name}: ${describeLine(old) || 'no amount'} → ${describeLine(line) || 'no amount'}` });
    }
  }
  for (const [k, line] of before) if (!after.has(k)) ingredients.push({ key: `ingredient:${k}`, label: `Removed ${line.name}` });
  return { fields, ingredients };
}

/**
 * The recipe after an update that applies only the picked changes (by key); everything else stays as
 * the recipe has it. Ingredients follow the batch's order, with lines the batch dropped but you kept
 * staying after the line they followed in the recipe.
 */
export function applyRecipeChanges(recipe: Recipe, next: RecipeFields, picked: ReadonlySet<string>): Recipe {
  const out: Recipe = { ...recipe };
  if (picked.has('type')) out.beverageType = next.beverageType;
  if (picked.has('style')) out.style = next.style;
  if (picked.has('size')) Object.assign(out, { batchSizeL: next.batchSizeL, volumeUnit: next.volumeUnit });
  if (picked.has('og')) out.targetOG = next.targetOG;
  if (picked.has('fg')) out.targetFG = next.targetFG;
  if (picked.has('mode')) out.targetMode = next.targetMode;
  if (picked.has('abv')) out.targetAbv = next.targetAbv;
  if (picked.has('rating')) out.rating = ratingForUpdate(recipe, next);
  if (picked.has('icon')) Object.assign(out, { icon: next.icon, extraIcons: next.extraIcons });
  if (picked.has('color')) out.color = next.color;

  const before = new Map(recipe.ingredients.map((l) => [key(l), l]));
  const after = new Set(next.ingredients.map(key));
  const lines: IngredientLine[] = [];
  for (const line of next.ingredients) {
    const old = before.get(key(line));
    const take = picked.has(`ingredient:${key(line)}`);
    if (old) lines.push(take ? { ...line, id: old.id } : old);
    else if (take) lines.push(line);
  }
  // Lines the batch no longer has, kept because their removal wasn't picked.
  recipe.ingredients.forEach((line, i) => {
    if (after.has(key(line)) || picked.has(`ingredient:${key(line)}`)) return;
    const prev = recipe.ingredients.slice(0, i).reverse().find((l) => lines.includes(l) || lines.some((x) => key(x) === key(l)));
    const at = prev ? lines.findIndex((x) => key(x) === key(prev)) + 1 : 0;
    lines.splice(at, 0, line);
  });
  out.ingredients = lines;
  return out;
}

/** The other batches started from this recipe, which an update would leave on the older version. */
export function otherBatchesFrom(recipeId: string, batches: Batch[], exceptBatchId: string): Batch[] {
  return batches.filter((b) => b.recipeId === recipeId && b.id !== exceptBatchId && !b.deletedAt);
}
