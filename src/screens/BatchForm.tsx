// New batch and edit batch. The form stays short: a name is the only
// required field, everything else can be filled in later.

import { useState } from 'react';
import { recordStatusEntry } from '../db/actions.ts';
import { batches, events, loadSettings, recipes, useQuery, useSettings } from '../db/store.ts';
import { BATCH_STATUSES, BEVERAGE_TYPES, type Batch, type BatchEvent, type BatchStatus, type BeverageType, type IngredientLine, type Settings, type VolumeUnit } from '../db/types.ts';
import { IconPicker } from '../components/IconPicker.tsx';
import { EditableIngredients, IngredientSheet } from '../components/StagedIngredients.tsx';
import { Icon } from '../icons/Icon.tsx';
import { StyleField, useNameAndStyle } from '../components/StyleField.tsx';
import { Field, TopBar, UnitField, VOLUME_UNITS, toast } from '../components/ui.tsx';
import { DEFAULT_FLAVOR, getFlavor } from '../icons/FlavorIcon.tsx';
import { cleanIngredients } from '../lib/stages.ts';
import { DEFAULT_TARGET_FG, analyzeGravity, batchAbv, finalReading, isFermentationComplete, projectedAbv, targetFinalGravity } from '../lib/batch.ts';
import { fmtPercent, fmtSG, newId, nowLocal, parseNum, today, volumeFromInput, volumeToInput } from '../lib/format.ts';
import { FinalReadingFields, NO_FINAL_READING, finalReadingEntry, finalReadingError, finalReadingPatch, saveFinalReading, type FinalReading } from '../components/FinalReading.tsx';
import { navigate } from '../lib/router.tsx';

interface Draft {
  name: string;
  recipeId: string | null;
  beverageType: BeverageType;
  style: string;
  status: BatchStatus;
  startDate: string;
  volumeUnit: VolumeUnit;
  volume: string;
  og: string;
  /** Asked for when the batch is past fermentation and wasn't before. */
  final: FinalReading;
  targetFG: string;
  ingredients: IngredientLine[];
  icon: string;
  extraIcons: string[];
  color: string;
  notes: string;
}

interface Loaded {
  draft: Draft;
  existing: Batch | null;
  targetOG: number | null;
  /** The batch's timeline, so the ABV line can count step feedings. Empty for a new batch. */
  timeline: BatchEvent[];
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
        timeline: (await events.list()).filter((e) => e.batchId === batch.id),
        draft: {
          name: batch.name,
          recipeId: batch.recipeId,
          beverageType: batch.beverageType,
          style: batch.style,
          status: batch.status,
          startDate: batch.startDate,
          volume: volumeToInput(batch.volumeL, batch.volumeUnit ?? volumeUnit),
          volumeUnit: batch.volumeUnit ?? volumeUnit,
          og: batch.og != null ? fmtSG(batch.og) : '',
          final: NO_FINAL_READING,
          targetFG: fmtSG(targetFinalGravity(batch)),
          ingredients: batch.ingredients,
          icon: batch.icon,
          extraIcons: batch.extraIcons ?? [],
          color: batch.color,
          notes: batch.notes,
        },
      };
    }
    const recipe = recipeId ? await recipes.get(recipeId) : undefined;
    return {
      existing: null,
      targetOG: recipe?.targetOG ?? null,
      timeline: [],
      draft: {
        name: recipe?.name ?? '',
        recipeId: recipe?.id ?? null,
        beverageType: recipe?.beverageType ?? 'mead',
        style: recipe?.style ?? '',
        status: 'primary',
        startDate: today(),
        volume: volumeToInput(recipe?.batchSizeL ?? null, recipe?.volumeUnit ?? volumeUnit),
        volumeUnit: recipe?.volumeUnit ?? volumeUnit,
        og: '',
        final: NO_FINAL_READING,
        targetFG: fmtSG(recipe?.targetFG ?? DEFAULT_TARGET_FG),
        // Fresh ids, so editing the batch never changes the recipe's own lines.
        ingredients: (recipe?.ingredients ?? []).map((line) => ({ ...line, id: newId() })),
        icon: recipe?.icon ?? DEFAULT_FLAVOR,
        extraIcons: recipe?.extraIcons ?? [],
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
  // The ingredient open in the ingredient sheet: 'new' to add one, null when closed.
  const [editing, setEditing] = useState<IngredientLine | 'new' | null>(null);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const naming = useNameAndStyle(draft, set);
  const isNew = !loaded.existing;

  // The ABV line updates as the gravities are typed.
  const inRange = (n: number | null) => (n != null && n >= 0.98 && n <= 1.2 ? n : null);
  const validOg = inRange(parseNum(draft.og));
  // Moving a batch past fermentation (or entering one that already is) asks for the final reading.
  // ...unless the timeline already has a final gravity reading.
  const asksFinal = isFermentationComplete({ status: draft.status } as Batch) && !(loaded.existing && isFermentationComplete(loaded.existing)) && !finalReading(loaded.timeline);
  const finalEntry = asksFinal ? finalReadingEntry(loaded.existing?.id ?? '', draft.final, nowLocal()) : null;

  // Work the numbers out from the draft as typed, with the batch's timeline, so step feedings count.
  const preview = { ...(loaded.existing ?? loaded.draft), og: validOg, startDate: draft.startDate, ...(asksFinal ? finalReadingPatch(draft.final, nowLocal()) : {}) } as Batch;
  const previewEvents = finalEntry ? [...loaded.timeline, { ...finalEntry, id: 'final', createdAt: '\uffff', updatedAt: '', deletedAt: null } as BatchEvent] : loaded.timeline;
  const { addedSugar } = analyzeGravity(preview, previewEvents);
  const projected = projectedAbv(validOg == null ? null : validOg + addedSugar, inRange(parseNum(draft.targetFG)) ?? DEFAULT_TARGET_FG);
  const abvParts: string[] = [];
  const finalAbv = validOg != null && asksFinal ? batchAbv(preview, previewEvents) : null;
  if (finalAbv != null) abvParts.push(`ABV ${draft.final.mode === 'estimate' ? '≈ ' : ''}${fmtPercent(finalAbv)}`);
  if (projected) abvParts.push(`Potential ${fmtPercent(projected.potential)}`);
  if (projected?.target != null) abvParts.push(`Target ${fmtPercent(projected.target)}`);
  const abvLine = abvParts.join(' · ');

  const ogHint = loaded.targetOG != null ? `Recipe target: ${fmtSG(loaded.targetOG)}` : 'Optional. You can add it later.';

  const save = async () => {
    const name = draft.name.trim();
    if (!name) return setError('Give the batch a name.');
    const og = parseNum(draft.og);
    const targetFG = parseNum(draft.targetFG);
    for (const [label, value, text] of [
      ['Original gravity', og, draft.og],
      ['Target final gravity', targetFG, draft.targetFG],
    ] as const) {
      if (text.trim() !== '' && (value == null || value < 0.98 || value > 1.2)) {
        return setError(`${label} should be a gravity between 0.980 and 1.200, such as 1.100.`);
      }
    }
    if (draft.volume.trim() !== '' && (parseNum(draft.volume) == null || (parseNum(draft.volume) as number) <= 0)) {
      return setError('Volume should be a number, such as 1 or 5.');
    }

    if (asksFinal) {
      const problem = finalReadingError(draft.final);
      if (problem) return setError(problem);
    }
    const finishedAt = nowLocal();

    const saved = await batches.save({
      ...(loaded.existing ?? { rating: null }),
      name,
      recipeId: draft.recipeId,
      beverageType: draft.beverageType,
      style: draft.style.trim(),
      status: draft.status,
      startDate: draft.startDate || today(),
      volumeL: volumeFromInput(draft.volume, draft.volumeUnit),
      volumeUnit: draft.volumeUnit,
      og,
      targetFG: targetFG ?? DEFAULT_TARGET_FG,
      ingredients: cleanIngredients(draft.ingredients),
      icon: draft.icon,
      extraIcons: draft.extraIcons,
      color: draft.color,
      notes: draft.notes.trim(),
      ...(asksFinal ? finalReadingPatch(draft.final, finishedAt) : {}),
    });

    if (loaded.existing && loaded.existing.status !== saved.status) {
      await recordStatusEntry(saved.id, loaded.existing.status, saved.status);
    }
    // The estimate (if any) is already on the batch; a final gravity goes on the timeline.
    if (asksFinal) await saveFinalReading(saved.id, draft.final, finishedAt);
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
          <input type="text" value={draft.name} placeholder="Blackberry Melomel" autoFocus={isNew} onChange={(e) => naming.onName(e.target.value)} />
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
          <UnitField
            label="Volume"
            value={draft.volume}
            placeholder={draft.volumeUnit === 'gal' ? '1' : '4'}
            onChange={(volume) => set({ volume })}
            unit={draft.volumeUnit}
            units={VOLUME_UNITS}
            onUnit={(volumeUnit) => set({ volumeUnit })}
          />
          <Field label="Original gravity" hint={ogHint}>
            <input type="text" inputMode="decimal" value={draft.og} placeholder="1.100" onChange={(e) => set({ og: e.target.value })} />
          </Field>
        </div>

        <div className="gravity-group">
          <Field label="Target final gravity" hint="Where you expect fermentation to stop. 1.000 is fully dry.">
            <input type="text" inputMode="decimal" value={draft.targetFG} placeholder="1.000" onChange={(e) => set({ targetFG: e.target.value })} />
          </Field>
          {asksFinal && (
            <>
              <h3 className="stage-divider">Final reading</h3>
              <p className="field-hint">{isNew ? 'This batch is past fermentation.' : `Moving to ${draft.status === 'aging' ? 'Aging' : 'a finished stage'} means fermentation is done.`}</p>
              <FinalReadingFields value={draft.final} onChange={(final) => set({ final })} />
            </>
          )}
          {abvLine && <p className="projection" aria-live="polite">{abvLine}</p>}
        </div>

        <fieldset className="ingredient-editor">
          <legend className="field-label">Ingredients</legend>
          <EditableIngredients lines={draft.ingredients} onEdit={(line) => setEditing(line)} />
          <button type="button" className="btn btn-small" onClick={() => setEditing('new')}>
            <Icon name="plus" size={18} />
            Add ingredient
          </button>
        </fieldset>

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

      {editing && (
        <IngredientSheet
          line={editing === 'new' ? null : editing}
          defaultStage={draft.status === 'secondary' || draft.status === 'aging' ? draft.status : 'primary'}
          defaultUnit={settings.volumeUnit === 'gal' ? 'lb' : 'g'}
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
