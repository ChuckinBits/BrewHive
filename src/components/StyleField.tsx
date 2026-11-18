// Picks a mead style. Each style comes with a one-line explanation: shown
// under the field for the chosen style, beside every option in the picker,
// and as a hover tip on computers. A custom style can be typed in too.

import { useId, useState } from 'react';
import { MEAD_STYLES, styleAbout } from '../db/types.ts';
import { Icon } from '../icons/Icon.tsx';
import { Sheet } from './ui.tsx';

interface Props {
  value: string;
  onChange: (style: string) => void;
}

export function StyleField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const labelId = useId();
  const about = styleAbout(value);
  const isCustom = value.trim() !== '' && !about;
  const [custom, setCustom] = useState(isCustom ? value : '');

  const pick = (style: string) => {
    onChange(style);
    setOpen(false);
  };

  return (
    <div className="field">
      <span className="field-label" id={labelId}>
        Style
      </span>
      <button type="button" className="select-button" aria-labelledby={labelId} aria-haspopup="dialog" title={about} onClick={() => setOpen(true)}>
        <span className={value ? undefined : 'muted'}>{value || 'Choose a style'}</span>
        <Icon name="chevron" size={18} />
      </button>
      {about && <span className="field-hint">{about}</span>}

      {open && (
        <Sheet title="Choose a style" onClose={() => setOpen(false)}>
          <ul className="style-list">
            {MEAD_STYLES.map((style) => {
              const on = style.name === value;
              return (
                <li key={style.name}>
                  <button type="button" className={on ? 'style-choice style-choice-on' : 'style-choice'} aria-pressed={on} title={style.about} onClick={() => pick(style.name)}>
                    <span>
                      <strong>{style.name}</strong>
                      <span>{style.about}</span>
                    </span>
                    {on && <Icon name="check" size={20} />}
                  </button>
                </li>
              );
            })}
          </ul>
          <form
            className="style-custom"
            onSubmit={(e) => {
              e.preventDefault();
              if (custom.trim()) pick(custom.trim());
            }}
          >
            <label className="field">
              <span className="field-label">Something else</span>
              <input type="text" value={custom} placeholder="Session cyser" onChange={(e) => setCustom(e.target.value)} />
            </label>
            <button type="submit" className="btn" disabled={!custom.trim()}>
              Use this style
            </button>
          </form>
          {value && (
            <button type="button" className="btn btn-quiet btn-block" onClick={() => pick('')}>
              Clear style
            </button>
          )}
        </Sheet>
      )}
    </div>
  );
}
