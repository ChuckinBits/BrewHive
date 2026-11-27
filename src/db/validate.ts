// Checks what a backup holds before it goes into the database. A backup is a file anyone can
// edit, so each record is checked for the fields the app reads: a record that can't be used is
// skipped, and loose ends (a missing note, a number saved as text) are tidied up, rather than
// letting one bad record break a page.

import { BATCH_STATUSES, BEVERAGE_TYPES, EVENT_TYPES, INGREDIENT_STAGES, POUR_TYPES, VESSEL_TYPES, type Settings } from './types.ts';
import type { StoreName } from './idb.ts';

type Rec = Record<string, unknown>;

const isObject = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Required text: present and a string. */
const hasText = (r: Rec, key: string) => isText(r[key]);
/** Optional text: a string, or '' when missing or not text. */
const text = (r: Rec, key: string) => {
  if (!isText(r[key])) r[key] = '';
};
/** Optional number: a finite number, or null. */
const numberOrNull = (r: Rec, key: string) => {
  if (key in r && !isNumber(r[key]) && r[key] !== null) r[key] = null;
};
const oneOf = (v: unknown, ids: readonly string[]) => isText(v) && ids.includes(v);

const STATUS_IDS = BATCH_STATUSES.map((s) => s.id);
const EVENT_IDS: string[] = [...EVENT_TYPES.map((t) => t.id), 'status'];
const BEVERAGE_IDS = BEVERAGE_TYPES.map((t) => t.id);
const STAGE_IDS = INGREDIENT_STAGES.map((s) => s.id);
const POUR_IDS = POUR_TYPES.map((t) => t.id);
const VESSEL_IDS = VESSEL_TYPES.map((t) => t.id);
/** Optional list of vessels with amounts: entries without a text id are dropped, amounts are numbers or null. */
const fills = (r: Rec, key: string) => {
  if (!(key in r)) return;
  if (!Array.isArray(r[key])) return void delete r[key];
  r[key] = (r[key] as unknown[]).flatMap((f) => {
    if (!f || typeof f !== 'object' || !isText((f as Rec).vesselId)) return [];
    const v = (f as Rec).volumeL;
    return [{ vesselId: (f as Rec).vesselId, volumeL: isNumber(v) && v > 0 ? v : null }];
  });
};
/** Optional id: text, or null. */
const idOrNull = (r: Rec, key: string) => {
  if (key in r && !isText(r[key])) r[key] = null;
};

/** A recipe's or batch's ingredient lines: those with an id and a name. */
function cleanLines(value: unknown): Rec[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isObject).filter((line) => isText(line.id) && isText(line.name)).map((line) => {
    const out = { ...line };
    text(out, 'amount');
    if ('stage' in out && !oneOf(out.stage, STAGE_IDS)) delete out.stage;
    return out;
  });
}

/** What each store's records need, after the id and timestamps. False skips the record. */
const CHECKS: Record<string, (r: Rec) => boolean> = {
  recipes: (r) => {
    if (!hasText(r, 'name')) return false;
    if (!oneOf(r.beverageType, BEVERAGE_IDS)) r.beverageType = 'mead';
    text(r, 'style');
    r.ingredients = cleanLines(r.ingredients);
    r.steps = Array.isArray(r.steps) ? r.steps.filter(isText) : [];
    for (const key of ['batchSizeL', 'targetOG', 'targetFG', 'targetAbv']) numberOrNull(r, key);
    return true;
  },
  batches: (r) => {
    if (!hasText(r, 'name') || !hasText(r, 'startDate') || !oneOf(r.status, STATUS_IDS)) return false;
    if (!oneOf(r.beverageType, BEVERAGE_IDS)) r.beverageType = 'mead';
    text(r, 'style');
    text(r, 'notes');
    r.ingredients = cleanLines(r.ingredients);
    if (!isText(r.recipeId)) r.recipeId = null;
    for (const key of ['volumeL', 'og', 'targetFG', 'targetAbv', 'rating']) numberOrNull(r, key);
    if (!('rating' in r)) r.rating = null;
    idOrNull(r, 'vesselId');
    fills(r, 'vessels');
    idOrNull(r, 'parentId');
    idOrNull(r, 'splitAt');
    if ('statusBeforeSplit' in r && !oneOf(r.statusBeforeSplit, STATUS_IDS)) r.statusBeforeSplit = null;
    return true;
  },
  events: (r) => {
    if (!hasText(r, 'batchId') || !hasText(r, 'date') || !oneOf(r.type, EVENT_IDS)) return false;
    if (!isNumber(r.value)) r.value = null;
    text(r, 'note');
    for (const key of ['toStatus', 'fromStatus']) if (key in r && !oneOf(r[key], STATUS_IDS)) delete r[key];
    idOrNull(r, 'vesselId');
    idOrNull(r, 'fromVesselId');
    fills(r, 'vessels');
    fills(r, 'fromVessels');
    numberOrNull(r, 'fromVolumeL');
    return true;
  },
  cellar: (r) => {
    if (!hasText(r, 'name') || !hasText(r, 'bottledDate') || !isNumber(r.count) || !isNumber(r.bottleSizeMl)) return false;
    if (!isText(r.batchId)) r.batchId = null;
    text(r, 'style');
    text(r, 'location');
    numberOrNull(r, 'abv');
    if (!isText(r.bestAfter)) r.bestAfter = null;
    return true;
  },
  pours: (r) => {
    if (!hasText(r, 'cellarEntryId') || !hasText(r, 'date') || !isNumber(r.count)) return false;
    if (!oneOf(r.type, POUR_IDS)) r.type = 'drank';
    text(r, 'note');
    numberOrNull(r, 'rating');
    if (!('rating' in r)) r.rating = null;
    return true;
  },
  ingredients: (r) => {
    if (!hasText(r, 'name')) return false;
    if (!isText(r.category)) r.category = 'other';
    text(r, 'defaultUnit');
    text(r, 'notes');
    if ('cost' in r && r.cost !== null) {
      const c = r.cost;
      if (!isObject(c) || !isNumber(c.price) || !isNumber(c.quantity) || !isText(c.unit)) r.cost = null;
    }
    return true;
  },
  equipment: (r) => {
    if (!hasText(r, 'name')) return false;
    if (r.kind !== 'vessel' && r.kind !== 'gear') r.kind = 'gear';
    text(r, 'notes');
    // v0.3.2 renamed Jug to Jar.
    if (r.vesselType === 'jug') r.vesselType = 'jar';
    if (r.kind === 'vessel' && !oneOf(r.vesselType, VESSEL_IDS)) r.vesselType = 'other';
    numberOrNull(r, 'capacityL');
    if (isNumber(r.capacityL) && r.capacityL <= 0) r.capacityL = null;
    if ('capacityUnit' in r && r.capacityUnit !== 'gal' && r.capacityUnit !== 'L') delete r.capacityUnit;
    numberOrNull(r, 'price');
    return true;
  },
};

/**
 * A backup record ready to save, or null when it can't be used: not an object, no id, or missing
 * something its store needs (a batch's name, an entry's batch and date, and so on).
 */
export function cleanRecord(store: StoreName, value: unknown): Rec | null {
  if (!isObject(value) || !isText(value.id) || value.id === '' || value.id.length > 200) return null;
  const r: Rec = { ...value };
  if (!isText(r.updatedAt)) r.updatedAt = '';
  if (!isText(r.createdAt)) r.createdAt = r.updatedAt;
  if ('deletedAt' in r && !isText(r.deletedAt) && r.deletedAt !== null) r.deletedAt = null;
  const check = CHECKS[store];
  return !check || check(r) ? r : null;
}

/**
 * A backup's settings laid over the ones on this device, keeping only fields that make sense:
 * anything missing or malformed stays as it is here.
 */
export function cleanSettings(incoming: unknown, current: Settings): Settings {
  const out: Settings = { ...current };
  if (!isObject(incoming)) return out;
  if (incoming.units === 'us' || incoming.units === 'metric') out.units = incoming.units;
  if (incoming.tempUnit === 'F' || incoming.tempUnit === 'C') out.tempUnit = incoming.tempUnit;
  if (incoming.theme === 'system' || incoming.theme === 'light' || incoming.theme === 'dark') out.theme = incoming.theme;
  const textMap = (v: unknown) => isObject(v) && Object.values(v).every(isText);
  if (textMap(incoming.views)) out.views = incoming.views as Settings['views'];
  if (textMap(incoming.sorts)) out.sorts = incoming.sorts as Settings['sorts'];
  if (Array.isArray(incoming.ingredientCategories)) {
    const categories = incoming.ingredientCategories.filter(isObject).filter((c) => isText(c.id) && isText(c.label));
    if (categories.length > 0) {
      out.ingredientCategories = categories.map((c) => ({ id: c.id as string, label: c.label as string, ...(isText(c.icon) ? { icon: c.icon } : {}) }));
    }
  }
  if (isText(incoming.currency) && /^[A-Z]{3}$/.test(incoming.currency)) out.currency = incoming.currency;
  if (typeof incoming.hideIngredientAdd === 'boolean') out.hideIngredientAdd = incoming.hideIngredientAdd;
  if (oneOf(incoming.vesselSort, ['type', 'size', 'name', 'free'])) out.vesselSort = incoming.vesselSort as Settings['vesselSort'];
  return out;
}

/**
 * Whether a backup's copy of a record should replace this device's. The one edited most recently
 * wins, except that a starter ingredient nobody has touched here (created and never edited, as a
 * fresh install or Erase everything leaves them) always gives way: it was made just now, so it
 * would otherwise look newer than the backup and undo the prices, units and deletions it carries.
 */
export function backupWins(incoming: StampedRecord, mine: StampedRecord | undefined): boolean {
  if (!mine) return true;
  const untouchedStarter = mine.id.startsWith('starter-') && mine.createdAt !== undefined && mine.createdAt === mine.updatedAt;
  return untouchedStarter || (incoming.updatedAt ?? '') >= (mine.updatedAt ?? '');
}

/** What backupWins needs of a record. */
interface StampedRecord {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}
