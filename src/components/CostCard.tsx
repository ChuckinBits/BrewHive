// The ingredient cost of a batch or recipe: the total, per 750 mL bottle and per gallon or liter,
// and which ingredients aren't counted. Shown once at least one ingredient has a cost.

import { currencyOf, ingredients, useQuery, useSettings } from '../db/store.ts';
import type { IngredientCost, IngredientLine, LibraryIngredient } from '../db/types.ts';
import { costSummary, fmtMoney, type MissingReason } from '../lib/cost.ts';
import { fmtVolume } from '../lib/format.ts';

/** The library ingredient a line is: by its link, or (older lines) by name. */
function libraryItemFor(line: IngredientLine, library: LibraryIngredient[]): LibraryIngredient | undefined {
  return line.ingredientId
    ? library.find((i) => i.id === line.ingredientId)
    : library.find((i) => i.name.trim().toLowerCase() === line.name.trim().toLowerCase());
}

/** A line's cost: a batch's saved one when `useSaved`, otherwise the library's current price. */
export function lineCostFrom(library: LibraryIngredient[], useSaved: boolean) {
  return (line: IngredientLine): IngredientCost | null => (useSaved && line.cost) || libraryItemFor(line, library)?.cost || null;
}

/** The library's current cost for a line, to save on a batch when it's saved. */
export function currentCost(line: IngredientLine, library: LibraryIngredient[]): IngredientCost | undefined {
  return libraryItemFor(line, library)?.cost ?? undefined;
}

const WHY: Record<MissingReason, string> = {
  'no cost': 'no cost',
  'no amount': 'no amount',
  units: "its cost is in other units",
};

interface Props {
  lines: IngredientLine[];
  /** Batch volume or recipe batch size, for the per-bottle and per-volume figures. */
  volumeL: number | null;
  /** Batches use the price saved with them; recipes use current prices. */
  useSaved: boolean;
}

export function CostCard({ lines, volumeL, useSaved }: Props) {
  const settings = useSettings();
  const library = useQuery(() => ingredients.list()) ?? [];
  const summary = costSummary(lines, lineCostFrom(library, useSaved));
  if (summary.counted === 0) return null;
  const currency = currencyOf(settings);
  const money = (n: number) => fmtMoney(n, currency);
  const perVolume = settings.volumeUnit === 'gal' ? 3.785411784 : 1;

  return (
    <section className="card cost-card" aria-label="Ingredient cost">
      <div className="card-head">
        <h2>Ingredient cost</h2>
        <span className="cost-total">{money(summary.total)}</span>
      </div>
      {volumeL != null && volumeL > 0 && (
        <p className="cost-per">
          {money(summary.total / (volumeL / 0.75))} per 750 mL bottle · {money((summary.total / volumeL) * perVolume)} per {fmtVolume(perVolume, settings.volumeUnit).replace(/^1 /, '')}
        </p>
      )}
      {summary.missing.length > 0 && (
        <p className="field-hint">
          Not counted: {summary.missing.map((m) => `${m.name} (${WHY[m.reason]})`).join(', ')}.
        </p>
      )}
      {!useSaved && <p className="field-hint">At today's prices from your ingredients.</p>}
    </section>
  );
}
