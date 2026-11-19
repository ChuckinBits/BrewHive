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
