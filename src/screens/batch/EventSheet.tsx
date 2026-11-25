// Adding or editing a timeline entry: the Add entry grid and every kind of entry's fields.

import { useState } from 'react';
import { batches, events, ingredients, useQuery } from '../../db/store.ts';
import { BATCH_STATUSES, EVENT_TYPES, eventLabel, INGREDIENT_STAGES, STABILIZE_METHODS, statusLabel, type Batch, type BatchEvent, type BatchStatus, type EventType, type IngredientLine, type IngredientStage, type Settings, type TempUnit } from '../../db/types.ts';
import { useIngredientFields } from '../../components/StagedIngredients.tsx';
import { currentCost } from '../../components/CostCard.tsx';
import { Field, RatingInput, Sheet, TEMP_UNITS, UnitField, toast } from '../../components/ui.tsx';
import { Icon } from '../../icons/Icon.tsx';
import { batchAbv, finalReading, sweetnessOf, isFermentationComplete } from '../../lib/batch.ts';
import { ingredientStageAt, lineFromEntry } from '../../lib/stages.ts';
import { fmtDateShort, fmtRating, fmtSG, fmtTemp, newId, nowLocal, parseNum, tempFromInput, tempToInput } from '../../lib/format.ts';
import { FinalReadingFields, NO_FINAL_READING, finalReadingError, saveFinalReading, type FinalReading } from '../../components/FinalReading.tsx';
import { EVENT_ICONS } from './entries.ts';

/** The text a value input starts with when editing an entry. */
function valueToInput(event: BatchEvent, settings: Settings): string {
  if (event.value == null) return '';
  if (event.type === 'gravity' || event.type === 'feeding' || event.type === 'backsweeten') return fmtSG(event.value);
  if (event.type === 'temperature') return tempToInput(event.value, event.tempUnit ?? settings.tempUnit);
  return String(event.value);
}

/** Old stage entries stored only the words "Moved to Aging". Works out the stage from them. */
function stageFromNote(note: string): BatchStatus | undefined {
  return BATCH_STATUSES.find((s) => note.toLowerCase().includes(s.label.toLowerCase()))?.id;
}

interface EventSheetProps {
  batch: Batch;
  settings: Settings;
  /** The entry being edited, or null to add a new one. */
  existing: BatchEvent | null;
  onClose: () => void;
  /** Called after a backsweetening ticked to ferment is added to a batch that is past fermentation. */
  onRestart: () => void;
}

/** The stages in order, for working out the next one. */
const STAGE_ORDER: BatchStatus[] = ['planned', 'primary', 'secondary', 'aging', 'bottled'];

/** The stage after this one: Planned → Primary → Secondary → Aging → Bottled. */
function nextStage(status: BatchStatus): BatchStatus {
  const i = STAGE_ORDER.indexOf(status);
  return i < 0 ? 'bottled' : STAGE_ORDER[Math.min(i + 1, STAGE_ORDER.length - 1)];
}

/** Whether `to` comes after `from` (Archived never does: it's set from the stage buttons). */
function isLaterStage(to: BatchStatus, from: BatchStatus): boolean {
  return to !== 'archived' && STAGE_ORDER.indexOf(to) > STAGE_ORDER.indexOf(from);
}

/**
 * What a new entry can be, most used first, as the Add entry grid shows them. Fining, Nutrients and
 * Yeast pitched are Ingredient entries now, titled by the ingredient's category; older entries of
 * those types keep their own.
 */
// An Estimated ABV entry is made from Gravity ("No reading? Enter an estimated ABV"), so it has no button of its own.
const ENTRY_ORDER: EventType[] = ['gravity', 'ingredient', 'tasting', 'note', 'status', 'rack', 'feeding', 'backsweeten', 'stabilize', 'temperature', 'ph', 'moved'];
// A soft hyphen lets Backsweetened break across two lines on a narrow button.
const SHORT_LABELS: Partial<Record<EventType, string>> = { gravity: 'Gravity', status: 'Stage change', feeding: 'Step feed', backsweeten: 'Back\u00ADsweetened' };
/** The grid button an entry type is under: an Estimated ABV is a kind of gravity entry. */
const gridChoice = (type: EventType): EventType => (type === 'estimate' ? 'gravity' : type);
const ENTRY_CHOICES = ENTRY_ORDER.map((id) => ({ id, label: id === 'status' ? 'Stage change' : (EVENT_TYPES.find((t) => t.id === id)?.label ?? id) }));

/** Adds a timeline entry, or edits one: its kind, date, reading and note. */
export function EventSheet({ batch, settings, existing, onClose, onRestart }: EventSheetProps) {
  const isStage = existing?.type === 'status';
  // "Batch rating" entries come from the rating slider; they are edited, not added, here.
  const isReview = existing?.type === 'review';
  // The OG's entry: its value is the batch's OG, so it stays a gravity reading and is never the final one.
  const isOg = existing?.type === 'gravity' && existing.og === true;
  const [type, setType] = useState<EventType>(existing?.type ?? 'gravity');
  // A new stage change starts on the stage after the timeline's latest (see below), unless one is picked.
  const [pickedStage, setStage] = useState<BatchStatus | null>(existing ? (existing.toStatus ?? stageFromNote(existing.note ?? '') ?? batch.status) : null);
  const [date, setDate] = useState(existing ? existing.date.slice(0, 16) : nowLocal());
  const [value, setValue] = useState(existing ? valueToInput(existing, settings) : '');
  const [place, setPlace] = useState(existing?.place ?? '');
  const [tempUnit, setTempUnit] = useState<TempUnit>(existing?.tempUnit ?? settings.tempUnit);
  // An old stage entry's note is its title, so it starts empty here.
  const [note, setNote] = useState(isStage && !existing?.toStatus ? '' : (existing?.note ?? ''));
  const [error, setError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Backsweetening: off unless ticked. Step feeding always ferments, so it has no checkbox.
  const [ferments, setFerments] = useState(existing?.ferments === true);
  // Gravity readings: whether this is the final gravity. Off unless ticked; a batch has only one.
  const [isFinal, setIsFinal] = useState(existing?.final === true);
  // The same ingredient fields as the batch's ingredient sheet, with the date in place of the stage.
  const ingredient = useIngredientFields(
    existing?.type === 'ingredient' ? { name: existing.ingredient ?? '', amount: existing.amount ?? '', quantity: existing.quantity, unit: existing.unit, ingredientId: existing.ingredientId } : null,
    settings.units === 'us' ? 'lb' : 'g',
  );
  // The batch ingredient this entry logged, if it's still on the list: offered to update along with it.
  const linkedLine = existing?.ingredientLineId ? batch.ingredients.find((l) => l.id === existing.ingredientLineId) : undefined;
  const [updateList, setUpdateList] = useState(true);
  // New ingredient entries also add the ingredient to the batch's list, ticked off, in the current stage.
  // Older entries that aren't on the list can be added too, but aren't by default.
  const [addToList, setAddToList] = useState(!existing);
  const [method, setMethod] = useState(existing?.method ?? STABILIZE_METHODS[0]);
  // Pasteurization's temperature and hold time, both optional.
  const [pasteurTemp, setPasteurTemp] = useState(existing?.type === 'stabilize' && existing.value != null ? tempToInput(existing.value, existing.tempUnit ?? settings.tempUnit) : '');
  const [minutes, setMinutes] = useState(existing?.minutes != null ? String(existing.minutes) : '');
  const [rating, setRating] = useState<number | null>(existing?.rating ?? null);

  const [taster, setTaster] = useState(existing?.taster ?? '');
  // New tastings set the batch rating by default. Editing an old tasting leaves the batch alone unless ticked.
  const [setAsBatch, setSetAsBatch] = useState(!existing);
  const allEntries = useQuery(() => events.list());
  const knownTasters = [...new Set((allEntries ?? []).map((e) => e.taster?.trim()).filter((t): t is string => !!t))].sort();

  // How sweet the backsweetened gravity is, as it's typed.
  const typedSg = parseNum(value);
  const sweetness = typedSg != null && typedSg >= 0.98 && typedSg <= 1.2 ? sweetnessOf(typedSg) : null;
  // A new Stage change entry: records a stage and when, for a past brew or a change made earlier.
  const newStage = !existing && type === 'status';
  const batchEntries = (allEntries ?? []).filter((e) => e.batchId === batch.id && !e.deletedAt);
  const stageEntries = batchEntries.filter((e) => e.type === 'status' && e.toStatus && e.id !== existing?.id);
  // The timeline's latest stage: its newest stage change, or Primary (where its first entries are)
  // when it has none. A new stage change starts on the one after it.
  const latestOnTimeline = [...stageEntries].sort((a, b) => a.date.localeCompare(b.date)).pop()?.toStatus ?? (batch.status === 'planned' ? 'planned' : 'primary');
  const stage = pickedStage ?? nextStage(latestOnTimeline);
  // The newest stage entry decides the batch's stage; an older one only records history.
  const stageIsNewest = !stageEntries.some((e) => e.date.slice(0, 16) > (date || nowLocal()));
  // A stage change on the timeline only moves the batch forward; the stage buttons move it back.
  const stageMovesBatch = stageIsNewest && isLaterStage(stage, batch.status);
  // An ingredient added to the batch's list goes in the stage the batch was in on the entry's date,
  // unless one is picked.
  const [pickedLineStage, setLineStage] = useState<IngredientStage | null>(null);
  const lineStage = pickedLineStage ?? ingredientStageAt(date || nowLocal(), batch.status, batchEntries);
  const [final, setFinal] = useState<FinalReading>(NO_FINAL_READING);
  // Moving from fermenting to Aging or Bottled this way asks for the final reading, as the stage buttons do.
  const stageAsksFinal = newStage && stageMovesBatch && (stage === 'aging' || stage === 'bottled') && !isFermentationComplete(batch) && !finalReading(batchEntries);
  const kind = isStage ? undefined : isReview ? 'rating' : EVENT_TYPES.find((t) => t.id === type)?.value;
  const pasteurizing = kind === 'method' && method === 'Pasteurization';
  // The batch's current final gravity reading, other than this one.
  const otherFinal = finalReading((allEntries ?? []).filter((e) => e.batchId === batch.id && e.id !== existing?.id));
  // A step feeding, or a backsweetening ticked to ferment, logged after the final reading.
  const fermentingSugar = type === 'feeding' || (type === 'backsweeten' && ferments);
  const removesFinal = !!otherFinal && fermentingSugar && (date || nowLocal()) >= otherFinal.date.slice(0, 16);

  const save = async () => {
    let parsed: number | null = null;
    if (kind === 'sg') {
      parsed = parseNum(value);
      if (parsed == null || parsed < 0.98 || parsed > 1.2) return setError('Enter a gravity between 0.980 and 1.200, such as 1.045.');
    } else if (kind === 'temp') {
      parsed = tempFromInput(value, tempUnit);
      if (parsed == null) return setError('Enter a temperature.');
    } else if (kind === 'ph') {
      parsed = parseNum(value);
      if (parsed == null || parsed < 0 || parsed > 14) return setError('Enter a pH between 0 and 14.');
    } else if (kind === 'abv') {
      parsed = parseNum(value.replace('%', ''));
      if (parsed == null || parsed < 0 || parsed > 25) return setError('Enter an ABV between 0 and 25, such as 12.');
    } else if (kind === 'sg-after' && value.trim() !== '') {
      parsed = parseNum(value);
      if (parsed == null || parsed < 0.98 || parsed > 1.2) return setError('Enter the gravity after adding, between 0.980 and 1.200, or leave it empty.');
    } else if (pasteurizing) {
      if (pasteurTemp.trim() !== '') {
        parsed = tempFromInput(pasteurTemp, tempUnit);
        if (parsed == null) return setError('Enter the temperature, or leave it empty.');
      }
      if (minutes.trim() !== '' && !((parseNum(minutes) ?? -1) > 0)) return setError('Enter how many minutes, or leave it empty.');
    } else if (kind === 'place' && !place.trim()) {
      return setError('Enter where the batch went, such as Basement.');
    } else if (kind === 'ingredient' && !ingredient.name.trim()) {
      return setError('Enter what you added, such as Oak cubes.');
    } else if (isReview && rating == null) {
      return setError('Pick a rating, or remove this entry.');
    }

    const picked = kind === 'ingredient' ? await ingredient.commit() : null;
    const fields = {
      batchId: batch.id,
      date: date || nowLocal(),
      note: note.trim(),
      value: parsed,
      place: kind === 'place' ? place.trim() : undefined,
      ferments: type === 'backsweeten' && ferments ? true : undefined,
      ingredient: picked?.name,
      amount: picked?.amount,
      quantity: picked?.quantity,
      unit: picked?.unit,
      ingredientId: picked?.ingredientId,
      method: kind === 'method' ? method : undefined,
      rating: kind === 'rating' ? rating : undefined,
      taster: type === 'tasting' && taster.trim() ? taster.trim() : undefined,
      tempUnit: kind === 'temp' || (pasteurizing && parsed != null) ? tempUnit : undefined,
      minutes: pasteurizing && minutes.trim() !== '' ? (parseNum(minutes) ?? undefined) : undefined,
      // Unticking a final reading keeps it marked as a former final (a measurement, never sugar).
      final: type === 'gravity' && !isOg ? (isFinal ? true : existing?.final != null ? false : undefined) : undefined,
    };
    if (newStage) {
      if (stageAsksFinal) {
        const problem = finalReadingError(final, batch.startDate);
        if (problem) return setError(problem);
      }
      // Where the batch was before this change: the stage entry just before it, or the batch's stage now.
      const before = [...stageEntries].filter((e) => e.date.slice(0, 16) <= fields.date).sort((a, b) => a.date.localeCompare(b.date)).pop();
      const fromStatus = stageMovesBatch ? batch.status : (before?.toStatus ?? 'primary');
      if (stageAsksFinal) await saveFinalReading(batch.id, { ...final, date: final.date || fields.date }, fields.date);
      await events.save({ ...fields, type: 'status', value: null, toStatus: stage, fromStatus, auto: false });
      if (stageMovesBatch) await batches.save({ ...batch, status: stage });
      toast(stageMovesBatch ? `Moved to ${statusLabel(stage)}` : 'Added to the timeline');
      return onClose();
    }
    if (existing && isStage) {
      // Editing a stage entry by hand makes it permanent: stage taps later the same day add a new entry instead of replacing it.
      await events.save({ ...existing, ...fields, value: null, toStatus: stage, auto: false });
      // The newest stage entry moves the batch forward, never back.
      if (stageMovesBatch) await batches.save({ ...batch, status: stage });
    } else if (existing && isOg) {
      await events.save({ ...existing, ...fields, type, og: true });
      if (parsed !== batch.og) await batches.save({ ...batch, og: parsed });
    } else if (existing && isReview) {
      // Editing a rating entry by hand keeps it, even if the batch rating changes again today.
      await events.save({ ...existing, ...fields, auto: false });
    } else if (existing && kind === 'ingredient' && linkedLine) {
      await events.save({ ...existing, ...fields, type });
      if (updateList) await batches.save({ ...batch, ingredients: batch.ingredients.map((l) => (l.id === linkedLine.id ? lineFromEntry(l, fields) : l)) });
    } else if (kind === 'ingredient' && addToList) {
      const line: IngredientLine = { id: newId(), name: picked?.name ?? '', amount: picked?.amount ?? '', quantity: picked?.quantity, unit: picked?.unit, ingredientId: picked?.ingredientId, stage: lineStage };
      line.cost = currentCost(line, await ingredients.list());
      await batches.save({ ...batch, ingredients: [...batch.ingredients, line] });
      await events.save({ ...(existing ?? {}), ...fields, type, ingredientLineId: line.id });
    } else if (existing) {
      await events.save({ ...existing, ...fields, type });
    } else {
      await events.save({ ...fields, type });
    }
    // "Set as the batch rating": updates the batch only. The tasting itself is the timeline record,
    // so no separate "Batch rating" entry is added or replaced.
    // Only one final gravity: a new one takes over from the old.
    if (fields.final && otherFinal) await events.save({ ...otherFinal, final: false });
    // Sugar that ferments after the final reading means fermentation isn't over: that reading stops being final.
    if (removesFinal && otherFinal) await events.save({ ...otherFinal, final: false });
    const rateBatch = type === 'tasting' && setAsBatch && rating != null && rating !== batch.rating;
    if (rateBatch) await batches.save({ ...batch, rating });
    toast(rateBatch ? 'Saved, and the batch rating updated' : existing ? 'Entry updated' : 'Added to the timeline');
    onClose();
    if (type === 'backsweeten' && fields.ferments && !(existing?.ferments) && isFermentationComplete(batch)) onRestart();
  };

  const whenField = (
    <Field label="When">
      <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
    </Field>
  );

  return (
    <Sheet title={isOg ? 'Original gravity' : existing ? 'Edit entry' : 'Add to timeline'} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {isReview ? (
          <p className="field-hint">Logged when the batch rating was set. Changing it here doesn't change the batch's current rating.</p>
        ) : isStage ? (
          <Field label="Stage">
            <select value={stage} onChange={(e) => setStage(e.target.value as BatchStatus)}>
              {BATCH_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id === 'bottled' ? 'Bottled' : `Moved to ${statusLabel(s.id)}`}
                </option>
              ))}
            </select>
          </Field>
        ) : isOg ? null : (
          <fieldset className="entry-types">
            <legend className="field-label">What happened?</legend>
            <div className="entry-grid" role="radiogroup" aria-label="What happened?">
              {/* An older Fining, Nutrients or Yeast pitched entry keeps its own type. */}
              {[...ENTRY_CHOICES, ...(ENTRY_CHOICES.some((t) => t.id === gridChoice(type)) ? [] : [{ id: type, label: eventLabel(type) }])].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={gridChoice(type) === t.id}
                  aria-label={t.label}
                  className="entry-choice"
                  onClick={() => {
                    if (type === t.id) return;
                    setType(t.id);
                    setValue('');
                    setError('');
                  }}
                >
                  <Icon name={EVENT_ICONS[t.id]} size={22} />
                  <span>{SHORT_LABELS[t.id] ?? t.label}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {newStage && (
          <>
            <Field label="Move to" hint={
                !stageIsNewest
                  ? 'Earlier than the latest stage change, so this only records when it happened.'
                  : stage === batch.status
                    ? 'The batch is already in this stage; this records when it got there.'
                    : stageMovesBatch
                      ? 'The batch moves to this stage.'
                      : `The batch is already in ${statusLabel(batch.status)}, so this only records when it happened. Use the stage buttons at the top to move it back.`
              }>
              <select value={stage} onChange={(e) => setStage(e.target.value as BatchStatus)}>
                {BATCH_STATUSES.filter((s) => s.id !== 'archived').map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            {whenField}
            {stageAsksFinal && (
              <>
                <h3 className="stage-divider">Final reading</h3>
                <FinalReadingFields value={{ ...final, date: final.date || date }} onChange={setFinal} abvSoFar={batchAbv(batch, batchEntries)} />
              </>
            )}
          </>
        )}
        {kind === 'sg' && (
          <Field
            label={isOg ? 'Original gravity' : 'Specific gravity'}
            hint={isOg ? "The batch's OG: changing it here changes the OG. If you took it after starting the batch, set When to that day." : 'Read it off your hydrometer, for example 1.045.'}
          >
            <input type="text" inputMode="decimal" value={value} placeholder="1.045" autoFocus={!existing} onChange={(e) => setValue(e.target.value)} />
          </Field>
        )}
        {type === 'gravity' && !isStage && !isOg && (
          <>
            <label className="check-field">
              <input type="checkbox" checked={isFinal} onChange={(e) => setIsFinal(e.target.checked)} />
              Final gravity reading
            </label>
            <p className={otherFinal ? 'field-hint final-hint' : 'field-hint'}>
              {otherFinal
                ? isFinal
                  ? `This reading will become your new final gravity, replacing ${fmtSG(otherFinal.value)} from ${fmtDateShort(otherFinal.date)}.`
                  : `This batch already has a final gravity reading: ${fmtSG(otherFinal.value)} on ${fmtDateShort(otherFinal.date)}.`
                : isFinal
                  ? 'Where fermentation ended. Moving to Aging or bottling won\'t ask for it again.'
                  : 'Tick this for the reading where fermentation ended.'}
            </p>
          </>
        )}
        {type === 'gravity' && !existing && (
          <button
            type="button"
            className="btn btn-quiet btn-small"
            // Start the estimate at the ABV so far, so it's easy to keep or adjust.
            onClick={() => {
              const soFar = batchAbv(batch, batchEntries);
              setType('estimate');
              setValue(soFar != null ? soFar.toFixed(1) : '');
              setError('');
            }}
          >
            No reading? Enter an estimated ABV
          </button>
        )}
        {kind === 'temp' && (
          <UnitField
            label="Temperature"
            value={value}
            placeholder={tempUnit === 'F' ? '68' : '20'}
            onChange={setValue}
            unit={tempUnit}
            units={TEMP_UNITS}
            onUnit={setTempUnit}
            hint={tempUnit !== settings.tempUnit && tempFromInput(value, tempUnit) != null ? `= ${fmtTemp(tempFromInput(value, tempUnit), settings.tempUnit)}` : undefined}
          />
        )}
        {kind === 'ph' && (
          <Field label="pH">
            <input type="text" inputMode="decimal" value={value} placeholder="3.6" onChange={(e) => setValue(e.target.value)} />
          </Field>
        )}
        {kind === 'sg-after' && (
          <>
            <Field label="Gravity after adding (optional)" hint="Take a reading once it is mixed in, so the added sugar is counted.">
              <input type="text" inputMode="decimal" value={value} placeholder="1.030" onChange={(e) => setValue(e.target.value)} />
            </Field>
            {type === 'backsweeten' && sweetness && (
              <p className="sweetness" aria-live="polite">
                <strong>{sweetness.label}</strong> <span className="muted">({sweetness.range})</span>
              </p>
            )}
            {type === 'backsweeten' && (
              <>
                <label className="check-field">
                  <input type="checkbox" checked={ferments} onChange={(e) => setFerments(e.target.checked)} />
                  This will ferment
                </label>
                <p className="field-hint">
                  {ferments
                    ? 'The added sugar raises the potential ABV, for example after adding yeast again.'
                    : 'Tick this if you expect the added sugar to ferment, so it raises the potential ABV.'}
                </p>
              </>
            )}
            {type === 'feeding' && <p className="field-hint">The added sugar raises the potential ABV.</p>}
          </>
        )}
        {kind === 'ingredient' && ingredient.fields}
        {kind === 'ingredient' && whenField}
        {kind === 'ingredient' && linkedLine && (
          <label className="check-field">
            <input type="checkbox" checked={updateList} onChange={(e) => setUpdateList(e.target.checked)} />
            Also update batch ingredients
          </label>
        )}
        {kind === 'ingredient' && !linkedLine && (
          <label className="check-field">
            <input type="checkbox" checked={addToList} onChange={(e) => setAddToList(e.target.checked)} />
            Add to batch ingredients
          </label>
        )}
        {kind === 'ingredient' && !linkedLine && addToList && (
          <Field label="Stage" hint={pickedLineStage ? undefined : 'Secondary while the batch was in Secondary on this date, otherwise Primary.'}>
            <select value={lineStage} onChange={(e) => setLineStage(e.target.value as IngredientStage)}>
              {INGREDIENT_STAGES.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        {kind === 'method' && (
          <Field label="Method">
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              {STABILIZE_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
        )}
        {pasteurizing && (
          <div className="form-pair">
            <UnitField
              label="Temperature (optional)"
              value={pasteurTemp}
              placeholder={tempUnit === 'F' ? '160' : '70'}
              onChange={setPasteurTemp}
              unit={tempUnit}
              units={TEMP_UNITS}
              onUnit={setTempUnit}
            />
            <Field label="Time (minutes)">
              <input type="text" inputMode="decimal" value={minutes} placeholder="15" onChange={(e) => setMinutes(e.target.value)} />
            </Field>
          </div>
        )}
        {kind === 'rating' && (
          <>
            <RatingInput value={rating} onChange={setRating} />
            {type === 'tasting' && (
              <>
                <label className="check-field">
                  <input type="checkbox" checked={setAsBatch && rating != null} disabled={rating == null} onChange={(e) => setSetAsBatch(e.target.checked)} />
                  Set as the batch rating
                </label>
                {setAsBatch && rating != null && batch.rating != null && batch.rating !== rating && (
                  <p className="field-hint">Replaces the current batch rating of {fmtRating(batch.rating)}.</p>
                )}
                <Field label="Taster (optional)" hint="Leave empty if it was you.">
                  <input type="text" list="known-tasters" value={taster} placeholder="Sam" onChange={(e) => setTaster(e.target.value)} />
                </Field>
                <datalist id="known-tasters">
                  {knownTasters.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </>
            )}
          </>
        )}
        {kind === 'abv' && (
          <>
            <Field label="Estimated ABV (%)" hint="Shown with ≈. A gravity reading logged after it replaces it.">
              <input type="text" inputMode="decimal" value={value} placeholder="12" autoFocus={!existing} onChange={(e) => setValue(e.target.value)} />
            </Field>
            {!existing && (
              <button
                type="button"
                className="btn btn-quiet btn-small"
                onClick={() => {
                  setType('gravity');
                  setValue('');
                  setError('');
                }}
              >
                Enter a gravity reading instead
              </button>
            )}
          </>
        )}
        {removesFinal && otherFinal && (
          <p className="warning" role="note">
            This will remove the Final tag from the {fmtSG(otherFinal.value)} gravity reading on {fmtDateShort(otherFinal.date)}, since fermentation isn't over yet.
          </p>
        )}
        {kind === 'place' && (
          <Field label="Where to?" hint="Somewhere you keep batches, such as Basement or Closet shelf.">
            <input type="text" value={place} placeholder="Basement" autoFocus={!existing} onChange={(e) => setPlace(e.target.value)} />
          </Field>
        )}
        {kind !== 'ingredient' && !newStage && whenField}
        <Field label="Note (optional)">
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {isStage && existing?.auto && (
          <p className="field-hint">Saving changes here keeps this entry, even if you tap another stage later today.</p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block">
          {existing ? 'Save changes' : 'Save entry'}
        </button>
        {existing &&
          (confirmingDelete ? (
            <div className="confirm-inline" role="group" aria-label="Confirm removal">
              <p>{isOg ? "Remove the OG? This also clears the batch's original gravity." : 'Remove this entry from the timeline?'}</p>
              <div className="button-row">
                <button type="button" className="btn" onClick={() => setConfirmingDelete(false)}>
                  Keep it
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={async () => {
                    await events.remove(existing.id);
                    if (isOg) await batches.save({ ...batch, og: null });
                    toast(isOg ? 'OG removed' : 'Entry removed');
                    onClose();
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-danger-quiet btn-block" onClick={() => setConfirmingDelete(true)}>
              <Icon name="trash" size={20} />
              Remove entry
            </button>
          ))}
      </form>
      {kind === 'ingredient' && ingredient.sheet}
    </Sheet>
  );
}
