// Ingredient library rules that don't depend on the screen.

import type { IngredientCategory, IngredientLine, LibraryIngredient } from '../db/types.ts';

/** The category an ingredient shows under: its own, or Other when that category is gone. */
export function categoryOf(item: LibraryIngredient, categories: IngredientCategory[]): IngredientCategory {
  return categories.find((c) => c.id === item.category) ?? categories.find((c) => c.id === 'other') ?? { id: 'other', label: 'Other' };
}

/** Library ingredients matching a search and category, sorted by name. */
export function filterIngredients(all: LibraryIngredient[], search: string, category: string | null, categories: IngredientCategory[]): LibraryIngredient[] {
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return all
    .filter((i) => category == null || categoryOf(i, categories).id === category)
    .filter((i) => words.every((w) => i.name.toLowerCase().includes(w)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Whether a recipe or batch line is this library ingredient: linked to it, or (older lines) the same name. */
export function lineIsIngredient(line: IngredientLine, item: LibraryIngredient): boolean {
  return line.ingredientId ? line.ingredientId === item.id : line.name.trim().toLowerCase() === item.name.trim().toLowerCase();
}

/** Categories A to Z by name, with Other kept last. */
export function sortCategories(list: IngredientCategory[]): IngredientCategory[] {
  const other = list.filter((c) => c.id === 'other');
  return [...list.filter((c) => c.id !== 'other').sort((a, b) => a.label.trim().localeCompare(b.label.trim(), undefined, { sensitivity: 'base' })), ...other];
}

/** The list with the item at `from` moved to `to` (both clamped to the list). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const last = list.length - 1;
  const a = Math.max(0, Math.min(last, from));
  const b = Math.max(0, Math.min(last, to));
  if (a === b) return list;
  const next = list.slice();
  const [item] = next.splice(a, 1);
  next.splice(b, 0, item);
  return next;
}
