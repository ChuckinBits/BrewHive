// The app's data API. Screens read with the use* hooks and write with the
// save / remove functions; nothing else touches IndexedDB directly.

import { useEffect, useState } from 'react';
import { getAll, getOne, putMany, subscribe, type StoreName } from './idb.ts';
import { DEFAULT_CATEGORIES, type Base, type Batch, type BatchEvent, type CellarEntry, type Equipment, type IngredientCategory, type LibraryIngredient, type Pour, type Recipe, type Settings, type ViewMode } from './types.ts';
import { starterIngredients } from './starterIngredients.ts';
import { upgradeSettings } from '../lib/units.ts';
import { localeCurrency } from '../lib/cost.ts';
import { newId } from '../lib/format.ts';

function collection<T extends Base>(store: StoreName) {
  return {
    /** Every record that has not been deleted. */
    async list(): Promise<T[]> {
      return (await getAll<T>(store)).filter((r) => !r.deletedAt);
    },
    async get(id: string): Promise<T | undefined> {
      const record = await getOne<T>(store, id);
      return record && !record.deletedAt ? record : undefined;
    },
    /** Creates the record, or updates it when `id` is given. Returns the saved record. */
    async save(data: Omit<T, keyof Base> & Partial<Base>): Promise<T> {
      const now = new Date().toISOString();
      const record = {
        ...data,
        id: data.id ?? newId(),
        createdAt: data.createdAt ?? now,
        updatedAt: now,
        deletedAt: null,
      } as unknown as T;
      await putMany(store, [record]);
      return record;
    },
    /** Soft delete: the record stays in the database, flagged, so sync can pass the deletion on. */
    async remove(id: string): Promise<void> {
      const record = await getOne<T>(store, id);
      if (!record) return;
      const now = new Date().toISOString();
      await putMany(store, [{ ...record, deletedAt: now, updatedAt: now }]);
    },
  };
}

export const recipes = collection<Recipe>('recipes');
export const batches = collection<Batch>('batches');
export const events = collection<BatchEvent>('events');
export const cellar = collection<CellarEntry>('cellar');
export const pours = collection<Pour>('pours');
export const ingredients = collection<LibraryIngredient>('ingredients');
export const equipment = collection<Equipment>('equipment');

/** The currency for costs: the chosen one, or the locale's. */
export function currencyOf(settings: Settings): string {
  return settings.currency ?? localeCurrency(typeof navigator !== 'undefined' ? navigator.language : 'en-US');
}

/** The ingredient categories, in order. */
export function categoriesOf(settings: Settings): IngredientCategory[] {
  return settings.ingredientCategories?.length ? settings.ingredientCategories : DEFAULT_CATEGORIES;
}

// --- The OG on the timeline

/** The OG entry's date for a start date: the start of that day, so it comes first on the timeline. */
const ogDate = (startDate: string) => `${startDate}T00:00`;

/**
 * Keeps a batch's OG entry in step with its OG after the batch is saved: created when there is an
 * OG, its value following the OG, removed when the OG is cleared. When the start date changes, an
 * entry still on the old start date moves with it; one moved to another day stays put.
 */
export async function syncOgEntry(batch: Batch, previousStartDate?: string): Promise<void> {
  const entry = (await getAll<BatchEvent>('events')).find((e) => e.batchId === batch.id && e.og && !e.deletedAt);
  if (batch.og == null) {
    if (entry) await events.remove(entry.id);
    return;
  }
  if (!entry) {
    await events.save({ batchId: batch.id, type: 'gravity', date: ogDate(batch.startDate), value: batch.og, note: '', og: true });
    return;
  }
  const date = previousStartDate && previousStartDate !== batch.startDate && entry.date.startsWith(previousStartDate) ? batch.startDate + entry.date.slice(previousStartDate.length) : entry.date;
  if (entry.value !== batch.og || date !== entry.date) await events.save({ ...entry, value: batch.og, date });
}

/** Batches with an OG but no OG entry (from before there were any) get one on their start date. */
/** v0.3.2 renamed the Jug vessel type to Jar: vessels saved as jugs become jars. Names stay as typed. */
export async function renameJugsToJars(): Promise<void> {
  const jugs = (await getAll<Equipment>('equipment')).filter((e) => (e.vesselType as string) === 'jug');
  if (jugs.length) await putMany('equipment', jugs.map((e) => ({ ...e, vesselType: 'jar' as const })));
}

export async function ensureOgEntries(): Promise<void> {
  const all = await getAll<BatchEvent>('events');
  const has = new Set(all.filter((e) => e.og && !e.deletedAt).map((e) => e.batchId));
  // A sub-batch reads its OG from the batch it was split from, so it never gets its own.
  const missing = (await getAll<Batch>('batches')).filter((b) => !b.deletedAt && b.og != null && !has.has(b.id) && !b.parentId);
  await putMany(
    'events',
    missing.map((b) => fresh({ id: newId(), batchId: b.id, type: 'gravity' as const, date: ogDate(b.startDate), value: b.og, note: '', og: true })),
  );
}

/** Starters to add: not already on the device (by id), and not named like an ingredient in the list. */
function startersToAdd(all: LibraryIngredient[], imperial: boolean, skip: (item: LibraryIngredient) => boolean) {
  const names = new Set(all.filter((i) => !i.deletedAt).map((i) => i.name.trim().toLowerCase()));
  const ids = new Set(all.filter(skip).map((i) => i.id));
  return starterIngredients(imperial).filter((i) => !ids.has(i.id) && !names.has(i.name.toLowerCase()));
}

/**
 * Adds the starter ingredients the device has never had. They have fixed ids, so one you deleted
 * stays deleted (its record is still there, flagged) and restoring a backup never duplicates them.
 * One whose name is already in the list (one you made, say) isn't added. A starter you never
 * edited follows the starter list: its category, its note, and its default unit in the units chosen
 * under More (lb or kg, oz or g, gal or L, fl oz or mL). Called at start and when the units change.
 */
export async function ensureStarterIngredients(): Promise<void> {
  const all = await getAll<LibraryIngredient>('ingredients');
  const imperial = await usesImperialUnits();
  const starters = new Map(starterIngredients(imperial).map((i) => [i.id, i]));
  // Never edited: it keeps up with the starter list.
  const followed = all.flatMap((i) => {
    const starter = starters.get(i.id);
    if (!starter || i.deletedAt || i.createdAt !== i.updatedAt) return [];
    if (starter.category === i.category && starter.notes === i.notes && starter.defaultUnit === i.defaultUnit) return [];
    // Written as-is otherwise, timestamps included, so it still counts as never edited.
    return [{ ...i, category: starter.category, notes: starter.notes, defaultUnit: starter.defaultUnit }];
  });
  await putMany('ingredients', [...followed, ...startersToAdd(all, imperial, () => true).map(fresh)]);
}

/** Starter units follow the volume unit chosen under More: gallons means US units. */
async function usesImperialUnits(): Promise<boolean> {
  return (await loadSettings()).units === 'us';
}

/** A new record with its timestamps, for writing several in one go. */
function fresh<T extends object>(data: T): T & Base {
  const now = new Date().toISOString();
  return { ...data, createdAt: now, updatedAt: now, deletedAt: null } as T & Base;
}

/**
 * Brings back starter ingredients that were deleted (or never added), and nothing else:
 * ingredients you added, prices, and starters you edited stay as they are. Returns how many came back.
 */
export async function restoreStarterIngredients(): Promise<number> {
  // Only live records count as present, so deleted starters come back.
  const missing = startersToAdd(await getAll<LibraryIngredient>('ingredients'), await usesImperialUnits(), (i) => !i.deletedAt);
  // Saved fresh, so a deleted one comes back as it started, with no price.
  await putMany('ingredients', missing.map(fresh));
  return missing.length;
}

// --- Settings ---------------------------------------------------------------

function usesImperial(): boolean {
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  return /-(US|LR|MM)$/i.test(locale);
}

export function defaultSettings(): Settings {
  const imperial = usesImperial();
  return {
    id: 'app',
    units: imperial ? 'us' : 'metric',
    tempUnit: imperial ? 'F' : 'C',
    theme: 'system',
    views: {},
    sorts: {},
  };
}

let cachedSettings: Settings | null = null;

export async function loadSettings(): Promise<Settings> {
  const saved = await getOne<Settings>('settings', 'app');
  cachedSettings = { ...defaultSettings(), ...(saved ? upgradeSettings(saved) : {}) };
  // Saved by v0.2.0 or earlier (volumeUnit): store it the current way, so backups say units too.
  if (saved && 'volumeUnit' in saved) await putMany('settings', [cachedSettings]);
  return cachedSettings;
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const current = await loadSettings();
  const next: Settings = { ...current, ...patch, id: 'app' };
  await putMany('settings', [next]);
  rememberTheme(next.theme);
  // Switching between US and metric moves untouched starter ingredients to the matching units.
  if (next.units !== current.units) await ensureStarterIngredients();
}

/** Mirrors the theme into localStorage so main.tsx can apply it before the first paint. */
export function rememberTheme(theme: Settings['theme']): void {
  try {
    localStorage.setItem('brewhive-theme', theme);
  } catch {
    // Storage can be unavailable (private windows); the theme then applies a moment later.
  }
}

// --- Live queries -----------------------------------------------------------

/**
 * Runs an async read and re-runs it after every database write, so screens
 * always show current data. Returns undefined until the first read finishes.
 */
export function useQuery<T>(read: () => Promise<T>, deps: unknown[] = []): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  useEffect(() => {
    let active = true;
    const run = () => {
      read().then(
        (next) => {
          if (active) setValue(next);
        },
        (error) => console.error('BrewHive could not read its database', error),
      );
    };
    run();
    const unsubscribe = subscribe(run);
    return () => {
      active = false;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

export function useSettings(): Settings {
  return useQuery(loadSettings) ?? cachedSettings ?? defaultSettings();
}

/** The remembered List / Shelf view and sort order for one screen. */
export function usePrefs(screen: string, defaultSort: string) {
  const settings = useSettings();
  return {
    view: settings.views[screen] ?? ('shelf' as ViewMode),
    sort: settings.sorts[screen] ?? defaultSort,
    setView: (view: ViewMode) => saveSettings({ views: { ...settings.views, [screen]: view } }),
    setSort: (sort: string) => saveSettings({ sorts: { ...settings.sorts, [screen]: sort } }),
  };
}
