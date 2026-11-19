// The ingredients a new library starts with: common mead-making staples, with
// no prices. Fixed ids, so they're only ever added once per device.

import type { LibraryIngredient } from './types.ts';

type Starter = Pick<LibraryIngredient, 'id' | 'name' | 'category' | 'defaultUnit' | 'notes'>;

export function starterIngredients(imperial: boolean): Starter[] {
  const weight = imperial ? 'lb' : 'kg';
  const small = imperial ? 'oz' : 'g';
  const item = (name: string, category: string, defaultUnit: string, notes = ''): Starter => ({
    id: `starter-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    name,
    category,
    defaultUnit,
    notes,
  });
  return [
    item('Wildflower honey', 'honey', weight),
    item('Clover honey', 'honey', weight),
    item('Orange blossom honey', 'honey', weight),
    item('Buckwheat honey', 'honey', weight),
    item('Cane sugar', 'sweetener', weight),
    item('Apple juice', 'juice', imperial ? 'gal' : 'L'),
    item('Cinnamon sticks', 'spice', ''),
    item('Vanilla beans', 'spice', ''),
    item('Lalvin 71B', 'yeast', 'packet'),
    item('Lalvin EC-1118', 'yeast', 'packet'),
    item('Lalvin D47', 'yeast', 'packet'),
    item('Lalvin K1-V1116', 'yeast', 'packet'),
    item('Lalvin QA23', 'yeast', 'packet'),
    item('Fermaid O', 'nutrient', 'g'),
    item('Fermaid K', 'nutrient', 'g'),
    item('Go-Ferm', 'nutrient', 'g', 'Yeast rehydration nutrient.'),
    item('DAP', 'nutrient', 'g', 'Diammonium phosphate.'),
    item('Potassium sorbate', 'additive', 'tsp', 'Stabilizer.'),
    item('Potassium metabisulfite', 'additive', 'tsp', 'Stabilizer.'),
    item('Campden tablets', 'additive', '', 'Stabilizer.'),
    item('Nagardo', 'additive', '', 'Microbial stabilizer.'),
    item('Pectic enzyme', 'additive', 'tsp'),
    item('Acid blend', 'additive', 'tsp'),
    item('Wine tannin', 'additive', 'tsp'),
    item('Bentonite', 'fining', 'tsp'),
    item('Sparkalloid', 'fining', 'g'),
    item('Chitosan', 'fining', ''),
    item('Oak cubes', 'oak', small),
  ];
}
