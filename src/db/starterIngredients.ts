// The ingredients a new library starts with: common mead-making ingredients,
// each with a short note on what it is and what it does, and no prices. Fixed ids, so they're only ever added once per device, and one is
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
    item('Honey', 'honey', weight, "General honey. Light, mild honeys let fruit and spice lead; darker ones bring more flavor of their own."),
    item('Wildflower honey', 'honey', weight, "From many blossoms, so the flavor varies by region and season. A good all-round base for traditional meads and melomels."),
    item('Clover honey', 'honey', weight, "Light and mild. A neutral base that lets fruit and spices lead."),
    item('Orange blossom honey', 'honey', weight, "Floral with a hint of citrus. A classic for traditional and citrus meads."),
    item('Buckwheat honey', 'honey', weight, "Dark, strong and earthy, with molasses notes. Use alone for a bold mead, or blend a little in for depth."),
    item('Meadowfoam honey', 'honey', weight, "A rare honey that tastes of toasted marshmallow and vanilla. Shines in traditional and dessert meads."),
    // Fruit
    item('Apples', 'fruit', weight, "Crisp and tart. Fermented with honey, apples make a cyser; easiest used pressed or as juice."),
    item('Apricots', 'fruit', weight, "Soft stone fruit with floral, honeyed notes. Adds body and aroma; pairs well with vanilla."),
    item('Blackberries', 'fruit', weight, "Deep color and a jammy, tart flavor. A classic melomel fruit; freezing first helps release the juice."),
    item('Blueberries', 'fruit', weight, "Mild and slightly earthy. The color comes through more than the flavor, so use plenty."),
    item('Cherries, sweet', 'fruit', weight, "Rich, dark fruit flavor and color. Pit or crush them; pairs with vanilla and oak."),
    item('Cherries, tart', 'fruit', weight, "Bright, sour cherries like Montmorency. Strong cherry flavor and acidity; a favorite for melomels."),
    item('Cranberries', 'fruit', weight, "Very tart, with a bright red color. Balance with sweeter fruit or backsweetening; freeze or crush to break the skins."),
    item('Elderberries', 'fruit', weight, "Dark, earthy and tannic, adding color and structure. Use ripe berries only: the stems, leaves and unripe berries are toxic."),
    item('Grapes', 'fruit', weight, "Fermented with honey, grapes make a pyment. Adds tannin, acidity and wine character."),
    item('Mangos', 'fruit', weight, "Sweet, tropical and aromatic. Peel and pit; pectic enzyme helps the pulp clear."),
    item('Mulberries', 'fruit', weight, "Sweet and mild with a dark color, like a softer blackberry."),
    item('Peaches', 'fruit', weight, "Delicate and floral. The flavor fades in fermentation, so add them in secondary; pairs with ginger or vanilla."),
    item('Pineapple', 'fruit', weight, "Bright, sweet-tart and tropical. Adds acidity; best added in secondary."),
    item('Plums', 'fruit', weight, "Sweet flesh, tart skins and a deep color. Plum meads pair well with warm spices."),
    item('Raspberries', 'fruit', weight, "Intense, tart and aromatic, one of the strongest-flavored fruits. Crushing the seeds hard can add bitterness."),
    item('Strawberries', 'fruit', weight, "Sweet and fragrant, but the flavor fades quickly. Use plenty, in secondary."),
    // Juice & concentrate
    item('Apple juice', 'juice', liquid, "For cysers. Use juice without preservatives like sorbate or benzoate, which stop fermentation."),
    item('Cherry juice', 'juice', liquid, "Cherry flavor and color without pitting fruit. Use juice without preservatives."),
    item('Cranberry juice', 'juice', liquid, "Tart and bright. Use 100% juice without preservatives; often blended with sweeter juice."),
    item('Grape juice', 'juice', liquid, "For pyments, or to add body and wine character. Use juice without preservatives."),
    // Sweeteners
    item('Cane sugar', 'sweetener', weight, "Ferments completely, adding alcohol but no flavor. Also for backsweetening after stabilizing."),
    item('Maple syrup', 'sweetener', splash, "Fermented with honey, it makes an acerglyn. Most maple flavor ferments away; add some at the end to keep it."),
    item('Lactose', 'sweetener', small, "Milk sugar that yeast can't ferment. Adds sweetness and body. Not vegan, and not for the lactose intolerant."),
    item('Allulose', 'sweetener', small, "A rare sugar that tastes like sugar and isn't fermented. Backsweetens without restarting fermentation."),
    item('Erythritol', 'sweetener', small, "A sugar alcohol about 70% as sweet as sugar, with a slight cooling taste. Isn't fermented."),
    item('Xylitol', 'sweetener', small, "A sugar alcohol about as sweet as sugar. Isn't fermented. Toxic to dogs."),
    item('Stevia', 'sweetener', 'tsp', "Plant-based and very sweet, so a little goes a long way. Isn't fermented; can taste bitter in large amounts."),
    item('Sucralose', 'sweetener', 'tsp', "Hundreds of times sweeter than sugar, with no calories. Isn't fermented; use tiny amounts."),
    // Spices
    item('Cinnamon sticks', 'spice', '', "Warm and sweet. Sticks give a cleaner flavor than ground; easy to overdo, so taste as it steeps."),
    item('Vanilla beans', 'spice', '', "Split, scrape and steep in secondary. Rounds out fruit, oak and spiced meads."),
    item('Allspice', 'spice', 'tsp', "Tastes like clove, cinnamon and nutmeg together. Great in holiday blends; use sparingly."),
    item('Cardamom', 'spice', '', "Aromatic, citrusy and slightly minty. Crack the pods; a few go a long way."),
    item('Clove', 'spice', '', "Strong, warming and slightly numbing. One or two per gallon is often plenty."),
    item('Ginger', 'spice', small, "Bright, spicy heat from fresh or dried root. Pairs with citrus, peach and honey."),
    item('Nutmeg', 'spice', 'tsp', "Warm, sweet and nutty. Grate it fresh; a small amount in spiced and holiday meads."),
    item('Star anise', 'spice', '', "Potent and licorice-like. One pod per gallon or less; good in spiced and dark meads."),
    item('Lime peel', 'spice', small, "Zest for bright citrus aroma. Leave out the white pith, which is bitter."),
    item('Orange peel', 'spice', small, "Sweet or bitter orange zest for citrus aroma. A classic with cinnamon and clove."),
    item('Coffee', 'spice', small, "Whole or cracked roasted beans, steeped in secondary like cold brew. Pairs with vanilla, cacao and dark honey."),
    item('Cacao nibs', 'spice', small, "Roasted cocoa bean pieces: chocolate flavor without sugar. Steep in secondary; pairs with vanilla, cherry and coffee."),
    // Herbs & flowers
    item('Basil', 'herb', small, "Sweet and peppery. Fresh leaves pair surprisingly well with strawberry or lemon."),
    item('Chamomile', 'herb', small, "Soft, apple-like and floral. Steep dried flowers briefly; long steeps can taste grassy."),
    item('Hibiscus', 'herb', small, "Tart and cranberry-like, with a vivid red color. A little adds both color and acidity."),
    item('Lavender', 'herb', small, "Strongly floral. Use very little: too much tastes soapy."),
    item('Lemongrass', 'herb', small, "Bright lemon aroma without the sourness. Bruise the stalks; pairs with ginger."),
    item('Mint', 'herb', small, "Cool and fresh. Steep briefly in secondary; it fades with time."),
    item('Rose petals', 'herb', small, "Delicate floral perfume. Use unsprayed petals; pairs with raspberry."),
    item('Rosemary', 'herb', small, "Piney and resinous. A small sprig is enough; good with citrus."),
    // Yeast
    item('Lalvin 71B', 'yeast', 'packet', "Fruity wine yeast that softens acidity. A favorite for melomels. Up to about 14% ABV."),
    item('Lalvin EC-1118', 'yeast', 'packet', "Strong and neutral, up to about 18% ABV. For dry, strong meads and restarting stuck fermentations."),
    item('Lalvin D47', 'yeast', 'packet', "Gives a round, full body; good for traditional meads. Keep it below about 68\u00b0F (20\u00b0C) to avoid harsh flavors. Up to about 14% ABV."),
    item('Lalvin K1-V1116', 'yeast', 'packet', "Hardy and fast, up to about 18% ABV. Keeps fresh, fruity aromas."),
    item('Lalvin QA23', 'yeast', 'packet', "Fresh citrus and tropical aromas for light, fruity meads. Up to about 16% ABV."),
    item('Lalvin RC-212', 'yeast', 'packet', "A red wine yeast that brings out color and red fruit. Good for dark berry and cherry meads. Up to about 16% ABV."),
    item('Red Star Premier Classique', 'yeast', 'packet', "Formerly Montrachet. A clean, reliable, all-purpose wine yeast."),
    item('Red Star C\u00f4te des Blancs', 'yeast', 'packet', "Slow and gentle. Keeps fruit aroma and can leave some sweetness."),
    item("Mangrove Jack's M05", 'yeast', 'packet', "Made for mead: clean and dry, letting the honey show. Up to about 18% ABV."),
    item('Safale US-05', 'yeast', 'packet', "Clean American ale yeast. For braggots and lighter session meads, up to about 10% ABV."),
    item('Lallemand Voss Kveik', 'yeast', 'packet', "Norwegian farmhouse yeast. Ferments fast and very warm, around 95\u00b0F (35\u00b0C), with orange notes. Good for quick session meads."),
    item("Fleischmann's", 'yeast', 'packet', "Bread yeast, used in the classic Joe's Ancient Orange mead. Stops early and leaves sweetness; can taste bready."),
    // Nutrients
    item('Fermaid O', 'nutrient', 'g', "Organic, yeast-derived nutrient used in staggered (TOSNA) schedules. Add in steps over the first third of fermentation."),
    item('Fermaid K', 'nutrient', 'g', "Blended nutrient with DAP and yeast extract. Add in steps early in fermentation."),
    item('Go-Ferm', 'nutrient', 'g', "Yeast rehydration nutrient. Mix into the rehydration water before pitching, not into the must."),
    item('DAP', 'nutrient', 'g', "Diammonium phosphate: inorganic nitrogen. Add early only; yeast can't use it once the alcohol passes about 9%."),
    // Additives
    item('Potassium sorbate', 'additive', 'tsp', "Stabilizer: stops yeast from multiplying. Use with metabisulfite before backsweetening."),
    item('Potassium metabisulfite', 'additive', 'tsp', "Stabilizer (K-meta): protects against oxidation and spoilage. Use with sorbate before backsweetening."),
    item('Campden tablets', 'additive', '', "Measured doses of metabisulfite, usually one per gallon. Protects the must or finished mead."),
    item('Nagardo', 'additive', '', "Microbial stabilizer, an alternative to sulfites."),
    item('Pectic enzyme', 'additive', 'tsp', "Breaks down fruit pectin for clearer mead and more juice. Add with the fruit, before fermenting."),
    item('Acid blend', 'additive', 'tsp', "Citric, malic and tartaric acid together. Brightens a flat mead; add to taste after fermenting."),
    item('Citric acid', 'additive', 'tsp', "Bright, citrusy tartness. Best added after fermenting."),
    item('Malic acid', 'additive', 'tsp', "Crisp, green-apple tartness."),
    item('Tartaric acid', 'additive', 'tsp', "The main acid in grapes: firm, wine-like tartness."),
    item('Potassium bicarbonate', 'additive', 'tsp', "Raises pH and softens acidity. Rescues a stalled, too-acidic fermentation or an over-tart mead."),
    // Fining & clarifiers
    item('Bentonite', 'fining', 'tsp', "Clay that clears protein haze. Mix with water first; add at the start or in secondary."),
    item('Sparkalloid', 'fining', 'g', "Clears stubborn haze. Mix with hot water; settles slowly but packs down well."),
    item('Chitosan', 'fining', '', "Fast clearing, usually paired with kieselsol. Made from shellfish."),
    // Tannins
    item('Wine tannin', 'oak', 'tsp', "Adds structure and a slight dryness. Helps fruit meads that taste thin."),
    item('Oak cubes', 'oak', small, "Slow, smooth oak flavor for long aging. Taste every few weeks."),
    item('Oak, American', 'oak', small, "Bold vanilla, coconut and sweet spice."),
    item('Oak, French', 'oak', small, "Subtle, spicy and elegant, with more tannin than flavor."),
    item('Black tea', 'oak', small, "Easy tannin: a strong cup adds structure to a thin mead."),
    item('Green tea', 'oak', small, "Lighter, grassy tannin; gentler than black tea."),
    // Grains & malt
    item('Pale malt', 'grain', weight, "Base malt for braggots, meads brewed with malt. Needs mashing."),
    item('Biscuit malt', 'grain', weight, "Toasty, bready, biscuit flavor. A small part of a braggot."),
    item('Amber malt', 'grain', weight, "Toasty and nutty with a hint of coffee. A little adds color and depth."),
    // Hops
    item('Cascade hops', 'hops', small, "Classic American hop: floral and grapefruit. For braggots and hopped meads."),
    item('Citra hops', 'hops', small, "Intense citrus and tropical fruit. Great dry-hopped in light meads."),
    item('Centennial hops', 'hops', small, "Floral and citrusy, like a stronger Cascade."),
  ];
}
