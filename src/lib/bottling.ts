// Bottling a batch in one or more bottle sizes.

import { fmtBottle, newId, parseNum } from './format.ts';

export type BottleUnit = 'ml' | 'floz' | 'cup' | 'pint' | 'quart' | 'l' | 'other';

/** Milliliters per unit. Cup, pint and quart are US measures. "Other" is entered in mL. */
export const BOTTLE_UNITS: { id: BottleUnit; label: string; ml: number }[] = [
  { id: 'ml', label: 'mL', ml: 1 },
  { id: 'floz', label: 'Fluid ounce', ml: 29.5735 },
  { id: 'cup', label: 'Cup (237 mL)', ml: 236.588 },
  { id: 'pint', label: 'Pint (473 mL)', ml: 473.176 },
  { id: 'quart', label: 'Quart (946 mL)', ml: 946.353 },
  { id: 'l', label: 'Liter', ml: 1000 },
  { id: 'other', label: 'Other', ml: 1 },
];

export interface BottleLine {
  id: string;
  count: string;
  size: string;
  unit: BottleUnit;
  /** For "Other": what the container is, such as Growler. */
  container: string;
  /** Once the person types a count, changing the size no longer recalculates it. */
  countTyped: boolean;
}

/** One bottle's volume in mL, or null if the size isn't a usable number. */
export function lineBottleMl(line: Pick<BottleLine, 'size' | 'unit'>): number | null {
  const size = parseNum(line.size);
  if (size == null || size <= 0) return null;
  const unit = BOTTLE_UNITS.find((u) => u.id === line.unit) ?? BOTTLE_UNITS[0];
  return size * unit.ml;
}

/** How many bottles of this size the volume fills, rounded down. Without a volume, 5. */
export function suggestCount(volumeMl: number | null, bottleMl: number | null): number {
  if (volumeMl == null || volumeMl <= 0 || bottleMl == null) return 5;
  return Math.max(1, Math.floor(volumeMl / bottleMl + 1e-9));
}

export function totalMl(lines: BottleLine[]): number {
  return lines.reduce((sum, line) => sum + (parseNum(line.count) ?? 0) * (lineBottleMl(line) ?? 0), 0);
}

export function newLine(volumeMl: number | null, others: BottleLine[] = []): BottleLine {
  const left = volumeMl == null ? null : volumeMl - totalMl(others);
  const line: BottleLine = { id: newId(), count: '', size: '750', unit: 'ml', container: '', countTyped: false };
  return { ...line, count: String(suggestCount(left, lineBottleMl(line))) };
}

/** A line's bottle as people read it: "750 mL", "12 fl oz", "Growler (1.89 L)". */
export function lineSizeLabel(line: BottleLine): string {
  const ml = lineBottleMl(line) ?? 0;
  const size = parseNum(line.size) ?? 0;
  const n = String(Number(size.toFixed(2)));
  switch (line.unit) {
    case 'ml':
    case 'l':
      return fmtBottle(ml);
    case 'floz':
      return `${n} fl oz`;
    case 'cup':
      return size === 1 ? '1 cup' : `${n} cups`;
    case 'pint':
      return size === 1 ? '1 pint' : `${n} pints`;
    case 'quart':
      return size === 1 ? '1 quart' : `${n} quarts`;
    case 'other':
      return `${line.container.trim() || 'Container'} (${fmtBottle(ml)})`;
  }
}

/** The "Bottled" timeline note: "2 × 750 mL, 3 × 500 mL". */
export function bottlingNote(lines: BottleLine[]): string {
  return lines.map((line) => `${parseNum(line.count)} × ${lineSizeLabel(line)}`).join(', ');
}

/** The first problem with the lines, or null when they can be saved. */
export function bottlingError(lines: BottleLine[]): string | null {
  for (const line of lines) {
    const count = parseNum(line.count);
    if (count == null || count < 1 || !Number.isInteger(count)) return 'Enter how many bottles you filled.';
    if (lineBottleMl(line) == null) return 'Enter the bottle size.';
    if (line.unit === 'other' && !line.container.trim()) return 'Name the container, such as Growler.';
  }
  return null;
}
