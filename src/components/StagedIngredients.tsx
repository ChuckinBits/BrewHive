// A batch's ingredients, grouped under a divider for each stage they go in.
// Used two ways:
// - In the batch form, each ingredient opens the ingredient sheet to edit it.
// - On the batch page, ingredients for the current stage can be tapped to log
//   them on the timeline; ones already logged show when they went in.

import { useId, useState } from 'react';
import { categoriesOf, currencyOf, ingredients, useQuery, useSettings } from '../db/store.ts';
import { costOf, fmtMoney } from '../lib/cost.ts';
import { INGREDIENT_STAGES, INGREDIENT_UNITS, unitLabel, type BatchEvent, type IngredientLine, type IngredientStage, type LibraryIngredient } from '../db/types.ts';
import { Icon } from '../icons/Icon.tsx';
import { fmtDateShort, fmtDateTime, newId, parseNum } from '../lib/format.ts';
import { categoryOf, filterIngredients } from '../lib/library.ts';
import { groupByStage, ingredientStageLabel, joinAmount, splitAmount } from '../lib/stages.ts';
import { CategoryChips, LibrarySheet } from '../screens/Ingredients.tsx';
import { Field, Sheet, toast } from './ui.tsx';

interface EditableProps {
  lines: IngredientLine[];
  onEdit: (line: IngredientLine) => void;
}

/** In the batch form: every ingredient opens for editing. */
export function EditableIngredients({ lines, onEdit }: EditableProps) {
  return (
    <div className="staged-ingredients">
      {groupByStage(lines).map((group) => (
        <section key={group.stage} aria-label={`${ingredientStageLabel(group.stage)} ingredients`}>
          <h3 className="stage-divider">{ingredientStageLabel(group.stage)} ingredients</h3>
          <ul className="staged-list">
            {group.lines.map((line) => (
              <li key={line.id}>
                <button type="button" className="staged-row" onClick={() => onEdit(line)}>
                  <span className="staged-name">{line.name}</span>
                  <span className="muted">{line.amount}</span>
                  <span className="staged-action staged-action-quiet">
                    <Icon name="edit" size={18} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

interface LoggableProps {
  lines: IngredientLine[];
  /** The stage whose ingredients can be logged, or null when none can (a planned batch). */
  current: IngredientStage | null;
  /** The timeline entry that logged each ingredient, by line id. */
  added: Map<string, BatchEvent>;
  onLog: (line: IngredientLine) => void;
}

/** Read-only, as on a recipe: grouped by stage, nothing to tap. */
export function IngredientsByStage({ lines }: { lines: IngredientLine[] }) {
  return <LoggableIngredients lines={lines} current={null} added={new Map()} onLog={() => {}} />;
}

/** On the batch page: ingredients for the current stage can be tapped to log them on the timeline. */
export function LoggableIngredients({ lines, current, added, onLog }: LoggableProps) {
  return (
    <div className="staged-ingredients">
      {groupByStage(lines).map((group) => {
        const isCurrent = group.stage === current;
        return (
          <section key={group.stage} aria-label={`${ingredientStageLabel(group.stage)} ingredients`}>
            <h3 className={isCurrent ? 'stage-divider stage-divider-current' : 'stage-divider'}>
              {ingredientStageLabel(group.stage)} ingredients
              {isCurrent && <span className="stage-now">Now</span>}
            </h3>
            <ul className="staged-list">
              {group.lines.map((line) => {
                const entry = added.get(line.id);
                if (entry) {
                  return (
                    <li key={line.id}>
                      <div className="staged-row staged-row-done">
                        <span className="staged-name">{line.name}</span>
                        <span className="muted">{line.amount}</span>
                        <span className="staged-action staged-action-done" aria-label={`Added ${fmtDateShort(entry.date)}`}>
                          <Icon name="check" size={16} />
                          {fmtDateShort(entry.date)}
                        </span>
                      </div>
                    </li>
                  );
                }
                if (isCurrent) {
                  return (
                    <li key={line.id}>
                      <button type="button" className="staged-row staged-row-open" onClick={() => onLog(line)} aria-label={`Log ${line.name} as added`}>
                        <span className="staged-name">{line.name}</span>
                        <span className="muted">{line.amount}</span>
                        <span className="staged-action staged-action-add">
                          <Icon name="plus" size={16} />
                          Add
                        </span>
                      </button>
                    </li>
                  );
                }
                return (
                  <li key={line.id}>
                    <div className="staged-row">
                      <span className="staged-name">{line.name}</span>
                      <span className="muted">{line.amount}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** What the ingredient fields hold: the same for a batch's ingredient and a timeline entry. */
export interface IngredientValue {
  name: string;
  quantity: string;
  unit: string;
  amount: string;
  ingredientId?: string;
}

/**
 * The ingredient fields: pick from your ingredients (or type a new one, with "Save to my ingredients"),
 * quantity and unit, and the cost hint. Returns the fields, the "Your ingredients" sheet to render
 * outside the form, and `commit`, which saves a new name to the library if asked and gives the value.
 */
export function useIngredientFields(start: { name: string; amount: string; quantity?: string; unit?: string; ingredientId?: string } | null, defaultUnit: string) {
  const initial = start ? splitAmount({ id: '', name: start.name, amount: start.amount, quantity: start.quantity, unit: start.unit }) : { quantity: '', unit: defaultUnit };
  const [name, setName] = useState(start?.name ?? '');
  const [quantity, setQuantity] = useState(initial.quantity);
  const [unit, setUnit] = useState(initial.unit);
  const formId = useId();

  // The ingredient library: pick from it, or save a new name to it.
  const settings = useSettings();
  const categories = categoriesOf(settings);
  const library = useQuery(() => ingredients.list()) ?? [];
  const [linkedId, setLinkedId] = useState(start?.ingredientId);
  const [picking, setPicking] = useState(false);
  const [pickCategory, setPickCategory] = useState<string | null>(null);
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [newCategory, setNewCategory] = useState('other');
  const [libraryOpen, setLibraryOpen] = useState(false);
  // The library item this name is: the one picked, or one with exactly this name.
  const match =
    library.find((i) => i.id === linkedId && i.name.trim().toLowerCase() === name.trim().toLowerCase()) ??
    library.find((i) => i.name.trim().toLowerCase() === name.trim().toLowerCase());
  const isNew = name.trim() !== '' && !match;
  // A name already picked from the list shows the whole list again, to switch to another.
  const suggestions = filterIngredients(library, match ? '' : name, pickCategory, categories);
  // Offer to save a new name only once it's clearly new: nothing in the list matches, or the list is closed.
  // (Typing "clov" on the way to Clover honey shouldn't ask.) Only a choice that was shown gets saved.
  const offerSave = isNew && (!picking || suggestions.length === 0);

  const pick = (item: LibraryIngredient) => {
    setName(item.name);
    setLinkedId(item.id);
    // Its default unit, unless this already has an amount in another unit.
    if (!quantity.trim() || !start) setUnit(item.defaultUnit);
    setPicking(false);
  };
  // Keep a unit from an older entry selectable even if it is not in the usual list.
  const units = INGREDIENT_UNITS.some((u) => u.id === unit) ? INGREDIENT_UNITS : [...INGREDIENT_UNITS, { id: unit, name: unit }];

  const commit = async (): Promise<IngredientValue> => {
    let ingredientId = match?.id;
    if (offerSave && saveToLibrary) {
      // A new name, saved for next time with this unit as its default.
      const saved = await ingredients.save({ name: name.trim(), category: newCategory, defaultUnit: unit, notes: '' });
      ingredientId = saved.id;
      toast(`${saved.name} added to your ingredients`);
    }
    return { name: match ? match.name : name.trim(), quantity: quantity.trim(), unit, amount: joinAmount(quantity, unit), ...(ingredientId ? { ingredientId } : {}) };
  };

  const fields = (
    <>
      <Field label="Ingredient">
        <input
          type="text"
          value={name}
          placeholder="Wildflower honey"
          autoFocus={!start}
          autoComplete="off"
          role="combobox"
          aria-expanded={picking}
          aria-controls={`${formId}-list`}
          onFocus={() => setPicking(true)}
          onClick={() => setPicking(true)}
          onChange={(e) => {
            setName(e.target.value);
            setPicking(true);
          }}
        />
      </Field>
      {picking && (
        <div className="picker">
          <CategoryChips categories={categories} value={pickCategory} onChange={setPickCategory} />
          <ul className="picker-list" id={`${formId}-list`} role="listbox" aria-label="Your ingredients">
            {suggestions.map((item) => (
              <li key={item.id} role="option" aria-selected={item.id === match?.id}>
                <button type="button" className="picker-row" onClick={() => pick(item)}>
                  <span className="library-name">{item.name}</span>
                  <span className="muted">{categoryOf(item, categories).label}</span>
                </button>
              </li>
            ))}
            {suggestions.length === 0 && <li className="muted picker-empty">{name.trim() ? `No ingredient called "${name.trim()}" yet.` : 'No ingredients here yet.'}</li>}
          </ul>
          <div className="picker-foot">
            <button type="button" className="btn btn-quiet btn-small" onClick={() => setLibraryOpen(true)}>
              Your ingredients
            </button>
            <button type="button" className="btn btn-quiet btn-small" onClick={() => setPicking(false)}>
              Close list
            </button>
          </div>
        </div>
      )}
      {offerSave && (
        <div className="save-to-library">
          <label className="check-field">
            <input type="checkbox" checked={saveToLibrary} onChange={(e) => setSaveToLibrary(e.target.checked)} />
            Save to my ingredients
          </label>
          {saveToLibrary && (
            <Field label="Category">
              <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      )}
      <div className="form-pair">
        <Field label="Quantity">
          <input type="text" inputMode="decimal" value={quantity} placeholder="3" onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <Field label="Unit">
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {unitLabel(u)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {match?.cost && quantity.trim() !== '' && (
        <p className="field-hint">
          {costOf(parseNum(quantity) ?? 0, unit, match.cost) != null
            ? `About ${fmtMoney(costOf(parseNum(quantity) ?? 0, unit, match.cost) as number, currencyOf(settings))} at your price for ${match.name}.`
            : `Its cost is in ${match.cost.unit || 'a count'}, so this amount isn't priced.`}
        </p>
      )}
    </>
  );
  const sheet = libraryOpen ? <LibrarySheet onClose={() => setLibraryOpen(false)} /> : null;
  return { fields, sheet, name, commit };
}

/** "Nov 3, 2:15 PM" for one timeline entry, or "the 2 timeline entries". */
export function loggedLabel(logged: BatchEvent[]): string {
  return logged.length === 1 ? `the timeline entry (${fmtDateTime(logged[0].date)})` : `the ${logged.length} timeline entries`;
}

interface SheetProps {
  /** The ingredient being edited, or null to add one. */
  line: IngredientLine | null;
  /** The stage a new ingredient starts in. */
  defaultStage: IngredientStage;
  /** The unit a new ingredient starts with. */
  defaultUnit: string;
  /** Timeline entries that logged this ingredient, offered to update along with it. */
  logged?: BatchEvent[];
  /** Whether those entries were already set to follow (from an earlier edit before saving). */
  syncLogged?: boolean;
  onSave: (line: IngredientLine, syncLogged: boolean) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

/** Adds or edits one ingredient: what it is, how much, and which stage it goes in. */
export function IngredientSheet({ line, defaultStage, defaultUnit, logged = [], syncLogged = true, onSave, onRemove, onClose }: SheetProps) {
  const ingredient = useIngredientFields(line, defaultUnit);
  const [stage, setStage] = useState<IngredientStage>(line?.stage ?? (line ? 'primary' : defaultStage));
  const [sync, setSync] = useState(syncLogged);
  const [error, setError] = useState('');

  const save = async () => {
    if (!ingredient.name.trim()) return setError('Enter the ingredient, such as Wildflower honey.');
    const value = await ingredient.commit();
    // The line keeps the price it was saved with, unless it's now another ingredient.
    const cost = line?.cost && line.ingredientId === value.ingredientId ? line.cost : undefined;
    onSave({ id: line?.id ?? newId(), ...value, stage, ...(cost ? { cost } : {}) }, logged.length > 0 && sync);
    onClose();
  };

  return (
    <Sheet title={line ? 'Edit ingredient' : 'Add ingredient'} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {ingredient.fields}
        <Field label="Stage" hint="What stage this ingredient goes in.">
          <select value={stage} onChange={(e) => setStage(e.target.value as IngredientStage)}>
            {INGREDIENT_STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        {logged.length > 0 && (
          <label className="check-field">
            <input type="checkbox" checked={sync} onChange={(e) => setSync(e.target.checked)} />
            Also update {loggedLabel(logged)}
          </label>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block">
          {line ? 'Save ingredient' : 'Add ingredient'}
        </button>
        {line && (
          <button
            type="button"
            className="btn btn-danger-quiet btn-block"
            onClick={() => {
              onRemove(line.id);
              onClose();
            }}
          >
            <Icon name="trash" size={20} />
            Remove ingredient
          </button>
        )}
      </form>
      {ingredient.sheet}
    </Sheet>
  );
}
