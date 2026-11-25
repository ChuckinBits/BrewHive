// Moving a batch to Aging: asks for the final reading first.

import { useState } from 'react';
import { changeStatus } from '../../db/actions.ts';
import { type Batch, type BatchEvent } from '../../db/types.ts';
import { Sheet, toast } from '../../components/ui.tsx';
import { batchAbv, finalGravity, finalReading } from '../../lib/batch.ts';
import { nowLocal } from '../../lib/format.ts';
import { FinalReadingFields, NO_FINAL_READING, finalReadingError, saveFinalReading, type FinalReading } from '../../components/FinalReading.tsx';

/**
 * Moving from Primary or Secondary to Aging: fermentation is done, so ask for the final reading.
 * After a Stabilized entry it is offered rather than asked for, with a way to keep the stage.
 */
export function FinishSheet({ batch, timeline, stabilized = false, onClose }: { batch: Batch; timeline: BatchEvent[]; stabilized?: boolean; onClose: () => void }) {
  // A batch that already has its final reading only needs the move.
  const hasFinal = finalReading(timeline) != null;
  const [final, setFinal] = useState<FinalReading>(NO_FINAL_READING);
  const [error, setError] = useState('');
  const save = async () => {
    if (!hasFinal) {
      const problem = finalReadingError(final);
      if (problem) return setError(problem);
      await saveFinalReading(batch.id, final, nowLocal());
    }
    await changeStatus(batch, 'aging');
    toast('Moved to Aging');
    onClose();
  };
  return (
    <Sheet title="Move to Aging" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <p>
          {stabilized
            ? `Stabilizing stops fermentation, so ${batch.name} is done fermenting. Move it to Aging${hasFinal ? '?' : ' and log the final reading?'}`
            : 'Moving to Aging means fermentation is done. Log the final reading?'}
        </p>
        {!hasFinal && (
          <FinalReadingFields
            value={final}
            onChange={(next) => {
              setError('');
              setFinal(next);
            }}
            latest={finalGravity(timeline)}
            abvSoFar={batchAbv(batch, timeline)}
          />
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block">
          Move to Aging
        </button>
        {stabilized && (
          <button type="button" className="btn btn-block" onClick={onClose}>
            Keep it in {batch.status === 'primary' ? 'Primary' : 'Secondary'}
          </button>
        )}
      </form>
    </Sheet>
  );
}
