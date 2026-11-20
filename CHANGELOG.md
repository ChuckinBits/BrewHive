# Changelog

All notable changes to BrewHive are listed here. Versions follow the roadmap:
minor versions are milestones (0.2 Ingredient library, 0.3 Equipment, 0.4
phone apps, 0.5 sync, 0.6 community) and patch versions are releases within
a milestone.

## Unreleased (v0.2.0)

### Ingredient library

- **Your ingredients** ([#31]). More → Ingredients lists the ingredients you
  use by category, with a search box and category chips. Each has a default
  unit and notes, and shows the recipes and batches that use it. It starts
  with common mead-making staples (honeys, yeasts, nutrients, stabilizers
  including Nagardo, fining agents), with no prices. "Restore starter
  ingredients" at the bottom of the list brings back any you deleted, leaving
  your own ingredients and prices alone.
- **Categories** ([#31]): Honey, Fruit, Juice & concentrate, Sweeteners,
  Spices, Herbs & flowers, Yeast, Nutrients, Additives, Fining & clarifiers,
  Oak & wood, Grains & malt, Hops and Other. Rename them, add your own, or
  remove one (its ingredients move to Other). Put them in order with Sort A–Z
  (Other stays last) or by dragging the ≡ handle (or its arrow keys); the order
  is used for the category chips and the sections of the list.
- **Pick from the list** ([#32]). Adding an ingredient to a recipe or batch
  shows your list as you type, with category chips. Picking one fills in its
  default unit. A name that isn't on the list can be used once, or saved
  with "Save as a new ingredient", which opens the New ingredient form
  (category, default unit, cost) on top of what you're writing and picks it
  when saved.
- **Timeline ingredient entries** ([#35]) use the same form: pick from your
  ingredients, quantity and unit, the cost hint, with When in place of Stage.
  An entry and the batch ingredient it logged stay in step: editing the
  entry offers "Also update batch ingredients", and editing the ingredient
  in Batch Edit offers "Also update the timeline entry", both ticked.
  Removing a batch ingredient keeps its timeline entry.
- **Fixed:** an amount with a unit but no quantity showed as just "lb".
- **Costs** ([#33]). Give an ingredient what you paid ("24.99 for 12 lb") and
  batches and recipes show their ingredient cost: the total, per 750 mL
  bottle and per gallon or liter. On a batch it's part of Details; recipes
  show it under their ingredients. A batch keeps the prices it was made with;
  recipes use today's. Choose the currency under More.

### Sample data and erasing

- **Sample data uses the library.** Its recipes and batches use the starter
  ingredients plus five of their own (spring water, blackberries,
  strawberries, cloves, oranges) with prices. Sample batches carry what they
  paid, so they show a full cost; your own ingredients and the starter
  ingredients are never priced or changed.
- **Erase everything** now also erases ingredients, and puts the starter
  ingredients back, like a fresh install.

### Batches

- **Details first.** The Details section (volume, start date, recipe and now
  cost) moves above Ingredients, as the overview of the batch, and always
  shows.

### Roadmap

- Milestones renumbered: v0.2 Ingredient library, v0.3 Equipment, v0.4 phone
  apps, v0.5 sync, v0.6 community.

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
