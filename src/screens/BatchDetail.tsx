// One batch: its numbers, gravity chart, rating and timeline.

import { useState } from 'react';
import { archiveBatch, changeStatus, setBatchRating, unarchiveBatch } from '../db/actions.ts';
import { batches, cellar, events, recipes, useQuery, useSettings } from '../db/store.ts';
import { BATCH_STATUSES, EVENT_TYPES, STABILIZE_METHODS, eventTitle, statusLabel, type Batch, type BatchEvent, type BatchStatus, type EventType, type Settings, type TempUnit } from '../db/types.ts';
import { GravityChart } from '../components/GravityChart.tsx';
import { LoggableIngredients } from '../components/StagedIngredients.tsx';
import { RecipeSheet } from '../components/RecipeSheet.tsx';
import { ConfirmSheet, Field, RatingBadge, RatingInput, Sheet, Stat, TEMP_UNITS, TopBar, UnitField, toast } from '../components/ui.tsx';
import { Icon, type IconName } from '../icons/Icon.tsx';
import {
  abvEstimate,
  batchAbv,
  currentGravity,
  finalGravity,
  gravityPoints,
  isActive,
  isFermentationComplete,
  analyzeGravity,
  originalGravity,
  projectedAbv,
  targetFinalGravity,
} from '../lib/batch.ts';
import { addedLines, currentIngredientStage, ingredientStageLabel, stageForNewIngredient, timelineSections } from '../lib/stages.ts';
import { fmtBottle, fmtDate, fmtDateShort, fmtPercent, fmtRating, fmtSG, fmtTemp, fmtTempBoth, fmtVolumeBoth, newId, nowLocal, parseNum, tempFromInput, tempToInput, today } from '../lib/format.ts';
import { BOTTLE_UNITS, bottlingError, bottlingNote, lineBottleMl, newLine, suggestCount, totalMl, type BottleLine, type BottleUnit } from '../lib/bottling.ts';
import { Link, navigate } from '../lib/router.tsx';
import { BatchArt, batchSubtitle } from './Batches.tsx';
import { FinalReadingFields, NO_FINAL_READING, finalReadingError, saveFinalReading, type FinalReading } from '../components/FinalReading.tsx';

const EVENT_ICONS: Record<EventType, IconName> = {
  gravity: 'droplet',
  temperature: 'thermometer',
  ph: 'flask',
  nutrient: 'nutrient',
  feeding: 'honey',
  rack: 'rack',
  stabilize: 'check',
  backsweeten: 'honey',
  fining: 'sparkle',
  tasting: 'glass',
  pitch: 'yeast',
  status: 'flag',
  moved: 'pin',
  ingredient: 'plus',
  review: 'star',
  note: 'note',
};

/** The short value shown after an entry's title, such as "1.045", "3.60" or "1 oz". */
function eventValue(event: BatchEvent, settings: Settings): string {
  if (event.type === 'ingredient') return event.amount ?? '';
  if (event.type === 'stabilize') return event.method ?? '';
  if (event.value == null) return '';
  if (event.type === 'gravity') return fmtSG(event.value);
  if (event.type === 'feeding' || event.type === 'backsweeten') return `→ ${fmtSG(event.value)}`;
  if (event.type === 'temperature') return fmtTempBoth(event.value, event.tempUnit, settings.tempUnit);
  // The title already says pH, so only the number.
  if (event.type === 'ph') return event.value.toFixed(2);
  return String(event.value);
}

/** Newest first; entries logged at the same minute keep the order they were added in. */
const newestFirst = (a: BatchEvent, b: BatchEvent) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

export function BatchDetailScreen({ id }: { id: string }) {
  const settings = useSettings();
  const data = useQuery(async () => {
    const batch = await batches.get(id);
    if (!batch) return { batch: null, events: [], recipe: null };
    const all = await events.list();
    return {
      batch,
      events: all.filter((e) => e.batchId === id).sort(newestFirst),
      recipe: batch.recipeId ? ((await recipes.get(batch.recipeId)) ?? null) : null,
    };
  }, [id]);

  // null: closed. 'new': adding an entry. An event: editing that entry.
  const [entry, setEntry] = useState<BatchEvent | 'new' | null>(null);
  const [bottling, setBottling] = useState(false);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [archiving, setArchiving] = useState(false);
  // Moving from fermenting to Aging asks for the final reading.
  const [finishing, setFinishing] = useState(false);
  // Backsweetening ticked to ferment after fermentation ended: offer to go back to Secondary.
  const [restarting, setRestarting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!data) return <TopBar title="Batch" back="/" />;
  const { batch } = data;
  if (!batch) {
    return (
      <>
        <TopBar title="Batch" back="/" />
        <p className="notice">This batch no longer exists.</p>
      </>
    );
  }

  const og = originalGravity(batch, data.events);
  const sg = currentGravity(batch, data.events);
  const abv = batchAbv(batch, data.events);
  const complete = isFermentationComplete(batch);
  const estimated = abvEstimate(batch, data.events) != null;
  const { addedSugar } = analyzeGravity(batch, data.events);
  // Sugar added later by step feeding or backsweetening raises the potential.
  const projected = projectedAbv(og == null ? null : og + addedSugar, targetFinalGravity(batch));

  const currentStage = currentIngredientStage(batch.status);
  const added = addedLines(data.events);

  const setStatus = async (status: BatchStatus) => {
    if (status === batch.status) return;
    // Bottling asks how many bottles first, then fills the cellar.
    if (status === 'bottled') return setBottling(true);
    if (status === 'aging' && !complete) return setFinishing(true);
    await changeStatus(batch, status);
  };

  return (
    <>
      <TopBar title={batch.name} back="/">
        <Link to={`/batches/${batch.id}/edit`} className="icon-btn" aria-label="Edit batch">
          <Icon name="edit" />
        </Link>
      </TopBar>

      <section className="hero">
        <RatingBadge rating={batch.rating} reserve />
        <BatchArt batch={batch} size={168} />
        <p className="hero-sub">
          {batch.style || 'Mead'} · {batchSubtitle(batch)}
        </p>
      </section>

      {batch.status === 'archived' ? (
        <div className="archived-note">
          <span>
            <strong>Archived</strong>
            <span className="muted">Hidden from Active and Bottled. Everything else still works.</span>
          </span>
          <button type="button" className="btn btn-small" onClick={() => void unarchiveBatch(batch).then(() => toast('Batch unarchived'))}>
            Unarchive
          </button>
        </div>
      ) : (
        <div className="steps" role="group" aria-label="Status">
          {BATCH_STATUSES.filter((s) => s.id !== 'archived').map((status) => (
            <button
              key={status.id}
              type="button"
              className={status.id === batch.status ? 'step step-on' : 'step'}
              aria-pressed={status.id === batch.status}
              onClick={() => setStatus(status.id)}
            >
              {status.label}
            </button>
          ))}
        </div>
      )}

      <div className="stats">
        <Stat label="OG" value={fmtSG(og)} extra={addedSugar > 0.0005 ? `+${Math.round(addedSugar * 1000)} pts fed` : undefined} />
        <Stat label={complete ? 'FG' : 'Gravity'} value={fmtSG(sg)} />
        <Stat label={complete ? 'ABV' : 'ABV so far'} value={estimated ? `≈ ${fmtPercent(abv)}` : fmtPercent(abv)} extra={estimated ? 'Estimated' : undefined} />
        <Stat
          label="Potential"
          value={fmtPercent(projected?.potential)}
          highlight
          extra={projected?.target != null ? `Target ${fmtPercent(projected.target)}` : undefined}
        />
      </div>

      <GravityChart points={gravityPoints(batch, data.events)} />

      <section className="card">
        <RatingInput value={batch.rating} onChange={(rating) => setBatchRating(batch, rating)} />
      </section>

      {batch.ingredients.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Ingredients</h2>
            <Link to={`/batches/${batch.id}/edit`} className="btn btn-quiet btn-small">
              Edit
            </Link>
          </div>
          {currentStage && added.size < batch.ingredients.length && (
            <p className="field-hint">Tap an ingredient when it goes in, to log it on the timeline.</p>
          )}
          <LoggableIngredients
            lines={batch.ingredients}
            current={currentStage}
            added={added}
            onLog={async (line) => {
              await events.save({
                batchId: batch.id,
                type: 'ingredient',
                date: nowLocal(),
                value: null,
                note: '',
                ingredient: line.name,
                amount: line.amount,
                ingredientLineId: line.id,
              });
              toast(`${line.name} logged on the timeline`);
            }}
          />
        </section>
      )}

      {(batch.volumeL != null || data.recipe) && (
        <section className="card">
          <h2>Details</h2>
          <dl className="facts">
            {batch.volumeL != null && (
              <>
                <dt>Volume</dt>
                <dd>{fmtVolumeBoth(batch.volumeL, batch.volumeUnit, settings.volumeUnit)}</dd>
              </>
            )}
            <dt>Started</dt>
            <dd>{fmtDate(batch.startDate)}</dd>
            {data.recipe && (
              <>
                <dt>Recipe</dt>
                <dd>
                  <Link to={`/recipes/${data.recipe.id}`}>{data.recipe.name}</Link>
                </dd>
              </>
            )}
          </dl>
        </section>
      )}

      {batch.notes && (
        <section className="card">
          <h2>Notes</h2>
          <p className="prose">{batch.notes}</p>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Timeline</h2>
          <button type="button" className="btn btn-primary btn-small" onClick={() => setEntry('new')}>
            <Icon name="plus" size={18} />
            Add entry
          </button>
        </div>
        {data.events.length === 0 ? (
          <p className="muted">Nothing logged yet. Add a gravity reading or a note to start the timeline.</p>
        ) : (
          <div className="timeline-sections">
            {timelineSections(data.events, batch.status).map((section, index) => (
              <section key={`${section.stage}-${index}`} aria-label={`${statusLabel(section.stage)} stage`}>
                <h3 className="stage-divider">{statusLabel(section.stage)}</h3>
                <ol className="timeline">
                  {section.events.map((event) => {
              // Old stage entries keep their wording in the note, which is already the title.
              const showNote = event.note && !(event.type === 'status' && !event.toStatus);
              return (
                <li key={event.id} className="timeline-row">
                  <button type="button" className="timeline-entry" onClick={() => setEntry(event)} aria-label={`Edit ${eventTitle(event)}, ${fmtDate(event.date)}`}>
                    <span className="timeline-icon">
                      <Icon name={EVENT_ICONS[event.type]} size={20} />
                    </span>
                    <span className="timeline-body">
                      <span className="timeline-head">
                        <strong className="timeline-title">
                          <span>
                            {eventTitle(event)}
                            {eventValue(event, settings) && <span className="timeline-value"> {eventValue(event, settings)}</span>}
                          </span>
                          {(event.type === 'tasting' || event.type === 'review') && <RatingBadge rating={event.rating} small />}
                        </strong>
                        <time dateTime={event.date}>{fmtDateShort(event.date)}</time>
                      </span>
                      {/* Backsweetening usually isn't meant to ferment, so only the exception is marked. */}
                      {event.type === 'backsweeten' && event.ferments === true && <span className="timeline-note">Expected to ferment</span>}
                      {showNote && <span className="timeline-note">{event.note}</span>}
                    </span>
                    <span className="timeline-edit">
                      <Icon name="edit" size={18} />
                    </span>
                  </button>
                </li>
              );
                  })}
                </ol>
              </section>
            ))}
          </div>
        )}
      </section>

      <div className="button-row">
        {isActive(batch.status) && (
          <button type="button" className="btn" onClick={() => setBottling(true)}>
            <Icon name="cellar" size={20} />
            Bottle this batch
          </button>
        )}
        <button type="button" className="btn" onClick={() => setSavingRecipe(true)}>
          <Icon name="recipes" size={20} />
          {data.recipe ? 'Update recipe' : 'Save as recipe'}
        </button>
        {batch.status !== 'archived' && (
          <button type="button" className="btn" onClick={() => setArchiving(true)}>
            <Icon name="archive" size={20} />
            Archive
          </button>
        )}
        <button type="button" className="btn btn-danger-quiet" onClick={() => setDeleting(true)}>
          <Icon name="trash" size={20} />
          Delete
        </button>
      </div>

      {archiving && (
        <ConfirmSheet
          title="Archive this batch?"
          message={`"${batch.name}" moves to the Archived filter and shows as a book on the shelf. You can unarchive it at any time.`}
          confirmLabel="Archive"
          tone="normal"
          onClose={() => setArchiving(false)}
          onConfirm={async () => {
            await archiveBatch(batch);
            setArchiving(false);
            toast('Batch archived');
          }}
        />
      )}

      {savingRecipe && <RecipeSheet batch={batch} events={data.events} recipe={data.recipe} settings={settings} onClose={() => setSavingRecipe(false)} />}
      {entry && (
        <EventSheet batch={batch} settings={settings} existing={entry === 'new' ? null : entry} onClose={() => setEntry(null)} onRestart={() => setRestarting(true)} />
      )}
      {finishing && <FinishSheet batch={batch} timeline={data.events} onClose={() => setFinishing(false)} />}
      {restarting && (
        <ConfirmSheet
          title="Fermenting again?"
          message={`You expect this sugar to ferment, so ${batch.name} is fermenting again. Move it back to Secondary?`}
          confirmLabel="Move to Secondary"
          cancelLabel="Keep it here"
          tone="normal"
          onClose={() => setRestarting(false)}
          onConfirm={async () => {
            setRestarting(false);
            const latest = await batches.get(batch.id);
            if (latest) await changeStatus(latest, 'secondary', latest.status === 'archived' ? { statusBeforeArchive: null } : {});
            toast('Moved back to Secondary');
          }}
        />
      )}
      {bottling && <BottleSheet batch={batch} timeline={data.events} onClose={() => setBottling(false)} />}
      {deleting && (
        <ConfirmSheet
          title="Delete this batch?"
          message={`"${batch.name}" and its timeline will be deleted. Bottles already in the cellar stay.`}
          confirmLabel="Delete batch"
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await batches.remove(batch.id);
            toast('Batch deleted');
            navigate('/', { replace: true });
          }}
        />
      )}
    </>
  );
}

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

/** Adds a timeline entry, or edits one: its kind, date, reading and note. */
function EventSheet({ batch, settings, existing, onClose, onRestart }: EventSheetProps) {
  const isStage = existing?.type === 'status';
  // "Batch rating" entries come from the rating slider; they are edited, not added, here.
  const isReview = existing?.type === 'review';
  const [type, setType] = useState<EventType>(existing?.type ?? 'gravity');
  const [stage, setStage] = useState<BatchStatus>(existing?.toStatus ?? stageFromNote(existing?.note ?? '') ?? batch.status);
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
  const [ingredient, setIngredient] = useState(existing?.ingredient ?? '');
  // New ingredient entries also add the ingredient to the batch's list, ticked off, in the current stage.
  const [addToList, setAddToList] = useState(!existing);
  const [amount, setAmount] = useState(existing?.amount ?? '');
  const [method, setMethod] = useState(existing?.method ?? STABILIZE_METHODS[0]);
  const [rating, setRating] = useState<number | null>(existing?.rating ?? null);

  const [taster, setTaster] = useState(existing?.taster ?? '');
  // New tastings set the batch rating by default. Editing an old tasting leaves the batch alone unless ticked.
  const [setAsBatch, setSetAsBatch] = useState(!existing);
  const allEntries = useQuery(() => events.list());
  const knownTasters = [...new Set((allEntries ?? []).map((e) => e.taster?.trim()).filter((t): t is string => !!t))].sort();

  const kind = isStage ? undefined : isReview ? 'rating' : EVENT_TYPES.find((t) => t.id === type)?.value;

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
    } else if (kind === 'sg-after' && value.trim() !== '') {
      parsed = parseNum(value);
      if (parsed == null || parsed < 0.98 || parsed > 1.2) return setError('Enter the gravity after adding, between 0.980 and 1.200, or leave it empty.');
    } else if (kind === 'place' && !place.trim()) {
      return setError('Enter where the batch went, such as Basement.');
    } else if (kind === 'ingredient' && !ingredient.trim()) {
      return setError('Enter what you added, such as Oak cubes.');
    } else if (isReview && rating == null) {
      return setError('Pick a rating, or remove this entry.');
    }

    const fields = {
      batchId: batch.id,
      date: date || nowLocal(),
      note: note.trim(),
      value: parsed,
      place: kind === 'place' ? place.trim() : undefined,
      ferments: type === 'backsweeten' && ferments ? true : undefined,
      ingredient: kind === 'ingredient' ? ingredient.trim() : undefined,
      amount: kind === 'ingredient' ? amount.trim() : undefined,
      method: kind === 'method' ? method : undefined,
      rating: kind === 'rating' ? rating : undefined,
      taster: type === 'tasting' && taster.trim() ? taster.trim() : undefined,
      tempUnit: kind === 'temp' ? tempUnit : undefined,
    };
    if (existing && isStage) {
      // Editing a stage entry by hand makes it permanent: stage taps later the same day add a new entry instead of replacing it.
      await events.save({ ...existing, ...fields, value: null, toStatus: stage, auto: false });
    } else if (existing && isReview) {
      // Editing a rating entry by hand keeps it, even if the batch rating changes again today.
      await events.save({ ...existing, ...fields, auto: false });
    } else if (existing) {
      await events.save({ ...existing, ...fields, type });
    } else if (kind === 'ingredient' && addToList) {
      const line = { id: newId(), name: fields.ingredient ?? '', amount: fields.amount ?? '', stage: stageForNewIngredient(batch.status) };
      await batches.save({ ...batch, ingredients: [...batch.ingredients, line] });
      await events.save({ ...fields, type, ingredientLineId: line.id });
    } else {
      await events.save({ ...fields, type });
    }
    // "Set as the batch rating": updates the batch only. The tasting itself is the timeline record,
    // so no separate "Batch rating" entry is added or replaced.
    const rateBatch = type === 'tasting' && setAsBatch && rating != null && rating !== batch.rating;
    if (rateBatch) await batches.save({ ...batch, rating });
    toast(rateBatch ? 'Saved, and the batch rating updated' : existing ? 'Entry updated' : 'Added to the timeline');
    onClose();
    if (type === 'backsweeten' && fields.ferments && !(existing?.ferments) && isFermentationComplete(batch)) onRestart();
  };

  return (
    <Sheet title={existing ? 'Edit entry' : 'Add to timeline'} onClose={onClose}>
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
        ) : (
          <Field label="What happened?">
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as EventType);
                setValue('');
                setError('');
              }}
            >
              {EVENT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        {kind === 'sg' && (
          <Field label="Specific gravity" hint="Read it off your hydrometer, for example 1.045.">
            <input type="text" inputMode="decimal" value={value} placeholder="1.045" autoFocus={!existing} onChange={(e) => setValue(e.target.value)} />
          </Field>
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
        {kind === 'ingredient' && (
          <div className="form-pair">
            <Field label="Ingredient">
              <input type="text" value={ingredient} placeholder="Oak cubes" autoFocus={!existing} onChange={(e) => setIngredient(e.target.value)} />
            </Field>
            <Field label="Amount">
              <input type="text" value={amount} placeholder="1 oz" onChange={(e) => setAmount(e.target.value)} />
            </Field>
          </div>
        )}
        {kind === 'ingredient' && !existing && (
          <label className="check-field">
            <input type="checkbox" checked={addToList} onChange={(e) => setAddToList(e.target.checked)} />
            Add to batch ingredients ({ingredientStageLabel(stageForNewIngredient(batch.status))})
          </label>
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
        {kind === 'place' && (
          <Field label="Where to?" hint="Somewhere you keep batches, such as Basement or Closet shelf.">
            <input type="text" value={place} placeholder="Basement" autoFocus={!existing} onChange={(e) => setPlace(e.target.value)} />
          </Field>
        )}
        <Field label="When">
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
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
              <p>Remove this entry from the timeline?</p>
              <div className="button-row">
                <button type="button" className="btn" onClick={() => setConfirmingDelete(false)}>
                  Keep it
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={async () => {
                    await events.remove(existing.id);
                    toast('Entry removed');
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
    </Sheet>
  );
}

/** Moving from Primary or Secondary to Aging: fermentation is done, so ask for the final reading. */
function FinishSheet({ batch, timeline, onClose }: { batch: Batch; timeline: BatchEvent[]; onClose: () => void }) {
  const [final, setFinal] = useState<FinalReading>(NO_FINAL_READING);
  const [error, setError] = useState('');
  const save = async () => {
    const problem = finalReadingError(final);
    if (problem) return setError(problem);
    const patch = await saveFinalReading(batch.id, final, nowLocal());
    await changeStatus(batch, 'aging', patch);
    toast('Moved to Aging');
    onClose();
  };
  return (
    <Sheet title="Move to Aging" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <p>Moving to Aging means fermentation is done. Log the final reading?</p>
        <FinalReadingFields
          value={final}
          onChange={(next) => {
            setError('');
            setFinal(next);
          }}
          latest={finalGravity(timeline)}
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block">
          Move to Aging
        </button>
      </form>
    </Sheet>
  );
}

/** The size a unit starts at when picked. */
const UNIT_START_SIZE: Record<BottleUnit, string> = { ml: '750', floz: '12', cup: '1', pint: '1', quart: '1', l: '1', other: '' };

function BottleSheet({ batch, timeline, onClose }: { batch: Batch; timeline: BatchEvent[]; onClose: () => void }) {
  // Bottled straight from fermenting: ask for the final reading too.
  const asksFinal = !isFermentationComplete(batch);
  const [final, setFinal] = useState<FinalReading>(NO_FINAL_READING);
  const volumeMl = batch.volumeL != null ? batch.volumeL * 1000 : null;
  const [lines, setLines] = useState<BottleLine[]>(() => [newLine(volumeMl)]);
  const [bottledDate, setBottledDate] = useState(today());
  const [bestAfter, setBestAfter] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');

  const update = (id: string, patch: Partial<BottleLine>) => {
    setError('');
    setLines((all) =>
      all.map((line, i) => {
        if (line.id !== id) return line;
        const next = { ...line, ...patch };
        // Until a count is typed, it follows the size and the volume left for this line.
        if (!next.countTyped && ('size' in patch || 'unit' in patch)) {
          const left = volumeMl == null ? null : volumeMl - totalMl(all.slice(0, i));
          next.count = String(suggestCount(left, lineBottleMl(next)));
        }
        return next;
      }),
    );
  };

  const save = async () => {
    const problem = bottlingError(lines) ?? (asksFinal ? finalReadingError(final) : null);
    if (problem) return setError(problem);
    const now = nowLocal();
    // The final reading goes on the timeline first, so the bottles get the ABV it gives.
    const patch = asksFinal ? await saveFinalReading(batch.id, final, now) : {};
    const latest = (await events.list()).filter((e) => e.batchId === batch.id);
    const abv = batchAbv({ ...batch, ...patch }, latest);
    const saved = [];
    for (const line of lines) {
      saved.push(
        await cellar.save({
          batchId: batch.id,
          name: batch.name,
          style: batch.style,
          bottleSizeMl: Math.round(lineBottleMl(line)!),
          count: parseNum(line.count)!,
          bottledDate,
          bestAfter: bestAfter || null,
          location: location.trim(),
          abv: abv != null ? Number(abv.toFixed(1)) : null,
          abvEstimated: abvEstimate({ ...batch, ...patch }, latest) != null,
          icon: batch.icon,
          extraIcons: batch.extraIcons ?? [],
          color: batch.color,
          rating: batch.rating,
          notes: line.unit === 'other' ? line.container.trim() : '',
        }),
      );
    }
    await batches.save({ ...batch, ...patch, status: 'bottled' });
    // A bottling entry records real bottles, so it is never replaced by a later stage tap.
    await events.save({
      batchId: batch.id,
      type: 'status',
      date: now,
      value: null,
      note: bottlingNote(lines),
      toStatus: 'bottled',
      fromStatus: batch.status,
      auto: false,
    });
    toast('Bottles added to your cellar');
    onClose();
    navigate(saved.length === 1 ? `/cellar/${saved[0].id}` : '/cellar');
  };

  const total = totalMl(lines);

  return (
    <Sheet title="Bottle this batch" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {asksFinal && (
          <>
            <h3 className="stage-divider">Final reading</h3>
            <FinalReadingFields value={final} onChange={(next) => { setError(''); setFinal(next); }} latest={finalGravity(timeline)} />
            <h3 className="stage-divider">Bottles</h3>
          </>
        )}
        {lines.map((line, i) => (
          <fieldset key={line.id} className="bottle-line" aria-label={`Bottle size ${i + 1}`}>
            <div className="bottle-line-fields">
              <Field label="Bottles filled">
                <input type="text" inputMode="numeric" value={line.count} onChange={(e) => update(line.id, { count: e.target.value, countTyped: true })} />
              </Field>
              <Field label={line.unit === 'other' ? 'Size (mL)' : 'Size'}>
                <input type="text" inputMode="decimal" value={line.size} onChange={(e) => update(line.id, { size: e.target.value })} />
              </Field>
              <Field label="Unit">
                <select
                  value={line.unit}
                  onChange={(e) => {
                    const unit = e.target.value as BottleUnit;
                    // "Other" is measured in mL, so carry the current size over.
                    const ml = lineBottleMl(line);
                    update(line.id, { unit, size: unit === 'other' ? (ml ? String(Math.round(ml)) : '') : UNIT_START_SIZE[unit] });
                  }}
                >
                  {BOTTLE_UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {line.unit === 'other' && (
              <Field label="Container">
                <input type="text" value={line.container} placeholder="Growler" onChange={(e) => update(line.id, { container: e.target.value })} />
              </Field>
            )}
            {lines.length > 1 && (
              <button type="button" className="btn btn-quiet btn-small bottle-line-remove" onClick={() => setLines((all) => all.filter((l) => l.id !== line.id))}>
                <Icon name="trash" size={16} />
                Remove this size
              </button>
            )}
          </fieldset>
        ))}
        <button type="button" className="btn btn-block" onClick={() => setLines((all) => [...all, newLine(volumeMl, all)])}>
          <Icon name="plus" size={20} />
          Add another size
        </button>
        <p className="bottle-total" aria-live="polite">
          Total: {fmtBottle(total)}
          {volumeMl != null && ` of ${fmtBottle(volumeMl)}`}
          <span className="field-hint">A guide only; some loss when bottling is normal.</span>
        </p>
        <div className="form-pair">
          <Field label="Bottled on">
            <input type="date" value={bottledDate} onChange={(e) => setBottledDate(e.target.value)} />
          </Field>
          <Field label="Best after (optional)">
            <input type="date" value={bestAfter} onChange={(e) => setBestAfter(e.target.value)} />
          </Field>
        </div>
        <Field label="Where are they stored? (optional)">
          <input type="text" value={location} placeholder="Basement rack" onChange={(e) => setLocation(e.target.value)} />
        </Field>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block">
          Add to cellar
        </button>
      </form>
    </Sheet>
  );
}
