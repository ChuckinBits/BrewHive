// Lets the user pick up to three flavor icons and the liquid color for a
// recipe, batch or bottle. Icon 1 is the main one: it's drawn in front, and
// its usual color, name and style are the ones suggested. Some flavors come in
// colors (a red apple, a bochet); each icon has its own.

import { useState } from 'react';
import { FLAVORS } from '../icons/flavors.ts';
import { DEFAULT_FLAVOR, FlavorIcon, FlavorIcons, MAX_ICONS, getFlavor } from '../icons/FlavorIcon.tsx';
import { FLAVOR_COLORS, colorOf, joinIcon, splitIcon } from '../icons/flavorColors.ts';
import { Sheet } from './ui.tsx';

/** Liquid colors offered next to the flavor's own default. */
const COLORS = ['#EFD27A', '#E8A33A', '#C77A12', '#B5672F', '#6E3B1A', '#F2A070', '#E5646A', '#B42335', '#7B3F8E', '#4A2A5E', '#D5D36A', '#8BC34A'];

export interface IconChoice {
  icon: string;
  extraIcons: string[];
  color: string;
}

interface Props {
  icon: string;
  extraIcons?: string[];
  color: string;
  onChange: (next: IconChoice) => void;
}

export function IconPicker({ icon, extraIcons = [], color, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const icons = [icon, ...extraIcons].slice(0, MAX_ICONS);
  const flavor = getFlavor(icon);
  const swatches = COLORS.includes(flavor.color) ? COLORS : [flavor.color, ...COLORS];
  const isCustom = !swatches.some((s) => s.toLowerCase() === color.toLowerCase());
  // The last color picked by hand, so it's easy to pick again after trying a swatch.
  const [custom, setCustom] = useState<string | null>(isCustom ? color : null);

  /**
   * Sets the icons. A new main flavor brings its usual liquid color with it; so does a new color
   * of Traditional (a bochet is darker). Recoloring a fruit keeps the liquid color as it is.
   */
  const setIcons = (next: string[]) => {
    if (next.length === 0) return;
    const [main, ...rest] = next;
    const sameFlavor = splitIcon(main).flavorId === splitIcon(icon).flavorId;
    const liquid = colorOf(main)?.liquid;
    onChange({ icon: main, extraIcons: rest, color: main === icon ? color : !sameFlavor ? getFlavor(main).color : (liquid ?? color) });
  };

  // The slots while the sheet is open: the main icon, then up to two more. The selected slot is the one a
  // tap on an icon or a color fills. A slot just added is empty until an icon is tapped.
  const [slots, setSlots] = useState<(string | null)[]>(icons);
  const [selected, setSelected] = useState(0);
  const filled = (list: (string | null)[]) => list.filter((x): x is string => !!x);
  const update = (next: (string | null)[], nextSelected = selected) => {
    setSlots(next);
    setSelected(nextSelected);
    setIcons(filled(next));
  };
  /** Selects a slot; an empty slot left behind is dropped. */
  const select = (index: number) => {
    const target = slots[index];
    const kept = slots.filter((x, i) => x || i === index);
    update(kept, kept.indexOf(target));
  };
  const addSlot = () => {
    const next = [...filled(slots), null];
    update(next, next.length - 1);
  };
  const remove = (index: number) => {
    const next = filled(slots.filter((_, i) => i !== index));
    update(next.length ? next : [DEFAULT_FLAVOR], 0);
  };
  /** Puts a flavor in the selected slot, in its own color; the same flavor again keeps the color picked. */
  const tapFlavor = (flavorId: string) => {
    if (splitIcon(slots[selected]).flavorId === flavorId) return;
    update(slots.map((x, i) => (i === selected ? flavorId : x)));
  };
  const tapColor = (colorId: string) => {
    const current = slots[selected];
    if (!current) return;
    update(slots.map((x, i) => (i === selected ? joinIcon(splitIcon(current).flavorId, colorId) : x)));
  };
  const current = slots[selected];
  const currentColors = current ? FLAVOR_COLORS[splitIcon(current).flavorId] : undefined;
  const ordinal = ['main', '2nd', '3rd'];

  const pickColor = (next: string) => onChange({ icon, extraIcons, color: next });

  return (
    <div className="icon-picker">
      <button
        type="button"
        className="icon-picker-button"
        onClick={() => {
          setSlots(icons);
          setSelected(0);
          setOpen(true);
        }}
      >
        <span className="icon-tile icon-tile-large">
          <FlavorIcons icons={icons} size={52} />
        </span>
        <span className="icon-picker-text">
          <span className="field-label">{icons.length > 1 ? 'Icons' : 'Icon'}</span>
          <strong>{icons.map((i) => getFlavor(i).label).join(', ')}</strong>
          <span className="muted">Tap to change</span>
        </span>
      </button>

      <div className="swatches" role="group" aria-label="Color">
        {swatches.map((swatch) => (
          <button
            key={swatch}
            type="button"
            className={swatch.toLowerCase() === color.toLowerCase() ? 'swatch swatch-on' : 'swatch'}
            style={{ backgroundColor: swatch }}
            aria-label={`Color ${swatch}`}
            aria-pressed={swatch.toLowerCase() === color.toLowerCase()}
            onClick={() => pickColor(swatch)}
          />
        ))}
        <label
          className={`swatch swatch-custom${isCustom ? ' swatch-on' : ''}${custom ? ' swatch-custom-set' : ''}`}
          style={custom ? { backgroundColor: custom } : undefined}
          title="Pick any color"
        >
          <input
            type="color"
            aria-label="Custom color"
            value={custom ?? color}
            // Tapping the circle brings the remembered color back right away; the picker still opens to adjust it.
            onClick={() => {
              if (custom && !isCustom) pickColor(custom);
            }}
            onChange={(e) => {
              setCustom(e.target.value);
              pickColor(e.target.value);
            }}
          />
        </label>
      </div>

      {open && (
        <Sheet title="Choose icons" onClose={() => setOpen(false)}>
          <div className="icon-slots" role="group" aria-label="Picked icons">
            {slots.map((slot, i) => (
              <span key={i} className={i === selected ? 'icon-slot icon-slot-on' : 'icon-slot'}>
                <button type="button" className="icon-slot-pick" aria-pressed={i === selected} onClick={() => select(i)}>
                  <span className="picked-number">{i + 1}</span>
                  {slot ? <FlavorIcon id={slot} size={24} /> : null}
                  <span className={slot ? 'picked-name' : 'picked-name muted'}>
                    {slot ? getFlavor(slot).label : 'Tap an icon'}
                    {i === 0 && <span className="muted"> · Main</span>}
                  </span>
                </button>
                {(filled(slots).length > 1 || !slot) && (
                  <button type="button" className="icon-slot-remove" aria-label={`Remove ${slot ? getFlavor(slot).label : 'empty slot'}`} onClick={() => remove(i)}>
                    ×
                  </button>
                )}
              </span>
            ))}
            {slots.every(Boolean) && slots.length < MAX_ICONS && (
              <button type="button" className="icon-slot icon-slot-add" onClick={addSlot}>
                + Add {ordinal[slots.length]} icon
              </button>
            )}
          </div>
          <p className="field-hint">
            {current ? `Tap an icon to change the ${ordinal[selected]} icon.` : `Tap an icon for the ${ordinal[selected]} icon.`}
          </p>
          {current && currentColors && (
            <div className="flavor-colors" role="radiogroup" aria-label={`Color of the ${ordinal[selected]} icon`}>
              {currentColors.map((c) => {
                const on = (colorOf(current)?.id ?? currentColors[0].id) === c.id;
                return (
                  <button key={c.id} type="button" role="radio" aria-checked={on} className={on ? 'flavor-color flavor-color-on' : 'flavor-color'} onClick={() => tapColor(c.id)}>
                    <span className="flavor-color-dot" style={{ backgroundColor: c.swatch }} />
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="icon-grid">
            {FLAVORS.map((f) => {
              const numbers = slots.map((x, i) => (x && splitIcon(x).flavorId === f.id ? i + 1 : 0)).filter(Boolean);
              const here = current && splitIcon(current).flavorId === f.id;
              // The tile shows the color picked for it: the selected slot's, or else the first slot with it.
              const shown = here ? current : slots.find((x) => x && splitIcon(x).flavorId === f.id) ?? f.id;
              return (
                <button key={f.id} type="button" className={here ? 'icon-choice icon-choice-on' : 'icon-choice'} aria-pressed={!!here} onClick={() => tapFlavor(f.id)}>
                  {numbers.length > 0 && (
                    <span className="icon-choice-number" aria-hidden="true">
                      {numbers.join('·')}
                    </span>
                  )}
                  <span className="icon-tile">
                    <FlavorIcon id={shown} size={38} />
                  </span>
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>
          <button type="button" className="btn btn-primary btn-block sheet-done" onClick={() => setOpen(false)}>
            Done
          </button>
        </Sheet>
      )}
    </div>
  );
}
