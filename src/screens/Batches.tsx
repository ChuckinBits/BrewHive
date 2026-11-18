// Home screen: every batch, as carboys on a shelf or as a list.

import { useState } from 'react';
import { batches, events, usePrefs, useQuery } from '../db/store.ts';
import { loadSampleData } from '../db/sample.ts';
import { BATCH_STATUSES, type Batch, type BatchEvent } from '../db/types.ts';
import { Book, Carboy } from '../components/Vessels.tsx';
import { Collection, SortSelect, ViewToggle, byRating, type ShelfEntry } from '../components/Shelf.tsx';
import { EmptyState, Fab, TopBar, toast } from '../components/ui.tsx';
import { batchAbv, fillLevel, isActive } from '../lib/batch.ts';
import { daysBetween } from '../lib/calc.ts';
import { fmtDateShort, fmtPercent, today } from '../lib/format.ts';
import { Link } from '../lib/router.tsx';

type Filter = 'active' | 'bottled' | 'archived' | 'all';

const FILTER_LABELS: Record<Filter, string> = { active: 'Active', bottled: 'Bottled', archived: 'Archived', all: 'All' };

const SORTS = [
  { id: 'newest', label: 'Newest' },
  { id: 'rating', label: 'Rating' },
  { id: 'name', label: 'Name' },
  { id: 'status', label: 'Status' },
];

const statusOrder = (b: Batch) => BATCH_STATUSES.findIndex((s) => s.id === b.status);

/** A batch's shelf artwork: a carboy, or a book spine once archived. */
export function BatchArt({ batch, size }: { batch: Batch; size?: number }) {
  if (batch.status === 'archived') return <Book icon={batch.icon} color={batch.color} size={size} />;
  return <Carboy icon={batch.icon} color={batch.color} level={fillLevel(batch.status)} fermenting={batch.status === 'primary'} size={size} />;
}

export function statusLabel(batch: Batch): string {
  return BATCH_STATUSES.find((s) => s.id === batch.status)?.label ?? batch.status;
}

/** "Primary · Day 9", or "Planned · Starts Nov 23". */
export function batchSubtitle(batch: Batch): string {
  const label = statusLabel(batch);
  if (batch.status === 'planned') {
    return batch.startDate > today() ? `${label} · Starts ${fmtDateShort(batch.startDate)}` : label;
  }
  if (!isActive(batch.status)) return label;
  return `${label} · Day ${daysBetween(batch.startDate, today()) + 1}`;
}

export function BatchesScreen() {
  const { view, sort, setView, setSort } = usePrefs('batches', 'newest');
  const [filter, setFilter] = useState<Filter>('active');
  const data = useQuery(async () => ({ batches: await batches.list(), events: await events.list() }));

  if (!data) return <TopBar title="Batches" />;

  const eventsByBatch = new Map<string, BatchEvent[]>();
  for (const event of data.events) {
    const list = eventsByBatch.get(event.batchId) ?? [];
    list.push(event);
    eventsByBatch.set(event.batchId, list);
  }

  const inFilter = (b: Batch, f: Filter) =>
    f === 'all' ? true : f === 'active' ? isActive(b.status) : f === 'bottled' ? b.status === 'bottled' : b.status === 'archived';
  const counts = {
    active: data.batches.filter((b) => inFilter(b, 'active')).length,
    bottled: data.batches.filter((b) => inFilter(b, 'bottled')).length,
    archived: data.batches.filter((b) => inFilter(b, 'archived')).length,
    all: data.batches.length,
  };
  // Fall back to "all" when the chosen filter would hide every batch.
  // With nothing active, open on everything rather than an empty shelf.
  const shown: Filter = filter === 'active' && counts.active === 0 && counts.all > 0 ? 'all' : filter;

  const visible = data.batches
    .filter((b) => inFilter(b, shown))
    .sort((a, b) => {
      if (sort === 'rating') return byRating(a, b);
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'status') return statusOrder(a) - statusOrder(b) || b.startDate.localeCompare(a.startDate);
      return b.startDate.localeCompare(a.startDate);
    });

  const items: ShelfEntry[] = visible.map((batch) => {
    const abv = batchAbv(batch, eventsByBatch.get(batch.id) ?? []);
    return {
      key: batch.id,
      to: `/batches/${batch.id}`,
      visual: <BatchArt batch={batch} />,
      icon: batch.icon,
      title: batch.name,
      subtitle: batchSubtitle(batch),
      meta: abv != null && batch.status !== 'planned' ? fmtPercent(abv) : undefined,
      rating: batch.rating,
    };
  });

  return (
    <>
      <TopBar title="Batches">{counts.all > 0 && <ViewToggle value={view} onChange={setView} />}</TopBar>

      {counts.all === 0 ? (
        <EmptyState art={<Carboy icon="traditional" color="#E8A33A" level={0.9} fermenting size={132} />} title="Your shelf is empty">
          <p>Start your first batch, or load a few samples to see how BrewHive looks in use.</p>
          <div className="button-row button-row-center">
            <Link to="/batches/new" className="btn btn-primary">
              Start a batch
            </Link>
            <button
              type="button"
              className="btn"
              onClick={async () => {
                await loadSampleData();
                toast('Sample data added');
              }}
            >
              Load sample data
            </button>
          </div>
        </EmptyState>
      ) : (
        <>
          <div className="toolbar">
            <div className="chips" role="group" aria-label="Filter batches">
              {(['active', 'bottled', 'archived', 'all'] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  className={id === shown ? 'chip chip-on' : 'chip'}
                  aria-pressed={id === shown}
                  onClick={() => setFilter(id)}
                >
                  {FILTER_LABELS[id]} <span className="chip-count">{counts[id]}</span>
                </button>
              ))}
            </div>
            <SortSelect value={sort} options={SORTS} onChange={setSort} />
          </div>
          {items.length === 0 ? (
            <p className="muted list-empty">No {FILTER_LABELS[shown].toLowerCase()} batches.</p>
          ) : (
            <Collection view={view} items={items} />
          )}
        </>
      )}

      {counts.all > 0 && <Fab to="/batches/new" label="New batch" />}
    </>
  );
}
