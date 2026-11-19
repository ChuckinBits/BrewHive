// Suggesting a name and style from the icon a person picks.

import { BEVERAGE_TYPES, MEAD_STYLES, stylesFor, type BeverageType } from '../db/types.ts';
import { FLAVORS } from '../icons/flavors.ts';

const flavor = (id: string) => FLAVORS.find((f) => f.id === id) ?? FLAVORS[0];

/** Icons whose own style label isn't one of the mead styles offered. */
const MEAD_STYLE_OVERRIDES: Record<string, string> = {
  traditional: 'Traditional',
  orange: 'Melomel',
  lemon: 'Melomel',
  pumpkin: 'Metheglin',
};

/** The mead style an icon implies: Maple gives Acerglyn, spices give Metheglin. */
export function meadStyleFor(flavorId: string): string {
  if (MEAD_STYLE_OVERRIDES[flavorId]) return MEAD_STYLE_OVERRIDES[flavorId];
  const style = flavor(flavorId).style;
  const listed = MEAD_STYLES.find((s) => s.name.toLowerCase() === style.toLowerCase());
  if (listed) return listed.name;
  return /melomel/i.test(style) ? 'Melomel' : 'Traditional';
}

/**
 * The name and style to suggest for an icon. A style the person already chose
 * is kept (and used in a mead's name); `style` is null when nothing should be filled in.
 */
export function suggestFromIcon(flavorId: string, type: BeverageType, chosenStyle: string): { name: string; style: string | null } {
  const label = flavor(flavorId).label;
  const chosen = chosenStyle.trim();
  if (type === 'mead') {
    const style = chosen || meadStyleFor(flavorId);
    return { name: label.toLowerCase() === style.toLowerCase() ? `${label} Mead` : `${label} ${style}`, style };
  }
  const typeLabel = type === 'other' ? 'Brew' : BEVERAGE_TYPES.find((t) => t.id === type)!.label;
  const styles = stylesFor(type);
  const belongs = Array.isArray(styles) ? styles.some((s) => s.name.toLowerCase() === chosen.toLowerCase()) : styles === 'free';
  return { name: `${label} ${typeLabel}`, style: chosen && belongs ? chosen : null };
}
