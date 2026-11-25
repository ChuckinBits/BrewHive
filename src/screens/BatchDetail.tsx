// One batch: its numbers, gravity chart, rating and timeline.

import { useState } from 'react';
import { volumeUnitOf } from '../lib/units.ts';
import { archiveBatch, changeStatus, setBatchRating, unarchiveBatch } from '../db/actions.ts';
import { batches, categoriesOf, cellar, events, ingredients, recipes, saveSettings, useQuery, useSettings } from '../db/store.ts';
import { BATCH_STATUSES, EVENT_TYPES, eventLabel, INGREDIENT_STAGES, STABILIZE_METHODS, eventTitle, statusLabel, type Batch, type BatchEvent, type BatchStatus, type EventType, type IngredientLine, type IngredientStage, type LibraryIngredient, type Settings, type TempUnit } from '../db/types.ts';
import { GravityChart } from '../components/GravityChart.tsx';
import { LoggableIngredients, anyToLog, useIngredientFields } from '../components/StagedIngredients.tsx';
import { CostFacts, currentCost } from '../components/CostCard.tsx';
import { RecipeSheet } from '../components/RecipeSheet.tsx';
import { ConfirmSheet, Field, RatingBadge, RatingInput, Sheet, Stat, TEMP_UNITS, TopBar, UnitField, toast } from '../components/ui.tsx';
import { Icon, type IconName } from '../icons/Icon.tsx';
import { CategoryIcon } from '../icons/CategoryIcon.tsx';
import { categoryIcon } from '../lib/library.ts';
import {
  abvEstimate,
  fmtPoints,
  batchAbv,
  finalReading,
  pointsNeeded,
  currentGravity,
  finalGravity,
  chartPoints,
  attenuation,
  daysToTarget,
  fermentationRate,
  isFermenting,
  sweetnessOf,
  isActive,
  isFermentationComplete,
  analyzeGravity,
  originalGravity,
  projectedAbv,
  targetReached,
} from '../lib/batch.ts';
import { addedLines, currentIngredientStage, entryFromLine, ingredientStageAt, ingredientStageLabel, lineFromEntry, timelineSections } from '../lib/stages.ts';
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
  estimate: 'flask',
  status: 'flag',
  moved: 'pin',
  ingredient: 'plus',
  review: 'star',
  note: 'note',
};

/**
 * When a tapped ingredient went in, to start the Log sheet at: primary ingredients (nutrients too)
 * at the batch start date, at the time of day it is now; everything else now.
 */
function logDateFor(line: IngredientLine, batch: Batch): string {
  const now = nowLocal();
  if ((line.stage ?? 'primary') !== 'primary' || !batch.startDate || batch.startDate >= today()) return now;
  return `${batch.startDate}T${now.slice(11, 16)}`;
}

/** The batch stage an ingredient stage's "Move to" button moves to. */
const STATUS_FOR_STAGE: Record<IngredientStage, BatchStatus> = { primary: 'primary', secondary: 'secondary', aging: 'aging', bottling: 'bottled' };

/** Logs one of a batch's ingredients on the timeline, asking when it went in. */
function LogIngredientSheet({ batch, line, onClose }: { batch: Batch; line: IngredientLine; onClose: () => void }) {
  const [date, setDate] = useState(() => logDateFor(line, batch));
  const [error, setError] = useState('');
  const save = async () => {
    if (!date) return setError('Enter when it went in.');
    await events.save({ batchId: batch.id, type: 'ingredient', date, value: null, note: '', ...entryFromLine(line), ingredientLineId: line.id });
    toast(`${line.name} logged on the timeline`);
    onClose();
  };
  return (
    <Sheet title={`Log ${line.name}`} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <p>
          {line.amount ? `${line.amount} of ${line.name}` : line.name}, from {ingredientStageLabel(line.stage ?? 'primary')} ingredients.
        </p>
        <Field label="When" hint={(line.stage ?? 'primary') === 'primary' ? 'Starts at the batch start date.' : undefined}>
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block">
          Add to timeline
        </button>
      </form>
    </Sheet>
  );
}

/** The short value shown after an entry's title, such as "1.045", "3.60" or "1 oz". */
function eventValue(event: BatchEvent, settings: Settings): string {
  if (event.type === 'ingredient') return event.amount ?? '';
  if (event.type === 'stabilize') {
    // Pasteurization: "Pasteurization · 160 °F for 15 min".
    const held = [event.value != null ? fmtTempBoth(event.value, event.tempUnit, settings.tempUnit) : '', event.minutes != null ? `${event.minutes} min` : ''].filter(Boolean).join(' for ');
    return [event.method ?? '', held].filter(Boolean).join(' · ');
  }
  if (event.value == null) return '';
  if (event.type === 'gravity') return fmtSG(event.value);
  if (event.type === 'feeding' || event.type === 'backsweeten') return `→ ${fmtSG(event.value)}`;
  if (event.type === 'temperature') return fmtTempBoth(event.value, event.tempUnit, settings.tempUnit);
  // The title already says pH, so only the number.
  if (event.type === 'ph') return event.value.toFixed(2);
  if (event.type === 'estimate') return `≈ ${fmtPercent(event.value)}`;
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

  const library = useQuery(() => ingredients.list()) ?? [];
  const categories = categoriesOf(settings);
  // An ingredient entry shows its category's icon; other entries, their type's.
  const iconFor = (event: BatchEvent) => {
    const category = entryCategory(event, library);
    const found = category ? categories.find((c) => c.id === category) : undefined;
    const id = found ? categoryIcon(found) : null;
    return id ? <CategoryIcon id={id} size={20} strokeWidth={1.75} /> : <Icon name={EVENT_ICONS[event.type]} size={20} />;
  };
  const titleOf = (event: BatchEvent) => eventTitle(event, entryCategory(event, library));

  // null: closed. 'new': adding an entry. An event: editing that entry.
  const [entry, setEntry] = useState<BatchEvent | 'new' | null>(null);
  // Bottling: false when closed; otherwise the Bottled timeline entry it was opened from, if any.
  const [bottling, setBottling] = useState<{ entry: BatchEvent | null } | false>(false);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [archiving, setArchiving] = useState(false);
  // Moving from fermenting to Aging asks for the final reading.
  const [finishing, setFinishing] = useState(false);
  // An ingredient being logged from the Ingredients card.
  const [logging, setLogging] = useState<IngredientLine | null>(null);
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
  const projected = projectedAbv(og == null ? null : og + addedSugar, batch);
  const reached = targetReached(batch, data.events);
  // Progress, in Details: how far it has fermented, how fast (while fermenting), and how long to go.
  const attenuationNow = attenuation(batch, data.events);
  const rate = isFermenting(batch.status) ? fermentationRate(batch, data.events) : null;
  const toTarget = daysToTarget(batch, data.events);

  const currentStage = currentIngredientStage(batch.status);
  const added = addedLines(data.events);
  // Hide Add and the "Tap an ingredient" hint only show while something is left to log.
  const toLog = anyToLog(batch.ingredients, currentStage, added);

  const setStatus = async (status: BatchStatus) => {
    // Bottling asks how many bottles first, then fills the cellar. Tapping Bottled again adds more.
    if (status === 'bottled') return setBottling({ entry: null });
    if (status === batch.status) return;
    if (status === 'aging' && !complete && !finalReading(data.events)) return setFinishing(true);
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
        <Stat label={complete || finalReading(data.events) ? 'FG' : 'Gravity'} value={fmtSG(sg)} />
        <Stat label={complete || finalReading(data.events) ? 'ABV' : 'ABV so far'} value={estimated ? `≈ ${fmtPercent(abv)}` : fmtPercent(abv)} extra={estimated ? 'Estimated' : undefined} />
        <Stat
          label="Potential"
          value={fmtPercent(projected?.potential)}
          highlight
          extra={
            projected == null ? undefined : projected.mode === 'abv' && projected.target != null ? (
              // Two lines, so it fits a phone. Drier than 0.990 can't be counted on: show the range of sugar it needs (to 0.990 and to 1.000).
              <>
                Target {fmtPercent(projected.target)}
                <br />
                {projected.reachable ? (
                  `FG ${fmtSG(projected.targetFG)}`
                ) : (
                  // Its own line, so the range fits a phone-width tile.
                  <>
                    needs
                    <br />
                    {fmtPoints(pointsNeeded(projected.targetFG))} pts
                  </>
                )}
              </>
            ) : projected.showTarget && projected.target != null ? (
              `Target ${fmtPercent(projected.target)}`
            ) : projected.potentialFG < 0.9995 ? (
              // Worked out to a target FG below 1.000.
              `at ${fmtSG(projected.potentialFG)}`
            ) : undefined
          }
        />
      </div>

      {reached && projected?.target != null && (
        <p className="notice-inline target-reached" role="status">
          <strong>Target reached.</strong> {fmtPercent(abv)} of the {fmtPercent(projected.target)} you aimed for. Time to stabilize?
        </p>
      )}

      <GravityChart points={chartPoints(batch, data.events)} />

      <section className="card">
        <RatingInput value={batch.rating} onChange={(rating) => setBatchRating(batch, rating)} />
      </section>

      <section className="card">
        <h2>Details</h2>
        <dl className="facts">
          {batch.volumeL != null && (
            <>
              <dt>Volume</dt>
              <dd>{fmtVolumeBoth(batch.volumeL, batch.volumeUnit, volumeUnitOf(settings))}</dd>
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
          {attenuationNow != null && (
            <>
              <dt>Attenuation</dt>
              <dd>{Math.round(attenuationNow)}%</dd>
            </>
          )}
          {rate != null && (
            <>
              <dt>Fermentation rate</dt>
              <dd>{rate < 10 ? rate.toFixed(1) : Math.round(rate)} pts/day</dd>
            </>
          )}
          {toTarget && (
            <>
              <dt>To {fmtSG(toTarget.targetFG)}</dt>
              <dd>{toTarget.days < 1 ? 'Less than a day' : `About ${Math.ceil(toTarget.days)} ${Math.ceil(toTarget.days) === 1 ? 'day' : 'days'}`}</dd>
            </>
          )}
          <CostFacts lines={batch.ingredients} volumeL={batch.volumeL} />
        </dl>
      </section>

      {batch.ingredients.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Ingredients</h2>
            <div className="card-head-actions">
              <Link to={`/batches/${batch.id}/edit?section=ingredients`} className="btn btn-quiet btn-small" aria-label="Edit ingredients">
                Edit
              </Link>
              {/* For people who keep the list but don't log it: hides + Add on every batch. */}
              {toLog && (
                <button
                  type="button"
                  className="btn btn-quiet btn-small"
                  aria-pressed={!!settings.hideIngredientAdd}
                  onClick={() => void saveSettings({ hideIngredientAdd: !settings.hideIngredientAdd })}
                >
                  {settings.hideIngredientAdd ? 'Show Add' : 'Hide Add'}
                </button>
              )}
            </div>
          </div>
          {toLog && !settings.hideIngredientAdd && (
            <p className="field-hint">Tap an ingredient when it goes in, to log it on the timeline.</p>
          )}
          <LoggableIngredients
            lines={batch.ingredients}
            current={currentStage}
            added={added}
            onLog={(line) => setLogging(line)}
            canAdd={!settings.hideIngredientAdd}
            onMoveTo={batch.status === 'archived' ? undefined : (stage) => void setStatus(STATUS_FOR_STAGE[stage])}
          />
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
                  <button
                    type="button"
                    className="timeline-entry"
                    // The Bottled entry opens bottling, to add bottles; its own date and removal are a tap further.
                    onClick={() => (isBottledEntry(event) ? setBottling({ entry: event }) : setEntry(event))}
                    aria-label={isBottledEntry(event) ? `Bottling, ${fmtDate(event.date)}` : `Edit ${titleOf(event)}, ${fmtDate(event.date)}`}
                  >
                    <span className="timeline-icon">
                      {iconFor(event)}
                    </span>
                    <span className="timeline-body">
                      <span className="timeline-head">
                        <strong className="timeline-title">
                          <span>
                            {titleOf(event)}
                            {eventValue(event, settings) && <span className="timeline-value"> {eventValue(event, settings)}</span>}
                            {event.type === 'gravity' && event.final && (
                              <>
                                {' '}
                                <span className="final-chip">Final</span>
                              </>
                            )}
                            {event.type === 'gravity' && event.og && (
                              <>
                                {' '}
                                <span className="og-chip">OG</span>
                              </>
                            )}
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
          <button type="button" className="btn" onClick={() => setBottling({ entry: null })}>
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
      {logging && <LogIngredientSheet batch={batch} line={logging} onClose={() => setLogging(null)} />}
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
      {bottling && (
        <BottleSheet
          batch={batch}
          timeline={data.events}
          entry={bottling.entry}
          onEditEntry={(e) => {
            setBottling(false);
            setEntry(e);
          }}
          onClose={() => setBottling(false)}
        />
      )}
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

/** What a new entry can be: the entry types, plus a stage change. */
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

/** An ingredient entry's category, from your ingredients: by its link, or by name. */
function entryCategory(event: BatchEvent, library: LibraryIngredient[]): string | undefined {
  if (event.type !== 'ingredient') return undefined;
  const name = event.ingredient?.trim().toLowerCase();
  const item = (event.ingredientId && library.find((i) => i.id === event.ingredientId)) || (name ? library.find((i) => i.name.trim().toLowerCase() === name) : undefined);
  return item?.category;
}

/** Adds a timeline entry, or edits one: its kind, date, reading and note. */
function EventSheet({ batch, settings, existing, onClose, onRestart }: EventSheetProps) {
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

/** Moving from Primary or Secondary to Aging: fermentation is done, so ask for the final reading. */
function FinishSheet({ batch, timeline, onClose }: { batch: Batch; timeline: BatchEvent[]; onClose: () => void }) {
  const [final, setFinal] = useState<FinalReading>(NO_FINAL_READING);
  const [error, setError] = useState('');
  const save = async () => {
    const problem = finalReadingError(final);
    if (problem) return setError(problem);
    await saveFinalReading(batch.id, final, nowLocal());
    await changeStatus(batch, 'aging');
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
          abvSoFar={batchAbv(batch, timeline)}
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

/** A Bottled stage entry on the timeline. */
const isBottledEntry = (e: BatchEvent) => e.type === 'status' && e.toStatus === 'bottled';

interface BottleSheetProps {
  batch: Batch;
  timeline: BatchEvent[];
  /** The Bottled timeline entry it was opened from, if any. */
  entry: BatchEvent | null;
  /** Opens that entry's own sheet, to change its date or remove it. */
  onEditEntry: (entry: BatchEvent) => void;
  onClose: () => void;
}

function BottleSheet({ batch, timeline, entry, onEditEntry, onClose }: BottleSheetProps) {
  const alreadyBottled = batch.status === 'bottled';
  // A Bottled entry with no bottles on it yet (marked bottled without the cellar) gets the bottles added now.
  const emptyEntry = entry && !entry.note ? entry : !entry ? [...timeline].reverse().find((e) => isBottledEntry(e) && !e.note && !e.deletedAt) ?? null : null;
  // Bottled straight from fermenting: ask for the final reading too.
  const asksFinal = !isFermentationComplete(batch) && !finalReading(timeline);
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
    if (asksFinal) await saveFinalReading(batch.id, final, now);
    const latest = (await events.list()).filter((e) => e.batchId === batch.id);
    const abv = batchAbv(batch, latest);
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
          abvEstimated: abvEstimate(batch, latest) != null,
          icon: batch.icon,
          extraIcons: batch.extraIcons ?? [],
          color: batch.color,
          rating: batch.rating,
          notes: line.unit === 'other' ? line.container.trim() : '',
        }),
      );
    }
    if (!alreadyBottled) await batches.save({ ...batch, status: 'bottled' });
    // A bottling entry records real bottles, so it is never replaced by a later stage tap.
    if (emptyEntry) await events.save({ ...emptyEntry, note: bottlingNote(lines), auto: false });
    else
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

  // Bottled, without putting bottles in the cellar (kegged, given away, or counted later).
  const markBottled = async () => {
    const problem = asksFinal ? finalReadingError(final) : null;
    if (problem) return setError(problem);
    const now = nowLocal();
    if (asksFinal) await saveFinalReading(batch.id, final, now);
    await batches.save({ ...batch, status: 'bottled' });
    await events.save({ batchId: batch.id, type: 'status', date: now, value: null, note: '', toStatus: 'bottled', fromStatus: batch.status, auto: false });
    toast('Marked as bottled');
    onClose();
  };

  const total = totalMl(lines);

  return (
    <Sheet title={alreadyBottled ? 'Add bottles' : 'Bottle this batch'} onClose={onClose}>
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
            <FinalReadingFields value={final} onChange={(next) => { setError(''); setFinal(next); }} latest={finalGravity(timeline)} abvSoFar={batchAbv(batch, timeline)} />
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
        {!alreadyBottled && (
          <button type="button" className="btn btn-quiet btn-block" onClick={() => void markBottled()}>
            Mark as bottled without adding to the cellar
          </button>
        )}
        {entry && (
          <button type="button" className="btn btn-quiet btn-block" onClick={() => onEditEntry(entry)}>
            <Icon name="edit" size={18} />
            Edit timeline entry
          </button>
        )}
      </form>
    </Sheet>
  );
}
