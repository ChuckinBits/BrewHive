// New batch and edit batch. The form stays short: a name is the only
// required field, everything else can be filled in later.

import { useState } from 'react';
import { recordStatusEntry } from '../db/actions.ts';
import { batches, events, loadSettings, recipes, useQuery, useSettings } from '../db/store.ts';
import { BATCH_STATUSES, BEVERAGE_TYPES, type Batch, type BatchStatus, type BeverageType, type IngredientLine, type Settings } from '../db/types.ts';
import { IconPicker } from '../components/IconPicker.tsx';
import { IngredientEditor, cleanIngredients } from '../components/IngredientEditor.tsx';
import { StyleField } from '../components/StyleField.tsx';
import { Field, TopBar, toast } from '../components/ui.tsx';
import { DEFAULT_FLAVOR, getFlavor } from '../icons/FlavorIcon.tsx';
import { DEFAULT_TARGET_FG, gravityPoints, isFermentationComplete, projectedAbv, targetFinalGravity } from '../lib/batch.ts';
import { abv } from '../lib/calc.ts';
import { fmtPercent, fmtSG, newId, parseNum, today, volumeFromInput, volumeToInput } from '../lib/format.ts';
import { navigate } from '../lib/router.tsx';

interface Draft {
  name: string;
  recipeId: string | null;
  beverageType: BeverageType;
  style: string;
  status: BatchStatus;
  startDate: string;
  volume: string;
  og: string;
  complete: boolean;
  fg: string;
  targetFG: string;
  ingredients: IngredientLine[];
  icon: string;
  color: string;
  notes: string;
}

interface Loaded {
  draft: Draft;
  existing: Batch | null;
  targetOG: number | null;
}

export function BatchFormScreen({ id, recipeId }: { id?: string; recipeId?: string }) {
  const settings = useSettings();
  const loaded = useQuery<Loaded | null>(async () => {
    const { volumeUnit } = await loadSettings();
    if (id) {
      const batch = await batches.get(id);
      if (!batch) return null;
      return {
        existing: batch,
        targetOG: null,
        draft: {
          name: batch.name,
          recipeId: batch.recipeId,
          beverageType: batch.beverageType,
          style: batch.style,
          status: batch.status,
          startDate: batch.startDate,
          volume: volumeToInput(batch.volumeL, volumeUnit),
          og: batch.og != null ? fmtSG(batch.og) : '',
          complete: isFermentationComplete(batch),
          fg: batch.fg != null ? fmtSG(batch.fg) : '',
          targetFG: fmtSG(targetFinalGravity(batch)),
          ingredients: batch.ingredients,
          icon: batch.icon,
          color: batch.color,
          notes: batch.notes,
        },
      };
    }
    const recipe = recipeId ? await recipes.get(recipeId) : undefined;
    return {
      existing: null,
      targetOG: recipe?.targetOG ?? null,
      draft: {
        name: recipe?.name ?? '',
        recipeId: recipe?.id ?? null,
        beverageType: recipe?.beverageType ?? 'mead',
        style: recipe?.style ?? '',
        status: 'primary',
        startDate: today(),
        volume: volumeToInput(recipe?.batchSizeL ?? null, volumeUnit),
        og: '',
        complete: false,
        fg: '',
        targetFG: fmtSG(recipe?.targetFG ?? DEFAULT_TARGET_FG),
        // Fresh ids, so editing the batch never changes the recipe's own lines.
        ingredients: (recipe?.ingredients ?? []).map((line) => ({ ...line, id: newId() })),
        icon: recipe?.icon ?? DEFAULT_FLAVOR,
        color: recipe?.color ?? getFlavor(DEFAULT_FLAVOR).color,
        notes: '',
      },
    };
  }, [id, recipeId]);

  const back = id ? `/batches/${id}` : recipeId ? `/recipes/${recipeId}` : '/';
  const title = id ? 'Edit batch' : 'New batch';

  if (loaded === undefined) return <TopBar title={title} back={back} />;
  if (loaded === null) {
    return (
      <>
        <TopBar title={title} back="/" />
        <p className="notice">This batch no longer exists.</p>
      </>
    );
  }
  return <BatchForm key={id ?? 'new'} loaded={loaded} settings={settings} back={back} title={title} />;
}

function BatchForm({ loaded, settings, back, title }: { loaded: Loaded; settings: Settings; back: string; title: string }) {
  const [draft, setDraft] = useState(loaded.draft);
  const [error, setError] = useState('');
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const isNew = !loaded.existing;

  // The ABV line updates as the gravities are typed.
  const ogValue = parseNum(draft.og);
  const validOg = ogValue != null && ogValue >= 0.98 && ogValue <= 1.2 ? ogValue : null;
  const fgValue = parseNum(draft.fg);
  let abvLine = '';
  if (validOg != null && draft.complete && fgValue != null && fgValue >= 0.98 && fgValue <= 1.2) {
    abvLine = `ABV ${fmtPercent(abv(validOg, fgValue))}`;
  } else if (validOg != null && !draft.complete) {
    const projected = projectedAbv(validOg, parseNum(draft.targetFG) ?? DEFAULT_TARGET_FG);
    if (projected) abvLine = `${projected.label} ${fmtPercent(projected.value)}`;
  }
  const ogHint = loaded.targetOG != null ? `Recipe target: ${fmtSG(loaded.targetOG)}` : 'Optional. You can add it later.';

  const save = async () => {
    const name = draft.name.trim();
    if (!name) return setError('Give the batch a name.');
    const og = parseNum(draft.og);
    let fg = parseNum(draft.fg);
    const targetFG = parseNum(draft.targetFG);
    for (const [label, value, text] of [
      ['Original gravity', og, draft.og],
      ['Final gravity', fg, draft.complete ? draft.fg : ''],
      ['Target final gravity', targetFG, draft.complete ? '' : draft.targetFG],
    ] as const) {
      if (text.trim() !== '' && (value == null || value < 0.98 || value > 1.2)) {
        return setError(`${label} should be a gravity between 0.980 and 1.200, such as 1.100.`);
      }
    }
    if (draft.volume.trim() !== '' && (parseNum(draft.volume) == null || (parseNum(draft.volume) as number) <= 0)) {
      return setError('Volume should be a number, such as 1 or 5.');
    }

    // Fermentation is done but no FG was typed: use the latest gravity reading.
    if (draft.complete && fg == null && loaded.existing) {
      const timeline = (await events.list()).filter((e) => e.batchId === loaded.existing?.id);
      const points = gravityPoints({ ...loaded.existing, og: null }, timeline);
      fg = points.length ? points[points.length - 1].sg : null;
    }

    const saved = await batches.save({
      ...(loaded.existing ?? { rating: null }),
      name,
      recipeId: draft.recipeId,
      beverageType: draft.beverageType,
      style: draft.style.trim(),
      status: draft.status,
      startDate: draft.startDate || today(),
      volumeL: volumeFromInput(draft.volume, settings.volumeUnit),
      og,
      fermentationComplete: draft.complete,
      fg,
      targetFG: targetFG ?? DEFAULT_TARGET_FG,
      ingredients: cleanIngredients(draft.ingredients),
      icon: draft.icon,
      color: draft.color,
      notes: draft.notes.trim(),
    });

    if (isNew && saved.status !== 'planned') {
      await events.save({ batchId: saved.id, type: 'pitch', date: `${saved.startDate}T12:00`, value: null, note: '' });
    }
    if (loaded.existing && loaded.existing.status !== saved.status) {
      await recordStatusEntry(saved.id, loaded.existing.status, saved.status);
    }
    toast(isNew ? 'Batch started' : 'Batch saved');
    navigate(`/batches/${saved.id}`, { replace: true });
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
          <input type="text" value={draft.name} placeholder="Blackberry Melomel" autoFocus={isNew} onChange={(e) => set({ name: e.target.value })} />
        </Field>

        <IconPicker icon={draft.icon} color={draft.color} onChange={set} />

        <div className="form-pair">
          <Field label="Type">
            <select value={draft.beverageType} onChange={(e) => set({ beverageType: e.target.value as BeverageType })}>
              {BEVERAGE_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <StyleField value={draft.style} onChange={(style) => set({ style })} />
        </div>

        <div className="form-pair">
          <Field label="Status">
            <select value={draft.status} onChange={(e) => set({ status: e.target.value as BatchStatus })}>
              {BATCH_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={draft.status === 'planned' ? 'Planned start' : 'Start date'}>
            <input type="date" value={draft.startDate} onChange={(e) => set({ startDate: e.target.value })} />
          </Field>
        </div>

        <div className="form-pair">
          <Field label={`Volume (${settings.volumeUnit})`}>
            <input type="text" inputMode="decimal" value={draft.volume} placeholder="1" onChange={(e) => set({ volume: e.target.value })} />
          </Field>
          <Field label="Original gravity" hint={ogHint}>
            <input type="text" inputMode="decimal" value={draft.og} placeholder="1.100" onChange={(e) => set({ og: e.target.value })} />
          </Field>
        </div>

        <div className="gravity-group">
          <label className="check-field">
            <input type="checkbox" checked={draft.complete} onChange={(e) => set({ complete: e.target.checked })} />
            Fermentation completed
          </label>
          {draft.complete ? (
            <Field label="Final gravity" hint="Leave it empty to use your latest gravity reading.">
              <input type="text" inputMode="decimal" value={draft.fg} placeholder="1.000" onChange={(e) => set({ fg: e.target.value })} />
            </Field>
          ) : (
            <Field label="Target final gravity" hint="Where you expect fermentation to stop. 1.000 is fully dry.">
              <input type="text" inputMode="decimal" value={draft.targetFG} placeholder="1.000" onChange={(e) => set({ targetFG: e.target.value })} />
            </Field>
          )}
          {abvLine && <p className="projection" aria-live="polite">{abvLine}</p>}
        </div>

        <IngredientEditor value={draft.ingredients} onChange={(ingredients) => set({ ingredients })} />

        <Field label="Notes">
          <textarea rows={4} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block">
          {isNew ? 'Start batch' : 'Save changes'}
        </button>
      </form>
    </>
  );
}
