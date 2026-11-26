// Offered after racking a batch into several vessels: keep it one batch, or split it so each vessel
// becomes a sub-batch of its own, sharing the batch's history up to now.

import { useState } from 'react';
import { Field, Sheet, toast } from '../../components/ui.tsx';
import { equipment, useQuery } from '../../db/store.ts';
import { splitBatch } from '../../db/actions.ts';
import type { Batch, VesselFill, VolumeUnit } from '../../db/types.ts';
import { listNames } from '../../lib/equipment.ts';
import { splitNames, splitProblem } from '../../lib/split.ts';
import { fmtVolume } from '../../lib/format.ts';
import { navigate } from '../../lib/router.tsx';

interface Props {
  batch: Batch;
  /** The vessels it was racked into, with amounts. */
  fills: VesselFill[];
  /** When it was racked: the split happens then. */
  date: string;
  unit: VolumeUnit;
  onClose: () => void;
}

export function SplitSheet({ batch, fills, date, unit, onClose }: Props) {
  const vessels = useQuery(async () => new Map((await equipment.list()).map((e) => [e.id, e])));
  const [names, setNames] = useState(() => splitNames(batch.name, fills.length));
  const [error, setError] = useState('');
  const nameOf = (id: string) => vessels?.get(id)?.name ?? 'a vessel';
  const parts = fills.map((f, i) => ({ name: names[i] ?? '', vesselId: f.vesselId, volumeL: f.volumeL }));

  const split = async () => {
    const problem = splitProblem(parts);
    if (problem) return setError(problem);
    const made = await splitBatch(batch.id, parts, date);
    toast(`Split into ${made.length} batches`);
    onClose();
    // Carry on in the first one: it's where the next entry most likely goes.
    if (made[0]) navigate(`/batches/${made[0].id}`);
  };

  return (
    <Sheet title="Make sub-batches?" onClose={onClose}>
      <div className="form">
        <p>
          {batch.name} is in {listNames(fills.map((f) => nameOf(f.vesselId)))} now. Keep it one batch, or split it so each vessel is a batch of its own: each keeps the history up to now, and gets its own readings, stages, tastings and rating from here
          on.
        </p>
        {parts.map((part, i) => (
          <Field key={part.vesselId} label={`${nameOf(part.vesselId)}${part.volumeL != null ? ` · ${fmtVolume(part.volumeL, unit)}` : ''}`}>
            <input
              type="text"
              value={part.name}
              onChange={(e) => {
                setError('');
                setNames((n) => n.map((x, j) => (j === i ? e.target.value : x)));
              }}
            />
          </Field>
        ))}
        <p className="field-hint">Ingredients and their costs are divided by volume. You can undo the split until something is logged on a sub-batch.</p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="btn btn-primary btn-block" onClick={() => void split()}>
          Split into {parts.length} batches
        </button>
        <button type="button" className="btn btn-block" onClick={onClose}>
          Keep as one batch
        </button>
      </div>
    </Sheet>
  );
}
