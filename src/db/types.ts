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

/** Common mead styles, each with a one-line explanation shown in the style picker. */
export const MEAD_STYLES: { name: string; about: string }[] = [
  { name: 'Traditional', about: 'Just honey, water and yeast. The honey itself is the star.' },
  { name: 'Melomel', about: 'Mead made with fruit, such as berries, cherries or peaches.' },
  { name: 'Cyser', about: 'Mead made with apples or apple juice. Part mead, part cider.' },
  { name: 'Pyment', about: 'Mead made with grapes or grape juice. Part mead, part wine.' },
  { name: 'Metheglin', about: 'Mead made with spices or herbs, such as cinnamon, vanilla or ginger.' },
  { name: 'Bochet', about: 'Mead made from honey that is caramelized first, for toffee and toasted flavors.' },
  { name: 'Braggot', about: 'Mead made with malted grain. Part mead, part beer, often with hops.' },
  { name: 'Acerglyn', about: 'Mead made with maple syrup.' },
  { name: 'Capsicumel', about: 'Mead made with chili peppers, from mild warmth to real heat.' },
  { name: 'Rhodomel', about: 'Mead made with roses or rose petals.' },
  { name: 'Hydromel', about: 'A light, lower-alcohol mead, often called a session mead.' },
  { name: 'Sack mead', about: 'A strong, rich mead made with extra honey. Usually sweet.' },
];

export function styleAbout(style: string): string | undefined {
  const wanted = style.trim().toLowerCase();
  return MEAD_STYLES.find((s) => s.name.toLowerCase() === wanted)?.about;
}

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
  | 'moved'
  | 'ingredient'
  | 'review'
  | 'note';

type EntryField = 'sg' | 'sg-after' | 'temp' | 'ph' | 'place' | 'ingredient' | 'method' | 'rating';

/** Event types the user can add by hand: Gravity reading first, as the most common, then A to Z. */
export const EVENT_TYPES: { id: EventType; label: string; value?: EntryField }[] = [
  { id: 'gravity', label: 'Gravity reading', value: 'sg' },
  ...(
    [
      { id: 'backsweeten', label: 'Backsweetened', value: 'sg-after' },
      { id: 'fining', label: 'Fining' },
      { id: 'ingredient', label: 'Ingredient', value: 'ingredient' },
      { id: 'moved', label: 'Moved to', value: 'place' },
      { id: 'note', label: 'Note' },
      { id: 'nutrient', label: 'Nutrients' },
      { id: 'ph', label: 'pH', value: 'ph' },
      { id: 'rack', label: 'Racked' },
      { id: 'stabilize', label: 'Stabilized', value: 'method' },
      { id: 'feeding', label: 'Step feeding', value: 'sg-after' },
      { id: 'tasting', label: 'Tasting', value: 'rating' },
      { id: 'temperature', label: 'Temperature', value: 'temp' },
      { id: 'pitch', label: 'Yeast pitched' },
    ] as { id: EventType; label: string; value?: EntryField }[]
  ).sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })),
];

/** How a batch was stabilized, chosen on a "Stabilized" entry. */
export const STABILIZE_METHODS = ['Chemical', 'Pasteurization', 'Filtration', 'Nagardo', 'Other'];

export function eventLabel(type: EventType): string {
  if (type === 'status') return 'Stage change';
  if (type === 'review') return 'Batch rating';
  return EVENT_TYPES.find((t) => t.id === type)?.label ?? 'Note';
}

export function statusLabel(status: BatchStatus): string {
  return BATCH_STATUSES.find((s) => s.id === status)?.label ?? status;
}

/** The heading a timeline entry shows, such as "Moved to Secondary" or "Moved to Basement". */
export function eventTitle(event: BatchEvent): string {
  if (event.type === 'status') {
    if (event.toStatus === 'bottled') return 'Bottled';
    if (event.toStatus) return `Moved to ${statusLabel(event.toStatus)}`;
    // Entries made before stages were stored keep their wording in the note.
    return event.note || 'Stage change';
  }
  if (event.type === 'moved') return event.place ? `Moved to ${event.place}` : 'Moved';
  if (event.type === 'ingredient') return event.ingredient ? `Added ${event.ingredient}` : 'Ingredient';
  if (event.type === 'tasting') return event.taster ? `Tasting by ${event.taster}` : 'Tasting';
  if (event.type === 'review') return 'Batch rating';
  return eventLabel(event.type);
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
  /**
   * True once fermentation is finished. Until then the batch shows a potential
   * (or target) ABV. Missing on batches saved by v0.1: see isFermentationComplete.
   */
  fermentationComplete?: boolean;
  /**
   * When fermentation was marked complete (or the final gravity last changed),
   * as an exact ISO moment. Places the final gravity on the timeline, so sugar
   * added afterwards by backsweetening is counted after it.
   */
  completedAt?: string | null;
  /** Final gravity, once fermentation is complete. The latest reading is used if it is left empty. */
  fg: number | null;
  /** The gravity fermentation is expected to finish at. Missing means 1.000. */
  targetFG?: number | null;
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
  /** For "status" entries: the stage the batch moved to. */
  toStatus?: BatchStatus;
  /** For "status" entries: the stage it was in before. */
  fromStatus?: BatchStatus;
  /**
   * For "status" entries made by tapping a stage button, and "review" entries
   * made by setting the batch rating. Changing it again the same day replaces
   * an automatic entry instead of adding a second one. Editing the entry by
   * hand turns this off, so the entry is kept.
   */
  auto?: boolean;
  /** For "moved" entries: where the batch went, such as "Basement". */
  place?: string;
  /**
   * For backsweetening: true when the added sugar is expected to ferment, so it
   * raises the potential ABV. Off unless ticked. Step feeding always ferments.
   */
  ferments?: boolean;
  /** For "ingredient" entries: what was added, and how much. */
  ingredient?: string;
  amount?: string;
  /** For "stabilize" entries: how it was stabilized, one of STABILIZE_METHODS. */
  method?: string;
  /** For "tasting" and "review" entries: a 0 to 10 rating, or null. */
  rating?: number | null;
  /** For "tasting" entries: who tasted it, if not the user. Optional. */
  taster?: string;
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
