// New batch and edit batch. The form stays short: a name is the only
// required field, everything else can be filled in later.

import { useEffect, useRef, useState } from 'react';
import { volumeUnitOf } from '../lib/units.ts';
import { recordStatusEntry } from '../db/actions.ts';
import { batches, events, ingredients, loadSettings, recipes, syncOgEntry, useQuery, useSettings } from '../db/store.ts';
import { BATCH_STATUSES, BEVERAGE_TYPES, type Batch, type BatchEvent, type BatchStatus, type BeverageType, type IngredientLine, type Settings, type TargetMode, type VolumeUnit } from '../db/types.ts';
import { IconPicker } from '../components/IconPicker.tsx';
import { EditableIngredients, IngredientSheet } from '../components/StagedIngredients.tsx';
import { Icon } from '../icons/Icon.tsx';
import { StyleField, useNameAndStyle } from '../components/StyleField.tsx';
import { Field, TopBar, UnitField, VOLUME_UNITS, toast } from '../components/ui.tsx';
import { DEFAULT_FLAVOR, getFlavor } from '../icons/FlavorIcon.tsx';
import { cleanIngredients, entryFromLine } from '../lib/stages.ts';
import { currentCost } from '../components/CostCard.tsx';
import { TargetField, targetError, targetValues } from '../components/TargetField.tsx';
import { DEFAULT_TARGET_FG, analyzeGravity, batchAbv, finalReading, isFermentationComplete, projectedAbv, targetFinalGravity } from '../lib/batch.ts';
import { fmtPercent, fmtSG, newId, nowLocal, parseNum, today, volumeFromInput, volumeToInput } from '../lib/format.ts';
import { FinalReadingFields, NO_FINAL_READING, finalReadingEntry, finalReadingError, saveFinalReading, type FinalReading } from '../components/FinalReading.tsx';
import { navigate } from '../lib/router.tsx';
import { VesselField } from '../components/VesselField.tsx';

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
  targetMode: TargetMode;
  targetFG: string;
  targetAbv: string;
  ingredients: IngredientLine[];
  icon: string;
  extraIcons: string[];
  color: string;
  notes: string;
  vesselId: string | null;
}

interface Loaded {
  draft: Draft;
  existing: Batch | null;
  targetOG: number | null;
  /** The batch's timeline, so the ABV line can count step feedings. Empty for a new batch. */
  timeline: BatchEvent[];
}

/** `section: 'ingredients'` opens the form scrolled to its ingredients. */
export function BatchFormScreen({ id, recipeId, section }: { id?: string; recipeId?: string; section?: string }) {
  const settings = useSettings();
  const loaded = useQuery<Loaded | null>(async () => {
    const volumeUnit = volumeUnitOf(await loadSettings());
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
          targetMode: batch.targetMode ?? 'fg',
          targetFG: fmtSG(targetFinalGravity(batch)),
          targetAbv: batch.targetAbv != null ? String(batch.targetAbv) : '',
          ingredients: batch.ingredients,
          icon: batch.icon,
          extraIcons: batch.extraIcons ?? [],
          color: batch.color,
          notes: batch.notes,
          vesselId: batch.vesselId ?? null,
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
        targetMode: recipe?.targetMode ?? 'fg',
        targetFG: fmtSG(recipe?.targetFG ?? DEFAULT_TARGET_FG),
        targetAbv: recipe?.targetAbv != null ? String(recipe.targetAbv) : '',
        // Fresh ids, so editing the batch never changes the recipe's own lines.
        ingredients: (recipe?.ingredients ?? []).map((line) => ({ ...line, id: newId() })),
        icon: recipe?.icon ?? DEFAULT_FLAVOR,
        extraIcons: recipe?.extraIcons ?? [],
        color: recipe?.color ?? getFlavor(DEFAULT_FLAVOR).color,
        notes: '',
        vesselId: null,
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
  return <BatchForm key={id ?? 'new'} loaded={loaded} settings={settings} back={back} title={title} section={section} />;
}

function BatchForm({ loaded, settings, back, title, section }: { loaded: Loaded; settings: Settings; back: string; title: string; section?: string }) {
  // Opened from a batch's Edit ingredients: start at the Ingredients section (after the page's scroll to the top).
  const ingredientsRef = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    if (section !== 'ingredients') return;
    const frame = requestAnimationFrame(() => ingredientsRef.current?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, [section]);
  const [draft, setDraft] = useState(loaded.draft);
  const [error, setError] = useState('');
  // The ingredient open in the ingredient sheet: 'new' to add one, null when closed.
  const [editing, setEditing] = useState<IngredientLine | 'new' | null>(null);
  // Ingredients whose timeline entries follow their changes when the batch is saved.
  const [syncLines, setSyncLines] = useState<Set<string>>(new Set());
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const loggedFor = (lineId: string) => loaded.timeline.filter((e) => e.type === 'ingredient' && e.ingredientLineId === lineId);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const naming = useNameAndStyle(draft, set);
  const isNew = !loaded.existing;

  // The ABV line updates as the gravities are typed.
  const inRange = (n: number | null) => (n != null && n >= 0.98 && n <= 1.2 ? n : null);
  const validOg = inRange(parseNum(draft.og));
  // Moving a batch past fermentation (or entering one that already is) asks for the final reading.
  // ...unless the timeline already has a final gravity reading.
  // A new batch started in Secondary may have finished fermenting already, so it's offered there too (optional).
  const finalInSecondary = isNew && draft.status === 'secondary';
  const asksFinal =
    (isFermentationComplete({ status: draft.status } as Batch) && !(loaded.existing && isFermentationComplete(loaded.existing)) && !finalReading(loaded.timeline)) || finalInSecondary;
  const finalEntry = asksFinal ? finalReadingEntry(loaded.existing?.id ?? '', draft.final, nowLocal()) : null;

  // Work the numbers out from the draft as typed, with the batch's timeline, so step feedings count.
  const preview = { ...(loaded.existing ?? loaded.draft), og: validOg, startDate: draft.startDate } as Batch;
  const previewEvents = finalEntry ? [...loaded.timeline, { ...finalEntry, id: 'final', createdAt: '\uffff', updatedAt: '', deletedAt: null } as BatchEvent] : loaded.timeline;
  const { addedSugar } = analyzeGravity(preview, previewEvents);
  const effectiveOg = validOg == null ? null : validOg + addedSugar;
  const projected = projectedAbv(effectiveOg, targetValues(draft, DEFAULT_TARGET_FG));
  const abvParts: string[] = [];
  const finalAbv = validOg != null && asksFinal ? batchAbv(preview, previewEvents) : null;
  if (finalAbv != null) abvParts.push(`ABV ${draft.final.mode === 'estimate' ? '≈ ' : ''}${fmtPercent(finalAbv)}`);
  if (projected) abvParts.push(`Potential ${fmtPercent(projected.potential)}${projected.potentialFG < 0.9995 ? ` (at ${fmtSG(projected.potentialFG)})` : ''}`);
  if (projected?.showTarget && projected.target != null) abvParts.push(`Target ${fmtPercent(projected.target)}`);
  const abvLine = abvParts.join(' · ');

  // An OG and a different final gravity on the same day usually means the start date is still today.
  const finalFg = draft.final.mode === 'reading' ? inRange(parseNum(draft.final.fg)) : null;
  const sameDay =
    asksFinal && validOg != null && finalFg != null && Math.abs(finalFg - validOg) > 0.0005 && (draft.final.date || nowLocal()).slice(0, 10) === draft.startDate;

  const ogHint = loaded.targetOG != null ? `Recipe target: ${fmtSG(loaded.targetOG)}` : 'Optional. You can add it later.';

  const save = async () => {
    const library = await ingredients.list();
    const name = draft.name.trim();
    if (!name) return setError('Give the batch a name.');
    const og = parseNum(draft.og);
    const target = targetValues(draft, DEFAULT_TARGET_FG);
    const targetProblem = targetError(draft);
    if (targetProblem) return setError(targetProblem);
    for (const [label, value, text] of [['Original gravity', og, draft.og]] as const) {
      if (text.trim() !== '' && (value == null || value < 0.98 || value > 1.2)) {
        return setError(`${label} should be a gravity between 0.980 and 1.200, such as 1.100.`);
      }
    }
    if (draft.volume.trim() !== '' && (parseNum(draft.volume) == null || (parseNum(draft.volume) as number) <= 0)) {
      return setError('Volume should be a number, such as 1 or 5.');
    }

    if (asksFinal) {
      const problem = finalReadingError(draft.final, draft.startDate);
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
      ...target,
      targetFG: target.targetFG ?? DEFAULT_TARGET_FG,
      // Each line keeps the price it had when first saved with the batch; new ones take today's.
      ingredients: cleanIngredients(draft.ingredients).map((line) => (line.cost ? line : { ...line, cost: currentCost(line, library) })),
      icon: draft.icon,
      extraIcons: draft.extraIcons,
      color: draft.color,
      notes: draft.notes.trim(),
      // Set by hand here, it's a correction: racking is what logs a move on the timeline.
      vesselId: draft.vesselId,
    });

    if (loaded.existing && loaded.existing.status !== saved.status) {
      await recordStatusEntry(saved.id, loaded.existing.status, saved.status);
    }
    // The OG's timeline entry follows the OG (and the start date, if it was on it).
    await syncOgEntry(saved, loaded.existing?.startDate);
    // The final gravity or the estimate goes on the timeline.
    if (asksFinal) await saveFinalReading(saved.id, draft.final, finishedAt);
    // Timeline entries of edited ingredients follow them; entries of removed ingredients stay, unlinked.
    for (const entry of loaded.timeline) {
      if (entry.type !== 'ingredient' || !entry.ingredientLineId) continue;
      const line = saved.ingredients.find((l) => l.id === entry.ingredientLineId);
      if (!line) await events.save({ ...entry, ingredientLineId: undefined });
      else if (syncLines.has(line.id)) await events.save({ ...entry, ...entryFromLine(line) });
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
        <VesselField
          value={draft.vesselId}
          onChange={(vesselId) => set({ vesselId })}
          batch={{ id: loaded.existing?.id ?? '', volumeL: volumeFromInput(draft.volume, draft.volumeUnit) }}
          unit={draft.volumeUnit}
          current={loaded.existing?.vesselId}
          hint={isNew ? 'What it ferments in. Racking it later asks where it goes next.' : 'Racking logs a move on the timeline; this just corrects it.'}
        />

        <div className="gravity-group">
          <TargetField value={draft} onChange={set} og={effectiveOg} />
          {asksFinal && (
            <>
              <h3 className="stage-divider">Final reading</h3>
              <p className="field-hint">
                {finalInSecondary
                  ? 'If fermentation has already finished, add the final reading. Otherwise leave it empty.'
                  : isNew
                    ? 'This batch is past fermentation.'
                    : `Moving to ${draft.status === 'aging' ? 'Aging' : 'a finished stage'} means fermentation is done.`}
              </p>
              <FinalReadingFields value={draft.final} onChange={(final) => set({ final })} abvSoFar={validOg != null ? batchAbv(preview, loaded.timeline) : null} />
              {sameDay && (
                <p className="warning" role="note">
                  The OG and the final reading are on the same day. If the batch started earlier, set the Start date to the day you started it.
                </p>
              )}
            </>
          )}
          {abvLine && <p className="projection" aria-live="polite">{abvLine}</p>}
        </div>

        <fieldset className="ingredient-editor" ref={ingredientsRef}>
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
          defaultUnit={settings.units === 'us' ? 'lb' : 'g'}
          logged={editing === 'new' ? [] : loggedFor(editing.id)}
          syncLogged={editing === 'new' || !touched.has(editing.id) || syncLines.has(editing.id)}
          pricePaid
          onSave={(line, sync) => {
            set({ ingredients: draft.ingredients.some((l) => l.id === line.id) ? draft.ingredients.map((l) => (l.id === line.id ? line : l)) : [...draft.ingredients, line] });
            const next = new Set(syncLines);
            if (sync) next.add(line.id);
            else next.delete(line.id);
            setSyncLines(next);
            setTouched(new Set(touched).add(line.id));
          }}
          onRemove={(id) => set({ ingredients: draft.ingredients.filter((l) => l.id !== id) })}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
