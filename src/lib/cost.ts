// Ingredient costs: converting amounts, the cost of a line, and batch or recipe totals.
// Weights convert to weights and volumes to volumes, never one to the other: honey bought by the
// pound but measured in cups shows as "cost unknown" rather than a guess. Counts (a packet, no
// unit) only match the same unit.

import type { IngredientCost, IngredientLine } from '../db/types.ts';
import { parseNum } from './format.ts';

const WEIGHT: Record<string, number> = { g: 1, kg: 1000, oz: 28.349523125, lb: 453.59237 };
const VOLUME: Record<string, number> = { mL: 1, L: 1000, gal: 3785.411784, cup: 236.5882365, 'fl oz': 29.5735295625, tbsp: 14.78676478125, tsp: 4.92892159375 };

/** An amount in a common base (grams, millilitres, or the count unit itself). Null for units it doesn't know. */
function toBase(quantity: number, unit: string): { kind: string; amount: number } | null {
  if (unit in WEIGHT) return { kind: 'weight', amount: quantity * WEIGHT[unit] };
  if (unit in VOLUME) return { kind: 'volume', amount: quantity * VOLUME[unit] };
  if (unit === '' || unit === 'packet') return { kind: `count:${unit}`, amount: quantity };
  return null;
}

/** Whether an amount in `unit` can be priced from a cost given in `costUnit`. */
export function unitsCompatible(unit: string, costUnit: string): boolean {
  const a = toBase(1, unit);
  const b = toBase(1, costUnit);
  return a != null && b != null && a.kind === b.kind;
}

/** What `quantity unit` costs at this purchase price, or null when it can't be worked out. */
export function costOf(quantity: number, unit: string, cost: IngredientCost): number | null {
  const used = toBase(quantity, unit);
  const bought = toBase(cost.quantity, cost.unit);
  if (!used || !bought || used.kind !== bought.kind || bought.amount <= 0) return null;
  return (used.amount / bought.amount) * cost.price;
}

/** The price per one `unit`, such as 2.08 per lb for 24.99 for 12 lb. Null when the units don't convert. */
export function pricePer(unit: string, cost: IngredientCost): number | null {
  return costOf(1, unit, cost);
}

export type MissingReason = 'no cost' | 'no amount' | 'units';

export interface CostSummary {
  total: number;
  /** Lines that were priced. */
  counted: number;
  /** Lines left out, and why. */
  missing: { name: string; reason: MissingReason }[];
}

/**
 * The total cost of some ingredient lines. `costFor` gives each line's cost (a batch's saved cost,
 * or the library's current one), or null when there is none.
 */
export function costSummary(lines: IngredientLine[], costFor: (line: IngredientLine) => IngredientCost | null | undefined): CostSummary {
  const summary: CostSummary = { total: 0, counted: 0, missing: [] };
  for (const line of lines) {
    const cost = costFor(line);
    if (!cost) {
      summary.missing.push({ name: line.name, reason: 'no cost' });
      continue;
    }
    const quantity = parseNum(line.quantity ?? '');
    if (quantity == null) {
      summary.missing.push({ name: line.name, reason: 'no amount' });
      continue;
    }
    const value = costOf(quantity, line.unit ?? '', cost);
    if (value == null) {
      summary.missing.push({ name: line.name, reason: 'units' });
      continue;
    }
    summary.total += value;
    summary.counted += 1;
  }
  return summary;
}

/** The currency for a locale's region, for the default setting. */
export function localeCurrency(locale: string): string {
  const region = (locale.split('-')[1] ?? '').toUpperCase();
  const byRegion: Record<string, string> = {
    US: 'USD', CA: 'CAD', GB: 'GBP', AU: 'AUD', NZ: 'NZD', IE: 'EUR', JP: 'JPY', IN: 'INR', CH: 'CHF', SE: 'SEK', NO: 'NOK',
    DK: 'DKK', PL: 'PLN', CZ: 'CZK', BR: 'BRL', MX: 'MXN', ZA: 'ZAR', SG: 'SGD', HK: 'HKD', KR: 'KRW', CN: 'CNY',
  };
  const euro = ['AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK'];
  return byRegion[region] ?? (euro.includes(region) ? 'EUR' : 'USD');
}

/** Currencies offered in More. */
export const CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'NZD', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'JPY', 'INR', 'BRL', 'MXN', 'ZAR', 'SGD', 'HKD', 'KRW', 'CNY'];

/** A money amount in the chosen currency, such as $42.10. */
export function fmtMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
