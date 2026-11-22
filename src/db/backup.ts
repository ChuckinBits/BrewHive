// JSON backup and restore. A backup is one human-readable file holding
// everything in the database, so nobody is ever locked in to BrewHive.

import { getAll, putMany, type StoreName } from './idb.ts';
import { ensureOgEntries, rememberTheme } from './store.ts';
import type { Settings } from './types.ts';

const DATA_STORES: StoreName[] = ['recipes', 'batches', 'events', 'cellar', 'pours', 'ingredients'];

export interface BackupFile {
  app: 'brewhive';
  formatVersion: 1;
  exportedAt: string;
  data: Record<string, unknown[]>;
}

export async function createBackup(): Promise<BackupFile> {
  const data: Record<string, unknown[]> = {};
  for (const store of [...DATA_STORES, 'settings' as StoreName]) {
    data[store] = await getAll(store);
  }
  return { app: 'brewhive', formatVersion: 1, exportedAt: new Date().toISOString(), data };
}

export function downloadBackup(backup: BackupFile): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `brewhive-backup-${backup.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface Stamped {
  id: string;
  updatedAt?: string;
}

function isStamped(value: unknown): value is Stamped {
  return typeof value === 'object' && value !== null && typeof (value as Stamped).id === 'string';
}

/**
 * Merges a backup into the database. Records are matched by id; when both
 * sides have the same record, the one edited most recently wins. Nothing that
 * is only on this device is removed. Returns how many records were written.
 */
export async function restoreBackup(input: unknown): Promise<number> {
  if (typeof input !== 'object' || input === null) throw new Error('That file is not a BrewHive backup.');
  const file = input as Partial<BackupFile>;
  if (file.app !== 'brewhive' || typeof file.data !== 'object' || file.data === null) {
    throw new Error('That file is not a BrewHive backup.');
  }
  if (file.formatVersion !== 1) {
    throw new Error('That backup was made by a newer version of BrewHive. Update the app, then try again.');
  }

  let written = 0;
  for (const store of DATA_STORES) {
    const incoming = file.data[store];
    if (!Array.isArray(incoming)) continue;
    const existing = new Map((await getAll<Stamped>(store)).map((r) => [r.id, r]));
    const winners = incoming.filter(isStamped).filter((record) => {
      const mine = existing.get(record.id);
      return !mine || (record.updatedAt ?? '') >= (mine.updatedAt ?? '');
    });
    await putMany(store, winners);
    written += winners.length;
  }

  const settings = file.data.settings;
  if (Array.isArray(settings)) {
    const app = settings.find((s) => isStamped(s) && s.id === 'app') as Settings | undefined;
    if (app) {
      await putMany('settings', [app]);
      rememberTheme(app.theme);
    }
  }
  // A backup from before the OG had a timeline entry gets them.
  await ensureOgEntries();
  return written;
}
