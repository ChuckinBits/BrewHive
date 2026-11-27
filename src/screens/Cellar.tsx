// The cellar: bottled brews waiting to be enjoyed, with a pour log.

import { useState } from 'react';
import { batches, cellar, pours, usePrefs, useQuery } from '../db/store.ts';
import { CARB_LEVELS, POUR_TYPES, type Batch, type CarbLevel, type CellarEntry, type Pour, type PourType } from '../db/types.ts';
import { carbLevelLabel } from '../lib/carbonation.ts';
import { archiveBatch } from '../db/actions.ts';
import { CELLAR_FILTERS, inCellarFilter, shouldAskToArchive, shouldResetArchivePrompt, type CellarFilter } from '../lib/cellar.ts';
import { IconPicker } from '../components/IconPicker.tsx';
import { StyleField } from '../components/StyleField.tsx';
import { Collection, SortSelect, ViewToggle, byRating, type ShelfEntry } from '../components/Shelf.tsx';
import { Bottle } from '../components/Vessels.tsx';
import { ConfirmSheet, EmptyState, Fab, Field, RatingBadge, RatingCard, RatingInput, Segmented, Sheet, Stat, TopBar, toast } from '../components/ui.tsx';
import { DEFAULT_FLAVOR, getFlavor, iconsOf } from '../icons/FlavorIcon.tsx';
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
  // Always opens on what is still in the cellar.
  const [filter, setFilter] = useState<CellarFilter>('in');
  if (!list) return <TopBar title="Cellar" />;

  const counts = Object.fromEntries(CELLAR_FILTERS.map((f) => [f.id, list.filter((e) => inCellarFilter(e, f.id)).length])) as Record<CellarFilter, number>;

  const sorted = list.filter((e) => inCellarFilter(e, filter)).sort((a, b) => {
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
    visual: <Bottle icon={entry.icon} extraIcons={entry.extraIcons} color={entry.color} empty={entry.count === 0} carbonated={entry.carbonation != null} />,
    icons: iconsOf(entry),
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
            <div className="chips" role="group" aria-label="Filter cellar">
              {CELLAR_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={f.id === filter ? 'chip chip-on' : 'chip'}
                  aria-pressed={f.id === filter}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label} <span className="chip-count">{counts[f.id]}</span>
                </button>
              ))}
            </div>
            <span className="muted">{plural(total, 'bottle')}</span>
            <SortSelect value={sort} options={SORTS} onChange={setSort} />
          </div>
          {items.length > 0 ? (
            <Collection view={view} items={items} />
          ) : filter === 'in' ? (
            <div className="list-empty">
              <p>Every bottle has been enjoyed.</p>
              <button type="button" className="btn btn-small" onClick={() => setFilter('empty')}>
                See empty bottles
              </button>
            </div>
          ) : (
            <p className="muted list-empty">No empty bottles yet.</p>
          )}
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
  const [editingPour, setEditingPour] = useState<Pour | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [askArchive, setAskArchive] = useState<Batch | null>(null);

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
          <Bottle icon={entry.icon} extraIcons={entry.extraIcons} color={entry.color} empty={entry.count === 0} carbonated={entry.carbonation != null} size={168} />
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
        <Stat label="ABV" value={entry.abvEstimated && entry.abv != null ? `≈ ${fmtPercent(entry.abv)}` : fmtPercent(entry.abv)} extra={entry.abvEstimated && entry.abv != null ? 'Estimated' : undefined} />
        <Stat label="Bottled" value={fmtDateShort(entry.bottledDate)} />
      </div>

      <RatingCard value={entry.rating} name={entry.name} onChange={(rating) => cellar.save({ ...entry, rating })} />

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
          <dt>Carbonation</dt>
          <dd>{entry.carbonation ? carbLevelLabel(entry.carbonation) : 'Still'}</dd>
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
            {data.pours.map((pour) => {
              const title = `${POUR_TYPES.find((t) => t.id === pour.type)?.label} ${plural(pour.count, 'bottle')}`;
              return (
                <li key={pour.id} className="timeline-row">
                  <button type="button" className="timeline-entry" onClick={() => setEditingPour(pour)} aria-label={`Edit ${title}, ${fmtDate(pour.date)}`}>
                    <span className="timeline-icon">
                      <Icon name="glass" size={20} />
                    </span>
                    <span className="timeline-body">
                      <span className="timeline-head">
                        <strong className="timeline-title">
                          <span>{title}</span>
                          <RatingBadge rating={pour.rating} small />
                        </strong>
                        <time dateTime={pour.date}>{fmtDateShort(pour.date)}</time>
                      </span>
                      {pour.note && <span className="timeline-note">{pour.note}</span>}
                    </span>
                    <span className="timeline-edit">
                      <Icon name="edit" size={18} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="button-row">
        <button type="button" className="btn btn-danger-quiet" onClick={() => setDeleting(true)}>
          <Icon name="trash" size={20} />
          Delete
        </button>
      </div>

      {pouring && <PourSheet entry={entry} existing={null} onClose={() => setPouring(false)} onLastBottle={setAskArchive} />}
      {editingPour && <PourSheet entry={entry} existing={editingPour} onClose={() => setEditingPour(null)} onLastBottle={setAskArchive} />}
      {askArchive && (
        <ConfirmSheet
          title="Archive the batch?"
          message={`That was the last bottle of ${askArchive.name}. Archive the batch?`}
          confirmLabel="Archive"
          cancelLabel="Not now"
          tone="normal"
          onClose={async () => {
            setAskArchive(null);
            const latest = await batches.get(askArchive.id);
            if (latest) await batches.save({ ...latest, archivePromptDismissed: true });
          }}
          onConfirm={async () => {
            setAskArchive(null);
            const latest = await batches.get(askArchive.id);
            if (latest) await archiveBatch(latest);
            toast('Batch archived');
          }}
        />
      )}
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

/**
 * Logs a pour, or edits or removes one. Bottles left always follows: a pour
 * takes its bottles from the entry, and editing or removing it puts back
 * what it no longer uses.
 */
function PourSheet({
  entry,
  existing,
  onClose,
  onLastBottle,
}: {
  entry: CellarEntry;
  existing: Pour | null;
  onClose: () => void;
  /** Called when this leaves a bottled batch with no bottles anywhere in the cellar. */
  onLastBottle: (batch: Batch) => void;
}) {
  const [count, setCount] = useState(existing ? String(existing.count) : '1');
  const [type, setType] = useState<PourType>(existing?.type ?? 'drank');
  const [date, setDate] = useState(existing?.date ?? today());
  const [note, setNote] = useState(existing?.note ?? '');
  const [rating, setRating] = useState<number | null>(existing?.rating ?? null);
  const [error, setError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // The most this pour can be: what is left, plus what it already took.
  const available = entry.count + (existing?.count ?? 0);

  const save = async () => {
    const bottles = parseNum(count);
    if (bottles == null || bottles < 1 || !Number.isInteger(bottles)) return setError('Enter how many bottles.');
    if (bottles > available) return setError(`Only ${plural(available, 'bottle')} ${existing ? 'available for this pour' : 'left'}.`);
    const fields = { cellarEntryId: entry.id, date: date || today(), count: bottles, type, note: note.trim(), rating };
    await pours.save(existing ? { ...existing, ...fields } : fields);
    const left = available - bottles;
    await cellar.save({ ...entry, count: left });
    onClose();
    // The archive prompt says it was the last bottle, so no toast on top of it.
    if (!(await afterCountChange())) toast(left === 0 ? 'That was the last bottle' : existing ? 'Pour updated' : 'Pour logged');
  };

  // Ask to archive once a batch's last bottle is gone; forget "Not now" once bottles come back.
  const afterCountChange = async (): Promise<boolean> => {
    if (!entry.batchId) return false;
    const batch = await batches.get(entry.batchId);
    const entries = await cellar.list();
    if (shouldResetArchivePrompt(batch, entries)) await batches.save({ ...batch!, archivePromptDismissed: false });
    else if (shouldAskToArchive(batch, entries)) {
      onLastBottle(batch!);
      return true;
    }
    return false;
  };

  const remove = async () => {
    if (!existing) return;
    await pours.remove(existing.id);
    await cellar.save({ ...entry, count: entry.count + existing.count });
    toast(`Pour removed, ${plural(existing.count, 'bottle')} back in the cellar`);
    onClose();
    await afterCountChange();
  };

  return (
    <Sheet title={existing ? 'Edit pour' : 'Log a pour'} onClose={onClose}>
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
          {existing ? 'Save changes' : 'Save pour'}
        </button>
        {existing &&
          (confirmingDelete ? (
            <div className="confirm-inline" role="group" aria-label="Confirm removal">
              <p>Remove this pour? {plural(existing.count, 'bottle')} will go back in the cellar.</p>
              <div className="button-row">
                <button type="button" className="btn" onClick={() => setConfirmingDelete(false)}>
                  Keep it
                </button>
                <button type="button" className="btn btn-danger" onClick={() => void remove()}>
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-danger-quiet btn-block" onClick={() => setConfirmingDelete(true)}>
              <Icon name="trash" size={20} />
              Remove pour
            </button>
          ))}
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
  /** Still, or how fizzy. */
  carbonation: CarbLevel | 'still';
  icon: string;
  extraIcons: string[];
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
          extraIcons: [],
          color: getFlavor(DEFAULT_FLAVOR).color,
          notes: '',
          carbonation: 'still',
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
        carbonation: entry.carbonation ?? 'still',
        icon: entry.icon,
        extraIcons: entry.extraIcons ?? [],
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
      // A typed ABV is the person's own number, no longer the estimate from bottling.
      abvEstimated: existing?.abvEstimated && abv === existing.abv ? true : undefined,
      carbonation: draft.carbonation === 'still' ? undefined : draft.carbonation,
      icon: draft.icon,
      extraIcons: draft.extraIcons,
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

        <IconPicker icon={draft.icon} extraIcons={draft.extraIcons} color={draft.color} onChange={set} />

        <StyleField value={draft.style} onChange={(style) => set({ style })} />

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

        <div className="field">
          <span className="field-label">Carbonation</span>
          <Segmented label="Carbonation" value={draft.carbonation} options={[{ id: 'still', label: 'Still' }, ...CARB_LEVELS]} onChange={(carbonation) => set({ carbonation })} />
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
