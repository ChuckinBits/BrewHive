// One batch: its numbers, gravity chart, rating and timeline.

import { useState } from 'react';
import { volumeUnitOf } from '../lib/units.ts';
import { archiveBatch, changeStatus, rackInto, setBatchRating, unarchiveBatch, undoSplit } from '../db/actions.ts';
import { canUndoSplit, subBatchesOf, timelineOf } from '../lib/split.ts';
import { SplitSheet } from './batch/SplitSheet.tsx';
import { VesselField } from '../components/VesselField.tsx';
import { getAll } from '../db/idb.ts';
import { fillsOf, fmtHeadspace, headspace, listNames, rackedInto, vesselsOf, vesselTypeLabel } from '../lib/equipment.ts';
import { batches, categoriesOf, equipment, events, ingredients, recipes, saveSettings, useQuery, useSettings } from '../db/store.ts';
import { BATCH_STATUSES, eventTitle, statusLabel, type Batch, type BatchEvent, type Equipment, type BatchStatus, type IngredientLine, type IngredientStage, type VesselFill, type VolumeUnit } from '../db/types.ts';
import { GravityChart } from '../components/GravityChart.tsx';
import { LoggableIngredients, anyToLog } from '../components/StagedIngredients.tsx';
import { CostFacts } from '../components/CostCard.tsx';
import { RecipeSheet } from '../components/RecipeSheet.tsx';
import { ConfirmSheet, RatingBadge, RatingCard, Sheet, Stat, TopBar, toast } from '../components/ui.tsx';
import { Icon } from '../icons/Icon.tsx';
import { CategoryIcon } from '../icons/CategoryIcon.tsx';
import { categoryIcon } from '../lib/library.ts';
import {
  abvEstimate,
  fmtPoints,
  batchAbv,
  finalReading,
  pointsNeeded,
  currentGravity,
  chartLine,
  gravityNow,
  sweetnessEntries,
  sweetnessOf,
  attenuation,
  daysToTarget,
  fermentationRate,
  isFermenting,
  isActive,
  isFermentationComplete,
  analyzeGravity,
  originalGravity,
  projectedAbv,
  targetReached,
} from '../lib/batch.ts';
import { addedLines, currentIngredientStage, timelineSections } from '../lib/stages.ts';
import { fmtDate, fmtDateShort, fmtPercent, fmtSG, fmtVolume, fmtVolumeBoth, nowLocal } from '../lib/format.ts';
import { Link, navigate } from '../lib/router.tsx';
import { BatchArt, batchSubtitle } from './Batches.tsx';
import { EVENT_ICONS, entryCategory, eventValue, isBottledEntry, newestFirst } from './batch/entries.ts';
import { EventSheet } from './batch/EventSheet.tsx';
import { FinishSheet } from './batch/FinishSheet.tsx';
import { BottleSheet } from './batch/BottleSheet.tsx';
import { LogIngredientSheet } from './batch/LogIngredientSheet.tsx';

/** The batch stage an ingredient stage's "Move to" button moves to. */
const STATUS_FOR_STAGE: Record<IngredientStage, BatchStatus> = { primary: 'primary', secondary: 'secondary', aging: 'aging', bottling: 'bottled' };

export function BatchDetailScreen({ id }: { id: string }) {
  const settings = useSettings();
  const data = useQuery(async () => {
    const batch = await batches.get(id);
    if (!batch) return { batch: null, events: [], inherited: new Set<string>(), recipe: null, equipment: [], allBatches: [] as Batch[] };
    const all = await events.list();
    const allBatches = await batches.list();
    // A sub-batch's timeline starts with the history of the batch it was split from.
    const timeline = timelineOf(batch, allBatches, all);
    return {
      batch,
      events: timeline.events.sort(newestFirst),
      inherited: timeline.inherited,
      recipe: batch.recipeId ? ((await recipes.get(batch.recipeId)) ?? null) : null,
      equipment: await equipment.list(),
      allBatches,
      allEvents: all,
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
  // Every vessel, deleted ones too, so an old Racked entry still says where it went.
  const vesselNames = useQuery(async () => new Map((await getAll<Equipment>('equipment')).map((e) => [e.id, e.name]))) ?? new Map<string, string>();
  const titleOf = (event: BatchEvent) => {
    const into = event.type === 'rack' ? rackedInto(event) : undefined;
    if (into) {
      const names = into.map((f) => vesselNames.get(f.vesselId)).filter((n): n is string => !!n);
      return names.length ? `Racked into ${listNames(names)}` : 'Racked';
    }
    return eventTitle(event, entryCategory(event, library));
  };

  // null: closed. 'new': adding an entry. An event: editing that entry.
  const [entry, setEntry] = useState<BatchEvent | 'new' | null>(null);
  // Bottling: false when closed; otherwise the Bottled timeline entry it was opened from, if any.
  const [bottling, setBottling] = useState<{ entry: BatchEvent | null } | false>(false);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [archiving, setArchiving] = useState(false);
  // Moving from fermenting to Aging asks for the final reading.
  // 'stabilized': offered after a Stabilized entry, rather than asked for by the Aging button.
  const [finishing, setFinishing] = useState<false | true | 'stabilized'>(false);
  // An ingredient being logged from the Ingredients card.
  const [logging, setLogging] = useState<IngredientLine | null>(null);
  // Backsweetening ticked to ferment after fermentation ended: offer to go back to Secondary.
  const [restarting, setRestarting] = useState(false);
  // Offered after moving to Secondary, when you track vessels: which one it was racked into.
  const [racking, setRacking] = useState(false);
  // After racking into several vessels: offered sub-batches.
  const [splitting, setSplitting] = useState<{ fills: VesselFill[]; date: string } | null>(null);
  const [undoingSplit, setUndoingSplit] = useState(false);
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
  // How sweet it is: under Gravity while fermenting (where it would stop), and in its own tile after,
  // where backsweetening can take it above the FG.
  const now = gravityNow(batch, data.events);
  const final = finalReading(data.events);
  const sweetShown = sweetnessEntries(data.events);
  const reached = targetReached(batch, data.events);
  // Progress, in Details: how far it has fermented, how fast (while fermenting), and how long to go.
  const attenuationNow = attenuation(batch, data.events);
  const rate = isFermenting(batch.status) ? fermentationRate(batch, data.events) : null;
  const toTarget = daysToTarget(batch, data.events);

  const currentStage = currentIngredientStage(batch.status);
  const added = addedLines(data.events);
  // Hide Add and the "Tap an ingredient" hint only show while something is left to log.
  const toLog = anyToLog(batch.ingredients, currentStage, added);

  const hasVessels = data.equipment.some((e) => e.kind === 'vessel');
  const parentBatch = batch.parentId ? data.allBatches.find((b) => b.id === batch.parentId) : undefined;
  const subBatches = batch.status === 'split' ? subBatchesOf(batch, data.allBatches) : [];
  const undoable = batch.status === 'split' && canUndoSplit(batch, subBatches, data.allEvents ?? []);
  const inVessels = vesselsOf(batch, data.equipment);
  const vesselUnit = batch.volumeUnit ?? volumeUnitOf(settings);
  const setStatus = async (status: BatchStatus) => {
    // Bottling asks how many bottles first, then fills the cellar. Tapping Bottled again adds more.
    if (status === 'bottled') return setBottling({ entry: null });
    if (status === batch.status) return;
    if (status === 'aging' && !complete && !finalReading(data.events)) return setFinishing(true);
    await changeStatus(batch, status);
    if (status === 'secondary' && batch.status === 'primary' && hasVessels) setRacking(true);
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

      {parentBatch && (
        <p className="split-from muted">
          Split from <Link to={`/batches/${parentBatch.id}`}>{parentBatch.name}</Link> on {fmtDate(batch.splitAt)}. Its history up to then is part of this timeline.
        </p>
      )}

      {batch.status === 'split' ? (
        <div className="archived-note split-note">
          <span>
            <strong>Split on {fmtDate(batch.splitAt)}</strong>
            <span className="muted">
              Into{' '}
              {subBatches.map((b, i) => (
                <span key={b.id}>
                  {i > 0 && (i === subBatches.length - 1 ? ' and ' : ', ')}
                  <Link to={`/batches/${b.id}`}>{b.name}</Link>
                </span>
              ))}
              . They carry on from here.
            </span>
          </span>
          {undoable && (
            <button type="button" className="btn btn-small" onClick={() => setUndoingSplit(true)}>
              Undo split
            </button>
          )}
        </div>
      ) : batch.status === 'archived' ? (
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
          {BATCH_STATUSES.filter((s) => s.id !== 'archived' && s.id !== 'split').map((status) => (
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

      {/* ABV is the number that matters, so it gets the accent. Potential only says where the batch
          is heading, so while fermenting it's the fourth tile; from Aging on that tile is the gravity now. */}
      <div className="stats">
        <Stat label="OG" value={fmtSG(og)} extra={addedSugar > 0.0005 ? `+${Math.round(addedSugar * 1000)} pts fed` : undefined} />
        <Stat label={complete || final ? 'FG' : 'Gravity'} value={fmtSG(sg)} extra={!complete && sg != null ? sweetnessOf(sg).label : undefined} />
        <Stat label={complete || final ? 'ABV' : 'ABV so far'} value={estimated ? `≈ ${fmtPercent(abv)}` : fmtPercent(abv)} highlight extra={estimated ? 'Estimated' : undefined} />
        {complete ? (
          <Stat label="Now" value={now == null ? '—' : fmtSG(now)} extra={now == null ? 'Take a reading' : sweetnessOf(now).label} />
        ) : (
          <Stat
            label="Potential"
            value={fmtPercent(projected?.potential)}
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
        )}
      </div>

      {reached && projected?.target != null && (
        <p className="notice-inline target-reached" role="status">
          <strong>Target reached.</strong> {fmtPercent(abv)} of the {fmtPercent(projected.target)} you aimed for. Time to stabilize?
        </p>
      )}

      <GravityChart line={chartLine(batch, data.events)} />

      <RatingCard value={batch.rating} name={batch.name} onChange={(rating) => setBatchRating(batch, rating)} />

      <section className="card">
        <h2>Details</h2>
        <dl className="facts">
          {batch.volumeL != null && (
            <>
              <dt>Volume</dt>
              <dd>{fmtVolumeBoth(batch.volumeL, batch.volumeUnit, volumeUnitOf(settings))}</dd>
            </>
          )}
          {inVessels.length > 0 && (
            <>
              <dt>{inVessels.length > 1 ? 'Vessels' : 'Vessel'}</dt>
              <dd>
                {inVessels.map(({ vessel, volumeL }) => {
                  const room = headspace(vessel.capacityL, volumeL);
                  return (
                    <span key={vessel.id} className="vessel-line">
                      <Link to="/equipment">{vessel.name}</Link>
                      {vessel.name.toLowerCase().includes(vesselTypeLabel(vessel).toLowerCase()) ? '' : ` (${vesselTypeLabel(vessel).toLowerCase()})`}
                      {inVessels.length > 1 && volumeL != null && ` · ${fmtVolume(volumeL, vesselUnit)}`}
                      {room && <span className={room.liters < -0.005 ? 'vessel-room vessel-over' : 'vessel-room'}>{fmtHeadspace(room, vesselUnit)}</span>}
                    </span>
                  );
                })}
              </dd>
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
          {batch.status !== 'split' && (
            <button type="button" className="btn btn-primary btn-small" onClick={() => setEntry('new')}>
              <Icon name="plus" size={18} />
              Add entry
            </button>
          )}
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
                    // An entry from before a split belongs to the batch it was split from: open that batch.
                    onClick={() => (data.inherited.has(event.id) ? navigate(`/batches/${event.batchId}`) : isBottledEntry(event) ? setBottling({ entry: event }) : setEntry(event))}
                    aria-label={data.inherited.has(event.id) ? `${titleOf(event)}, ${fmtDate(event.date)}, from ${parentBatch?.name ?? 'the batch it was split from'}` : isBottledEntry(event) ? `Bottling, ${fmtDate(event.date)}` : `Edit ${titleOf(event)}, ${fmtDate(event.date)}`}
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
                            {sweetShown.has(event.id) && event.value != null && <span className="timeline-sweet"> · {sweetnessOf(event.value).label}</span>}
                            {event.type === 'gravity' && event.id === final?.id && (
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
        <EventSheet batch={batch} settings={settings} existing={entry === 'new' ? null : entry} onClose={() => setEntry(null)} onRestart={() => setRestarting(true)} onStabilized={() => setFinishing('stabilized')} onSecondary={() => hasVessels && setRacking(true)} onSeveral={(fills, date) => setSplitting({ fills, date })} />
      )}
      {logging && <LogIngredientSheet batch={batch} line={logging} onClose={() => setLogging(null)} />}
      {racking && <RackSheet batch={batch} unit={batch.volumeUnit ?? volumeUnitOf(settings)} onClose={() => setRacking(false)} onSeveral={(fills, date) => setSplitting({ fills, date })} />}
      {splitting && <SplitSheet batch={batch} fills={splitting.fills} date={splitting.date} unit={batch.volumeUnit ?? volumeUnitOf(settings)} onClose={() => setSplitting(null)} />}
      {undoingSplit && (
        <ConfirmSheet
          title="Undo the split?"
          message={`${listNames(subBatches.map((b) => b.name))} go, and ${batch.name} carries on in their vessels. Nothing was logged on them yet, so nothing is lost.`}
          confirmLabel="Undo split"
          onClose={() => setUndoingSplit(false)}
          onConfirm={async () => {
            await undoSplit(batch.id);
            setUndoingSplit(false);
            toast('Split undone');
          }}
        />
      )}
      {finishing && <FinishSheet batch={batch} timeline={data.events} stabilized={finishing === 'stabilized'} onClose={() => setFinishing(false)} />}
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


/** After moving to Secondary: which vessel it was racked into, logged as a Racked entry. */
function RackSheet({ batch, unit, onClose, onSeveral }: { batch: Batch; unit: VolumeUnit; onClose: () => void; onSeveral: (fills: VesselFill[], date: string) => void }) {
  const [fills, setFills] = useState<VesselFill[]>([]);
  const [error, setError] = useState('');
  return (
    <Sheet title="Racked into a new vessel?" onClose={onClose}>
      <div className="form">
        <p>
          Moving to Secondary usually means racking off the lees. Pick the vessel it went into, or several with how much went in each, and a Racked entry goes on the timeline
          {fillsOf(batch).length ? `. ${fillsOf(batch).length > 1 ? 'The old vessels are' : 'The old vessel is'} free again.` : '.'}
        </p>
        <VesselField
          label="Racked into"
          value={fills}
          onChange={(v) => {
            setFills(v);
            setError('');
          }}
          changesVolume
          batch={batch}
          unit={unit}
          noneLabel="Choose a vessel"
          current={fillsOf(batch).map((f) => f.vesselId)}
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={async () => {
            if (!fills.length) return setError('Choose the vessel it went into, or tap Not now.');
            const date = nowLocal();
            await rackInto(batch.id, fills, date);
            toast('Racked');
            onClose();
            // Into several vessels: offer sub-batches.
            if (fills.length > 1) onSeveral(fills, date);
          }}
        >
          Log racking
        </button>
        <button type="button" className="btn btn-block" onClick={onClose}>
          Not now
        </button>
      </div>
    </Sheet>
  );
}
