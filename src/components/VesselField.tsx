// Picking the vessels a batch is in: one, or several with an amount in each (filled in the order
// you pick them). Free vessels come first, and each choice warns when it's too small or already
// holds another batch.

import { useState } from 'react';
import { Field } from './ui.tsx';
import { batches, equipment, useQuery } from '../db/store.ts';
import type { Batch, VesselFill, VolumeUnit } from '../db/types.ts';
import { fillInOrder, listNames, vesselChoices, vesselWarning } from '../lib/equipment.ts';
import { fmtVolume, volumeFromInput, volumeToInput } from '../lib/format.ts';
import { Icon } from '../icons/Icon.tsx';

interface Props {
  label?: string;
  value: VesselFill[];
  onChange: (fills: VesselFill[]) => void;
  /** The batch going in: its id (none for a new batch) and volume, for amounts and warnings. */
  batch: Pick<Batch, 'id' | 'volumeL'>;
  unit: VolumeUnit;
  /** What "none" is called: "No vessel" on the batch, "Not tracked" when racking. */
  noneLabel?: string;
  hint?: string;
  /** The vessels the batch is in now: shown as "in it now", not "free", and listed last when racking. */
  current?: string[];
  /** Racking: amounts that add up to more or less than the batch change its volume, and the note says so. */
  changesVolume?: boolean;
}

/** Shows nothing until you have vessels (More → Equipment), so the form stays simple without them. */
export function VesselField({ label = 'Vessel', value, onChange, batch, unit, noneLabel = 'No vessel', hint, current = [], changesVolume = false }: Props) {
  const becomes = (total: number) => (changesVolume ? ` The batch becomes ${fmtVolume(total, unit)}.` : '');
  const data = useQuery(async () => ({ items: await equipment.list(), batches: await batches.list() }));
  // Amounts typed by hand stop the automatic fill-in-order.
  const [typed, setTyped] = useState(false);
  if (!data) return null;
  const choices = vesselChoices(data.items, data.batches, batch.id).sort((a, b) => Number(current.includes(a.vessel.id)) - Number(current.includes(b.vessel.id)));
  if (choices.length === 0) return null;
  const byId = new Map(choices.map((c) => [c.vessel.id, c]));
  const fills = value.filter((f) => byId.has(f.vesselId));
  const several = fills.length > 1;

  /** Sets the vessels, refilling amounts in order unless you've typed your own. */
  const setVessels = (ids: string[], keepTyped = typed) => {
    if (ids.length < 2) return onChange(ids.map((vesselId) => ({ vesselId, volumeL: null })));
    if (keepTyped) return onChange(ids.map((vesselId) => ({ vesselId, volumeL: fills.find((f) => f.vesselId === vesselId)?.volumeL ?? null })));
    const amounts = fillInOrder(batch.volumeL, ids.map((id) => byId.get(id)?.vessel.capacityL));
    onChange(ids.map((vesselId, i) => ({ vesselId, volumeL: amounts[i] })));
  };
  const ids = fills.map((f) => f.vesselId);
  const unused = choices.filter((c) => !ids.includes(c.vessel.id));
  const optionText = (id: string) => {
    const c = byId.get(id)!;
    const status = c.holding.length ? `holds ${c.holding.map((b) => b.name).join(', ')}` : current.includes(id) ? 'in it now' : 'free';
    return [c.vessel.name, c.vessel.capacityL ? fmtVolume(c.vessel.capacityL, c.vessel.capacityUnit ?? unit) : null, status].filter(Boolean).join(' · ');
  };
  const total = several && fills.every((f) => f.volumeL != null) ? fills.reduce((s, f) => s + (f.volumeL ?? 0), 0) : null;

  return (
    <Field label={label} hint={several ? undefined : hint}>
      <div className="vessel-picks">
        {(fills.length ? fills : [null]).map((fill, i) => {
          const c = fill ? byId.get(fill.vesselId) : null;
          const empty = several && fill?.volumeL != null && fill.volumeL <= 0;
          const warning = empty ? `Nothing goes in ${c?.vessel.name}: change the amounts, or remove it.` : c && fill ? vesselWarning(c.vessel, several ? fill.volumeL : batch.volumeL, batch.id, data.batches, unit, several) : null;
          return (
            <div key={fill?.vesselId ?? 'none'} className="vessel-pick">
              <div className="vessel-pick-row">
                <select
                  aria-label={several ? `${label} ${i + 1}` : label}
                  value={fill?.vesselId ?? ''}
                  onChange={(e) => {
                    const next = [...ids];
                    if (!e.target.value) next.splice(i, 1);
                    else if (fill) next[i] = e.target.value;
                    else next.push(e.target.value);
                    setVessels(next);
                  }}
                >
                  {!several && <option value="">{noneLabel}</option>}
                  {[...(fill ? [fill.vesselId] : []), ...unused.map((u) => u.vessel.id)].map((id) => (
                    <option key={id} value={id}>
                      {optionText(id)}
                    </option>
                  ))}
                </select>
                {several && (
                  <>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="vessel-amount"
                      aria-label={`Amount in ${c?.vessel.name}`}
                      value={volumeToInput(fill!.volumeL, unit)}
                      onChange={(e) => {
                        setTyped(true);
                        onChange(fills.map((f) => (f.vesselId === fill!.vesselId ? { ...f, volumeL: volumeFromInput(e.target.value, unit) } : f)));
                      }}
                    />
                    <span className="vessel-unit">{unit}</span>
                    <button type="button" className="icon-btn" aria-label={`Remove ${c?.vessel.name}`} onClick={() => setVessels(ids.filter((id) => id !== fill!.vesselId))}>
                      <Icon name="close" size={18} />
                    </button>
                  </>
                )}
              </div>
              {warning && (
                <span className="warning vessel-warning" role="note">
                  {warning}
                </span>
              )}
            </div>
          );
        })}
        {fills.length > 0 && unused.length > 0 && (
          <button type="button" className="btn btn-small vessel-add" onClick={() => setVessels([...ids, unused[0].vessel.id], false)}>
            <Icon name="plus" size={18} />
            Add another vessel
          </button>
        )}
        {several && (
          <p className="field-hint" role="status">
            {total == null
              ? `Split across ${listNames(fills.map((f) => byId.get(f.vesselId)!.vessel.name))}.`
              : batch.volumeL == null || Math.abs(total - batch.volumeL) < 0.005
                ? `${fmtVolume(total, unit)} across ${fills.length} vessels: all of it.`
                : total < batch.volumeL
                  ? `${fmtVolume(total, unit)} across ${fills.length} vessels: ${fmtVolume(batch.volumeL - total, unit)} left behind.${becomes(total)}`
                  : `${fmtVolume(total, unit)} across ${fills.length} vessels, more than the batch's ${fmtVolume(batch.volumeL, unit)}.${becomes(total)}`}
          </p>
        )}
      </div>
    </Field>
  );
}
