// The app's data API. Screens read with the use* hooks and write with the
// save / remove functions; nothing else touches IndexedDB directly.

import { useEffect, useState } from 'react';
import { getAll, getOne, putMany, subscribe, type StoreName } from './idb.ts';
import type { Base, Batch, BatchEvent, CellarEntry, Pour, Recipe, Settings, ViewMode } from './types.ts';
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

// --- Settings ---------------------------------------------------------------

function usesImperial(): boolean {
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  return /-(US|LR|MM)$/i.test(locale);
}

export function defaultSettings(): Settings {
  const imperial = usesImperial();
  return {
    id: 'app',
    volumeUnit: imperial ? 'gal' : 'L',
    tempUnit: imperial ? 'F' : 'C',
    theme: 'system',
    views: {},
    sorts: {},
  };
}

let cachedSettings: Settings | null = null;

export async function loadSettings(): Promise<Settings> {
  const saved = await getOne<Settings>('settings', 'app');
  cachedSettings = { ...defaultSettings(), ...saved };
  return cachedSettings;
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const current = await loadSettings();
  const next: Settings = { ...current, ...patch, id: 'app' };
  await putMany('settings', [next]);
  rememberTheme(next.theme);
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
