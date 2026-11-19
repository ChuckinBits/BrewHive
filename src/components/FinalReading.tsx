// The final reading, asked for when fermentation ends: moving a batch from
// Primary or Secondary to Aging, bottling it, or entering a batch that is
// already past fermentation. A final gravity is logged on the timeline as a
// reading like any other; without one, an estimated ABV can be entered instead.

import { events } from '../db/store.ts';
import type { Batch, BatchEvent } from '../db/types.ts';
import { parseNum } from '../lib/format.ts';
import { Field } from './ui.tsx';

export interface FinalReading {
  mode: 'reading' | 'estimate';
  /** Final gravity as typed. Optional. */
  fg: string;
  /** Estimated ABV in % as typed, when there is no reading. */
  estimate: string;
}

export const NO_FINAL_READING: FinalReading = { mode: 'reading', fg: '', estimate: '' };

/** A problem with what was typed, or null. Both fields are optional. */
export function finalReadingError(input: FinalReading): string | null {
  if (input.mode === 'reading') {
    if (input.fg.trim() === '') return null;
    const fg = parseNum(input.fg);
    return fg == null || fg < 0.98 || fg > 1.2 ? 'Final gravity should be between 0.980 and 1.200, such as 1.000.' : null;
  }
  if (input.estimate.trim() === '') return null;
  const abv = parseNum(input.estimate.replace('%', ''));
  return abv == null || abv < 0 || abv > 25 ? 'Estimated ABV should be a percentage between 0 and 25, such as 12.' : null;
}

/** The entry a final gravity becomes, ready to save; null without one. */
export function finalReadingEntry(batchId: string, input: FinalReading, date: string): Omit<BatchEvent, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> | null {
  const fg = input.mode === 'reading' ? parseNum(input.fg) : null;
  return fg == null ? null : { batchId, type: 'gravity', date, value: fg, note: '', final: true };
}

/** The batch fields an estimate sets (cleared when a final gravity is given instead). */
export function finalReadingPatch(input: FinalReading, date: string): Partial<Batch> {
  const estimate = input.mode === 'estimate' ? parseNum(input.estimate.replace('%', '')) : null;
  if (estimate != null) return { abvEstimate: estimate, abvEstimateAt: date, abvEstimateSavedAt: new Date().toISOString() };
  if (input.mode === 'reading' && parseNum(input.fg) != null) return { abvEstimate: null, abvEstimateAt: null, abvEstimateSavedAt: null };
  return {};
}

/** Saves the final reading: a gravity entry on the timeline, or the estimate on the batch (returned as a patch). */
export async function saveFinalReading(batchId: string, input: FinalReading, date: string): Promise<Partial<Batch>> {
  const entry = finalReadingEntry(batchId, input, date);
  if (entry) await events.save(entry);
  return finalReadingPatch(input, date);
}

interface Props {
  value: FinalReading;
  onChange: (value: FinalReading) => void;
  /** The latest reading, offered as the placeholder. */
  latest?: number | null;
}

export function FinalReadingFields({ value, onChange, latest }: Props) {
  if (value.mode === 'estimate') {
    return (
      <div className="final-reading">
        <Field label="Estimated ABV (%)" hint="Shown with ≈. A gravity reading logged later replaces it.">
          <input type="text" inputMode="decimal" value={value.estimate} placeholder="12" autoFocus onChange={(e) => onChange({ ...value, estimate: e.target.value })} />
        </Field>
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
      <button type="button" className="btn btn-quiet btn-small" onClick={() => onChange({ ...value, mode: 'estimate' })}>
        No reading? Enter an estimated ABV
      </button>
    </div>
  );
}
