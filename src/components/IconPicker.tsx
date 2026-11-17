// Lets the user pick the flavor icon and the liquid color for a recipe,
// batch or bottle.

import { useState } from 'react';
import { FLAVORS } from '../icons/flavors.ts';
import { FlavorIcon, getFlavor } from '../icons/FlavorIcon.tsx';
import { Sheet } from './ui.tsx';

/** Liquid colors offered next to the flavor's own default. */
const COLORS = ['#EFD27A', '#E8A33A', '#C77A12', '#B5672F', '#6E3B1A', '#F2A070', '#E5646A', '#B42335', '#7B3F8E', '#4A2A5E', '#D5D36A', '#8BC34A'];

interface Props {
  icon: string;
  color: string;
  onChange: (next: { icon: string; color: string }) => void;
}

export function IconPicker({ icon, color, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const flavor = getFlavor(icon);
  const swatches = COLORS.includes(flavor.color) ? COLORS : [flavor.color, ...COLORS];

  return (
    <div className="icon-picker">
      <button type="button" className="icon-picker-button" onClick={() => setOpen(true)}>
        <span className="icon-tile icon-tile-large">
          <FlavorIcon id={icon} size={52} />
        </span>
        <span className="icon-picker-text">
          <span className="field-label">Icon</span>
          <strong>{flavor.label}</strong>
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
            onClick={() => onChange({ icon, color: swatch })}
          />
        ))}
      </div>

      {open && (
        <Sheet title="Choose an icon" onClose={() => setOpen(false)}>
          <div className="icon-grid">
            {FLAVORS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={f.id === icon ? 'icon-choice icon-choice-on' : 'icon-choice'}
                aria-pressed={f.id === icon}
                onClick={() => {
                  // Picking an icon also picks its usual color; the swatches can override it.
                  onChange({ icon: f.id, color: f.color });
                  setOpen(false);
                }}
              >
                <span className="icon-tile">
                  <FlavorIcon id={f.id} size={38} />
                </span>
                <span>{f.label}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}
