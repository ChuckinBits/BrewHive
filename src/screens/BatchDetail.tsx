// One batch: its numbers, gravity chart, rating and timeline.

import { useState } from 'react';
import { batches, cellar, events, recipes, useQuery, useSettings } from '../db/store.ts';
import { BATCH_STATUSES, EVENT_TYPES, eventLabel, type Batch, type BatchEvent, type BatchStatus, type EventType, type Settings } from '../db/types.ts';
import { GravityChart } from '../components/GravityChart.tsx';
import { IngredientList } from '../components/IngredientEditor.tsx';
import { Carboy } from '../components/Vessels.tsx';
import { ConfirmSheet, Field, RatingBadge, RatingInput, Sheet, Stat, TopBar, toast } from '../components/ui.tsx';
import { Icon, type IconName } from '../icons/Icon.tsx';
import { batchAbv, currentGravity, fillLevel, gravityPoints, isActive, originalGravity } from '../lib/batch.ts';
import { daysBetween } from '../lib/calc.ts';
import { fmtDate, fmtDateShort, fmtPercent, fmtSG, fmtTemp, fmtVolume, parseNum, tempFromInput, toDateInput, today } from '../lib/format.ts';
import { Link, navigate } from '../lib/router.tsx';
import { batchSubtitle } from './Batches.tsx';

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
  note: 'note',
};

function eventValue(event: BatchEvent, settings: Settings): string {
  if (event.value == null) return '';
  if (event.type === 'gravity') return fmtSG(event.value);
  if (event.type === 'temperature') return fmtTemp(event.value, settings.tempUnit);
  if (event.type === 'ph') return `pH ${event.value.toFixed(2)}`;
  return String(event.value);
}

function nowLocal(): string {
  const d = new Date();
  return `${toDateInput(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function BatchDetailScreen({ id }: { id: string }) {
  const settings = useSettings();
  const data = useQuery(async () => {
    const batch = await batches.get(id);
    if (!batch) return { batch: null, events: [], recipe: null };
    const all = await events.list();
    return {
      batch,
      events: all.filter((e) => e.batchId === id).sort((a, b) => b.date.localeCompare(a.date)),
      recipe: batch.recipeId ? ((await recipes.get(batch.recipeId)) ?? null) : null,
    };
  }, [id]);

  const [adding, setAdding] = useState(false);
  const [bottling, setBottling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removing, setRemoving] = useState<BatchEvent | null>(null);

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
  const day = batch.startDate <= today() ? daysBetween(batch.startDate, today()) + 1 : null;

  const setStatus = async (status: BatchStatus) => {
    if (status === batch.status) return;
    if (status === 'bottled') {
      setBottling(true);
      return;
    }
    const label = BATCH_STATUSES.find((s) => s.id === status)?.label ?? status;
    await batches.save({ ...batch, status });
    await events.save({ batchId: batch.id, type: 'status', date: nowLocal(), value: null, note: `Moved to ${label}` });
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
        <Carboy icon={batch.icon} color={batch.color} level={fillLevel(batch.status)} fermenting={batch.status === 'primary'} size={168} />
        <p className="hero-sub">
          {batch.style || 'Mead'} · {batchSubtitle(batch)}
        </p>
      </section>

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

      <div className="stats">
        <Stat label="OG" value={fmtSG(og)} />
        <Stat label={batch.fg != null ? 'FG' : 'Gravity'} value={fmtSG(sg)} />
        <Stat label="ABV" value={fmtPercent(abv)} />
        <Stat label={isActive(batch.status) ? 'Day' : 'Started'} value={isActive(batch.status) ? (day ?? '–') : fmtDateShort(batch.startDate)} />
      </div>

      <GravityChart points={gravityPoints(batch, data.events)} />

      <section className="card">
        <RatingInput value={batch.rating} onChange={(rating) => batches.save({ ...batch, rating })} />
      </section>

      {(batch.ingredients.length > 0 || batch.volumeL != null || data.recipe) && (
        <section className="card">
          <h2>Details</h2>
          <dl className="facts">
            {batch.volumeL != null && (
              <>
                <dt>Volume</dt>
                <dd>{fmtVolume(batch.volumeL, settings.volumeUnit)}</dd>
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
          <IngredientList lines={batch.ingredients} />
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
          <button type="button" className="btn btn-primary btn-small" onClick={() => setAdding(true)}>
            <Icon name="plus" size={18} />
            Add entry
          </button>
        </div>
        {data.events.length === 0 ? (
          <p className="muted">Nothing logged yet. Add a gravity reading or a note to start the timeline.</p>
        ) : (
          <ol className="timeline">
            {data.events.map((event) => (
              <li key={event.id}>
                <span className="timeline-icon">
                  <Icon name={EVENT_ICONS[event.type]} size={20} />
                </span>
                <div className="timeline-body">
                  <div className="timeline-head">
                    <strong>
                      {event.type === 'status' ? event.note : eventLabel(event.type)}
                      {event.value != null && <span className="timeline-value"> {eventValue(event, settings)}</span>}
                    </strong>
                    <time dateTime={event.date}>{fmtDateShort(event.date)}</time>
                  </div>
                  {event.type !== 'status' && event.note && <p>{event.note}</p>}
                </div>
                <button type="button" className="icon-btn icon-btn-quiet" aria-label={`Remove ${eventLabel(event.type)} entry`} onClick={() => setRemoving(event)}>
                  <Icon name="trash" size={18} />
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="button-row">
        {isActive(batch.status) && (
          <button type="button" className="btn" onClick={() => setBottling(true)}>
            <Icon name="cellar" size={20} />
            Bottle this batch
          </button>
        )}
        <button type="button" className="btn btn-danger-quiet" onClick={() => setDeleting(true)}>
          <Icon name="trash" size={20} />
          Delete
        </button>
      </div>

      {adding && <AddEventSheet batch={batch} settings={settings} onClose={() => setAdding(false)} />}
      {bottling && <BottleSheet batch={batch} abv={abv} finalGravity={sg} onClose={() => setBottling(false)} />}
      {removing && (
        <ConfirmSheet
          title="Remove this entry?"
          message={`${eventLabel(removing.type)} from ${fmtDate(removing.date)} will be removed from the timeline.`}
          confirmLabel="Remove"
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await events.remove(removing.id);
            setRemoving(null);
          }}
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

function AddEventSheet({ batch, settings, onClose }: { batch: Batch; settings: Settings; onClose: () => void }) {
  const [type, setType] = useState<EventType>('gravity');
  const [date, setDate] = useState(nowLocal());
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const kind = EVENT_TYPES.find((t) => t.id === type)?.value;

  const save = async () => {
    let parsed: number | null = null;
    if (kind === 'sg') {
      parsed = parseNum(value);
      if (parsed == null || parsed < 0.98 || parsed > 1.2) return setError('Enter a gravity between 0.980 and 1.200, such as 1.045.');
    } else if (kind === 'temp') {
      parsed = tempFromInput(value, settings.tempUnit);
      if (parsed == null) return setError('Enter a temperature.');
    } else if (kind === 'ph') {
      parsed = parseNum(value);
      if (parsed == null || parsed < 0 || parsed > 14) return setError('Enter a pH between 0 and 14.');
    }
    await events.save({ batchId: batch.id, type, date: date || nowLocal(), value: parsed, note: note.trim() });
    toast('Added to the timeline');
    onClose();
  };

  return (
    <Sheet title="Add to timeline" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
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
        {kind === 'sg' && (
          <Field label="Specific gravity" hint="Read it off your hydrometer, for example 1.045.">
            <input type="text" inputMode="decimal" value={value} placeholder="1.045" autoFocus onChange={(e) => setValue(e.target.value)} />
          </Field>
        )}
        {kind === 'temp' && (
          <Field label={`Temperature (°${settings.tempUnit})`}>
            <input type="text" inputMode="decimal" value={value} placeholder={settings.tempUnit === 'F' ? '68' : '20'} onChange={(e) => setValue(e.target.value)} />
          </Field>
        )}
        {kind === 'ph' && (
          <Field label="pH">
            <input type="text" inputMode="decimal" value={value} placeholder="3.6" onChange={(e) => setValue(e.target.value)} />
          </Field>
        )}
        <Field label="When">
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Note (optional)">
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block">
          Save entry
        </button>
      </form>
    </Sheet>
  );
}

const BOTTLE_SIZES = [187, 330, 375, 500, 750, 1000];

function BottleSheet({ batch, abv, finalGravity, onClose }: { batch: Batch; abv: number | null; finalGravity: number | null; onClose: () => void }) {
  const [count, setCount] = useState('5');
  const [size, setSize] = useState(750);
  const [bottledDate, setBottledDate] = useState(today());
  const [bestAfter, setBestAfter] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');

  const save = async () => {
    const bottles = parseNum(count);
    if (bottles == null || bottles < 1 || !Number.isInteger(bottles)) return setError('Enter how many bottles you filled.');
    const entry = await cellar.save({
      batchId: batch.id,
      name: batch.name,
      style: batch.style,
      bottleSizeMl: size,
      count: bottles,
      bottledDate,
      bestAfter: bestAfter || null,
      location: location.trim(),
      abv: abv != null ? Number(abv.toFixed(1)) : null,
      icon: batch.icon,
      color: batch.color,
      rating: batch.rating,
      notes: '',
    });
    await batches.save({ ...batch, status: 'bottled', fg: batch.fg ?? finalGravity });
    await events.save({ batchId: batch.id, type: 'status', date: nowLocal(), value: null, note: `Bottled ${bottles} ${bottles === 1 ? 'bottle' : 'bottles'}` });
    toast('Bottles added to your cellar');
    onClose();
    navigate(`/cellar/${entry.id}`);
  };

  return (
    <Sheet title="Bottle this batch" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="form-pair">
          <Field label="Bottles filled">
            <input type="text" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
          </Field>
          <Field label="Bottle size">
            <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
              {BOTTLE_SIZES.map((ml) => (
                <option key={ml} value={ml}>
                  {ml >= 1000 ? `${ml / 1000} L` : `${ml} mL`}
                </option>
              ))}
            </select>
          </Field>
        </div>
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
