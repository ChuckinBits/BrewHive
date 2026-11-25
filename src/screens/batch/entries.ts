// What the timeline shows for an entry: its icon, short value and order, shared by the batch page and its sheets.

import { type BatchEvent, type EventType, type LibraryIngredient, type Settings } from '../../db/types.ts';
import { type IconName } from '../../icons/Icon.tsx';
import { fmtPercent, fmtSG, fmtTempBoth } from '../../lib/format.ts';

export const EVENT_ICONS: Record<EventType, IconName> = {
  gravity: 'droplet',
  temperature: 'thermometer',
  ph: 'flask',
  nutrient: 'nutrient',
  feeding: 'honey',
  rack: 'rack',
  stabilize: 'check',
  backsweeten: 'honey',
  fining: 'sparkle',
  tasting: 'glass',
  pitch: 'yeast',
  estimate: 'flask',
  status: 'flag',
  moved: 'pin',
  ingredient: 'plus',
  review: 'star',
  note: 'note',
};

/** The short value shown after an entry's title, such as "1.045", "3.60" or "1 oz". */
export function eventValue(event: BatchEvent, settings: Settings): string {
  if (event.type === 'ingredient') return event.amount ?? '';
  if (event.type === 'stabilize') {
    // Pasteurization: "Pasteurization · 160 °F for 15 min".
    const held = [event.value != null ? fmtTempBoth(event.value, event.tempUnit, settings.tempUnit) : '', event.minutes != null ? `${event.minutes} min` : ''].filter(Boolean).join(' for ');
    return [event.method ?? '', held].filter(Boolean).join(' · ');
  }
  if (event.value == null) return '';
  if (event.type === 'gravity') return fmtSG(event.value);
  if (event.type === 'feeding' || event.type === 'backsweeten') return `→ ${fmtSG(event.value)}`;
  if (event.type === 'temperature') return fmtTempBoth(event.value, event.tempUnit, settings.tempUnit);
  // The title already says pH, so only the number.
  if (event.type === 'ph') return event.value.toFixed(2);
  if (event.type === 'estimate') return `≈ ${fmtPercent(event.value)}`;
  return String(event.value);
}

/** Newest first; entries logged at the same minute keep the order they were added in. */
export const newestFirst = (a: BatchEvent, b: BatchEvent) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

/** An ingredient entry's category, from your ingredients: by its link, or by name. */
export function entryCategory(event: BatchEvent, library: LibraryIngredient[]): string | undefined {
  if (event.type !== 'ingredient') return undefined;
  const name = event.ingredient?.trim().toLowerCase();
  const item = (event.ingredientId && library.find((i) => i.id === event.ingredientId)) || (name ? library.find((i) => i.name.trim().toLowerCase() === name) : undefined);
  return item?.category;
}

/** A Bottled stage entry on the timeline. */
export const isBottledEntry = (e: BatchEvent) => e.type === 'status' && e.toStatus === 'bottled';
