// Logging one of a batch's ingredients on the timeline from the Ingredients card.

import { useState } from 'react';
import { events } from '../../db/store.ts';
import { type Batch, type IngredientLine } from '../../db/types.ts';
import { Field, Sheet, toast } from '../../components/ui.tsx';
import { entryFromLine, ingredientStageLabel } from '../../lib/stages.ts';
import { nowLocal, today } from '../../lib/format.ts';

/**
 * When a tapped ingredient went in, to start the Log sheet at: primary ingredients (nutrients too)
 * at the batch start date, at the time of day it is now; everything else now.
 */
function logDateFor(line: IngredientLine, batch: Batch): string {
  const now = nowLocal();
  if ((line.stage ?? 'primary') !== 'primary' || !batch.startDate || batch.startDate >= today()) return now;
  return `${batch.startDate}T${now.slice(11, 16)}`;
}

/** Logs one of a batch's ingredients on the timeline, asking when it went in. */
export function LogIngredientSheet({ batch, line, onClose }: { batch: Batch; line: IngredientLine; onClose: () => void }) {
  const [date, setDate] = useState(() => logDateFor(line, batch));
  const [error, setError] = useState('');
  const save = async () => {
    if (!date) return setError('Enter when it went in.');
    await events.save({ batchId: batch.id, type: 'ingredient', date, value: null, note: '', ...entryFromLine(line), ingredientLineId: line.id });
    toast(`${line.name} logged on the timeline`);
    onClose();
  };
  return (
    <Sheet title={`Log ${line.name}`} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <p>
          {line.amount ? `${line.amount} of ${line.name}` : line.name}, from {ingredientStageLabel(line.stage ?? 'primary')} ingredients.
        </p>
        <Field label="When" hint={(line.stage ?? 'primary') === 'primary' ? 'Starts at the batch start date.' : undefined}>
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block">
          Add to timeline
        </button>
      </form>
    </Sheet>
  );
}
