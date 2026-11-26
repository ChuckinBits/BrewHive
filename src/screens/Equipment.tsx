// Equipment (More → Equipment): your vessels, with how much each holds and which batch is in it,
// and the rest of your gear. Batches pick a vessel when they start or when they're racked.

import { useState } from 'react';
import { ConfirmSheet, Field, Sheet, TopBar, UnitField, VOLUME_UNITS, toast } from '../components/ui.tsx';
import { batches, currencyOf, equipment, useQuery, useSettings } from '../db/store.ts';
import { VESSEL_TYPES, type Batch, type Equipment, type VesselType, type VolumeUnit } from '../db/types.ts';
import { batchesIn, suggestVesselName, vesselTypeLabel } from '../lib/equipment.ts';
import { fmtMoney } from '../lib/cost.ts';
import { fmtVolume, parseNum, volumeFromInput, volumeToInput } from '../lib/format.ts';
import { volumeUnitOf } from '../lib/units.ts';
import { Icon } from '../icons/Icon.tsx';
import { Link } from '../lib/router.tsx';

type Editing = { item: Equipment | null; kind: Equipment['kind'] } | null;

const byName = (a: Equipment, b: Equipment) => a.name.localeCompare(b.name, undefined, { numeric: true });

export function EquipmentScreen() {
  const settings = useSettings();
  const unit = volumeUnitOf(settings);
  const currency = currencyOf(settings);
  const data = useQuery(async () => ({ items: await equipment.list(), batches: await batches.list() }));
  const [editing, setEditing] = useState<Editing>(null);
  if (!data) return <TopBar title="Equipment" back="/more" />;

  const vessels = data.items.filter((e) => e.kind === 'vessel').sort(byName);
  const gear = data.items.filter((e) => e.kind === 'gear').sort(byName);
  const free = vessels.filter((v) => batchesIn(v.id, data.batches).length === 0).length;

  return (
    <>
      <TopBar title="Equipment" back="/more" />
      <div className="button-row equipment-add">
        <button type="button" className="btn btn-primary" onClick={() => setEditing({ item: null, kind: 'vessel' })}>
          <Icon name="plus" size={20} />
          Add vessel
        </button>
        <button type="button" className="btn" onClick={() => setEditing({ item: null, kind: 'gear' })}>
          <Icon name="plus" size={20} />
          Add gear
        </button>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Vessels</h2>
          {vessels.length > 0 && <span className="muted">{free === vessels.length ? 'All free' : `${free} of ${vessels.length} free`}</span>}
        </div>
        {vessels.length === 0 ? (
          <p className="muted">Carboys, buckets, jugs, kegs and barrels. Give each its capacity, and pick one when you start or rack a batch to see which are free and how much headspace a batch has.</p>
        ) : (
          <ul className="library-list">
            {vessels.map((v) => {
              const holding = batchesIn(v.id, data.batches);
              return (
                <li key={v.id}>
                  <button type="button" className="library-row equipment-row" onClick={() => setEditing({ item: v, kind: 'vessel' })}>
                    <span className="timeline-icon">
                      <Icon name="batches" size={20} />
                    </span>
                    <span className="equipment-text">
                      <span className="library-name">{v.name}</span>
                      <span className="muted">{[vesselTypeLabel(v), v.capacityL ? fmtVolume(v.capacityL, v.capacityUnit ?? unit) : null].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className={holding.length ? 'vessel-status vessel-busy' : 'vessel-status'}>{holding.length ? holding.map((b) => b.name).join(', ') : 'Free'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Other gear</h2>
        {gear.length === 0 ? (
          <p className="muted">Hydrometers, siphons, pH meters, airlocks: whatever you'd like to keep a list of, with notes and what it cost.</p>
        ) : (
          <ul className="library-list">
            {gear.map((g) => (
              <li key={g.id}>
                <button type="button" className="library-row equipment-row" onClick={() => setEditing({ item: g, kind: 'gear' })}>
                  <span className="timeline-icon">
                    <Icon name="flask" size={20} />
                  </span>
                  <span className="equipment-text">
                    <span className="library-name">{g.name}</span>
                    {g.notes && <span className="muted equipment-notes">{g.notes}</span>}
                  </span>
                  {g.price != null && <span className="vessel-status">{fmtMoney(g.price, currency)}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && <EquipmentSheet item={editing.item} kind={editing.kind} unit={unit} currency={currency} batches={data.batches} onClose={() => setEditing(null)} />}
    </>
  );
}

interface SheetProps {
  item: Equipment | null;
  kind: Equipment['kind'];
  unit: VolumeUnit;
  currency: string;
  batches: Batch[];
  onClose: () => void;
}

function EquipmentSheet({ item, kind, unit, currency, batches: all, onClose }: SheetProps) {
  const isVessel = kind === 'vessel';
  const [name, setName] = useState(item?.name ?? '');
  const [vesselType, setVesselType] = useState<VesselType>(item?.vesselType ?? 'carboy');
  const [capacityUnit, setCapacityUnit] = useState<VolumeUnit>(item?.capacityUnit ?? unit);
  const [capacity, setCapacity] = useState(volumeToInput(item?.capacityL ?? null, item?.capacityUnit ?? unit));
  const [price, setPrice] = useState(item?.price != null ? String(item.price) : '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const holding = item ? batchesIn(item.id, all) : [];

  const capacityL = volumeFromInput(capacity, capacityUnit);
  const suggested = suggestVesselName(vesselType, capacityL, capacityUnit);

  const save = async () => {
    if (isVessel && capacity.trim() && !(capacityL != null && capacityL > 0)) return setError('Capacity should be a number, such as 5 or 19.');
    const priceValue = price.trim() ? parseNum(price.replace(/[^0-9.,-]/g, '')) : null;
    if (price.trim() && (priceValue == null || priceValue < 0)) return setError('Enter what it cost, such as 34.99, or leave it empty.');
    const finalName = name.trim() || (isVessel ? suggested : '');
    if (!finalName) return setError('Enter what it is, such as Hydrometer.');
    await equipment.save({
      ...(item ?? {}),
      name: finalName,
      kind,
      notes: notes.trim(),
      price: priceValue,
      ...(isVessel ? { vesselType, capacityL: capacity.trim() ? capacityL : null, capacityUnit } : {}),
    });
    toast(item ? 'Saved' : isVessel ? 'Vessel added' : 'Gear added');
    onClose();
  };

  return (
    <Sheet title={item ? `Edit ${item.name}` : isVessel ? 'Add vessel' : 'Add gear'} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {isVessel && (
          <div className="form-pair">
            <Field label="Type">
              <select value={vesselType} onChange={(e) => setVesselType(e.target.value as VesselType)}>
                {VESSEL_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <UnitField label="Capacity" value={capacity} onChange={setCapacity} unit={capacityUnit} units={VOLUME_UNITS} onUnit={setCapacityUnit} placeholder={capacityUnit === 'gal' ? '5' : '19'} />
          </div>
        )}
        <Field label="Name" hint={isVessel ? (name.trim() ? 'Tell them apart, such as Carboy A or Big bucket.' : `Left empty, it's called ${suggested}.`) : undefined}>
          <input type="text" value={name} placeholder={isVessel ? suggested : 'Hydrometer'} autoFocus={!item && !isVessel} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={`Price (${currency}, optional)`}>
          <input type="text" inputMode="decimal" value={price} placeholder={isVessel ? '39.99' : '12.99'} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Notes">
          <textarea rows={3} value={notes} placeholder={isVessel ? 'Glass, 3-piece airlock, small chip on the neck' : 'Where it lives, when it was calibrated'} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {holding.length > 0 && (
          <p className="field-hint">
            Holding{' '}
            {holding.map((b, i) => (
              <span key={b.id}>
                {i > 0 && ', '}
                <Link to={`/batches/${b.id}`}>
                  {b.name}
                </Link>
              </span>
            ))}
            .
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block">
          {item ? 'Save' : isVessel ? 'Add vessel' : 'Add gear'}
        </button>
        {item && (
          <button type="button" className="btn btn-danger-quiet btn-block" onClick={() => setDeleting(true)}>
            <Icon name="trash" size={20} />
            Delete
          </button>
        )}
      </form>
      {deleting && item && (
        <ConfirmSheet
          title={`Delete ${item.name}?`}
          message={
            holding.length
              ? `${holding.map((b) => b.name).join(', ')} ${holding.length === 1 ? 'is' : 'are'} in it. ${holding.length === 1 ? 'It keeps' : 'They keep'} ${holding.length === 1 ? 'its' : 'their'} history, but won't show a vessel.`
              : `${item.name} is removed from your equipment. Batches that used it keep their history.`
          }
          confirmLabel="Delete"
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await equipment.remove(item.id);
            toast('Deleted');
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}
