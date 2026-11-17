// The BrewHive data model. Everything is stored on the device in IndexedDB.
//
// Conventions:
// - Every record has a UUID, createdAt, updatedAt and a deletedAt soft-delete
//   flag, so a future sync server can merge changes between devices.
// - Units are stored in metric (liters, milliliters, °C) and specific gravity.
//   The screens convert to the units chosen in Settings.

export type BeverageType = 'mead' | 'cider' | 'wine' | 'beer' | 'kombucha' | 'other';

export const BEVERAGE_TYPES: { id: BeverageType; label: string }[] = [
  { id: 'mead', label: 'Mead' },
  { id: 'cider', label: 'Cider' },
  { id: 'wine', label: 'Wine' },
  { id: 'beer', label: 'Beer' },
  { id: 'kombucha', label: 'Kombucha' },
  { id: 'other', label: 'Other' },
];

export const MEAD_STYLES = [
  'Traditional',
  'Melomel',
  'Cyser',
  'Pyment',
  'Metheglin',
  'Bochet',
  'Braggot',
  'Acerglyn',
  'Capsicumel',
  'Rhodomel',
  'Hydromel',
  'Sack mead',
];

export type BatchStatus = 'planned' | 'primary' | 'secondary' | 'aging' | 'bottled' | 'archived';

export const BATCH_STATUSES: { id: BatchStatus; label: string }[] = [
  { id: 'planned', label: 'Planned' },
  { id: 'primary', label: 'Primary' },
  { id: 'secondary', label: 'Secondary' },
  { id: 'aging', label: 'Aging' },
  { id: 'bottled', label: 'Bottled' },
  { id: 'archived', label: 'Archived' },
];

export type EventType =
  | 'pitch'
  | 'gravity'
  | 'temperature'
  | 'ph'
  | 'nutrient'
  | 'feeding'
  | 'rack'
  | 'stabilize'
  | 'backsweeten'
  | 'fining'
  | 'tasting'
  | 'status'
  | 'note';

/** Event types the user can add by hand, in the order the add sheet shows them. */
export const EVENT_TYPES: { id: EventType; label: string; value?: 'sg' | 'temp' | 'ph' }[] = [
  { id: 'gravity', label: 'Gravity reading', value: 'sg' },
  { id: 'note', label: 'Note' },
  { id: 'nutrient', label: 'Nutrients' },
  { id: 'tasting', label: 'Tasting' },
  { id: 'rack', label: 'Racked' },
  { id: 'temperature', label: 'Temperature', value: 'temp' },
  { id: 'ph', label: 'pH', value: 'ph' },
  { id: 'feeding', label: 'Step feeding' },
  { id: 'stabilize', label: 'Stabilized' },
  { id: 'backsweeten', label: 'Backsweetened' },
  { id: 'fining', label: 'Fining' },
  { id: 'pitch', label: 'Yeast pitched' },
];

export function eventLabel(type: EventType): string {
  if (type === 'status') return 'Status';
  return EVENT_TYPES.find((t) => t.id === type)?.label ?? 'Note';
}

export interface Base {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface IngredientLine {
  id: string;
  name: string;
  /** Free text for now, such as "3 lb" or "1 packet". Linked inventory arrives in v0.2. */
  amount: string;
}

export interface Recipe extends Base {
  name: string;
  beverageType: BeverageType;
  style: string;
  batchSizeL: number | null;
  targetOG: number | null;
  targetFG: number | null;
  ingredients: IngredientLine[];
  steps: string[];
  /** Flavor icon id, see src/icons/flavors.ts. */
  icon: string;
  /** Liquid color, a hex string. */
  color: string;
  /** 0 to 10, or null when not rated. */
  rating: number | null;
  notes: string;
  /** Reserved for the Nostr community in v0.5. */
  isPublished: boolean;
}

export interface Batch extends Base {
  name: string;
  recipeId: string | null;
  beverageType: BeverageType;
  style: string;
  status: BatchStatus;
  /** yyyy-mm-dd */
  startDate: string;
  volumeL: number | null;
  og: number | null;
  /** Final gravity. Left null until the user sets it; the latest reading is used meanwhile. */
  fg: number | null;
  ingredients: IngredientLine[];
  icon: string;
  color: string;
  rating: number | null;
  notes: string;
}

export interface BatchEvent extends Base {
  batchId: string;
  type: EventType;
  /** Local date-time, yyyy-mm-ddThh:mm */
  date: string;
  /** SG for gravity, °C for temperature, pH for ph. */
  value: number | null;
  note: string;
}

export interface CellarEntry extends Base {
  batchId: string | null;
  name: string;
  style: string;
  bottleSizeMl: number;
  /** Bottles left. */
  count: number;
  /** yyyy-mm-dd */
  bottledDate: string;
  /** yyyy-mm-dd, or null */
  bestAfter: string | null;
  location: string;
  abv: number | null;
  icon: string;
  color: string;
  rating: number | null;
  notes: string;
}

export type PourType = 'drank' | 'gifted' | 'competition';

export const POUR_TYPES: { id: PourType; label: string }[] = [
  { id: 'drank', label: 'Drank' },
  { id: 'gifted', label: 'Gifted' },
  { id: 'competition', label: 'Competition' },
];

export interface Pour extends Base {
  cellarEntryId: string;
  /** yyyy-mm-dd */
  date: string;
  count: number;
  type: PourType;
  note: string;
  rating: number | null;
}

export type ViewMode = 'list' | 'shelf';

export interface Settings {
  id: 'app';
  volumeUnit: 'gal' | 'L';
  tempUnit: 'F' | 'C';
  theme: 'system' | 'light' | 'dark';
  /** Remembered List / Shelf choice per screen. */
  views: Record<string, ViewMode>;
  /** Remembered sort choice per screen. */
  sorts: Record<string, string>;
  /** Set once a hosted preview has loaded its sample data. Unused in the real app. */
  demoSeeded?: boolean;
}
