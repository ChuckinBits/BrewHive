// Equipment (More → Equipment): your vessels, with how much each holds and which batch is in it,
// and the rest of your gear. Batches pick a vessel when they start or when they're racked.

import { useState } from 'react';
import { ConfirmSheet, Field, Segmented, Sheet, TopBar, UnitField, VOLUME_UNITS, toast } from '../components/ui.tsx';
import { batches, currencyOf, equipment, saveSettings, useQuery, useSettings } from '../db/store.ts';
import { GEAR_ICONS, VESSEL_TYPES, type Batch, type Equipment, type GearIcon, type VesselSort, type VesselType, type VolumeUnit } from '../db/types.ts';
import { MAX_AT_ONCE, batchesIn, gearIcon, groupVessels, guessGearIcon, numberedNames, priceTotal, sortGroups, suggestVesselName, vesselIcon, vesselTypeLabel } from '../lib/equipment.ts';
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
  const sort = settings.vesselSort ?? 'type';
  const data = useQuery(async () => ({ items: await equipment.list(), batches: await batches.list() }));
  const [editing, setEditing] = useState<Editing>(null);
  // Which groups of alike vessels are open.
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  if (!data) return <TopBar title="Equipment" back="/more" />;

  const vessels = data.items.filter((e) => e.kind === 'vessel').sort(byName);
  const gear = data.items.filter((e) => e.kind === 'gear').sort(byName);
  const free = vessels.filter((v) => batchesIn(v.id, data.batches).length === 0).length;
  const toggle = (key: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  /** A vessel's line: its name, and its type and size when it isn't under a group that says so. */
  const vesselRow = (v: Equipment, withSize: boolean) => {
    const holding = batchesIn(v.id, data.batches);
    return (
      <button type="button" className="library-row equipment-row" onClick={() => setEditing({ item: v, kind: 'vessel' })}>
        {withSize && (
          <span className="timeline-icon">
            <Icon name={vesselIcon(v.vesselType)} size={20} />
          </span>
        )}
        <span className="equipment-text">
          <span className="library-name">{v.name}</span>
          {withSize && <span className="muted">{[vesselTypeLabel(v), v.capacityL ? fmtVolume(v.capacityL, v.capacityUnit ?? unit) : null].filter(Boolean).join(' · ')}</span>}
        </span>
        <span className={holding.length ? 'vessel-status vessel-busy' : 'vessel-status'}>{holding.length ? holding.map((b) => b.name).join(', ') : 'Free'}</span>
      </button>
    );
  };
  const vesselCost = priceTotal(vessels);
  const gearCost = priceTotal(gear);
  const unpriced = vesselCost.unpriced + gearCost.unpriced;

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
        {groupVessels(vessels, unit).length > 1 && (
          <Segmented<VesselSort>
            label="Sort vessels"
            value={sort}
            options={[
              { id: 'type', label: 'Type' },
              { id: 'size', label: 'Size' },
              { id: 'name', label: 'Name' },
              { id: 'free', label: 'Free first' },
            ]}
            onChange={(vesselSort) => void saveSettings({ vesselSort })}
          />
        )}
        {vessels.length === 0 ? (
          <p className="muted">Carboys, buckets, jars, kegs and barrels. Give each its capacity, and pick one when you start or rack a batch to see which are free and how much headspace a batch has.</p>
        ) : (
          <ul className="library-list">
            {sortGroups(groupVessels(vessels, unit), sort, data.batches).map((group) => {
              // One of a kind: just the vessel. Several alike: one line that opens to show each.
              if (group.vessels.length === 1) return <li key={group.key}>{vesselRow(group.vessels[0], true)}</li>;
              const groupFree = group.vessels.filter((v) => batchesIn(v.id, data.batches).length === 0).length;
              const isOpen = open.has(group.key);
              return (
                <li key={group.key} className="vessel-group">
                  <button type="button" className="library-row equipment-row vessel-group-head" aria-expanded={isOpen} onClick={() => toggle(group.key)}>
                    <span className="timeline-icon">
                      <Icon name={vesselIcon(group.vessels[0].vesselType)} size={20} />
                    </span>
                    <span className="equipment-text">
                      <span className="library-name">{group.label}</span>
                      <span className="muted">{group.vessels.length} vessels</span>
                    </span>
                    <span className={groupFree === 0 ? 'vessel-status vessel-busy' : 'vessel-status'}>{groupFree === group.vessels.length ? 'All free' : `${groupFree} of ${group.vessels.length} free`}</span>
                    <span className={isOpen ? 'vessel-chevron vessel-chevron-open' : 'vessel-chevron'}>
                      <Icon name="chevron" size={18} />
                    </span>
                  </button>
                  {isOpen && (
                    <ul className="library-list vessel-group-list">
                      {group.vessels.map((v) => (
                        <li key={v.id}>{vesselRow(v, false)}</li>
                      ))}
                    </ul>
                  )}
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
                    <Icon name={gearIcon(g.icon)} size={20} />
                  </span>
                  <span className="equipment-text">
                    <span className="library-name">
                      {g.name}
                      {(g.quantity ?? 1) > 1 && <span className="gear-count"> × {g.quantity}</span>}
                    </span>
                    {g.notes && <span className="muted equipment-notes">{g.notes}</span>}
                  </span>
                  {g.price != null && <span className="vessel-status">{fmtMoney(g.price * (g.quantity ?? 1), currency)}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {vessels.length + gear.length > 0 && (
        <section className="card">
          <h2>What it cost</h2>
          <dl className="facts equipment-cost">
            <dt>Vessels</dt>
            <dd>{fmtMoney(vesselCost.total, currency)}</dd>
            <dt>Other gear</dt>
            <dd>{fmtMoney(gearCost.total, currency)}</dd>
            <dt>Total</dt>
            <dd className="equipment-cost-total">{fmtMoney(vesselCost.total + gearCost.total, currency)}</dd>
          </dl>
          {unpriced > 0 && <p className="field-hint">{unpriced === 1 ? '1 item has no price, so it isn\'t counted.' : `${unpriced} items have no price, so they aren't counted.`}</p>}
        </section>
      )}

      {editing && <EquipmentSheet item={editing.item} kind={editing.kind} unit={unit} currency={currency} batches={data.batches} items={data.items} onClose={() => setEditing(null)} />}
    </>
  );
}

interface SheetProps {
  item: Equipment | null;
  kind: Equipment['kind'];
  unit: VolumeUnit;
  currency: string;
  batches: Batch[];
  /** Everything on the list, for numbering vessels added together. */
  items: Equipment[];
  onClose: () => void;
}

function EquipmentSheet({ item, kind, unit, currency, batches: all, items, onClose }: SheetProps) {
  const isVessel = kind === 'vessel';
  const [name, setName] = useState(item?.name ?? '');
  const [vesselType, setVesselType] = useState<VesselType>(item?.vesselType ?? 'carboy');
  const [capacityUnit, setCapacityUnit] = useState<VolumeUnit>(item?.capacityUnit ?? unit);
  const [capacity, setCapacity] = useState(volumeToInput(item?.capacityL ?? null, item?.capacityUnit ?? unit));
  const [price, setPrice] = useState(item?.price != null ? String(Math.round(item.price * 100) / 100) : '');
  // With several, the price can be typed for each one or for all of them together.
  const [priceFor, setPriceFor] = useState<'each' | 'total'>('each');
  const [notes, setNotes] = useState(item?.notes ?? '');
  // Gear's picture: the one picked, or else one that fits the name as it's typed.
  const [picked, setPicked] = useState<GearIcon | null>(item?.icon ?? null);
  const icon: GearIcon = picked ?? guessGearIcon(name) ?? 'other';
  // Adding several alike at once (new vessels only).
  const [count, setCount] = useState(String(item?.quantity ?? 1));
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const holding = item ? batchesIn(item.id, all) : [];

  const capacityL = volumeFromInput(capacity, capacityUnit);
  const suggested = suggestVesselName(vesselType, capacityL, capacityUnit);

  // Several alike at once (new items only): each its own, numbered after the shared name.
  const base = name.trim() || (isVessel ? suggested : '');
  const countField = (!item || !isVessel) && (
    <Field
      label="How many"
      hint={
        !isVessel
          ? 'Several of the same, such as airlocks? One line, with the count.'
          : Number(count) > 1
            ? `Each is added on its own, numbered: ${numberedNames(base, Math.min(Number(count) || 1, MAX_AT_ONCE), items.map((e) => e.name)).slice(0, 2).join(', ')}…`
            : 'Got several alike? Add them all at once.'
      }
    >
      <input type="text" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/[^0-9]/g, ''))} />
    </Field>
  );

  const several = Number(count) > 1 && (!item || !isVessel);
  const typed = price.trim() ? parseNum(price.replace(/[^0-9.,-]/g, '')) : null;
  const priceHint =
    several && typed != null
      ? priceFor === 'total'
        ? `${fmtMoney(typed / Number(count), currency)} each.`
        : `${fmtMoney(typed * Number(count), currency)} in all.`
      : undefined;
  /** Switching between each and total carries the number across, so it still means the same price. */
  const switchPriceFor = (next: 'each' | 'total') => {
    if (next !== priceFor && typed != null) {
      const n = Number(count);
      setPrice(String(Math.round((next === 'total' ? typed * n : typed / n) * 100) / 100));
    }
    setPriceFor(next);
  };

  const save = async () => {
    if (isVessel && capacity.trim() && !(capacityL != null && capacityL > 0)) return setError('Capacity should be a number, such as 5 or 19.');
    const typedPrice = price.trim() ? parseNum(price.replace(/[^0-9.,-]/g, '')) : null;
    // A total is divided across them; kept to fractions of a cent so it adds back up.
    const priceValue = typedPrice != null && several && priceFor === 'total' ? Math.round((typedPrice / Number(count)) * 10000) / 10000 : typedPrice;
    if (price.trim() && (typedPrice == null || typedPrice < 0)) return setError('Enter what it cost, such as 34.99, or leave it empty.');
    const finalName = name.trim() || (isVessel ? suggested : '');
    if (!finalName) return setError('Enter what it is, such as Hydrometer.');
    const howMany = item && isVessel ? 1 : Number(count.trim() || '1');
    const most = isVessel ? MAX_AT_ONCE : 9999;
    if (!Number.isInteger(howMany) || howMany < 1 || howMany > most) return setError(`How many should be a whole number from 1 to ${most}.`);
    // Vessels are each their own (each holds its own batch), numbered; gear is one item with a count.
    const names = item || !isVessel ? [finalName] : numberedNames(finalName, howMany, items.filter((e) => !e.deletedAt).map((e) => e.name));
    for (const vesselName of names) {
      await equipment.save({
        ...(item ?? {}),
        name: vesselName,
        kind,
        notes: notes.trim(),
        price: priceValue,
        ...(isVessel ? {} : { quantity: howMany, icon }),
        ...(isVessel ? { vesselType, capacityL: capacity.trim() ? capacityL : null, capacityUnit } : {}),
      });
    }
    toast(item ? 'Saved' : names.length > 1 ? `${names.length} vessels added` : isVessel ? 'Vessel added' : 'Gear added');
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
        {isVessel && countField}
        <Field label="Name" hint={isVessel ? (Number(count) > 1 && !item ? 'The name they share: each gets its number after it.' : name.trim() ? 'Tell them apart, such as Carboy A or Big bucket.' : `Left empty, it's called ${suggested}.`) : undefined}>
          <input type="text" value={name} placeholder={isVessel ? suggested : 'Hydrometer'} autoFocus={!item && !isVessel} onChange={(e) => setName(e.target.value)} />
        </Field>
        {!isVessel && (
          <div className="field">
            <span className="field-label" id="gear-icon-label">
              Icon
            </span>
            <div className="icon-picker" role="radiogroup" aria-labelledby="gear-icon-label">
              {GEAR_ICONS.map((g) => (
                <button key={g.id} type="button" role="radio" aria-checked={icon === g.id} aria-label={g.label} title={g.label} className={icon === g.id ? 'icon-pick icon-pick-on' : 'icon-pick'} onClick={() => setPicked(g.id)}>
                  <Icon name={gearIcon(g.id)} size={22} />
                </button>
              ))}
            </div>
            <span className="field-hint">{GEAR_ICONS.find((g) => g.id === icon)?.label}{picked ? '' : ' · picked from the name'}</span>
          </div>
        )}
        {!isVessel && countField}
        <Field label={`Price (${currency}, optional)`} hint={priceHint}>
          <div className="price-row">
            <input type="text" inputMode="decimal" aria-label="Price" value={price} placeholder={isVessel ? '39.99' : '12.99'} onChange={(e) => setPrice(e.target.value)} />
            {several && (
              <Segmented<'each' | 'total'>
                label="Price for"
                value={priceFor}
                options={[
                  { id: 'each', label: 'Each' },
                  { id: 'total', label: 'Total' },
                ]}
                onChange={switchPriceFor}
              />
            )}
          </div>
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
          {item ? 'Save' : isVessel && Number(count) > 1 ? `Add ${Number(count)} vessels` : isVessel ? 'Add vessel' : 'Add gear'}
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
