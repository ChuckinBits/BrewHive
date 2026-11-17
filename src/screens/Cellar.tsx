// The cellar: bottled brews waiting to be enjoyed, with a pour log.

import { useState } from 'react';
import { batches, cellar, pours, usePrefs, useQuery } from '../db/store.ts';
import { MEAD_STYLES, POUR_TYPES, type CellarEntry, type PourType } from '../db/types.ts';
import { IconPicker } from '../components/IconPicker.tsx';
import { Collection, SortSelect, ViewToggle, byRating, type ShelfEntry } from '../components/Shelf.tsx';
import { Bottle } from '../components/Vessels.tsx';
import { ConfirmSheet, EmptyState, Fab, Field, RatingBadge, RatingInput, Segmented, Sheet, Stat, TopBar, toast } from '../components/ui.tsx';
import { DEFAULT_FLAVOR, getFlavor } from '../icons/FlavorIcon.tsx';
import { Icon } from '../icons/Icon.tsx';
import { fmtBottle, fmtDate, fmtDateShort, fmtPercent, parseNum, plural, today } from '../lib/format.ts';
import { Link, navigate } from '../lib/router.tsx';

const SORTS = [
  { id: 'newest', label: 'Newest' },
  { id: 'rating', label: 'Rating' },
  { id: 'name', label: 'Name' },
  { id: 'ready', label: 'Ready first' },
];

const isReady = (entry: CellarEntry) => entry.count > 0 && entry.bestAfter != null && entry.bestAfter <= today();

function readiness(entry: CellarEntry): string {
  if (entry.count === 0) return 'All gone';
  if (!entry.bestAfter) return 'In the cellar';
  return entry.bestAfter <= today() ? 'Ready to drink' : `Best after ${fmtDateShort(entry.bestAfter)}`;
}

export function CellarScreen() {
  const { view, sort, setView, setSort } = usePrefs('cellar', 'newest');
  const list = useQuery(() => cellar.list());
  if (!list) return <TopBar title="Cellar" />;

  const sorted = [...list].sort((a, b) => {
    // Empty entries always go last.
    if ((a.count === 0) !== (b.count === 0)) return a.count === 0 ? 1 : -1;
    if (sort === 'rating') return byRating(a, b);
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'ready') return Number(isReady(b)) - Number(isReady(a)) || (a.bestAfter ?? '9999').localeCompare(b.bestAfter ?? '9999');
    return b.bottledDate.localeCompare(a.bottledDate);
  });

  const total = list.reduce((sum, entry) => sum + entry.count, 0);

  const items: ShelfEntry[] = sorted.map((entry) => ({
    key: entry.id,
    to: `/cellar/${entry.id}`,
    visual: <Bottle icon={entry.icon} color={entry.color} empty={entry.count === 0} />,
    icon: entry.icon,
    title: entry.name,
    subtitle: view === 'shelf' ? `${entry.count} × ${fmtBottle(entry.bottleSizeMl)}` : `${fmtBottle(entry.bottleSizeMl)} · ${readiness(entry)}`,
    meta: `× ${entry.count}`,
    rating: entry.rating,
    glow: isReady(entry),
  }));

  return (
    <>
      <TopBar title="Cellar">{list.length > 0 && <ViewToggle value={view} onChange={setView} />}</TopBar>
      {list.length === 0 ? (
        <EmptyState art={<Bottle icon="traditional" color="#E8A33A" size={132} />} title="Nothing in the cellar yet">
          <p>Bottle a batch and it lands here automatically. You can also add bottles you already have.</p>
          <div className="button-row button-row-center">
            <Link to="/cellar/new" className="btn btn-primary">
              Add bottles
            </Link>
          </div>
        </EmptyState>
      ) : (
        <>
          <div className="toolbar">
            <span className="muted">{plural(total, 'bottle')}</span>
            <SortSelect value={sort} options={SORTS} onChange={setSort} />
          </div>
          <Collection view={view} items={items} />
          <Fab to="/cellar/new" label="Add bottles" />
        </>
      )}
    </>
  );
}

export function CellarDetailScreen({ id }: { id: string }) {
  const data = useQuery(async () => {
    const entry = (await cellar.get(id)) ?? null;
    if (!entry) return { entry: null, pours: [], batch: null };
    return {
      entry,
      pours: (await pours.list()).filter((p) => p.cellarEntryId === id).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
      batch: entry.batchId ? ((await batches.get(entry.batchId)) ?? null) : null,
    };
  }, [id]);
  const [pouring, setPouring] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!data) return <TopBar title="Cellar" back="/cellar" />;
  const { entry } = data;
  if (!entry) {
    return (
      <>
        <TopBar title="Cellar" back="/cellar" />
        <p className="notice">These bottles are no longer in the cellar.</p>
      </>
    );
  }

  return (
    <>
      <TopBar title={entry.name} back="/cellar">
        <Link to={`/cellar/${entry.id}/edit`} className="icon-btn" aria-label="Edit cellar entry">
          <Icon name="edit" />
        </Link>
      </TopBar>

      <section className="hero">
        <RatingBadge rating={entry.rating} reserve />
        <span className={isReady(entry) ? 'shelf-glow' : undefined}>
          <Bottle icon={entry.icon} color={entry.color} empty={entry.count === 0} size={168} />
        </span>
        <p className="hero-sub">
          {entry.style || 'Mead'} · {readiness(entry)}
        </p>
        <button type="button" className="btn btn-primary" disabled={entry.count === 0} onClick={() => setPouring(true)}>
          <Icon name="glass" size={20} />
          Log a pour
        </button>
      </section>

      <div className="stats">
        <Stat label={entry.count === 1 ? 'Bottle left' : 'Bottles left'} value={entry.count} />
        <Stat label="Size" value={fmtBottle(entry.bottleSizeMl)} />
        <Stat label="ABV" value={fmtPercent(entry.abv)} />
        <Stat label="Bottled" value={fmtDateShort(entry.bottledDate)} />
      </div>

      <section className="card">
        <RatingInput value={entry.rating} onChange={(rating) => cellar.save({ ...entry, rating })} />
      </section>

      <section className="card">
        <h2>Details</h2>
        <dl className="facts">
          <dt>Bottled</dt>
          <dd>{fmtDate(entry.bottledDate)}</dd>
          {entry.bestAfter && (
            <>
              <dt>Best after</dt>
              <dd>{fmtDate(entry.bestAfter)}</dd>
            </>
          )}
          {entry.location && (
            <>
              <dt>Stored</dt>
              <dd>{entry.location}</dd>
            </>
          )}
          {data.batch && (
            <>
              <dt>Batch</dt>
              <dd>
                <Link to={`/batches/${data.batch.id}`}>{data.batch.name}</Link>
              </dd>
            </>
          )}
        </dl>
        {entry.notes && <p className="prose">{entry.notes}</p>}
      </section>

      <section className="card">
        <h2>Pours</h2>
        {data.pours.length === 0 ? (
          <p className="muted">No bottles opened yet.</p>
        ) : (
          <ol className="timeline">
            {data.pours.map((pour) => (
              <li key={pour.id}>
                <span className="timeline-icon">
                  <Icon name="glass" size={20} />
                </span>
                <div className="timeline-body">
                  <div className="timeline-head">
                    <strong>
                      {POUR_TYPES.find((t) => t.id === pour.type)?.label} {plural(pour.count, 'bottle')}
                    </strong>
                    <time dateTime={pour.date}>{fmtDateShort(pour.date)}</time>
                  </div>
                  {pour.note && <p>{pour.note}</p>}
                </div>
                <RatingBadge rating={pour.rating} />
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="button-row">
        <button type="button" className="btn btn-danger-quiet" onClick={() => setDeleting(true)}>
          <Icon name="trash" size={20} />
          Delete
        </button>
      </div>

      {pouring && <PourSheet entry={entry} onClose={() => setPouring(false)} />}
      {deleting && (
        <ConfirmSheet
          title="Remove from the cellar?"
          message={`"${entry.name}" and its pour history will be deleted.`}
          confirmLabel="Delete"
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await cellar.remove(entry.id);
            toast('Removed from the cellar');
            navigate('/cellar', { replace: true });
          }}
        />
      )}
    </>
  );
}

function PourSheet({ entry, onClose }: { entry: CellarEntry; onClose: () => void }) {
  const [count, setCount] = useState('1');
  const [type, setType] = useState<PourType>('drank');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [error, setError] = useState('');

  const save = async () => {
    const bottles = parseNum(count);
    if (bottles == null || bottles < 1 || !Number.isInteger(bottles)) return setError('Enter how many bottles.');
    if (bottles > entry.count) return setError(`Only ${plural(entry.count, 'bottle')} left.`);
    await pours.save({ cellarEntryId: entry.id, date: date || today(), count: bottles, type, note: note.trim(), rating });
    await cellar.save({ ...entry, count: entry.count - bottles });
    toast(entry.count - bottles === 0 ? 'That was the last bottle' : 'Pour logged');
    onClose();
  };

  return (
    <Sheet title="Log a pour" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Segmented label="What happened to it?" value={type} options={POUR_TYPES} onChange={setType} />
        <div className="form-pair">
          <Field label="Bottles">
            <input type="text" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
          </Field>
          <Field label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Tasting note (optional)">
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <RatingInput value={rating} onChange={setRating} />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block">
          Save pour
        </button>
      </form>
    </Sheet>
  );
}

interface Draft {
  name: string;
  style: string;
  count: string;
  bottleSizeMl: string;
  bottledDate: string;
  bestAfter: string;
  location: string;
  abv: string;
  icon: string;
  color: string;
  notes: string;
}

export function CellarFormScreen({ id }: { id?: string }) {
  const loaded = useQuery<{ draft: Draft; existing: CellarEntry | null } | null>(async () => {
    if (!id) {
      return {
        existing: null,
        draft: {
          name: '',
          style: '',
          count: '6',
          bottleSizeMl: '750',
          bottledDate: today(),
          bestAfter: '',
          location: '',
          abv: '',
          icon: DEFAULT_FLAVOR,
          color: getFlavor(DEFAULT_FLAVOR).color,
          notes: '',
        },
      };
    }
    const entry = await cellar.get(id);
    if (!entry) return null;
    return {
      existing: entry,
      draft: {
        name: entry.name,
        style: entry.style,
        count: String(entry.count),
        bottleSizeMl: String(entry.bottleSizeMl),
        bottledDate: entry.bottledDate,
        bestAfter: entry.bestAfter ?? '',
        location: entry.location,
        abv: entry.abv != null ? String(entry.abv) : '',
        icon: entry.icon,
        color: entry.color,
        notes: entry.notes,
      },
    };
  }, [id]);

  const back = id ? `/cellar/${id}` : '/cellar';
  const title = id ? 'Edit bottles' : 'Add bottles';
  if (loaded === undefined) return <TopBar title={title} back={back} />;
  if (loaded === null) {
    return (
      <>
        <TopBar title={title} back="/cellar" />
        <p className="notice">These bottles are no longer in the cellar.</p>
      </>
    );
  }
  return <CellarForm key={id ?? 'new'} draft={loaded.draft} existing={loaded.existing} back={back} title={title} />;
}

function CellarForm({ draft: initial, existing, back, title }: { draft: Draft; existing: CellarEntry | null; back: string; title: string }) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState('');
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    const name = draft.name.trim();
    if (!name) return setError('Give these bottles a name.');
    const count = parseNum(draft.count);
    if (count == null || count < 0 || !Number.isInteger(count)) return setError('Bottles should be a whole number.');
    const size = parseNum(draft.bottleSizeMl);
    if (size == null || size <= 0) return setError('Bottle size should be a number of milliliters, such as 750.');
    const abv = parseNum(draft.abv);
    if (draft.abv.trim() !== '' && (abv == null || abv < 0 || abv > 25)) return setError('ABV should be a percentage between 0 and 25.');

    const saved = await cellar.save({
      ...(existing ?? { batchId: null, rating: null }),
      name,
      style: draft.style.trim(),
      count,
      bottleSizeMl: size,
      bottledDate: draft.bottledDate || today(),
      bestAfter: draft.bestAfter || null,
      location: draft.location.trim(),
      abv,
      icon: draft.icon,
      color: draft.color,
      notes: draft.notes.trim(),
    });
    toast(existing ? 'Changes saved' : 'Added to the cellar');
    navigate(`/cellar/${saved.id}`, { replace: true });
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
          <input type="text" value={draft.name} placeholder="Bramble Melomel 2026" autoFocus={!existing} onChange={(e) => set({ name: e.target.value })} />
        </Field>

        <IconPicker icon={draft.icon} color={draft.color} onChange={set} />

        <Field label="Style">
          <input type="text" list="mead-styles" value={draft.style} placeholder="Melomel" onChange={(e) => set({ style: e.target.value })} />
        </Field>
        <datalist id="mead-styles">
          {MEAD_STYLES.map((style) => (
            <option key={style} value={style} />
          ))}
        </datalist>

        <div className="form-pair">
          <Field label="Bottles">
            <input type="text" inputMode="numeric" value={draft.count} onChange={(e) => set({ count: e.target.value })} />
          </Field>
          <Field label="Bottle size (mL)">
            <input type="text" inputMode="numeric" value={draft.bottleSizeMl} onChange={(e) => set({ bottleSizeMl: e.target.value })} />
          </Field>
        </div>

        <div className="form-pair">
          <Field label="Bottled on">
            <input type="date" value={draft.bottledDate} onChange={(e) => set({ bottledDate: e.target.value })} />
          </Field>
          <Field label="Best after (optional)">
            <input type="date" value={draft.bestAfter} onChange={(e) => set({ bestAfter: e.target.value })} />
          </Field>
        </div>

        <div className="form-pair">
          <Field label="ABV % (optional)">
            <input type="text" inputMode="decimal" value={draft.abv} placeholder="13.5" onChange={(e) => set({ abv: e.target.value })} />
          </Field>
          <Field label="Stored (optional)">
            <input type="text" value={draft.location} placeholder="Basement rack" onChange={(e) => set({ location: e.target.value })} />
          </Field>
        </div>

        <Field label="Notes">
          <textarea rows={3} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block">
          {existing ? 'Save changes' : 'Add to cellar'}
        </button>
      </form>
    </>
  );
}
