// Home screen: every batch, as carboys on a shelf or as a list.

import { useState } from 'react';
import { batches, events, usePrefs, useQuery } from '../db/store.ts';
import { loadSampleData } from '../db/sample.ts';
import { BATCH_STATUSES, type Batch, type BatchEvent } from '../db/types.ts';
import { Carboy } from '../components/Vessels.tsx';
import { Collection, SortSelect, ViewToggle, byRating, type ShelfEntry } from '../components/Shelf.tsx';
import { EmptyState, Fab, TopBar, toast } from '../components/ui.tsx';
import { batchAbv, fillLevel, isActive } from '../lib/batch.ts';
import { daysBetween } from '../lib/calc.ts';
import { fmtDateShort, fmtPercent, today } from '../lib/format.ts';
import { Link } from '../lib/router.tsx';

type Filter = 'active' | 'bottled' | 'all';

const SORTS = [
  { id: 'newest', label: 'Newest' },
  { id: 'rating', label: 'Rating' },
  { id: 'name', label: 'Name' },
  { id: 'status', label: 'Status' },
];

const statusOrder = (b: Batch) => BATCH_STATUSES.findIndex((s) => s.id === b.status);

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

  const counts = {
    active: data.batches.filter((b) => isActive(b.status)).length,
    bottled: data.batches.filter((b) => !isActive(b.status)).length,
    all: data.batches.length,
  };
  // Fall back to "all" when the chosen filter would hide every batch.
  const shown: Filter = counts[filter] === 0 && counts.all > 0 ? 'all' : filter;

  const visible = data.batches
    .filter((b) => (shown === 'all' ? true : shown === 'active' ? isActive(b.status) : !isActive(b.status)))
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
      visual: <Carboy icon={batch.icon} color={batch.color} level={fillLevel(batch.status)} fermenting={batch.status === 'primary'} />,
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
              {(['active', 'bottled', 'all'] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  className={id === shown ? 'chip chip-on' : 'chip'}
                  aria-pressed={id === shown}
                  onClick={() => setFilter(id)}
                >
                  {id === 'active' ? 'Active' : id === 'bottled' ? 'Bottled' : 'All'} <span className="chip-count">{counts[id]}</span>
                </button>
              ))}
            </div>
            <SortSelect value={sort} options={SORTS} onChange={setSort} />
          </div>
          <Collection view={view} items={items} />
        </>
      )}

      {counts.all > 0 && <Fab to="/batches/new" label="New batch" />}
    </>
  );
}
