// Moving a batch to Aging: asks for the final reading first.

import { useState } from 'react';
import { changeStatus } from '../../db/actions.ts';
import { type Batch, type BatchEvent } from '../../db/types.ts';
import { Sheet, toast } from '../../components/ui.tsx';
import { batchAbv, finalGravity } from '../../lib/batch.ts';
import { nowLocal } from '../../lib/format.ts';
import { FinalReadingFields, NO_FINAL_READING, finalReadingError, saveFinalReading, type FinalReading } from '../../components/FinalReading.tsx';

/** Moving from Primary or Secondary to Aging: fermentation is done, so ask for the final reading. */
export function FinishSheet({ batch, timeline, onClose }: { batch: Batch; timeline: BatchEvent[]; onClose: () => void }) {
  const [final, setFinal] = useState<FinalReading>(NO_FINAL_READING);
  const [error, setError] = useState('');
  const save = async () => {
    const problem = finalReadingError(final);
    if (problem) return setError(problem);
    await saveFinalReading(batch.id, final, nowLocal());
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
        <p>Moving to Aging means fermentation is done. Log the final reading?</p>
        <FinalReadingFields
          value={final}
          onChange={(next) => {
            setError('');
            setFinal(next);
          }}
          latest={finalGravity(timeline)}
          abvSoFar={batchAbv(batch, timeline)}
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block">
          Move to Aging
        </button>
      </form>
    </Sheet>
  );
}
