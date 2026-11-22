# Changelog

All notable changes to BrewHive are listed here. Versions follow the roadmap:
minor versions are milestones (0.2 Ingredient library, 0.3 Equipment, 0.4
phone apps, 0.5 sync, 0.6 community) and patch versions are releases within
a milestone.

## Unreleased (v0.2.2)

- **Fermentation progress in Details** ([#49]): attenuation (how much of
  the sugar has fermented), the fermentation rate in points per day between
  the last two readings, and about how many days to the target FG (1.000
  without one) at that rate. The rate and days show while fermenting.
- **Sweetness when backsweetening** ([#49]). Typing the gravity after
  adding shows how sweet it is: Dry, Semi-sweet, Sweet or Dessert, by the
  BJCP mead ranges. The Target field on batches and recipes shows it too,
  for the target FG or the FG an ABV target finishes at.
- **Backsweetening off the chart** ([#49]). A backsweetening reading is
  charted only when ticked "This will ferment".
- **Stage change entries** ([#49]). Add entry has Stage change: pick the
  stage and when. The newest stage change moves the batch to it (moving to
  Aging or Bottled asks for the final reading); an earlier one only records
  when it happened, for logging a past brew.
- **Relocate** ([#49]). The "Moved to" entry for where a batch is kept is
  now Relocate, shown as "Relocated to Basement", so it isn't mistaken for
  a stage change.

## v0.2.1 – 2026-11-21

### Batches

- **The OG on the timeline** ([#44]). A batch's OG is an "Original gravity"
  entry marked OG, dated its start date. Editing its value changes the OG;
  move its date if you took it after starting. Removing it clears the OG.
  Batches that already have an OG get the entry.
- **Final reading for new batches in Secondary** ([#44]), as for Aging and
  Bottled, but optional. The final reading has a When (date and time), and
  can't be before the start date. When the OG and a different final gravity
  fall on the same day, a note suggests setting the start date to when the
  batch really started.
- With a final reading, the ABV tile says ABV, not ABV so far, in any stage.

### Bottling

- **Bottled without the cellar** ([#46]). Bottle this batch has "Mark as
  bottled without adding to the cellar": the batch moves to Bottled with a
  Bottled timeline entry (and the final reading, if entered), and no
  bottles. Closing the sheet still leaves the stage as it was.
- **Bottled opens bottling** ([#46]). Tapping Bottled on a bottled batch, or
  its Bottled timeline entry, opens Add bottles. Bottles added to an entry
  that had none are recorded on it; later bottlings get their own entry.
  "Edit timeline entry" there changes the entry's date or removes it.

### Units

- **Volume & weight: US or Metric** ([#41]). The Volume setting under
  More → Units is now Volume & weight, with US (gallons, pounds, ounces) or
  Metric (liters, kilograms, grams).
- **Starter ingredients follow your units** ([#41]). Switching between US
  and Metric moves the starter ingredients' default units to match: lb and
  kg, oz and g, gal and L, fl oz and mL. Ingredients you've changed, and
  your own, keep their units. Starters take their units from that setting
  rather than the browser's region, and opening an ingredient and saving it
  without changes no longer counts as changing it.

**Updating from v0.2.0:** existing data carries over. The units setting is
now saved as `units: "us"` or `"metric"` (it was `volumeUnit: "gal"` or
`"L"`); older settings and backups are converted when they load or restore.
Batches and recipes still record their own volume as gal or L. Batches with
an OG get their Original gravity entry the first time the app opens.

## v0.2.0 – 2026-11-21

The ingredient library: your ingredients by category, picked from as you
type, with costs for every batch and recipe.

### Your ingredients

- **Ingredient library** ([#31]). More → Ingredients lists your ingredients
  by category, with a search box and category chips. Each has a default
  unit, notes, and the recipes and batches that use it. The search, chip and
  scroll position stay put when you open an ingredient and come back.
- **100 starter ingredients** ([#38]), each with a short note on what it is
  and what it does in a brew: honeys including meadowfoam, 16 fruits,
  juices, sugar and sugar substitutes, spices (including coffee, cacao nibs
  and chili peppers), herbs and flowers, 12 yeasts (wine, ale, kveik and
  bread yeast), nutrients, acids and stabilizers including Nagardo, fining
  agents, tannins (wine tannin, oak, tea), malts and hops. None have prices.
  "Restore starter ingredients" brings back any you deleted, leaving your
  own ingredients and prices alone.
- **Categories** ([#31]): Honey, Fruit, Juice & concentrate, Sweeteners,
  Spices, Herbs & flowers, Yeast, Nutrients, Additives, Fining & clarifiers,
  Tannins, Grains & malt, Hops and Other. Rename them, add your own, or
  remove one (its ingredients move to Other). Sort A–Z (Other stays last)
  or drag the ≡ handle (or use its arrow keys); the order is used for the
  chips and the sections of the list.
- **Category icons** ([#36]). Each category has a line icon, shown in the
  list with the category name in the accent color. In Categories, tap an
  icon to pick another (17 in all) or None. Categories you add start with
  none.

### Adding ingredients

- **Pick from the list** ([#32]). Adding an ingredient to a recipe, a batch
  or the timeline shows your list as you type, with category chips. Picking
  one fills in its default unit and shows its note under the field. A name
  that isn't on the list can be used once, or saved with "Save as a new
  ingredient", which opens the New ingredient form (category, default unit,
  cost) on top of what you're writing and picks it when saved.
- **Timeline ingredient entries** ([#35]) use the same form, with When in
  place of Stage. An entry and the batch ingredient it logged stay in step:
  editing the entry offers "Also update batch ingredients", and editing the
  ingredient in Batch Edit offers "Also update the timeline entry", both
  ticked. Removing a batch ingredient keeps its timeline entry.

### Costs

- **What a batch costs** ([#33]). Give an ingredient what you paid ("24.99
  for 12 lb") and batches and recipes show their ingredient cost: the total,
  per 750 mL bottle and per gallon or liter. A batch keeps the prices it was
  made with; recipes use today's. Choose the currency under More.
- **Details first.** On a batch, cost is part of Details, which moves above
  Ingredients as the overview of the batch. Recipes show cost under their
  ingredients.

### Sample data and erasing

- **Sample data uses the library.** Its recipes and batches use the starter
  ingredients (plus spring water and oranges), and everything they use gets
  a price unless you've already priced it, so recipes, batches and the
  ingredient list show the same costs.
- **Erase everything** also erases ingredients, then puts the starter
  ingredients back, like a fresh install.

### Fixed

- An amount with a unit but no quantity showed as just "lb".
- A 1 gallon sample batch cost a cent more per gallon than in total.

### Roadmap

- Milestones renumbered: v0.2 Ingredient library, v0.3 Equipment, v0.4 phone
  apps, v0.5 sync, v0.6 community.

**Updating from v0.1.2:** existing data carries over, and the app adds the
ingredient library on first start. Ingredients already in your recipes and
batches are matched to it by name, so they show under "Used in" and get a
cost once you price them.

## v0.1.2 – 2026-11-19

### Fermentation and the final gravity

- **The stage decides when fermentation is done** ([#26]). The "Fermentation
  is complete" checkbox and the Final gravity field are gone. Primary and
  Secondary are fermenting ("ABV so far"); Aging and Bottled are done ("ABV").
- **The final gravity is a timeline reading** ([#26]). Moving a batch from
  Primary or Secondary to Aging, or bottling it, asks for the final reading.
  Any gravity reading can also be ticked as the final gravity, and then those
  moves don't ask. A batch has one final gravity: ticking a newer reading
  replaces it. The final reading shows a Final badge and settles the ABV, so
  later readings don't change it.
- **Estimated ABV** ([#26]). With no final reading, an estimated ABV can be
  entered instead. It starts at the ABV so far, goes on the timeline as an
  "Estimated ABV" entry and shows with ≈. Deleting the entry, or logging a
  later reading, removes it.
- **Fermenting again** ([#26]). A step feeding or a backsweetening ticked
  "This will ferment" after the final reading warns that it will remove the
  Final tag. While Aging or Bottled, a ticked backsweetening offers to move the
  batch back to Secondary.
- **Fixed: backsweetening raised the ABV** ([#24]). Backsweetening that isn't
  set to ferment never adds to the ABV. Step feeding and ticked backsweetening
  only raise it once a later gravity reading shows them fermenting.

### Targets

- **Aim for an FG or an ABV** ([#27]). The Target field on batches and
  recipes has an FG / ABV switch. Aiming for an FG works as before: the target
  ABV rises with step feeding. Aiming for an ABV keeps it fixed and shows the
  FG it finishes at instead (OG 1.080 + 40 points fed, aiming for 14%,
  finishes around 1.013). Batches and recipes keep the choice when saved from
  one another.
- **Very dry finishes** ([#27]). Finishing between 0.990 and 1.000 counts as
  reachable ("drier than most meads get"). Below 0.990, it gives the range of
  sugar still needed, from finishing at 0.990 to finishing at 1.000
  ("needs 17–27 pts").
- **Potential follows a target below 1.000** ([#27]). With a target FG of
  0.995, Potential is worked out to 0.995 ("Potential 13.8% at 0.995")
  instead of showing a target higher than the potential.
- **Target reached** ([#27]). While fermenting, the batch page says so once
  the ABV gets to the target: a cue to stabilize.

### Other

- **No automatic Yeast pitched entry** ([#23]). Starting a batch no longer
  adds one; add it yourself from Add entry. Non-alcoholic brews never need it.

**Updating from v0.1.1:** existing data carries over. Final gravities entered
in the old field are no longer used; on batches that had one, log it as a
gravity reading and tick "Final gravity reading".

## v0.1.1 – 2026-11-18

### Batches

- **Archive batches** ([#17]). An Archive button moves a batch out of Active
  and Bottled into its own Archived filter, where it shows as a book. Unarchive
  returns it to the status it had.
- **Bottle in several sizes** ([#20]). Each line has a count, size and unit
  (mL, fluid ounce, US cup, pint and quart, liter, or a named container). The
  count defaults to the batch volume over the bottle size (1 gal at 750 mL
  gives 5). Each size becomes its own cellar entry, and one Bottled entry
  lists them all.
- **Per-record units** ([#14]). Batches, recipes and temperature entries can
  use gal or L and °F or °C, whatever the default. When they differ from the
  default, both values show: "20 °C (68 °F)".
- **Styles by type** ([#15]). Mead, beer and wine each have their own styles;
  cider and kombucha have no Style field; Other takes free text.
- **Icon suggestions** ([#15]). Picking an icon fills in the name and style
  while the name is empty: Maple gives "Maple Acerglyn".
- **Up to 3 icons and a custom color** ([#16]). The main icon sits in front
  with the others peeking out behind it, everywhere icons appear. The last
  color swatch opens the device's color picker.
- **Save a batch as a recipe** ([#12]), and update the recipe as the batch
  evolves, with a list of what will change.
- **Ingredients by stage** ([#10]): Primary, Secondary, Aging or Bottling.
  Ingredients for the current stage can be logged on the timeline with one
  tap, and the timeline is divided by stage.
- **Tasting and rating** ([#8]). Tastings can set the batch rating and name
  a taster; setting the batch rating logs an entry, one per day.
- **More timeline entries** ([#6]): Ingredient, stabilizing methods
  (including Nagardo), and ratings shown as a number in a star.
- **Step feeding and backsweetening count in the ABV** ([#3]).
- **Editable timeline and potential ABV** ([#1]). Any timeline entry can be
  edited or removed, a "Moved to" entry records where the batch went, and
  potential ABV shows as soon as there's an OG.

### Cellar

- **Edit and remove pours** ([#18]). Bottles left always follows.
- **Ask to archive after the last bottle** ([#19]). Pouring the last bottle
  of a bottled batch offers to archive it.
- **Cellar filters** ([#19]): In cellar (the default), Empty and All.

## v0.1.0

First release: a local-first mead and brew log that works offline as an
installable web app. Batches with a timeline, gravity chart and ABV; recipes;
a cellar with pours; shelf and list views; backup and restore; light and dark
themes; sample data.

[#1]: https://github.com/ChuckinBits/BrewHive/issues/1
[#3]: https://github.com/ChuckinBits/BrewHive/issues/3
[#6]: https://github.com/ChuckinBits/BrewHive/issues/6
[#8]: https://github.com/ChuckinBits/BrewHive/issues/8
[#10]: https://github.com/ChuckinBits/BrewHive/issues/10
[#12]: https://github.com/ChuckinBits/BrewHive/issues/12
[#14]: https://github.com/ChuckinBits/BrewHive/issues/14
[#15]: https://github.com/ChuckinBits/BrewHive/issues/15
[#16]: https://github.com/ChuckinBits/BrewHive/issues/16
[#17]: https://github.com/ChuckinBits/BrewHive/issues/17
[#18]: https://github.com/ChuckinBits/BrewHive/issues/18
[#19]: https://github.com/ChuckinBits/BrewHive/issues/19
[#20]: https://github.com/ChuckinBits/BrewHive/issues/20
[#23]: https://github.com/ChuckinBits/BrewHive/issues/23
[#24]: https://github.com/ChuckinBits/BrewHive/issues/24
[#26]: https://github.com/ChuckinBits/BrewHive/issues/26
[#27]: https://github.com/ChuckinBits/BrewHive/issues/27
[#31]: https://github.com/ChuckinBits/BrewHive/issues/31
[#32]: https://github.com/ChuckinBits/BrewHive/issues/32
[#33]: https://github.com/ChuckinBits/BrewHive/issues/33
[#35]: https://github.com/ChuckinBits/BrewHive/issues/35
[#36]: https://github.com/ChuckinBits/BrewHive/issues/36
[#38]: https://github.com/ChuckinBits/BrewHive/issues/38
[#41]: https://github.com/ChuckinBits/BrewHive/issues/41
[#44]: https://github.com/ChuckinBits/BrewHive/issues/44
[#46]: https://github.com/ChuckinBits/BrewHive/issues/46
[#49]: https://github.com/ChuckinBits/BrewHive/issues/49
