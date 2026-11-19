// Lets the user pick up to three flavor icons and the liquid color for a
// recipe, batch or bottle. Icon 1 is the main one: it's drawn in front, and
// its usual color, name and style are the ones suggested.

import { useState } from 'react';
import { FLAVORS } from '../icons/flavors.ts';
import { DEFAULT_FLAVOR, FlavorIcon, FlavorIcons, MAX_ICONS, getFlavor } from '../icons/FlavorIcon.tsx';
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

  /** Sets the icons; a new main icon brings its usual color with it. */
  const setIcons = (next: string[]) => {
    if (next.length === 0) return;
    const [main, ...rest] = next;
    onChange({ icon: main, extraIcons: rest, color: main === icon ? color : getFlavor(main).color });
  };

  // The picks while the sheet is open. They may be empty for a moment (to swap the only icon);
  // the record keeps its last non-empty set.
  const [picks, setPicks] = useState<string[]>(icons);
  const choose = (next: string[]) => {
    setPicks(next);
    setIcons(next);
  };
  const toggle = (id: string) => {
    // Traditional means just honey, so picking a flavor replaces it rather than joining it.
    if (picks.length === 1 && picks[0] === DEFAULT_FLAVOR && id !== DEFAULT_FLAVOR) choose([id]);
    else if (picks.includes(id)) choose(picks.filter((i) => i !== id));
    else if (picks.length < MAX_ICONS) choose([...picks, id]);
  };

  const pickColor = (next: string) => onChange({ icon, extraIcons, color: next });

  return (
    <div className="icon-picker">
      <button
        type="button"
        className="icon-picker-button"
        onClick={() => {
          setPicks(icons);
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
          <div className="picked-icons" aria-label="Picked icons">
            <ol>
              {picks.map((id, i) => (
                <li key={id}>
                  <span className="picked-number">{i + 1}</span>
                  <FlavorIcon id={id} size={28} />
                  <span className="picked-name">
                    {getFlavor(id).label}
                    {i === 0 && <span className="muted"> · Main</span>}
                  </span>
                  {i > 0 && (
                    <button type="button" className="btn btn-quiet btn-small" onClick={() => choose([id, ...picks.filter((x) => x !== id)])}>
                      Make main
                    </button>
                  )}
                </li>
              ))}
            </ol>
            <p className="field-hint">
              {picks.length === 0
                ? 'Pick at least one icon.'
                : picks.length < MAX_ICONS
                  ? `Tap up to ${MAX_ICONS} icons. Number 1 is the main flavor.`
                  : `That's ${MAX_ICONS}. Tap a picked icon to remove it.`}
            </p>
          </div>
          <div className="icon-grid">
            {FLAVORS.map((f) => {
              const position = picks.indexOf(f.id);
              const picked = position >= 0;
              return (
                <button
                  key={f.id}
                  type="button"
                  className={picked ? 'icon-choice icon-choice-on' : 'icon-choice'}
                  aria-pressed={picked}
                  disabled={!picked && picks.length >= MAX_ICONS}
                  onClick={() => toggle(f.id)}
                >
                  {picked && (
                    <span className="icon-choice-number" aria-hidden="true">
                      {position + 1}
                    </span>
                  )}
                  <span className="icon-tile">
                    <FlavorIcon id={f.id} size={38} />
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
