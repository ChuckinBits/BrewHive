// The two ways to look at a collection: a shelf of artwork, or a plain list.
// Both show the same items, with the icon prominent and the rating on top.

import type { ReactNode } from 'react';
import { FlavorIcons } from '../icons/FlavorIcon.tsx';
import { Icon } from '../icons/Icon.tsx';
import { Link } from '../lib/router.tsx';
import type { ViewMode } from '../db/types.ts';
import { RatingBadge, Segmented, useWidth } from './ui.tsx';

export interface ShelfEntry {
  key: string;
  to: string;
  /** A Carboy, Book or Bottle. */
  visual: ReactNode;
  /** Main icon first. */
  icons: string[];
  title: string;
  subtitle?: string;
  /** Extra text at the right of a list row, such as "x 6". */
  meta?: string;
  rating: number | null;
  /** Soft glow, used for bottles that are ready to drink. */
  glow?: boolean;
}

const MIN_CELL = 104;

export function Shelf({ items }: { items: ShelfEntry[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const columns = Math.max(2, Math.min(6, Math.floor((width || 330) / MIN_CELL)));
  const rows: ShelfEntry[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));

  return (
    <div className="shelf" ref={ref}>
      {rows.map((row, index) => (
        <div className="shelf-row" key={index} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {row.map((item) => (
            <Link key={item.key} to={item.to} className="shelf-item">
              <RatingBadge rating={item.rating} reserve />
              <span className={item.glow ? 'shelf-visual shelf-glow' : 'shelf-visual'}>{item.visual}</span>
              <span className="shelf-plank" />
              <span className="shelf-label">
                <strong>{item.title}</strong>
                {/* On the narrow shelf, each part of "Primary · Day 9" gets its own line. */}
                {item.subtitle?.split(' · ').map((part) => <span key={part}>{part}</span>)}
              </span>
            </Link>
          ))}
          {Array.from({ length: columns - row.length }, (_, i) => (
            <span className="shelf-item shelf-filler" key={`filler-${i}`} aria-hidden="true">
              <span className="rating rating-none" />
              <span className="shelf-visual" />
              <span className="shelf-plank" />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ItemList({ items }: { items: ShelfEntry[] }) {
  return (
    <ul className="item-list">
      {items.map((item) => (
        <li key={item.key}>
          <Link to={item.to} className="item-row">
            <span className="icon-tile">
              <FlavorIcons icons={item.icons} size={38} />
            </span>
            <span className="item-text">
              <strong>{item.title}</strong>
              {item.subtitle && <span>{item.subtitle}</span>}
            </span>
            {item.meta && <span className="item-meta">{item.meta}</span>}
            <RatingBadge rating={item.rating} />
            <span className="item-chevron">
              <Icon name="chevron" size={18} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Collection({ view, items }: { view: ViewMode; items: ShelfEntry[] }) {
  return view === 'shelf' ? <Shelf items={items} /> : <ItemList items={items} />;
}

export function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (value: ViewMode) => void }) {
  return (
    <Segmented
      label="View"
      value={value}
      onChange={onChange}
      iconsOnly
      options={[
        { id: 'shelf', label: 'Shelf view', icon: 'shelf' },
        { id: 'list', label: 'List view', icon: 'list' },
      ]}
    />
  );
}

interface SortSelectProps {
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
}

export function SortSelect({ value, options, onChange }: SortSelectProps) {
  return (
    <label className="sort-select">
      <span>Sort</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Highest rating first; unrated items go last. */
export function byRating<T extends { rating: number | null; name: string }>(a: T, b: T): number {
  return (b.rating ?? -1) - (a.rating ?? -1) || a.name.localeCompare(b.name);
}
