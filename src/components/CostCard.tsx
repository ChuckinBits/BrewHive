// The ingredient cost of a batch or recipe: the total, per 750 mL bottle and per gallon or liter,
// and which ingredients aren't counted. Shown once at least one ingredient has a cost.

import { currencyOf, ingredients, useQuery, useSettings } from '../db/store.ts';
import { volumeUnitOf } from '../lib/units.ts';
import type { IngredientCost, IngredientLine, LibraryIngredient } from '../db/types.ts';
import { costSummary, fmtMoney, type MissingReason } from '../lib/cost.ts';
import { fmtVolume } from '../lib/format.ts';
import { L_PER_GAL } from '../lib/calc.ts';

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

/** What isn't counted, one short line per reason: "No cost: Cinnamon sticks, Oak cubes." */
const WHY: Record<MissingReason, string> = {
  'no cost': 'No cost',
  'no amount': 'No amount',
  units: 'Cost in other units',
};

function notCountedLines(missing: { name: string; reason: MissingReason }[]): string[] {
  const lines: string[] = [];
  for (const reason of Object.keys(WHY) as MissingReason[]) {
    const names = missing.filter((m) => m.reason === reason).map((m) => m.name);
    if (names.length) lines.push(`${WHY[reason]}: ${names.join(', ')}.`);
  }
  return lines;
}

interface Props {
  lines: IngredientLine[];
  /** Batch volume or recipe batch size, for the per-bottle and per-volume figures. */
  volumeL: number | null;
  /** Batches use the price saved with them; recipes use current prices. */
  useSaved: boolean;
}

/** The figures to show, or null when no ingredient has a cost. */
function useCost(lines: IngredientLine[], volumeL: number | null, useSaved: boolean) {
  const settings = useSettings();
  const library = useQuery(() => ingredients.list()) ?? [];
  const summary = costSummary(lines, lineCostFrom(library, useSaved));
  if (summary.counted === 0) return null;
  const currency = currencyOf(settings);
  const money = (n: number) => fmtMoney(n, currency);
  const gallons = settings.units === 'us';
  const perVolume = gallons ? L_PER_GAL : 1;
  const hasVolume = volumeL != null && volumeL > 0;
  return {
    total: money(summary.total),
    perBottle: hasVolume ? money(summary.total / ((volumeL as number) / 0.75)) : null,
    // Divided by the volume in the display unit (rounded past any float noise), so 1 gal gives exactly the total.
    perVolume: hasVolume ? money(summary.total / (Math.round(((volumeL as number) / perVolume) * 1e6) / 1e6)) : null,
    perVolumeName: gallons ? 'gallon' : 'liter',
    perVolumeShort: fmtVolume(perVolume, volumeUnitOf(settings)).replace(/^1 /, ''),
    notCounted: summary.missing.length > 0 ? notCountedLines(summary.missing).join(' ') : null,
  };
}

/** The cost card, under a recipe's ingredients. */
export function CostCard({ lines, volumeL, useSaved }: Props) {
  const cost = useCost(lines, volumeL, useSaved);
  if (!cost) return null;
  return (
    <section className="card cost-card" aria-label="Ingredient cost">
      <div className="card-head">
        <h2>Ingredient cost</h2>
        <span className="cost-total">{cost.total}</span>
      </div>
      {cost.perBottle && (
        <p className="cost-per">
          {cost.perBottle} per 750 mL bottle · {cost.perVolume} per {cost.perVolumeShort}
        </p>
      )}
      {cost.notCounted && <p className="field-hint">{cost.notCounted}</p>}
      {!useSaved && <p className="field-hint">At today's prices from your ingredients.</p>}
    </section>
  );
}

/** The cost as rows of a batch's Details list, followed by what isn't counted. */
export function CostFacts({ lines, volumeL }: { lines: IngredientLine[]; volumeL: number | null }) {
  const cost = useCost(lines, volumeL, true);
  if (!cost) return null;
  return (
    <>
      <dt>Ingredient cost</dt>
      <dd>{cost.total}</dd>
      {cost.perBottle && (
        <>
          <dt>Per bottle</dt>
          <dd>{cost.perBottle} (750 mL)</dd>
          <dt>Per {cost.perVolumeName}</dt>
          <dd>{cost.perVolume}</dd>
        </>
      )}
      {cost.notCounted && <dd className="facts-note">{cost.notCounted}</dd>}
    </>
  );
}
