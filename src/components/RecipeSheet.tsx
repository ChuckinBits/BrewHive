// "Save as recipe" and "Update recipe" on the batch page.

import { useState } from 'react';
import { volumeUnitOf } from '../lib/units.ts';
import { batches, recipes, useQuery } from '../db/store.ts';
import type { Batch, BatchEvent, Recipe, Settings } from '../db/types.ts';
import { fmtVolume, plural } from '../lib/format.ts';
import { otherBatchesFrom, ratingForUpdate, recipeChanges, recipeFieldsFromBatch, suggestRecipeName } from '../lib/recipeFromBatch.ts';
import { navigate } from '../lib/router.tsx';
import { Field, Sheet, toast } from './ui.tsx';

interface Props {
  batch: Batch;
  events: BatchEvent[];
  /** The batch's recipe, or null when it has none (or it was deleted). */
  recipe: Recipe | null;
  settings: Settings;
  onClose: () => void;
}

export function RecipeSheet({ batch, events, recipe, settings, onClose }: Props) {
  // With a recipe the sheet starts as an update; "Save as a new recipe" switches it.
  const [mode, setMode] = useState<'new' | 'update'>(recipe ? 'update' : 'new');
  const [name, setName] = useState(suggestRecipeName(batch.name));
  const [error, setError] = useState('');
  const allBatches = useQuery(() => batches.list()) ?? [];

  const fields = recipeFieldsFromBatch(batch, events);
  const stamp = { updatedFromBatchId: batch.id, updatedFromAt: new Date().toISOString() };

  const saveNew = async () => {
    if (!name.trim()) return setError('Give the recipe a name.');
    // The recipe starts with the batch's rating (fields.rating).
    const saved = await recipes.save({ ...fields, ...stamp, name: name.trim(), steps: [], notes: batch.notes, isPublished: false });
    await batches.save({ ...batch, recipeId: saved.id });
    toast('Saved as a recipe');
    onClose();
    navigate(`/recipes/${saved.id}`);
  };

  if (mode === 'update' && recipe) {
    const changes = recipeChanges(recipe, fields, (l) => fmtVolume(l, volumeUnitOf(settings)));
    const upToDate = changes.fields.length === 0 && changes.ingredients.length === 0;
    const others = otherBatchesFrom(recipe.id, allBatches, batch.id);
    const update = async () => {
      // Name, notes and steps stay as they are on the recipe; an unrated batch keeps its rating too.
      await recipes.save({ ...recipe, ...fields, ...stamp, rating: ratingForUpdate(recipe, fields) });
      toast('Recipe updated');
      onClose();
    };
    return (
      <Sheet title="Update recipe" onClose={onClose}>
        <div className="form">
          <p>
            Update <strong>{recipe.name}</strong> to match this batch.
          </p>
          {upToDate ? (
            <p className="notice-inline">The recipe already matches this batch.</p>
          ) : (
            <div className="change-list">
              <h3 className="stage-divider">What will change</h3>
              <ul>
                {[...changes.fields, ...changes.ingredients].map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="field-hint">The recipe's name, notes and steps stay as they are{batch.rating == null ? ', and so does its rating, since this batch isn\'t rated' : ''}.</p>
            </div>
          )}
          {others.length > 0 && !upToDate && (
            <p className="warning" role="note">
              {plural(others.length, 'other batch', 'other batches')} {others.length === 1 ? 'was' : 'were'} started from this recipe:{' '}
              {others.map((b) => b.name).join(', ')}. {others.length === 1 ? 'It keeps' : 'They keep'} {others.length === 1 ? 'its' : 'their'} own
              ingredients; only the recipe changes.
            </p>
          )}
          <button type="button" className="btn btn-primary btn-block" disabled={upToDate} onClick={() => void update()}>
            Update recipe
          </button>
          <button type="button" className="btn btn-block" onClick={() => setMode('new')}>
            Save as a new recipe instead
          </button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="Save as recipe" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void saveNew();
        }}
      >
        <p className="muted">Saves this batch's style, size, gravities, ingredients with their stages, icon, color and rating as a recipe you can brew again.</p>
        <Field label="Recipe name">
          <input type="text" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
        </Field>
        {recipe && <p className="field-hint">This batch will then belong to the new recipe. {recipe.name} stays as it is.</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block">
          Save recipe
        </button>
      </form>
    </Sheet>
  );
}
