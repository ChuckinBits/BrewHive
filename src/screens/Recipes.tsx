// Recipes: the list, one recipe, and the recipe form.

import { useState } from 'react';
import { volumeUnitOf } from '../lib/units.ts';
import { batches, loadSettings, recipes, usePrefs, useQuery, useSettings } from '../db/store.ts';
import { BEVERAGE_TYPES, type BeverageType, type IngredientLine, type Recipe, type Settings, type TargetMode, type VolumeUnit } from '../db/types.ts';
import { IconPicker } from '../components/IconPicker.tsx';
import { TargetField, targetError, targetValues } from '../components/TargetField.tsx';
import { StyleField, useNameAndStyle } from '../components/StyleField.tsx';
import { EditableIngredients, IngredientSheet, IngredientsByStage } from '../components/StagedIngredients.tsx';
import { CostCard } from '../components/CostCard.tsx';
import { cleanIngredients } from '../lib/stages.ts';
import { Collection, SortSelect, ViewToggle, byRating, type ShelfEntry } from '../components/Shelf.tsx';
import { Book } from '../components/Vessels.tsx';
import { ConfirmSheet, EmptyState, Fab, Field, RatingBadge, RatingInput, Stat, TopBar, UnitField, VOLUME_UNITS, toast } from '../components/ui.tsx';
import { DEFAULT_FLAVOR, getFlavor, iconsOf } from '../icons/FlavorIcon.tsx';
import { Icon } from '../icons/Icon.tsx';
import { L_PER_GAL, abv } from '../lib/calc.ts';
import { fmtDateShort, fmtPercent, fmtSG, fmtVolumeBoth, parseNum, plural, volumeFromInput, volumeToInput, toLocalMinute } from '../lib/format.ts';
import { Link, navigate } from '../lib/router.tsx';
import { batchSubtitle } from './Batches.tsx';

const SORTS = [
  { id: 'name', label: 'Name' },
  { id: 'rating', label: 'Rating' },
  { id: 'newest', label: 'Newest' },
];

/** The ABV the recipe aims for: its target ABV, or what its OG and FG give. */
const estimatedAbv = (recipe: Recipe) =>
  recipe.targetMode === 'abv' && recipe.targetAbv != null ? recipe.targetAbv : recipe.targetOG != null && recipe.targetFG != null ? abv(recipe.targetOG, recipe.targetFG) : null;

export function RecipesScreen() {
  const { view, sort, setView, setSort } = usePrefs('recipes', 'name');
  const list = useQuery(() => recipes.list());
  if (!list) return <TopBar title="Recipes" />;

  const sorted = [...list].sort((a, b) => {
    if (sort === 'rating') return byRating(a, b);
    if (sort === 'newest') return b.createdAt.localeCompare(a.createdAt);
    return a.name.localeCompare(b.name);
  });

  const items: ShelfEntry[] = sorted.map((recipe) => {
    const est = estimatedAbv(recipe);
    return {
      key: recipe.id,
      to: `/recipes/${recipe.id}`,
      visual: <Book icon={recipe.icon} extraIcons={recipe.extraIcons} color={recipe.color} />,
      icons: iconsOf(recipe),
      title: recipe.name,
      subtitle: recipe.style || 'Mead',
      meta: est != null ? `~${fmtPercent(est, 0)}` : undefined,
      rating: recipe.rating,
    };
  });

  return (
    <>
      <TopBar title="Recipes">{list.length > 0 && <ViewToggle value={view} onChange={setView} />}</TopBar>
      {list.length === 0 ? (
        <EmptyState art={<Book icon="traditional" color="#E8A33A" size={132} />} title="No recipes yet">
          <p>Save a recipe once, then start a new batch from it with one tap.</p>
          <div className="button-row button-row-center">
            <Link to="/recipes/new" className="btn btn-primary">
              Write a recipe
            </Link>
          </div>
        </EmptyState>
      ) : (
        <>
          <div className="toolbar">
            <span className="muted">{plural(list.length, 'recipe')}</span>
            <SortSelect value={sort} options={SORTS} onChange={setSort} />
          </div>
          <Collection view={view} items={items} />
          <Fab to="/recipes/new" label="New recipe" />
        </>
      )}
    </>
  );
}

export function RecipeDetailScreen({ id }: { id: string }) {
  const settings = useSettings();
  const data = useQuery(async () => {
    const recipe = (await recipes.get(id)) ?? null;
    const made = recipe ? (await batches.list()).filter((b) => b.recipeId === id).sort((a, b) => b.startDate.localeCompare(a.startDate)) : [];
    const source = recipe?.updatedFromBatchId ? ((await batches.get(recipe.updatedFromBatchId)) ?? null) : null;
    return { recipe, made, source };
  }, [id]);
  const [deleting, setDeleting] = useState(false);

  if (!data) return <TopBar title="Recipe" back="/recipes" />;
  const { recipe } = data;
  if (!recipe) {
    return (
      <>
        <TopBar title="Recipe" back="/recipes" />
        <p className="notice">This recipe no longer exists.</p>
      </>
    );
  }
  const est = estimatedAbv(recipe);

  return (
    <>
      <TopBar title={recipe.name} back="/recipes">
        <Link to={`/recipes/${recipe.id}/edit`} className="icon-btn" aria-label="Edit recipe">
          <Icon name="edit" />
        </Link>
      </TopBar>

      <section className="hero">
        <RatingBadge rating={recipe.rating} reserve />
        <Book icon={recipe.icon} extraIcons={recipe.extraIcons} color={recipe.color} size={168} />
        <p className="hero-sub">
          {recipe.style || 'Mead'}
          {recipe.batchSizeL != null && ` · ${fmtVolumeBoth(recipe.batchSizeL, recipe.volumeUnit, volumeUnitOf(settings))}`}
        </p>
        {data.source && recipe.updatedFromAt && (
          <p className="hero-note">
            Updated from <Link to={`/batches/${data.source.id}`}>{data.source.name}</Link> on {fmtDateShort(toLocalMinute(recipe.updatedFromAt))}
          </p>
        )}
        <Link to={`/batches/new?recipe=${recipe.id}`} className="btn btn-primary">
          <Icon name="batches" size={20} />
          Start a batch
        </Link>
      </section>

      {recipe.targetMode === 'abv' && recipe.targetAbv != null ? (
        <div className="stats stats-3">
          <Stat label="Target OG" value={fmtSG(recipe.targetOG)} />
          <Stat label="Target ABV" value={fmtPercent(recipe.targetAbv)} />
          <Stat label="Finishes ≈" value={recipe.targetOG != null ? fmtSG(recipe.targetOG - recipe.targetAbv / 131.25) : '–'} />
        </div>
      ) : (
        (recipe.targetOG != null || recipe.targetFG != null) && (
          <div className="stats stats-3">
            <Stat label="Target OG" value={fmtSG(recipe.targetOG)} />
            <Stat label="Target FG" value={fmtSG(recipe.targetFG)} />
            <Stat label="Est. ABV" value={fmtPercent(est)} />
          </div>
        )
      )}

      <section className="card">
        <RatingInput value={recipe.rating} onChange={(rating) => recipes.save({ ...recipe, rating })} />
      </section>

      {recipe.ingredients.length > 0 && (
        <section className="card">
          <h2>Ingredients</h2>
          <IngredientsByStage lines={recipe.ingredients} />
        </section>
      )}

      <CostCard lines={recipe.ingredients} volumeL={recipe.batchSizeL} useSaved={false} />

      {recipe.steps.length > 0 && (
        <section className="card">
          <h2>Steps</h2>
          <ol className="steps-list">
            {recipe.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </section>
      )}

      {recipe.notes && (
        <section className="card">
          <h2>Notes</h2>
          <p className="prose">{recipe.notes}</p>
        </section>
      )}

      {data.made.length > 0 && (
        <section className="card">
          <h2>Batches from this recipe</h2>
          <ul className="link-list">
            {data.made.map((batch) => (
              <li key={batch.id}>
                <Link to={`/batches/${batch.id}`}>
                  <span>{batch.name}</span>
                  <span className="muted">{batchSubtitle(batch)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="button-row">
        <button type="button" className="btn btn-danger-quiet" onClick={() => setDeleting(true)}>
          <Icon name="trash" size={20} />
          Delete
        </button>
      </div>

      {deleting && (
        <ConfirmSheet
          title="Delete this recipe?"
          message={`"${recipe.name}" will be deleted. Batches made from it stay.`}
          confirmLabel="Delete recipe"
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await recipes.remove(recipe.id);
            toast('Recipe deleted');
            navigate('/recipes', { replace: true });
          }}
        />
      )}
    </>
  );
}

interface Draft {
  name: string;
  beverageType: BeverageType;
  style: string;
  batchSize: string;
  volumeUnit: VolumeUnit;
  targetOG: string;
  targetMode: TargetMode;
  targetFG: string;
  targetAbv: string;
  ingredients: IngredientLine[];
  steps: string;
  icon: string;
  extraIcons: string[];
  color: string;
  notes: string;
}

interface Loaded {
  draft: Draft;
  existing: Recipe | null;
}

export function RecipeFormScreen({ id }: { id?: string }) {
  const settings = useSettings();
  const loaded = useQuery<Loaded | null>(async () => {
    const volumeUnit = volumeUnitOf(await loadSettings());
    if (!id) {
      return {
        existing: null,
        draft: {
          name: '',
          beverageType: 'mead',
          style: '',
          batchSize: volumeToInput(volumeUnit === 'gal' ? L_PER_GAL : 4, volumeUnit),
          volumeUnit,
          targetOG: '',
          targetMode: 'fg',
          targetFG: '',
          targetAbv: '',
          ingredients: [],
          steps: '',
          icon: DEFAULT_FLAVOR,
          extraIcons: [],
          color: getFlavor(DEFAULT_FLAVOR).color,
          notes: '',
        },
      };
    }
    const recipe = await recipes.get(id);
    if (!recipe) return null;
    return {
      existing: recipe,
      draft: {
        name: recipe.name,
        beverageType: recipe.beverageType,
        style: recipe.style,
        batchSize: volumeToInput(recipe.batchSizeL, recipe.volumeUnit ?? volumeUnit),
        volumeUnit: recipe.volumeUnit ?? volumeUnit,
        targetOG: recipe.targetOG != null ? fmtSG(recipe.targetOG) : '',
        targetMode: recipe.targetMode ?? 'fg',
        targetFG: recipe.targetFG != null ? fmtSG(recipe.targetFG) : '',
        targetAbv: recipe.targetAbv != null ? String(recipe.targetAbv) : '',
        ingredients: recipe.ingredients,
        steps: recipe.steps.join('\n'),
        icon: recipe.icon,
        extraIcons: recipe.extraIcons ?? [],
        color: recipe.color,
        notes: recipe.notes,
      },
    };
  }, [id]);

  const back = id ? `/recipes/${id}` : '/recipes';
  const title = id ? 'Edit recipe' : 'New recipe';
  if (loaded === undefined) return <TopBar title={title} back={back} />;
  if (loaded === null) {
    return (
      <>
        <TopBar title={title} back="/recipes" />
        <p className="notice">This recipe no longer exists.</p>
      </>
    );
  }
  return <RecipeForm key={id ?? 'new'} loaded={loaded} settings={settings} back={back} title={title} />;
}

function RecipeForm({ loaded, settings, back, title }: { loaded: Loaded; settings: Settings; back: string; title: string }) {
  const [draft, setDraft] = useState(loaded.draft);
  const [error, setError] = useState('');
  // The ingredient open in the ingredient sheet: 'new' to add one, null when closed.
  const [editing, setEditing] = useState<IngredientLine | 'new' | null>(null);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const naming = useNameAndStyle(draft, set);
  const isNew = !loaded.existing;

  const save = async () => {
    const name = draft.name.trim();
    if (!name) return setError('Give the recipe a name.');
    const targetOG = parseNum(draft.targetOG);
    const targetProblem = targetError(draft);
    if (targetProblem) return setError(targetProblem);
    const target = targetValues(draft, null);
    for (const [label, value, text] of [['Target OG', targetOG, draft.targetOG]] as const) {
      if (text.trim() !== '' && (value == null || value < 0.98 || value > 1.2)) {
        return setError(`${label} should be a gravity between 0.980 and 1.200, such as 1.100.`);
      }
    }
    const saved = await recipes.save({
      ...(loaded.existing ?? { rating: null, isPublished: false }),
      name,
      beverageType: draft.beverageType,
      style: draft.style.trim(),
      batchSizeL: volumeFromInput(draft.batchSize, draft.volumeUnit),
      volumeUnit: draft.volumeUnit,
      targetOG,
      ...target,
      // Recipes use current prices, so lines don't keep a saved cost.
      ingredients: cleanIngredients(draft.ingredients).map(({ cost: _cost, ...line }) => line),
      steps: draft.steps
        .split('\n')
        .map((step) => step.trim())
        .filter(Boolean),
      icon: draft.icon,
      extraIcons: draft.extraIcons,
      color: draft.color,
      notes: draft.notes.trim(),
    });
    toast(isNew ? 'Recipe saved' : 'Changes saved');
    navigate(`/recipes/${saved.id}`, { replace: true });
  };

  return (
    <>
      <TopBar title={title} back={back} />
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Name">
          <input type="text" value={draft.name} placeholder="Traditional Show Mead" autoFocus={isNew} onChange={(e) => naming.onName(e.target.value)} />
        </Field>

        <IconPicker icon={draft.icon} extraIcons={draft.extraIcons} color={draft.color} onChange={naming.onIcon} />

        <div className="form-pair">
          <Field label="Type">
            <select value={draft.beverageType} onChange={(e) => naming.onType(e.target.value as BeverageType)}>
              {BEVERAGE_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <StyleField value={draft.style} type={draft.beverageType} onChange={naming.onStyle} />
        </div>

        <UnitField
          label="Batch size"
          value={draft.batchSize}
          onChange={(batchSize) => set({ batchSize })}
          unit={draft.volumeUnit}
          units={VOLUME_UNITS}
          onUnit={(volumeUnit) => set({ volumeUnit })}
        />

        <Field label="Target OG">
          <input type="text" inputMode="decimal" value={draft.targetOG} placeholder="1.100" onChange={(e) => set({ targetOG: e.target.value })} />
        </Field>
        <TargetField value={draft} onChange={set} og={parseNum(draft.targetOG)} />

        <fieldset className="ingredient-editor">
          <legend className="field-label">Ingredients</legend>
          <EditableIngredients lines={draft.ingredients} onEdit={(line) => setEditing(line)} />
          <button type="button" className="btn btn-small" onClick={() => setEditing('new')}>
            <Icon name="plus" size={18} />
            Add ingredient
          </button>
        </fieldset>

        <Field label="Steps" hint="One step per line.">
          <textarea rows={6} value={draft.steps} onChange={(e) => set({ steps: e.target.value })} />
        </Field>

        <Field label="Notes">
          <textarea rows={3} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block">
          {isNew ? 'Save recipe' : 'Save changes'}
        </button>
      </form>

      {editing && (
        <IngredientSheet
          line={editing === 'new' ? null : editing}
          defaultStage="primary"
          defaultUnit={settings.units === 'us' ? 'lb' : 'g'}
          onSave={(line) =>
            set({ ingredients: draft.ingredients.some((l) => l.id === line.id) ? draft.ingredients.map((l) => (l.id === line.id ? line : l)) : [...draft.ingredients, line] })
          }
          onRemove={(id) => set({ ingredients: draft.ingredients.filter((l) => l.id !== id) })}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
