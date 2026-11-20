// The ingredient library (More → Ingredients): what you use, by category, with
// a default unit for each. Picked from when adding ingredients to a recipe or batch.

import { useEffect, useRef, useState } from 'react';
import { ConfirmSheet, Fab, Field, Sheet, TopBar, toast } from '../components/ui.tsx';
import { batches, categoriesOf, currencyOf, ingredients, recipes, restoreStarterIngredients, saveSettings, useQuery, useSettings } from '../db/store.ts';
import { INGREDIENT_UNITS, unitLabel, type IngredientCategory, type IngredientCost, type LibraryIngredient } from '../db/types.ts';
import { categoryOf, filterIngredients, lineIsIngredient, moveItem, sortCategories } from '../lib/library.ts';
import { fmtMoney, pricePer, unitsCompatible } from '../lib/cost.ts';
import { parseNum } from '../lib/format.ts';
import { Icon } from '../icons/Icon.tsx';
import { newId, plural } from '../lib/format.ts';
import { Link, navigate } from '../lib/router.tsx';

/** "$2.08 / lb" when it has a cost (per its default unit if that converts), otherwise its default unit. */
function priceLabel(item: LibraryIngredient, currency: string): string {
  if (!item.cost) return item.defaultUnit || 'count';
  const unit = unitsCompatible(item.defaultUnit, item.cost.unit) ? item.defaultUnit : item.cost.unit;
  const per = pricePer(unit, item.cost);
  return per == null ? item.defaultUnit || 'count' : `${fmtMoney(per, currency)} / ${unit || 'each'}`;
}

export function CategoryChips({
  categories,
  value,
  onChange,
  counts,
}: {
  categories: IngredientCategory[];
  value: string | null;
  onChange: (id: string | null) => void;
  counts?: Map<string, number>;
}) {
  // Only categories that have ingredients get a chip (plus the selected one), so the row stays short.
  const shown = counts ? categories.filter((c) => (counts.get(c.id) ?? 0) > 0 || c.id === value) : categories;
  return (
    <div className="chips chips-scroll" role="group" aria-label="Category">
      <button type="button" className={value == null ? 'chip chip-on' : 'chip'} aria-pressed={value == null} onClick={() => onChange(null)}>
        All
      </button>
      {shown.map((c) => (
        <button key={c.id} type="button" className={value === c.id ? 'chip chip-on' : 'chip'} aria-pressed={value === c.id} onClick={() => onChange(value === c.id ? null : c.id)}>
          {c.label}
          {counts && <span className="chip-count">{counts.get(c.id) ?? 0}</span>}
        </button>
      ))}
    </div>
  );
}

export function IngredientsScreen() {
  const settings = useSettings();
  const categories = categoriesOf(settings);
  const all = useQuery(() => ingredients.list()) ?? [];
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);

  const counts = new Map<string, number>();
  for (const item of all) counts.set(categoryOf(item, categories).id, (counts.get(categoryOf(item, categories).id) ?? 0) + 1);
  const shown = filterIngredients(all, search, category, categories);

  return (
    <>
      <TopBar title="Ingredients" back="/more">
        <button type="button" className="btn btn-small" onClick={() => setManaging(true)}>
          Categories
        </button>
      </TopBar>
      <p className="muted page-intro">The ingredients you use, picked from when you add ingredients to a recipe or batch.</p>
      <input type="search" className="search" placeholder="Search ingredients" aria-label="Search ingredients" value={search} onChange={(e) => setSearch(e.target.value)} />
      <CategoryChips categories={categories} value={category} onChange={setCategory} counts={counts} />

      {shown.length === 0 ? (
        <p className="muted list-empty">{all.length === 0 ? 'No ingredients yet.' : 'No ingredients match.'}</p>
      ) : (
        categories
          .filter((c) => category == null || c.id === category)
          .map((c) => {
            const items = shown.filter((i) => categoryOf(i, categories).id === c.id);
            if (items.length === 0) return null;
            return (
              <section key={c.id} aria-label={c.label}>
                <h3 className="stage-divider">{c.label}</h3>
                <ul className="library-list">
                  {items.map((item) => (
                    <li key={item.id}>
                      <Link to={`/ingredients/${item.id}`} className="library-row">
                        <span className="library-name">{item.name}</span>
                        <span className="muted">{priceLabel(item, currencyOf(settings))}</span>
                        <Icon name="chevron" size={18} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
      )}

      <div className="button-row button-row-center">
        <button
          type="button"
          className="btn btn-quiet btn-small"
          onClick={async () => {
            const count = await restoreStarterIngredients();
            toast(count === 0 ? 'All starter ingredients are already in your list' : `${plural(count, 'starter ingredient')} restored`);
          }}
        >
          Restore starter ingredients
        </button>
      </div>

      <Fab to={category ? `/ingredients/new?category=${category}` : '/ingredients/new'} label="Add ingredient" />
      {managing && <CategoriesSheet categories={categories} counts={counts} onClose={() => setManaging(false)} />}
    </>
  );
}

/** Rename, add, remove and reorder categories. Removing one moves its ingredients to Other. */
function CategoriesSheet({ categories, counts, onClose }: { categories: IngredientCategory[]; counts: Map<string, number>; onClose: () => void }) {
  const [list, setList] = useState(categories);
  const [added, setAdded] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const sorted = sortCategories(list).every((c, i) => c.id === list[i].id);

  // While dragging, the row goes where the pointer is: after every other row whose middle is above it.
  // Listened for on the window, because moving the row in the page drops the handle's pointer capture.
  useEffect(() => {
    if (!dragging) return;
    let edge = 0;
    let timer = 0;
    // Near the top or bottom of the sheet, keep scrolling so the row can go anywhere in a long list.
    const scroller = listRef.current?.closest('.sheet-body') as HTMLElement | null;
    const autoScroll = () => {
      if (scroller && edge) scroller.scrollTop += edge;
      timer = edge ? window.setTimeout(autoScroll, 16) : 0;
    };
    const move = (e: PointerEvent) => {
      e.preventDefault();
      if (scroller) {
        const box = scroller.getBoundingClientRect();
        edge = e.clientY < box.top + 48 ? -8 : e.clientY > box.bottom - 48 ? 8 : 0;
        if (edge && !timer) autoScroll();
      }
      const rows = Array.from(listRef.current?.children ?? []) as HTMLElement[];
      setList((current) => {
        const from = current.findIndex((c) => c.id === dragging);
        let to = 0;
        rows.forEach((row, i) => {
          if (i === from) return;
          const box = row.getBoundingClientRect();
          if (box.top + box.height / 2 < e.clientY) to++;
        });
        return moveItem(current, from, to);
      });
    };
    const stop = () => setDragging(null);
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [dragging]);

  const save = async () => {
    const cleaned = list.map((c) => ({ ...c, label: c.label.trim() || categories.find((o) => o.id === c.id)?.label || 'Category' }));
    await saveSettings({ ingredientCategories: cleaned });
    // Ingredients in a removed category move to Other.
    const kept = new Set(cleaned.map((c) => c.id));
    for (const item of await ingredients.list()) if (!kept.has(item.category)) await ingredients.save({ ...item, category: 'other' });
    toast('Categories saved');
    onClose();
  };
  return (
    <Sheet title="Categories" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="category-edit-head">
          <span className="field-hint">Drag ≡ to reorder. This order is used for the chips and the list.</span>
          <button type="button" className="btn btn-small" disabled={sorted} onClick={() => setList(sortCategories(list))}>
            Sort A–Z
          </button>
        </div>
        <ul className="category-edit" ref={listRef}>
          {list.map((c, i) => (
            <li key={c.id} className={dragging === c.id ? 'dragging' : undefined}>
              <button
                type="button"
                className="icon-btn drag-handle"
                aria-label={`Reorder ${c.label}. Drag, or use the up and down arrow keys.`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setDragging(c.id);
                }}
                onKeyDown={(e) => {
                  const step = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
                  if (!step) return;
                  e.preventDefault();
                  setList(moveItem(list, i, i + step));
                  // Keep focus on the handle as the row moves.
                  const target = e.currentTarget;
                  requestAnimationFrame(() => target.focus());
                }}
              >
                <Icon name="grip" size={18} />
              </button>
              <input type="text" aria-label={`Name of ${c.label}`} value={c.label} onChange={(e) => setList(list.map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x)))} />
              {c.id !== 'other' && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove ${c.label}`}
                  title={counts.get(c.id) ? `Its ${plural(counts.get(c.id) ?? 0, 'ingredient')} move to Other` : undefined}
                  onClick={() => setList(list.filter((x) => x.id !== c.id))}
                >
                  <Icon name="trash" size={18} />
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="unit-input">
          <input type="text" aria-label="New category" placeholder="New category" value={added} onChange={(e) => setAdded(e.target.value)} />
          <button
            type="button"
            className="btn btn-small"
            disabled={!added.trim()}
            onClick={() => {
              setList([...list.filter((c) => c.id !== 'other'), { id: newId(), label: added.trim() }, ...list.filter((c) => c.id === 'other')]);
              setAdded('');
            }}
          >
            Add
          </button>
        </div>
        <p className="field-hint">Removing a category moves its ingredients to Other.</p>
        <button type="submit" className="btn btn-primary btn-block">
          Save categories
        </button>
      </form>
    </Sheet>
  );
}

export function IngredientFormScreen({ id, category }: { id?: string; category?: string }) {
  const settings = useSettings();
  const categories = categoriesOf(settings);
  const loaded = useQuery(async () => ({ item: id ? ((await ingredients.get(id)) ?? null) : null, all: await ingredients.list() }), [id]);
  if (!loaded) return <TopBar title="Ingredient" back="/ingredients" />;
  if (id && !loaded.item) {
    return (
      <>
        <TopBar title="Ingredient" back="/ingredients" />
        <p className="notice">This ingredient was deleted.</p>
      </>
    );
  }
  return <IngredientForm key={id ?? 'new'} item={loaded.item} all={loaded.all} categories={categories} startCategory={category} />;
}

interface FormProps {
  item: LibraryIngredient | null;
  all: LibraryIngredient[];
  categories: IngredientCategory[];
  startCategory?: string;
  /** For a new ingredient: the name and default unit to start with. */
  startName?: string;
  startUnit?: string;
  /** In a sheet: called when saved (with the saved ingredient) or deleted, instead of going back to the Ingredients screen. */
  onDone?: (saved?: LibraryIngredient) => void;
}

export function IngredientForm({ item, all, categories, startCategory, startName, startUnit, onDone }: FormProps) {
  const done = (saved?: LibraryIngredient) => (onDone ? onDone(saved) : navigate('/ingredients'));
  const [name, setName] = useState(item?.name ?? startName ?? '');
  const [category, setCategory] = useState(item?.category ?? (startCategory && categories.some((c) => c.id === startCategory) ? startCategory : 'other'));
  const [defaultUnit, setDefaultUnit] = useState(item?.defaultUnit ?? startUnit ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  // Cost, as bought: price for an amount. Optional.
  const [price, setPrice] = useState(item?.cost ? String(item.cost.price) : '');
  const [costQty, setCostQty] = useState(item?.cost ? String(item.cost.quantity) : '1');
  const [costUnit, setCostUnit] = useState(item?.cost?.unit ?? item?.defaultUnit ?? startUnit ?? '');
  const settings = useSettings();
  const currency = currencyOf(settings);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const units = INGREDIENT_UNITS.some((u) => u.id === defaultUnit) ? INGREDIENT_UNITS : [...INGREDIENT_UNITS, { id: defaultUnit, name: defaultUnit }];
  const duplicate = all.find((other) => other.id !== item?.id && other.name.trim().toLowerCase() === name.trim().toLowerCase());

  const usedIn = useQuery(async () => {
    if (!item) return { recipes: [], batches: [] };
    return {
      recipes: (await recipes.list()).filter((r) => r.ingredients.some((l) => lineIsIngredient(l, item))),
      batches: (await batches.list()).filter((b) => b.ingredients.some((l) => lineIsIngredient(l, item))),
    };
  }, [item?.id, item?.name]);

  const priceValue = parseNum(price.replace(/[^0-9.,-]/g, ''));
  const qtyValue = parseNum(costQty);
  const cost: IngredientCost | null = priceValue != null && qtyValue != null && qtyValue > 0 ? { price: priceValue, quantity: qtyValue, unit: costUnit } : null;
  // "= $2.08 per lb": per the default unit when it converts, otherwise per the unit it was bought in.
  const perUnit = cost ? (unitsCompatible(defaultUnit, cost.unit) ? defaultUnit : cost.unit) : '';
  const per = cost ? pricePer(perUnit, cost) : null;

  const save = async () => {
    if (!name.trim()) return setError('Enter the ingredient, such as Orange blossom honey.');
    if (duplicate) return setError(`${duplicate.name} is already in your ingredients.`);
    if (price.trim() && !cost) return setError('Enter the price and how much it was for, such as 24.99 for 12 lb.');
    const saved = await ingredients.save({ ...(item ?? {}), name: name.trim(), category, defaultUnit, notes: notes.trim(), cost });
    toast(item ? 'Ingredient saved' : 'Added to your ingredients');
    done(saved);
  };

  return (
    <>
      {!onDone && <TopBar title={item ? 'Edit ingredient' : 'New ingredient'} back="/ingredients" />}
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Name">
          <input type="text" value={name} placeholder="Orange blossom honey" autoFocus={!item} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="form-pair">
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Default unit" hint="Filled in when you add it.">
            <select value={defaultUnit} onChange={(e) => setDefaultUnit(e.target.value)}>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {unitLabel(u)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <fieldset className="cost-fields">
          <legend className="field-label">Cost (optional)</legend>
          <div className="cost-row">
            <Field label={`Price (${currency})`}>
              <input type="text" inputMode="decimal" value={price} placeholder="24.99" onChange={(e) => setPrice(e.target.value)} />
            </Field>
            <span className="cost-for">for</span>
            <Field label="Amount">
              <input type="text" inputMode="decimal" value={costQty} placeholder="12" onChange={(e) => setCostQty(e.target.value)} />
            </Field>
            <Field label="Unit">
              <select value={costUnit} onChange={(e) => setCostUnit(e.target.value)}>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.id || 'count'}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="field-hint">
            {per != null ? `= ${fmtMoney(per, currency)} per ${perUnit || 'one'}. Used for batch and recipe costs.` : 'What you paid and how much it was for. Used for batch and recipe costs.'}
          </p>
        </fieldset>
        <Field label="Notes">
          <textarea rows={3} value={notes} placeholder="Where you buy it, how you use it" onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block">
          {item ? 'Save ingredient' : onDone ? 'Save new ingredient' : 'Add ingredient'}
        </button>
      </form>

      {item && usedIn && !onDone && (
        <section className="card used-in">
          <h2>Used in</h2>
          {usedIn.recipes.length + usedIn.batches.length === 0 ? (
            <p className="muted">Not in any recipe or batch yet.</p>
          ) : (
            <ul className="library-list">
              {usedIn.recipes.map((r) => (
                <li key={r.id}>
                  <Link to={`/recipes/${r.id}`} className="library-row">
                    <span className="library-name">{r.name}</span>
                    <span className="muted">Recipe</span>
                    <Icon name="chevron" size={18} />
                  </Link>
                </li>
              ))}
              {usedIn.batches.map((b) => (
                <li key={b.id}>
                  <Link to={`/batches/${b.id}`} className="library-row">
                    <span className="library-name">{b.name}</span>
                    <span className="muted">Batch</span>
                    <Icon name="chevron" size={18} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {item && (
        <div className="button-row">
          <button type="button" className="btn btn-danger-quiet" onClick={() => setDeleting(true)}>
            <Icon name="trash" size={20} />
            Delete
          </button>
        </div>
      )}
      {deleting && item && (
        <ConfirmSheet
          title="Delete this ingredient?"
          message={`${item.name} is removed from your ingredients. Recipes and batches that use it keep it as it is.`}
          confirmLabel="Delete"
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await ingredients.remove(item.id);
            toast('Ingredient deleted');
            done();
          }}
        />
      )}
    </>
  );
}
