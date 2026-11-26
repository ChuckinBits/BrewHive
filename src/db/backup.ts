// JSON backup and restore. A backup is one human-readable file holding
// everything in the database, so nobody is ever locked in to BrewHive.

import { getAll, putMany, type StoreName } from './idb.ts';
import { upgradeSettings } from '../lib/units.ts';
import { today } from '../lib/format.ts';
import { ensureOgEntries, loadSettings, rememberTheme } from './store.ts';
import { backupWins, cleanRecord, cleanSettings } from './validate.ts';

const DATA_STORES: StoreName[] = ['recipes', 'batches', 'events', 'cellar', 'pours', 'ingredients', 'equipment'];

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
  // Named for today where you are (exportedAt is UTC, a day ahead on an American evening).
  link.download = `brewhive-backup-${today()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface Stamped {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RestoreResult {
  /** Records saved. */
  written: number;
  /** Records left out because they couldn't be read (see validate.ts). */
  skipped: number;
}

/**
 * Merges a backup into the database. Records are matched by id; when both
 * sides have the same record, the one edited most recently wins. Nothing that
 * is only on this device is removed. Each record is checked first, and one
 * that can't be used is skipped.
 */
export async function restoreBackup(input: unknown): Promise<RestoreResult> {
  if (typeof input !== 'object' || input === null) throw new Error('That file is not a BrewHive backup.');
  const file = input as Partial<BackupFile>;
  if (file.app !== 'brewhive' || typeof file.data !== 'object' || file.data === null) {
    throw new Error('That file is not a BrewHive backup.');
  }
  if (file.formatVersion !== 1) {
    throw new Error('That backup was made by a newer version of BrewHive. Update the app, then try again.');
  }

  let written = 0;
  let skipped = 0;
  for (const store of DATA_STORES) {
    const incoming = file.data[store];
    if (!Array.isArray(incoming)) continue;
    const records = incoming.map((value) => cleanRecord(store, value));
    const usable = records.filter((record): record is Record<string, unknown> & Stamped => record !== null);
    skipped += records.length - usable.length;
    const existing = new Map((await getAll<Stamped>(store)).map((r) => [r.id, r]));
    const winners = usable.filter((record) => backupWins(record, existing.get(record.id)));
    await putMany(store, winners);
    written += winners.length;
  }

  const settings = file.data.settings;
  if (Array.isArray(settings)) {
    const app = settings.find((s) => typeof s === 'object' && s !== null && (s as Stamped).id === 'app');
    if (app) {
      // Backups from v0.2.0 and earlier have volumeUnit; it becomes units. Fields that don't make
      // sense keep this device's value.
      const next = cleanSettings(upgradeSettings(app as object), await loadSettings());
      await putMany('settings', [next]);
      rememberTheme(next.theme);
    }
  }
  // A backup from before the OG had a timeline entry gets them.
  await ensureOgEntries();
  return { written, skipped };
}
