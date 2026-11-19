# Changelog

All notable changes to BrewHive are listed here. Versions follow the roadmap:
minor versions are milestones (0.2 Equipment, 0.3 phone apps, 0.4 sync,
0.5 community) and patch versions are releases within a milestone.

## Unreleased

- **Aim for an FG or an ABV** ([#27]). The Target field on batches and
  recipes has an FG / ABV switch. Aiming for an FG works as before: the
  target ABV rises with step feeding. Aiming for an ABV keeps it fixed and
  shows the FG it finishes at instead (OG 1.080 + 40 points fed, aiming for
  14%, finishes around 1.013). Finishing between 0.990 and 1.000 is fine
  ("drier than most meads get"); below 0.990 it says how many more points of
  sugar it needs.
- **Potential follows a target below 1.000** ([#27]). With a target FG of
  0.995, Potential is worked out to 0.995 ("Potential 13.8% at 0.995")
  instead of showing a target higher than the potential. While fermenting, the batch page says "Target reached"
  once the ABV gets there. Batches and recipes keep the choice when saved
  from one another.
- **The stage decides when fermentation is done** ([#26]). The "Fermentation
  is complete" checkbox and the Final gravity field are gone. Moving a batch
  from Primary or Secondary to Aging, or bottling it, asks for the final
  reading, which goes on the timeline as a gravity reading marked Final.
  Any gravity reading can be ticked as the final gravity (only one per batch;
  a newer one replaces it), and then those moves don't ask. Without a
  reading, an estimated ABV can be entered instead (it starts at the ABV so
  far). It goes on the timeline as an "Estimated ABV" entry and shows with ≈;
  deleting the entry or logging a later reading removes it. The final reading
  settles the ABV: later readings don't change it, and a step feeding or
  ticked backsweetening after it warns that it will remove the Final tag. A backsweetening ticked "This will ferment"
  after fermentation is done offers to move the batch back to Secondary.
  Final gravities entered in the old field are no longer used: log them as
  a reading.
- **No automatic Yeast pitched entry** ([#23]). Starting a batch no longer adds
  one; add it yourself from Add entry. Non-alcoholic brews never need it.
- **Fixed: backsweetening raised the ABV** ([#24]). Backsweetening that isn't
  set to ferment no longer adds to the ABV, even when fermentation was marked
  complete after it was logged. Step feeding and backsweetening ticked to
  ferment add to the ABV only once a later gravity reading (or a final gravity
  entered after them) shows them fermenting.

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
