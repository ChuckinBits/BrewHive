// Picking the vessel a batch is in: free vessels first, each with its capacity, and a warning when
// the vessel is too small or already holds another batch.

import { Field } from './ui.tsx';
import { batches, equipment, useQuery } from '../db/store.ts';
import type { Batch, VolumeUnit } from '../db/types.ts';
import { vesselChoices, vesselWarning } from '../lib/equipment.ts';
import { fmtVolume } from '../lib/format.ts';

interface Props {
  label?: string;
  value: string | null;
  onChange: (vesselId: string | null) => void;
  /** The batch going in: its id (none for a new batch) and volume, for the warning. */
  batch: Pick<Batch, 'id' | 'volumeL'>;
  unit: VolumeUnit;
  /** What "none" is called: "No vessel" on the batch, "Not tracked" when racking. */
  noneLabel?: string;
  hint?: string;
  /** The vessel the batch is in now: shown as "in it now", not "free", and listed last when racking. */
  current?: string | null;
}

/** Shows nothing until you have vessels (More → Equipment), so the form stays simple without them. */
export function VesselField({ label = 'Vessel', value, onChange, batch, unit, noneLabel = 'No vessel', hint, current }: Props) {
  const data = useQuery(async () => ({ items: await equipment.list(), batches: await batches.list() }));
  if (!data) return null;
  const choices = vesselChoices(data.items, data.batches, batch.id).sort((a, b) => Number(a.vessel.id === current) - Number(b.vessel.id === current));
  if (choices.length === 0) return null;
  const picked = choices.find((c) => c.vessel.id === value)?.vessel;
  const warning = picked ? vesselWarning(picked, batch, data.batches, unit) : null;
  return (
    <Field label={label} hint={warning ? undefined : hint}>
      <select value={picked ? picked.id : ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{noneLabel}</option>
        {choices.map(({ vessel, holding }) => (
          <option key={vessel.id} value={vessel.id}>
            {[vessel.name, vessel.capacityL ? fmtVolume(vessel.capacityL, vessel.capacityUnit ?? unit) : null, holding.length ? `holds ${holding.map((b) => b.name).join(', ')}` : vessel.id === current ? 'in it now' : 'free']
              .filter(Boolean)
              .join(' · ')}
          </option>
        ))}
      </select>
      {warning && (
        <span className="warning vessel-warning" role="note">
          {warning}
        </span>
      )}
    </Field>
  );
}
