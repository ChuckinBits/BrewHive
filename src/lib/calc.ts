// Brewing math. Pure functions with no imports, so they are easy to test.

/** Alcohol by volume from original and current (or final) gravity, the standard homebrew formula. */
export function abv(og: number, fg: number): number {
  return Math.max(0, (og - fg) * 131.25);
}

/** Share of the sugar the yeast has eaten so far, as a percentage. */
export function attenuation(og: number, sg: number): number {
  if (og <= 1) return 0;
  return Math.min(100, Math.max(0, ((og - sg) / (og - 1)) * 100));
}

/** Specific gravity to degrees Brix (ASBC polynomial). */
export function sgToBrix(sg: number): number {
  return 182.4601 * sg ** 3 - 775.6821 * sg ** 2 + 1262.7794 * sg - 669.5622;
}

/** Degrees Brix to specific gravity. */
export function brixToSg(brix: number): number {
  return 1 + brix / (258.6 - (brix / 258.2) * 227.1);
}

/** Liters in a US gallon. */
export const L_PER_GAL = 3.785411784;

export function litersToGallons(liters: number): number {
  return liters / L_PER_GAL;
}

export function gallonsToLiters(gallons: number): number {
  return gallons * L_PER_GAL;
}

export function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

export function fToC(f: number): number {
  return ((f - 32) * 5) / 9;
}

/** Whole days from one yyyy-mm-dd (or ISO) date to another, never negative. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(from.slice(0, 10) + 'T00:00:00Z');
  const b = Date.parse(to.slice(0, 10) + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}
