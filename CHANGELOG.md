# Changelog

All notable changes to BrewHive are listed here. Versions follow the roadmap:
minor versions are milestones (0.2 Ingredient library, 0.3 Equipment, 0.4
phone apps, 0.5 sync, 0.6 community) and patch versions are releases within
a milestone.

## Unreleased

### Equipment

- **Alike vessels on one line.** Vessels of the same type and size are
  grouped, such as "1 gal carboy · 8 vessels · 4 of 8 free". Tap the line to
  see each one and the batch in it. A vessel with no twin stays on its own
  line.
- **What it cost.** The Equipment screen totals what your vessels and other
  gear cost, and both together, and says how many have no price.
- **Add several alike at once.** Add vessel has a **How many** box: eight
  1 gal carboys in one go, each its own vessel, numbered "1 gal carboy 1" to
  "8" (or after your own name). Adding more later carries on the numbers.
- **Gear you have several of.** Add gear has a **How many** box too, but
  gear stays one line with its count, such as "Airlock × 10", priced each.
  The totals count every one, and editing changes the count.
- **Price each or in total.** When there's more than one, an **Each /
  Total** switch sits beside the price. Bought eight carboys for $119.92?
  Pick Total and type that: it works out $14.99 each for you. Switching
  carries the number across.
- **Sort your vessels** by Type (carboys, buckets, jars…, smallest first),
  Size (smallest first, whatever the type), Name, or Free first (the lines
  with the most free vessels at the top). Your choice is remembered.
- **Jug is now Jar.** Vessels saved as jugs become jars. Names you typed stay
  as they are.

## v0.3.1 – 2026-11-26

### Equipment

- **A batch in several vessels.** Racking can go into more than one vessel:
  pick the first, then **Add another vessel**. Each gets an amount, filled
  in the order you picked them (2 gal into two 1 gal jugs is 1 + 1), and you
  can change the amounts. If they add up to less than the batch, say lees
  left behind, the batch's volume becomes what went in. The batch page lists
  each vessel with its own headspace, and the timeline says "Racked into Jug
  B and Jug C". Removing that entry puts the batch, and its volume, back.

### Splitting batches

- **Split a batch into sub-batches.** After racking into several vessels,
  BrewHive asks whether to make sub-batches. Keep it one batch, or split it so
  each vessel becomes a batch of its own, named "Bramble Melomel #2 A", "… B"
  (rename them as you like).
- **Each sub-batch keeps the history.** Its timeline starts with the batch's
  entries up to the split (tap one to open the batch it belongs to), so its
  OG, readings and ABV carry on. From there it has its own readings, stages,
  tastings and rating. Ingredients, and so costs, are divided by volume.
- **The batch is marked Split.** It shows which sub-batches it became, leaves
  the Active list (find it under All), and keeps its history.
- **Undo split** is offered until something is logged on a sub-batch: they
  go, and the batch carries on in their vessels.
- Racking into several vessels now says when one would get nothing ("Nothing
  goes in 5 gal carboy"), as filling in order can leave the last empty.

**Updating from v0.3.0:** nothing to do. Batches keep the vessel you gave
them, and you can add more when you next rack.

## v0.3.0 – 2026-11-26

### Equipment

- **An Equipment screen** under More, with two lists. **Vessels**:
  carboys, buckets, jugs, kegs, barrels and tanks, each with a capacity,
  what it cost and notes. Leave a vessel unnamed and it's called by its size
  and type, such as "5 gal carboy". **Other gear**: hydrometers, siphons, pH
  meters, whatever you'd like a list of, with notes and prices.
- **See what's in each vessel.** The list shows which batch each vessel
  holds, or that it's free, and how many are free. A batch leaves its vessel
  when it's bottled or archived.
- **Batches have a vessel.** Pick one when you start a batch, or change it
  on the batch's form. Picking one that's too small, or that already holds
  another batch, warns you. The batch page shows the vessel and the headspace
  left in it, such as "0.5 gal headspace (10%)".
- **Racking moves the batch.** Moving a batch to Secondary asks which vessel
  it was racked into, and a Racked entry from Add entry asks the same. The
  timeline says where it went ("Racked into Jug B"), the old vessel is free
  again, and removing the entry puts the batch back where it was.
- Without vessels, nothing changes: the vessel fields and questions only
  appear once you've added one. Backups include your equipment.

**Updating from v0.2.9:** nothing to do. Add your vessels under More →
Equipment, then pick one on each batch that's still fermenting or aging.

## v0.2.9 – 2026-11-26

### Ratings

- **No more accidental ratings.** On batch, recipe and bottle pages the
  rating is shown, not edited in place: a finger landing on the old slider
  while scrolling changed it. Tap **Rate** (or **Change**) to open a sheet
  with the slider, and nothing is saved until **Save**. The tasting and pour
  forms keep their slider, since those save together with the rest of the
  form.
- **Editing the Batch rating entry changes the batch rating.** If it's the
  entry the batch's current rating came from (the latest one), changing it on
  the timeline changes the batch rating too. An older entry, or one a tasting
  has since replaced, only changes the timeline, and the form says which.
  Removing a Batch rating entry never clears the batch rating.
- **Recipes carry the batch rating.** Saving a batch as a recipe gives the
  recipe the batch's rating. Rate the batch again later and **Update recipe**
  lists the change ("Rating 7 → 8.5") and applies it. A batch started from a
  recipe starts unrated, and updating the recipe from an unrated batch keeps
  the recipe's rating.
- **Pick what Update recipe changes.** Every change in the Update recipe
  sheet has a checkbox, all ticked to start. Untick any you want to leave as
  the recipe has it, such as a rating or one ingredient, and the button says
  how many changes it will make. What you leave out is offered again next
  time.

**Updating from v0.2.8:** nothing to do. Recipes you saved before keep their
rating; the next Update recipe from a rated batch offers its rating.

## v0.2.8 – 2026-11-25

### Batch page

- **ABV is the highlighted number.** The accent color moves from Potential
  to ABV (or ABV so far), the number you actually have.
- **Potential shows only while fermenting.** In Primary and Secondary it
  still shows where the batch is heading and any target. From Aging on the
  batch is done, and its place goes to Now (below). Backsweetening that you
  expect to ferment moves the batch back to Secondary, and Potential comes
  back with it.
- **How sweet it is.** While fermenting, the Gravity tile says how sweet the
  mead would be if it stopped there (Dry, Semi-sweet, Sweet or Dessert), for
  stopping early at the sweetness you want. From Aging on, the fourth tile is
  **Now**: the gravity in the batch now and its sweetness. After
  backsweetening it differs from the FG, which stays where fermentation
  ended. Backsweetened entries, the final reading, and readings after
  stabilizing or backsweetening show their sweetness on the timeline too.
- **Stabilizing ends fermentation.** Adding a Stabilized entry in Primary or
  Secondary offers to move the batch to Aging and log the final reading, or
  to keep it where it is.
- **Sugar goes in at once on the chart.** A step feeding, or backsweetening
  that will ferment, is drawn straight up on its day instead of as a slow
  climb from the reading before. Only fermentation slopes.

### Fixes

- **Unticking "This will ferment" brings the FG back.** Ticking it on
  backsweetening after the final reading took the Final mark off that reading
  for good, so unticking left the FG at the backsweetened gravity. The mark
  now stays: while sugar that will ferment follows it, the reading just
  doesn't count as final, and unticking or deleting that entry makes it count
  again. A reading that already lost its mark this way needs "Final gravity"
  ticked again once.
- **No more blank screens.** If the browser's storage doesn't answer,
  BrewHive now says so after 10 seconds, with the browser's reason and what
  usually fixes it: another BrewHive tab, even one paused in the background,
  can hold on to the storage, so close the others or restart the browser.
  Before, the page just stayed blank. A screen that fails to draw shows the
  error and a Reload button instead of blanking the whole app, and Erase
  everything says so if it can't finish.

**Updating from v0.2.7:** nothing to do. If a batch's FG jumped to its
backsweetened gravity after you ticked and unticked "This will ferment", open
its final reading and tick "Final gravity" again.

## v0.2.7 – 2026-11-24

### Behind the scenes

- **Vite 8.** The app is built with Vite 8 (Rolldown and Oxc) and its React
  plugin v6. Builds take a fraction of a second, and the app's code is a
  little smaller. The build targets Chrome and Edge 111, Firefox 114 and
  Safari 16.4 or newer, Vite's default. Nothing you'd see changes: the
  styles already needed iOS 16.2 or newer for their full look.
- **TypeScript 7.** Type checks run on TypeScript 7, the native compiler,
  and finish several times faster. It no longer picks up Node's types on its
  own, so the config names them for the tests.

**Updating from v0.2.6:** nothing to do. Existing data carries over and the
app looks and works the same.

## v0.2.6 – 2026-11-24

### Fixes

- **Restoring a backup keeps your ingredient edits.** Restoring onto a new
  device, or after Erase everything, quietly undid changes to the starter
  ingredients: prices you'd set were dropped, starters you'd deleted came
  back, and metric default units went back to US. The fresh starters made at
  install looked newer than your backup and won. An untouched starter now
  always gives way to the backup.
- **Dates in your time zone.** A backup file was named for the UTC date, a
  day ahead on an American evening, and so was a recipe's "Updated from …
  on" date. Both use your local date now.
- **Removing the latest stage change moves the batch back.** Removing, say,
  the "Moved to Secondary" entry takes the batch back to the stage before,
  so its stage matches its timeline; the confirmation says where it goes.
  Removing an earlier stage change only removes it from the history.
- **Bottling more than the batch holds** gets a note ("That's more than this
  batch holds"), so a mistyped count is easy to catch. It doesn't stop you.
- **Long names show in full.** A batch's, recipe's or bottle's name at the
  top of its page wraps to up to three lines instead of being cut off.

### Look

- **The app's fonts are bundled.** Inter (text) and Bricolage Grotesque
  (headings) now ship with the app, so every device shows them, offline too.
  Before, they only appeared where they happened to be installed, and most
  phones fell back to their own system font.
- **Filters stay on one line.** With Inter, the Batches filters (Active,
  Bottled, Archived, All) were a little too wide and All wrapped to a second
  line on phones up to 390 px. They're slightly more compact now and fit from
  375 px; on narrower phones the row scrolls sideways instead of wrapping.

### Safety

- **Backups are checked before restoring.** Each record is checked for the
  fields BrewHive needs; one that can't be used is skipped and counted
  ("Skipped 3 records that couldn't be read"), and loose ends such as a
  number saved as text are tidied. Settings that don't make sense keep this
  device's value. A damaged or hand-edited backup can no longer break a page.
- **Content-Security-Policy.** The built app only allows its own files, so
  nothing that slipped into a page could load a script or send data
  anywhere.

### Behind the scenes

- Pull requests are checked (types, unit tests and a build) before merging,
  and the deploy checks types too.
- A "Update lockfile" workflow writes package-lock.json, so every build
  installs exactly the package versions that were tested.
- The workflows use the Node 24 versions of GitHub's actions, CI fails if
  the built page is missing its Content-Security-Policy, and Dependabot
  proposes package and action updates weekly (minor and patch updates
  grouped, each major version on its own).
- **Browser checks in the repo.** The 46 checks that drive the app in a
  headless browser now live in `checks/`, run with `npm run checks`, and run
  on every pull request.
- The batch page's code is split into one file per sheet
  (`src/screens/batch/`), and dead code and unused styles are removed. No
  change in behavior.
- The browser checks wait for what they expect instead of reading the page
  the instant after a save, so slower machines don't make them flaky.

**Updating from v0.2.5:** existing data carries over. If you restored a
backup onto a new device with an earlier version and your ingredient prices
or units went missing, restore the same backup again: this version brings
them back.

## v0.2.5 – 2026-11-24

### Ingredients card

- **Log any earlier stage.** Ingredients not yet logged can be tapped in
  the batch's current stage or any earlier one, so a Bottled batch can
  still log a Secondary ingredient. Later stages stay locked.
- **Asks when.** Tapping an ingredient opens a small sheet with When:
  primary ingredients (nutrients too) start at the batch start date,
  everything else at now.
- **Move to the next stage.** The next stage's ingredients show a
  "Move to Secondary" (Aging, Bottled) button. It moves the batch and adds
  the stage change to the timeline, as the stage buttons do, asking for the
  final reading or bottles where they would.
- **Hide Add.** Under Edit on the Ingredients card, "Hide Add" hides the
  + Add buttons on every batch, for keeping the list without logging it on
  the timeline. "Show Add" brings them back. Hide Add and the "Tap an
  ingredient" hint only show while something is left to log.

### Cost

- **Shorter "not counted" line.** Ingredients left out of the cost are
  grouped by why: "No cost: Cinnamon sticks, Oak cubes." in place of
  "Not counted: Cinnamon sticks (no cost), Oak cubes (no cost)." Lines for
  "No amount" and "Cost in other units" follow when they apply.

**Updating from v0.2.4:** existing data carries over. Ingredients already
logged keep their dates; Hide Add starts off.

## v0.2.4 – 2026-11-23

### Add entry

- **Icons instead of a list** ([#57]). What happened? is a grid of icon
  buttons, most used first: Gravity, Ingredient, Tasting, Note, Stage
  change and so on. Estimated ABV moved into Gravity: "No reading? Enter an
  estimated ABV", as when finishing a batch.
- **Fining, Nutrients and Yeast pitched are Ingredient entries.** Pick the
  ingredient and the entry takes its title and icon from the ingredient's
  category: "Fining: Gelatin finings 2 tsp", "Nutrients: Fermaid O 2 g",
  "Yeast pitched: Lalvin 71B 1 packet". Other ingredients read "Added …"
  with their category's icon. Older entries of those three types keep
  showing as they are.

### Timeline

- **Stage changes on the timeline only move forward.** Add entry → Stage
  change starts on the stage after the timeline's latest (Secondary when it
  only has Primary entries, Aging after Secondary, and so on). It moves the
  batch only when that's later than its current stage; filling in a past
  brew's history leaves a Bottled batch in Bottled. The stage buttons at the
  top still move a batch back.
- **A Stage for ingredients added from the timeline** ([#61]). An
  Ingredient entry with "Add to batch ingredients" ticked has a Stage field.
  It starts on Secondary when the batch was in Secondary on the entry's
  date, and on Primary otherwise, so a past brew's honey no longer lands in
  Bottling. Pick another stage to override it.
- **OG and FG in Primary** ([#63]). A batch created in Secondary, Aging
  or Bottled, with no stage changes on its timeline, shows everything up to
  its FG (its OG, without one) under Primary, and later entries in the stage
  it's in. Additions and readings dated on the start date no longer split
  Primary with a Bottled section.
- **Winter Spice sample** records its move to Secondary, so its timeline
  reads Primary, Secondary, Aging. Load the sample data again to see it.

**Updating from v0.2.3:** existing data carries over. Fining, Nutrients and
Yeast pitched entries already saved keep their titles and icons.

## v0.2.3 – 2026-11-22

### Ingredients

- **Fractions in quantities** ([#52]). Type 1/2, 1 1/2 or ½ for an amount;
  it's priced and scaled like 0.5 or 1.5.
- **Price paid** ([#55]). Batch Edit's ingredient sheet asks what you paid
  and for how much, starting from the price saved with the line or your
  ingredients' price. "Also update the price in your ingredients" saves it
  to your list too; it's ticked when your list has no price yet.
- **Edit ingredients** ([#53]). The Edit button on a batch's Ingredients
  card opens Batch Edit at the Ingredients section.
- **Primary ingredients log at the start date** ([#56]). Tapping a primary
  ingredient to log it dates the entry when the batch was started, since
  that's when it went in. Nutrients, which are usually staggered, and later
  stages still log now.

### Timeline

- **Stage change starts on the next stage.** Picking Stage change in Add
  entry shows "Move to", set to the stage after the batch's current one.
- **Pasteurization temperature and time** ([#54]). Stabilized with
  Pasteurization asks the temperature (in your °F/°C setting) and how many
  minutes, both optional, and reads "Pasteurization · 160 °F for 15 min".

**Updating from v0.2.2:** existing data carries over. Prices already saved
with a batch's ingredients show as its price paid.

## v0.2.2 – 2026-11-21

### Fermentation

- **Fermentation progress in Details** ([#49]): attenuation (how much of
  the sugar has fermented), the fermentation rate in points per day between
  the last two readings, and about how many days to the target FG (1.000
  without one) at that rate. The rate and days show while fermenting.
- **Sweetness** ([#49]). Typing the gravity after backsweetening shows how
  sweet it is: Dry, Semi-sweet, Sweet or Dessert, by the BJCP mead ranges.
  The Target field on batches and recipes shows it too, for the target FG
  or the FG an ABV target finishes at.
- **Backsweetening off the chart** ([#49]). A backsweetening reading is
  charted only when ticked "This will ferment".

### Timeline

- **Stage change entries** ([#49]). Add entry has Stage change: pick the
  stage and when. The newest stage change moves the batch to it (moving to
  Aging or Bottled asks for the final reading); an earlier one only records
  when it happened, for logging a past brew.
- **Relocate** ([#49]). The "Moved to" entry for where a batch is kept is
  now Relocate, shown as "Relocated to Basement", so it isn't mistaken for
  a stage change.

**Updating from v0.2.1:** existing data carries over; nothing changes in how
it's saved.

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
[#52]: https://github.com/ChuckinBits/BrewHive/issues/52
[#53]: https://github.com/ChuckinBits/BrewHive/issues/53
[#54]: https://github.com/ChuckinBits/BrewHive/issues/54
[#55]: https://github.com/ChuckinBits/BrewHive/issues/55
[#56]: https://github.com/ChuckinBits/BrewHive/issues/56
[#57]: https://github.com/ChuckinBits/BrewHive/issues/57
[#61]: https://github.com/ChuckinBits/BrewHive/issues/61
[#63]: https://github.com/ChuckinBits/BrewHive/issues/63
