// Bottling a batch: how many bottles of which sizes, into the cellar.

import { useState } from 'react';
import { batches, cellar, events } from '../../db/store.ts';
import { type Batch, type BatchEvent } from '../../db/types.ts';
import { Field, Sheet, toast } from '../../components/ui.tsx';
import { Icon } from '../../icons/Icon.tsx';
import { abvEstimate, batchAbv, finalReading, finalGravity, isFermentationComplete } from '../../lib/batch.ts';
import { fmtBottle, nowLocal, parseNum, today } from '../../lib/format.ts';
import { BOTTLE_UNITS, bottlingError, bottlingNote, lineBottleMl, newLine, suggestCount, totalMl, type BottleLine, type BottleUnit } from '../../lib/bottling.ts';
import { navigate } from '../../lib/router.tsx';
import { FinalReadingFields, NO_FINAL_READING, finalReadingError, saveFinalReading, type FinalReading } from '../../components/FinalReading.tsx';
import { isBottledEntry } from './entries.ts';

/** The size a unit starts at when picked. */
const UNIT_START_SIZE: Record<BottleUnit, string> = { ml: '750', floz: '12', cup: '1', pint: '1', quart: '1', l: '1', other: '' };

interface BottleSheetProps {
  batch: Batch;
  timeline: BatchEvent[];
  /** The Bottled timeline entry it was opened from, if any. */
  entry: BatchEvent | null;
  /** Opens that entry's own sheet, to change its date or remove it. */
  onEditEntry: (entry: BatchEvent) => void;
  onClose: () => void;
}

export function BottleSheet({ batch, timeline, entry, onEditEntry, onClose }: BottleSheetProps) {
  const alreadyBottled = batch.status === 'bottled';
  // A Bottled entry with no bottles on it yet (marked bottled without the cellar) gets the bottles added now.
  const emptyEntry = entry && !entry.note ? entry : !entry ? [...timeline].reverse().find((e) => isBottledEntry(e) && !e.note && !e.deletedAt) ?? null : null;
  // Bottled straight from fermenting: ask for the final reading too.
  const asksFinal = !isFermentationComplete(batch) && !finalReading(timeline);
  const [final, setFinal] = useState<FinalReading>(NO_FINAL_READING);
  const volumeMl = batch.volumeL != null ? batch.volumeL * 1000 : null;
  const [lines, setLines] = useState<BottleLine[]>(() => [newLine(volumeMl)]);
  const [bottledDate, setBottledDate] = useState(today());
  const [bestAfter, setBestAfter] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');

  const update = (id: string, patch: Partial<BottleLine>) => {
    setError('');
    setLines((all) =>
      all.map((line, i) => {
        if (line.id !== id) return line;
        const next = { ...line, ...patch };
        // Until a count is typed, it follows the size and the volume left for this line.
        if (!next.countTyped && ('size' in patch || 'unit' in patch)) {
          const left = volumeMl == null ? null : volumeMl - totalMl(all.slice(0, i));
          next.count = String(suggestCount(left, lineBottleMl(next)));
        }
        return next;
      }),
    );
  };

  const save = async () => {
    const problem = bottlingError(lines) ?? (asksFinal ? finalReadingError(final) : null);
    if (problem) return setError(problem);
    const now = nowLocal();
    // The final reading goes on the timeline first, so the bottles get the ABV it gives.
    if (asksFinal) await saveFinalReading(batch.id, final, now);
    const latest = (await events.list()).filter((e) => e.batchId === batch.id);
    const abv = batchAbv(batch, latest);
    const saved = [];
    for (const line of lines) {
      saved.push(
        await cellar.save({
          batchId: batch.id,
          name: batch.name,
          style: batch.style,
          bottleSizeMl: Math.round(lineBottleMl(line)!),
          count: parseNum(line.count)!,
          bottledDate,
          bestAfter: bestAfter || null,
          location: location.trim(),
          abv: abv != null ? Number(abv.toFixed(1)) : null,
          abvEstimated: abvEstimate(batch, latest) != null,
          icon: batch.icon,
          extraIcons: batch.extraIcons ?? [],
          color: batch.color,
          rating: batch.rating,
          notes: line.unit === 'other' ? line.container.trim() : '',
        }),
      );
    }
    if (!alreadyBottled) await batches.save({ ...batch, status: 'bottled' });
    // A bottling entry records real bottles, so it is never replaced by a later stage tap.
    if (emptyEntry) await events.save({ ...emptyEntry, note: bottlingNote(lines), auto: false });
    else
      await events.save({
        batchId: batch.id,
        type: 'status',
        date: now,
        value: null,
        note: bottlingNote(lines),
        toStatus: 'bottled',
        fromStatus: batch.status,
        auto: false,
      });
    toast('Bottles added to your cellar');
    onClose();
    navigate(saved.length === 1 ? `/cellar/${saved[0].id}` : '/cellar');
  };

  // Bottled, without putting bottles in the cellar (kegged, given away, or counted later).
  const markBottled = async () => {
    const problem = asksFinal ? finalReadingError(final) : null;
    if (problem) return setError(problem);
    const now = nowLocal();
    if (asksFinal) await saveFinalReading(batch.id, final, now);
    await batches.save({ ...batch, status: 'bottled' });
    await events.save({ batchId: batch.id, type: 'status', date: now, value: null, note: '', toStatus: 'bottled', fromStatus: batch.status, auto: false });
    toast('Marked as bottled');
    onClose();
  };

  const total = totalMl(lines);

  return (
    <Sheet title={alreadyBottled ? 'Add bottles' : 'Bottle this batch'} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {asksFinal && (
          <>
            <h3 className="stage-divider">Final reading</h3>
            <FinalReadingFields value={final} onChange={(next) => { setError(''); setFinal(next); }} latest={finalGravity(timeline)} abvSoFar={batchAbv(batch, timeline)} />
            <h3 className="stage-divider">Bottles</h3>
          </>
        )}
        {lines.map((line, i) => (
          <fieldset key={line.id} className="bottle-line" aria-label={`Bottle size ${i + 1}`}>
            <div className="bottle-line-fields">
              <Field label="Bottles filled">
                <input type="text" inputMode="numeric" value={line.count} onChange={(e) => update(line.id, { count: e.target.value, countTyped: true })} />
              </Field>
              <Field label={line.unit === 'other' ? 'Size (mL)' : 'Size'}>
                <input type="text" inputMode="decimal" value={line.size} onChange={(e) => update(line.id, { size: e.target.value })} />
              </Field>
              <Field label="Unit">
                <select
                  value={line.unit}
                  onChange={(e) => {
                    const unit = e.target.value as BottleUnit;
                    // "Other" is measured in mL, so carry the current size over.
                    const ml = lineBottleMl(line);
                    update(line.id, { unit, size: unit === 'other' ? (ml ? String(Math.round(ml)) : '') : UNIT_START_SIZE[unit] });
                  }}
                >
                  {BOTTLE_UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {line.unit === 'other' && (
              <Field label="Container">
                <input type="text" value={line.container} placeholder="Growler" onChange={(e) => update(line.id, { container: e.target.value })} />
              </Field>
            )}
            {lines.length > 1 && (
              <button type="button" className="btn btn-quiet btn-small bottle-line-remove" onClick={() => setLines((all) => all.filter((l) => l.id !== line.id))}>
                <Icon name="trash" size={16} />
                Remove this size
              </button>
            )}
          </fieldset>
        ))}
        <button type="button" className="btn btn-block" onClick={() => setLines((all) => [...all, newLine(volumeMl, all)])}>
          <Icon name="plus" size={20} />
          Add another size
        </button>
        <p className="bottle-total" aria-live="polite">
          Total: {fmtBottle(total)}
          {volumeMl != null && ` of ${fmtBottle(volumeMl)}`}
          <span className="field-hint">A guide only; some loss when bottling is normal.</span>
        </p>
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
        {!alreadyBottled && (
          <button type="button" className="btn btn-quiet btn-block" onClick={() => void markBottled()}>
            Mark as bottled without adding to the cellar
          </button>
        )}
        {entry && (
          <button type="button" className="btn btn-quiet btn-block" onClick={() => onEditEntry(entry)}>
            <Icon name="edit" size={18} />
            Edit timeline entry
          </button>
        )}
      </form>
    </Sheet>
  );
}
