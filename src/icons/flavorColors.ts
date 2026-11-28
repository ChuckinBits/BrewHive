// The colors some flavor icons come in: a red or yellow apple, green grapes, a bochet's dark honey.
// A colored icon is saved as `flavor~color` (apple~red). The flavor's own drawing is the first
// color in its list and is saved as just the flavor (apple), so icons saved before colors existed
// keep their look.

import { FLAVORS, type Flavor } from './flavors.ts';

export interface FlavorColor {
  id: string;
  label: string;
  /** The color circle shown in the picker. */
  swatch: string;
  /** Fill colors in the drawing to swap for this color's. Empty for the flavor's own drawing. */
  swap: Record<string, string>;
  /** For Traditional: the liquid color it brings, as a darker honey makes a darker mead. */
  liquid?: string;
  /** The style it suggests, when it differs from the flavor's own (a bochet is a Bochet). */
  style?: string;
  /** Its name, when "Red apple" (color, then flavor) doesn't fit: "Bochet" rather than "Bochet traditional". */
  name?: string;
}

const own = (id: string, label: string, swatch: string, extra: Partial<FlavorColor> = {}): FlavorColor => ({ id, label, swatch, swap: {}, ...extra });

export const FLAVOR_COLORS: Record<string, FlavorColor[]> = {
  traditional: [
    own('gold', 'Gold', '#F2A93B', { liquid: '#E8A33A' }),
    { id: 'pale', label: 'Pale', swatch: '#F6D36B', swap: { '#F2A93B': '#F6D36B', '#FFF4DC': '#FFFBEA' }, liquid: '#EFD27A', name: 'Pale traditional' },
    { id: 'amber', label: 'Amber', swatch: '#D9822B', swap: { '#F2A93B': '#D9822B' }, liquid: '#C77A12', name: 'Amber traditional' },
    { id: 'bochet', label: 'Bochet', swatch: '#8A4B1F', swap: { '#F2A93B': '#8A4B1F', '#FFF4DC': '#E9B98A' }, liquid: '#6E3B1A', style: 'Bochet', name: 'Bochet' },
  ],
  apple: [
    own('green', 'Green', '#9BC53D'),
    { id: 'red', label: 'Red', swatch: '#D8343B', swap: { '#9BC53D': '#D8343B', '#E4F2B8': '#F7B3B0' } },
    { id: 'yellow', label: 'Yellow', swatch: '#F2D04B', swap: { '#9BC53D': '#F2D04B', '#E4F2B8': '#FFF3B8' } },
    { id: 'pink', label: 'Pink', swatch: '#F08AA0', swap: { '#9BC53D': '#F08AA0', '#E4F2B8': '#FFD8E0' } },
  ],
  grape: [
    own('purple', 'Purple', '#7B4BA6'),
    { id: 'red', label: 'Red', swatch: '#A3324A', swap: { '#7B4BA6': '#A3324A', '#D7C2EE': '#F0B3BF' } },
    { id: 'green', label: 'Green', swatch: '#9CC25A', swap: { '#7B4BA6': '#9CC25A', '#D7C2EE': '#E6F2C4' } },
  ],
  cherry: [
    own('red', 'Red', '#B42335'),
    { id: 'dark', label: 'Dark', swatch: '#5E1424', swap: { '#B42335': '#5E1424', '#F4A3AC': '#C98A94' } },
    { id: 'rainier', label: 'Rainier', swatch: '#F2C14E', swap: { '#B42335': '#F2C14E', '#F4A3AC': '#FFF0B8' } },
  ],
  pear: [
    own('green', 'Green', '#C9D94A'),
    { id: 'yellow', label: 'Yellow', swatch: '#F2D04B', swap: { '#C9D94A': '#F2D04B', '#F0F5C2': '#FFF6C4' } },
    { id: 'red', label: 'Red', swatch: '#C8463A', swap: { '#C9D94A': '#C8463A', '#F0F5C2': '#F5B8AE' } },
  ],
  plum: [
    own('purple', 'Purple', '#7A2E6B'),
    { id: 'red', label: 'Red', swatch: '#B8323F', swap: { '#7A2E6B': '#B8323F', '#D5A2CB': '#F2B0B6' } },
    { id: 'yellow', label: 'Yellow', swatch: '#E8C33E', swap: { '#7A2E6B': '#E8C33E', '#D5A2CB': '#FFF0B0' } },
  ],
  raspberry: [
    own('red', 'Red', '#D6336C'),
    { id: 'golden', label: 'Golden', swatch: '#F0B43C', swap: { '#D6336C': '#F0B43C' } },
    { id: 'black', label: 'Black', swatch: '#3B1F3A', swap: { '#D6336C': '#3B1F3A' } },
  ],
  chili: [
    own('red', 'Red', '#D7262E'),
    { id: 'green', label: 'Green', swatch: '#4E9A2E', swap: { '#D7262E': '#4E9A2E', '#F7A1A1': '#C8E6A0' } },
    { id: 'yellow', label: 'Yellow', swatch: '#F2C230', swap: { '#D7262E': '#F2C230', '#F7A1A1': '#FFF0A8' } },
  ],
  rose: [
    own('pink', 'Pink', '#E0457B'),
    { id: 'red', label: 'Red', swatch: '#C21F35', swap: { '#E0457B': '#C21F35', '#C42F66': '#9E1528', '#8E1E4A': '#6B0F1C', '#F7B5CF': '#F2A2A8' } },
    { id: 'yellow', label: 'Yellow', swatch: '#F2C84B', swap: { '#E0457B': '#F2C84B', '#C42F66': '#E0A82E', '#8E1E4A': '#B07A16', '#F7B5CF': '#FFF0B8' } },
  ],
};

/** A saved icon split into its flavor and color: `apple~red` is apple in red; `apple` is apple in its own color. */
export function splitIcon(icon: string | null | undefined): { flavorId: string; colorId: string | null } {
  const [flavorId, colorId] = (icon ?? '').split('~');
  return { flavorId, colorId: colorId || null };
}

/** The icon to save for a flavor in a color: just the flavor for its own color. */
export function joinIcon(flavorId: string, colorId: string | null): string {
  const first = FLAVOR_COLORS[flavorId]?.[0];
  return !colorId || colorId === first?.id ? flavorId : `${flavorId}~${colorId}`;
}

/** The color an icon is in, or null for a flavor that comes in one color. An unknown color is the flavor's own. */
export function colorOf(icon: string | null | undefined): FlavorColor | null {
  const { flavorId, colorId } = splitIcon(icon);
  const colors = FLAVOR_COLORS[flavorId];
  if (!colors) return null;
  return colors.find((c) => c.id === colorId) ?? colors[0];
}

const BY_ID = new Map(FLAVORS.map((f) => [f.id, f]));

export const DEFAULT_FLAVOR = 'traditional';

// Colored icons, drawn once and kept.
const colored = new Map<string, Flavor>();

/**
 * The flavor for a saved icon, in its color: `apple~red` is the apple drawn red and labeled "Red apple".
 * Traditional's colors also bring their liquid color and, for a bochet, the style. An unknown flavor is Traditional.
 */
export function getFlavor(id: string | null | undefined): Flavor {
  const { flavorId } = splitIcon(id);
  const base = BY_ID.get(flavorId) ?? (BY_ID.get(DEFAULT_FLAVOR) as Flavor);
  const color = BY_ID.has(flavorId) ? colorOf(id) : null;
  // Traditional in its own gold is just Traditional; any other flavor that has colors names its own ("Green apple").
  if (!color || (base.id === DEFAULT_FLAVOR && color === FLAVOR_COLORS[base.id][0])) return base;
  const own = color === FLAVOR_COLORS[base.id][0];
  const key = own ? base.id : `${base.id}~${color.id}`;
  let flavor = colored.get(key);
  if (!flavor) {
    let body = base.body;
    for (const [from, to] of Object.entries(color.swap)) body = body.split(from).join(to);
    flavor = { ...base, id: key, label: color.name ?? `${color.label} ${base.label.toLowerCase()}`, style: color.style ?? base.style, color: color.liquid ?? base.color, body };
    colored.set(key, flavor);
  }
  return flavor;
}

/** A flavor's own name, without its color: "Apple" for a red apple. */
export function flavorLabel(icon: string | null | undefined): string {
  return (BY_ID.get(splitIcon(icon).flavorId) ?? (BY_ID.get(DEFAULT_FLAVOR) as Flavor)).label;
}
