// The ingredients a new library starts with: common mead-making staples, with
// no prices. Fixed ids, so they're only ever added once per device, and one is
// skipped when an ingredient of that name is already in the list.

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
  const liquid = imperial ? 'gal' : 'L';
  const splash = imperial ? 'fl oz' : 'mL';
  return [
    // Honey
    item('Honey', 'honey', weight),
    item('Wildflower honey', 'honey', weight),
    item('Clover honey', 'honey', weight),
    item('Orange blossom honey', 'honey', weight),
    item('Buckwheat honey', 'honey', weight),
    item('Meadowfoam honey', 'honey', weight),
    // Fruit
    item('Apples', 'fruit', weight),
    item('Apricots', 'fruit', weight),
    item('Blackberries', 'fruit', weight),
    item('Blueberries', 'fruit', weight),
    item('Cherries, sweet', 'fruit', weight),
    item('Cherries, tart', 'fruit', weight),
    item('Cranberries', 'fruit', weight),
    item('Elderberries', 'fruit', weight),
    item('Grapes', 'fruit', weight),
    item('Mangos', 'fruit', weight),
    item('Mulberries', 'fruit', weight),
    item('Peaches', 'fruit', weight),
    item('Pineapple', 'fruit', weight),
    item('Plums', 'fruit', weight),
    item('Raspberries', 'fruit', weight),
    item('Strawberries', 'fruit', weight),
    // Juice & concentrate
    item('Apple juice', 'juice', liquid),
    item('Cherry juice', 'juice', liquid),
    item('Cranberry juice', 'juice', liquid),
    item('Grape juice', 'juice', liquid),
    // Sweeteners
    item('Cane sugar', 'sweetener', weight),
    item('Maple syrup', 'sweetener', splash),
    item('Lactose', 'sweetener', small, "Unfermentable milk sugar."),
    item('Allulose', 'sweetener', small, 'Unfermentable.'),
    item('Erythritol', 'sweetener', small, 'Unfermentable.'),
    item('Xylitol', 'sweetener', small, 'Unfermentable.'),
    item('Stevia', 'sweetener', 'tsp', 'Unfermentable.'),
    item('Sucralose', 'sweetener', 'tsp', 'Unfermentable.'),
    // Spices
    item('Cinnamon sticks', 'spice', ''),
    item('Vanilla beans', 'spice', ''),
    item('Allspice', 'spice', 'tsp'),
    item('Cardamom', 'spice', ''),
    item('Clove', 'spice', ''),
    item('Ginger', 'spice', small),
    item('Nutmeg', 'spice', 'tsp'),
    item('Star anise', 'spice', ''),
    item('Lime peel', 'spice', small),
    item('Orange peel', 'spice', small),
    // Herbs & flowers
    item('Basil', 'herb', small),
    item('Chamomile', 'herb', small),
    item('Coffee', 'herb', small),
    item('Hibiscus', 'herb', small),
    item('Lavender', 'herb', small),
    item('Lemongrass', 'herb', small),
    item('Mint', 'herb', small),
    item('Rose petals', 'herb', small),
    item('Rosemary', 'herb', small),
    // Yeast
    item('Lalvin 71B', 'yeast', 'packet'),
    item('Lalvin EC-1118', 'yeast', 'packet'),
    item('Lalvin D47', 'yeast', 'packet'),
    item('Lalvin K1-V1116', 'yeast', 'packet'),
    item('Lalvin QA23', 'yeast', 'packet'),
    item('Lalvin RC-212', 'yeast', 'packet'),
    item('Red Star Premier Classique', 'yeast', 'packet'),
    item('Red Star Côte des Blancs', 'yeast', 'packet'),
    item("Mangrove Jack's M05", 'yeast', 'packet'),
    item('Safale US-05', 'yeast', 'packet'),
    item('Lallemand Voss Kveik', 'yeast', 'packet', 'Ferments fast and warm.'),
    item("Fleischmann's", 'yeast', 'packet', 'Bread yeast.'),
    // Nutrients
    item('Fermaid O', 'nutrient', 'g'),
    item('Fermaid K', 'nutrient', 'g'),
    item('Go-Ferm', 'nutrient', 'g', 'Yeast rehydration nutrient.'),
    item('DAP', 'nutrient', 'g', 'Diammonium phosphate.'),
    // Additives
    item('Potassium sorbate', 'additive', 'tsp', 'Stabilizer.'),
    item('Potassium metabisulfite', 'additive', 'tsp', 'Stabilizer.'),
    item('Campden tablets', 'additive', '', 'Stabilizer.'),
    item('Nagardo', 'additive', '', 'Microbial stabilizer.'),
    item('Pectic enzyme', 'additive', 'tsp'),
    item('Acid blend', 'additive', 'tsp'),
    item('Citric acid', 'additive', 'tsp'),
    item('Malic acid', 'additive', 'tsp'),
    item('Tartaric acid', 'additive', 'tsp'),
    item('Potassium bicarbonate', 'additive', 'tsp', 'Raises pH.'),
    // Fining & clarifiers
    item('Bentonite', 'fining', 'tsp'),
    item('Sparkalloid', 'fining', 'g'),
    item('Chitosan', 'fining', ''),
    // Tannins (the category was Oak & wood; its id stays 'oak')
    item('Wine tannin', 'oak', 'tsp'),
    item('Oak cubes', 'oak', small),
    item('Oak, American', 'oak', small),
    item('Oak, French', 'oak', small),
    item('Black tea', 'oak', small),
    item('Green tea', 'oak', small),
    // Grains & malt
    item('Pale malt', 'grain', weight),
    item('Biscuit malt', 'grain', weight),
    item('Amber malt', 'grain', weight),
    // Hops
    item('Cascade hops', 'hops', small),
    item('Citra hops', 'hops', small),
    item('Centennial hops', 'hops', small),
  ];
}
