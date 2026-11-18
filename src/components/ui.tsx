// Small building blocks shared by every screen.

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { Icon, type IconName } from '../icons/Icon.tsx';
import { Link } from '../lib/router.tsx';
import { fmtRating } from '../lib/format.ts';

// --- Rating -----------------------------------------------------------------

const STAR = 'M12 2.2l2.9 6 6.6 1-4.8 4.6 1.1 6.6L12 17.3l-5.8 3.1 1.1-6.6L2.5 9.2l6.6-1z';

/** The 0 to 10 rating shown at a glance, as a number inside a star. With `reserve`, an unrated item keeps the same space. */
export function RatingBadge({ rating, reserve = false, small = false }: { rating: number | null | undefined; reserve?: boolean; small?: boolean }) {
  if (rating == null) return reserve ? <span className="rating rating-none" aria-hidden="true" /> : null;
  return (
    <span className={small ? 'rating rating-small' : 'rating'} role="img" aria-label={`Rated ${fmtRating(rating)} out of 10`}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={STAR} />
      </svg>
      <span className="rating-number" aria-hidden="true">
        {fmtRating(rating)}
      </span>
    </span>
  );
}

export function RatingInput({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  const id = useId();
  return (
    <div className="rating-input">
      <div className="rating-input-head">
        <label htmlFor={id}>Rating</label>
        {value == null ? <span className="muted">Not rated</span> : <RatingBadge rating={value} />}
      </div>
      <div className="rating-input-row">
        <input
          id={id}
          type="range"
          min="0"
          max="10"
          step="0.5"
          value={value ?? 5}
          onChange={(e) => onChange(Number(e.target.value))}
          className={value == null ? 'range-unset' : undefined}
        />
        {value != null && (
          <button type="button" className="btn btn-quiet btn-small" onClick={() => onChange(null)}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

// --- Layout -----------------------------------------------------------------

interface TopBarProps {
  title: string;
  /** Address of the parent screen. Shows a back arrow when given. */
  back?: string;
  children?: ReactNode;
}

export function TopBar({ title, back, children }: TopBarProps) {
  return (
    <header className="topbar">
      {back && (
        <Link to={back} className="icon-btn" aria-label="Back">
          <Icon name="back" />
        </Link>
      )}
      <h1 className={back ? 'topbar-title topbar-title-small' : 'topbar-title'}>{title}</h1>
      <div className="topbar-actions">{children}</div>
    </header>
  );
}

export function Fab({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="fab" aria-label={label}>
      <Icon name="plus" size={28} />
    </Link>
  );
}

export function EmptyState({ art, title, children }: { art: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-art">{art}</div>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export function Stat({ label, value, highlight = false, extra }: { label: string; value: ReactNode; highlight?: boolean; extra?: ReactNode }) {
  return (
    <div className={highlight ? 'stat stat-projected' : 'stat'}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      {extra && <span className="stat-extra">{extra}</span>}
    </div>
  );
}

// --- Form controls ----------------------------------------------------------

interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

/** A label wrapped around its control, so tapping the label focuses it. */
export function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { id: T; label: string; icon?: IconName }[];
  onChange: (value: T) => void;
  /** Hides the option text and shows only the icons. */
  iconsOnly?: boolean;
}

export function Segmented<T extends string>({ label, value, options, onChange, iconsOnly = false }: SegmentedProps<T>) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={option.id === value ? 'segment segment-on' : 'segment'}
          aria-pressed={option.id === value}
          aria-label={iconsOnly ? option.label : undefined}
          onClick={() => onChange(option.id)}
        >
          {option.icon && <Icon name={option.icon} size={20} />}
          {!iconsOnly && option.label}
        </button>
      ))}
    </div>
  );
}

// --- Sheets (dialogs that slide up from the bottom) -------------------------

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Sheet({ title, onClose, children }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('sheet-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('sheet-open');
      previous?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

interface ConfirmProps {
  title: string;
  message: string;
  confirmLabel: string;
  /** "danger" (the default) for deleting; "normal" for actions that can be undone. */
  tone?: 'danger' | 'normal';
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmSheet({ title, message, confirmLabel, tone = 'danger', cancelLabel = 'Cancel', onConfirm, onClose }: ConfirmProps) {
  return (
    <Sheet title={title} onClose={onClose}>
      <p>{message}</p>
      <div className="button-row">
        <button type="button" className="btn" onClick={onClose}>
          {cancelLabel}
        </button>
        <button type="button" className={tone === 'danger' ? 'btn btn-danger' : 'btn btn-primary'} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}

// --- Toasts (short confirmations at the bottom of the screen) ---------------

let toastMessage: { id: number; text: string } | null = null;
const toastListeners = new Set<() => void>();
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function toast(text: string): void {
  toastMessage = { id: Date.now(), text };
  for (const listener of toastListeners) listener();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMessage = null;
    for (const listener of toastListeners) listener();
  }, 3200);
}

export function Toaster() {
  const message = useSyncExternalStore(
    (listener) => {
      toastListeners.add(listener);
      return () => toastListeners.delete(listener);
    },
    () => toastMessage,
  );
  return (
    <div className="toaster" role="status" aria-live="polite">
      {message && (
        <div className="toast" key={message.id}>
          {message.text}
        </div>
      )}
    </div>
  );
}

// --- Misc -------------------------------------------------------------------

/** Tracks an element's width, for layouts that depend on it. */
export function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}
