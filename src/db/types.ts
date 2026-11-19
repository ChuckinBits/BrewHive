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

export const BEER_STYLES: { name: string; about: string }[] = [
  { name: 'Ale', about: 'Top-fermented at warmer temperatures, often fruity and full.' },
  { name: 'Lager', about: 'Fermented cool and conditioned cold, for a clean, crisp beer.' },
  { name: 'IPA', about: 'A strong, heavily hopped pale ale, bitter and aromatic.' },
  { name: 'Pale ale', about: 'A balanced, hop-forward ale made with pale malt.' },
  { name: 'Stout', about: 'A dark, roasty ale, with notes of coffee and chocolate.' },
  { name: 'Porter', about: 'A dark ale, a little lighter and less roasty than a stout.' },
  { name: 'Wheat beer', about: 'Brewed with plenty of wheat, usually hazy and light.' },
  { name: 'Sour', about: 'Deliberately tart, soured with bacteria or wild yeast.' },
  { name: 'Saison', about: 'A dry, spicy, highly carbonated farmhouse ale.' },
  { name: 'Amber/Red ale', about: 'A malty ale with caramel flavors and a reddish color.' },
  { name: 'Brown ale', about: 'A malty, nutty ale, mild on the hops.' },
  { name: 'Pilsner', about: 'A pale, crisp lager with a firm hop bite.' },
];

export const WINE_STYLES: { name: string; about: string }[] = [
  { name: 'Red', about: 'Fermented with the grape skins for color and tannin.' },
  { name: 'White', about: 'Made from pressed juice without the skins.' },
  { name: 'Rosé', about: 'Only brief contact with red grape skins, for a pink wine.' },
  { name: 'Sparkling', about: 'Carbonated, usually by a second fermentation in the bottle.' },
  { name: 'Dessert', about: 'A sweet wine, often strong, served with or as dessert.' },
  { name: 'Fruit wine', about: 'Wine made from fruit other than grapes.' },
  { name: 'Country wine', about: 'Wine made from flowers, vegetables, herbs or grains.' },
];

/** The styles offered for a type: a list, free text ("free"), or no Style field at all ("none"). */
export function stylesFor(type: BeverageType): { name: string; about: string }[] | 'free' | 'none' {
  switch (type) {
    case 'mead':
      return MEAD_STYLES;
    case 'beer':
      return BEER_STYLES;
    case 'wine':
      return WINE_STYLES;
    case 'other':
      return 'free';
    default:
      return 'none';
  }
}

const ALL_LISTED = [...MEAD_STYLES, ...BEER_STYLES, ...WINE_STYLES];

/** After switching type: the style to keep. Styles from another type's list are cleared; custom ones stay. */
export function styleForType(style: string, type: BeverageType): string {
  const styles = stylesFor(type);
  if (styles === 'none') return '';
  if (styles === 'free') return style;
  const wanted = style.trim().toLowerCase();
  if (styles.some((s) => s.name.toLowerCase() === wanted)) return style;
  return ALL_LISTED.some((s) => s.name.toLowerCase() === wanted) ? '' : style;
}

export function styleAbout(style: string, type: BeverageType = 'mead'): string | undefined {
  const wanted = style.trim().toLowerCase();
  const styles = stylesFor(type);
  return (Array.isArray(styles) ? styles : MEAD_STYLES).find((s) => s.name.toLowerCase() === wanted)?.about;
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
  | 'estimate'
  | 'note';

type EntryField = 'sg' | 'sg-after' | 'temp' | 'ph' | 'abv' | 'place' | 'ingredient' | 'method' | 'rating';

/** Event types the user can add by hand: Gravity reading first, as the most common, then A to Z. */
export const EVENT_TYPES: { id: EventType; label: string; value?: EntryField }[] = [
  { id: 'gravity', label: 'Gravity reading', value: 'sg' },
  ...(
    [
      { id: 'backsweeten', label: 'Backsweetened', value: 'sg-after' },
      { id: 'estimate', label: 'Estimated ABV', value: 'abv' },
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
    if (event.toStatus === 'archived') return 'Archived';
    if (event.fromStatus === 'archived') return `Unarchived, back to ${statusLabel(event.toStatus ?? 'bottled')}`;
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

/** The stage of a batch an ingredient goes in. Bottling covers priming sugar and other additions at bottling. */
export type IngredientStage = 'primary' | 'secondary' | 'aging' | 'bottling';

export const INGREDIENT_STAGES: { id: IngredientStage; label: string }[] = [
  { id: 'primary', label: 'Primary' },
  { id: 'secondary', label: 'Secondary' },
  { id: 'aging', label: 'Aging' },
  { id: 'bottling', label: 'Bottling' },
];

/**
 * Units offered for an ingredient amount, A to Z by name, after "no unit".
 * An empty unit means a count, such as "2" cinnamon sticks.
 */
export const INGREDIENT_UNITS: { id: string; name: string }[] = [
  { id: '', name: 'No unit (a count)' },
  ...[
    { id: 'cup', name: 'Cup' },
    { id: 'fl oz', name: 'Fluid ounce' },
    { id: 'gal', name: 'Gallon' },
    { id: 'g', name: 'Gram' },
    { id: 'kg', name: 'Kilogram' },
    { id: 'L', name: 'Liter' },
    { id: 'mL', name: 'Milliliter' },
    { id: 'oz', name: 'Ounce' },
    { id: 'packet', name: 'Packet' },
    { id: 'lb', name: 'Pound' },
    { id: 'tbsp', name: 'Tablespoon' },
    { id: 'tsp', name: 'Teaspoon' },
  ].sort((a, b) => a.name.localeCompare(b.name)),
];

/** How a unit reads in the unit list: "Pound (lb)", or just "Cup" when the short form is the word itself. */
export function unitLabel(unit: { id: string; name: string }): string {
  return unit.id === '' || unit.id.toLowerCase() === unit.name.toLowerCase() ? unit.name : `${unit.name} (${unit.id})`;
}

export interface IngredientLine {
  id: string;
  name: string;
  /** The amount as shown, such as "3 lb" or "1 packet". Older lines have only this. */
  amount: string;
  /** The number part of the amount, as typed. */
  quantity?: string;
  /** One of INGREDIENT_UNITS, or a unit from an older free-text amount. */
  unit?: string;
  /** When it goes in. Missing means Primary. Recipes set it too, and batches started from a recipe keep it. */
  stage?: IngredientStage;
}

export type VolumeUnit = 'gal' | 'L';
export type TempUnit = 'F' | 'C';

export interface Recipe extends Base {
  name: string;
  beverageType: BeverageType;
  style: string;
  batchSizeL: number | null;
  /** The unit the batch size was entered in. Missing means the default from settings. */
  volumeUnit?: VolumeUnit;
  targetOG: number | null;
  targetFG: number | null;
  ingredients: IngredientLine[];
  steps: string[];
  /** Flavor icon id, see src/icons/flavors.ts. */
  icon: string;
  /** Up to two more icons shown behind the main one, in order. */
  extraIcons?: string[];
  /** Liquid color, a hex string. */
  color: string;
  /** 0 to 10, or null when not rated. */
  rating: number | null;
  notes: string;
  /** Reserved for the Nostr community in v0.5. */
  isPublished: boolean;
  /** The batch this recipe was last saved or updated from, if any. */
  updatedFromBatchId?: string | null;
  /** When that was, as an ISO moment. */
  updatedFromAt?: string | null;
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
  /** The unit the volume was entered in. Missing means the default from settings. */
  volumeUnit?: VolumeUnit;
  og: number | null;
  /** The gravity fermentation is expected to finish at. Missing means 1.000. */
  targetFG?: number | null;
  /** The stage the batch was in when it was archived, so Unarchive can put it back. */
  statusBeforeArchive?: BatchStatus | null;
  /** "Not now" was chosen when the last bottle was poured; cleared when bottles come back. */
  archivePromptDismissed?: boolean;
  ingredients: IngredientLine[];
  icon: string;
  /** Up to two more icons shown behind the main one, in order. */
  extraIcons?: string[];
  color: string;
  rating: number | null;
  notes: string;
}

export interface BatchEvent extends Base {
  batchId: string;
  /** For temperature entries: the unit it was entered in. Missing means the default from settings. */
  tempUnit?: TempUnit;
  type: EventType;
  /** Local date-time, yyyy-mm-ddThh:mm */
  date: string;
  /** SG for gravity, °C for temperature, pH for ph, % for an estimated ABV. */
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
  /**
   * For gravity entries: true for the final reading (one per batch). false for a reading that was
   * the final one until a newer final reading or a feeding replaced it: still a measurement, never sugar.
   */
  final?: boolean;
  /** For "ingredient" entries: what was added, and how much. */
  ingredient?: string;
  amount?: string;
  /** For "ingredient" entries: the line in the batch's ingredient list this entry ticks off. */
  ingredientLineId?: string;
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
  /** True when the ABV came from an estimate at bottling, not from gravity readings. */
  abvEstimated?: boolean;
  icon: string;
  /** Up to two more icons shown behind the main one, in order. */
  extraIcons?: string[];
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
