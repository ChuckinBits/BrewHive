// The final reading, asked for when fermentation ends: moving a batch from
// Primary or Secondary to Aging, bottling it, or entering a batch that is
// already past fermentation. Either way it goes on the timeline: a gravity
// reading marked Final, or, without one, an "Estimated ABV" entry.

import { events } from '../db/store.ts';
import type { BatchEvent } from '../db/types.ts';
import { useState } from 'react';
import { nowLocal, parseNum } from '../lib/format.ts';
import { Field } from './ui.tsx';

export interface FinalReading {
  mode: 'reading' | 'estimate';
  /** Final gravity as typed. Optional. */
  fg: string;
  /** Estimated ABV in % as typed, when there is no reading. */
  estimate: string;
  /** When the reading was taken (local date and time); empty means now. */
  date: string;
}

export const NO_FINAL_READING: FinalReading = { mode: 'reading', fg: '', estimate: '', date: '' };

/** A problem with what was typed, or null. Both fields are optional. */
export function finalReadingError(input: FinalReading, startDate?: string): string | null {
  if (startDate && input.date && input.date.slice(0, 10) < startDate) return 'The final reading can\'t be from before the batch started.';
  if (input.mode === 'reading') {
    if (input.fg.trim() === '') return null;
    const fg = parseNum(input.fg);
    return fg == null || fg < 0.98 || fg > 1.2 ? 'Final gravity should be between 0.980 and 1.200, such as 1.000.' : null;
  }
  if (input.estimate.trim() === '') return null;
  const abv = parseNum(input.estimate.replace('%', ''));
  return abv == null || abv < 0 || abv > 25 ? 'Estimated ABV should be a percentage between 0 and 25, such as 12.' : null;
}

/** The timeline entry the final reading becomes, ready to save; null when nothing was entered. */
export function finalReadingEntry(batchId: string, input: FinalReading, now: string): Omit<BatchEvent, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> | null {
  const date = input.date || now;
  if (input.mode === 'estimate') {
    const abv = parseNum(input.estimate.replace('%', ''));
    return abv == null ? null : { batchId, type: 'estimate', date, value: abv, note: '' };
  }
  const fg = parseNum(input.fg);
  return fg == null ? null : { batchId, type: 'gravity', date, value: fg, note: '', final: true };
}

/** Saves the final reading on the timeline, if one was entered. */
export async function saveFinalReading(batchId: string, input: FinalReading, now: string): Promise<void> {
  const entry = finalReadingEntry(batchId, input, now);
  if (entry) await events.save(entry);
}

interface Props {
  value: FinalReading;
  onChange: (value: FinalReading) => void;
  /** The latest reading, offered as the placeholder. */
  latest?: number | null;
  /** The ABV so far, filled in as the starting estimate. */
  abvSoFar?: number | null;
}

export function FinalReadingFields({ value, onChange, latest, abvSoFar }: Props) {
  // When it was taken, since it goes on the timeline. Starts at now.
  const [now] = useState(nowLocal);
  const when = (
    <Field label="When">
      <input type="datetime-local" value={value.date || now} onChange={(e) => onChange({ ...value, date: e.target.value })} />
    </Field>
  );
  if (value.mode === 'estimate') {
    return (
      <div className="final-reading">
        <Field label="Estimated ABV (%)" hint={abvSoFar != null ? 'Starts at the ABV so far. Shown with ≈; a gravity reading logged later replaces it.' : 'Shown with ≈. A gravity reading logged later replaces it.'}>
          <input type="text" inputMode="decimal" value={value.estimate} placeholder="12" autoFocus onChange={(e) => onChange({ ...value, estimate: e.target.value })} />
        </Field>
        {when}
        <button type="button" className="btn btn-quiet btn-small" onClick={() => onChange({ ...value, mode: 'reading' })}>
          Enter a final gravity instead
        </button>
      </div>
    );
  }
  return (
    <div className="final-reading">
      <Field label="Final gravity (optional)" hint="Logged on the timeline as the final reading.">
        <input
          type="text"
          inputMode="decimal"
          value={value.fg}
          placeholder={latest != null ? latest.toFixed(3) : '1.000'}
          onChange={(e) => onChange({ ...value, fg: e.target.value })}
        />
      </Field>
      {when}
      <button
        type="button"
        className="btn btn-quiet btn-small"
        // Start the estimate at the ABV so far, so it's easy to keep or adjust.
        onClick={() => onChange({ ...value, mode: 'estimate', estimate: value.estimate || (abvSoFar != null ? abvSoFar.toFixed(1) : '') })}
      >
        No reading? Enter an estimated ABV
      </button>
    </div>
  );
}
