// Picks a style for the type: mead, beer and wine each have their own list,
// Other is free text, and cider and kombucha have no Style field. Each listed
// style comes with a one-line explanation: shown under the field for the chosen
// style, beside every option in the picker, and as a hover tip on computers.
// A custom style can be typed in too.
//
// useNameAndStyle wires the icon, type, name and style together in the batch
// and recipe forms, so picking an icon suggests a name and style.

import { useId, useState } from 'react';
import { styleAbout, styleForType, stylesFor, type BeverageType } from '../db/types.ts';
import { Icon } from '../icons/Icon.tsx';
import { suggestFromIcon } from '../lib/suggest.ts';
import { Field, Sheet } from './ui.tsx';

interface Props {
  value: string;
  onChange: (style: string) => void;
  type?: BeverageType;
}

const CUSTOM_PLACEHOLDER: Partial<Record<BeverageType, string>> = { mead: 'Session cyser', beer: 'Hazy IPA', wine: 'Orange wine' };

export function StyleField({ value, onChange, type = 'mead' }: Props) {
  const styles = stylesFor(type);
  if (styles === 'none') return null;
  if (styles === 'free') {
    return (
      <Field label="Style">
        <input type="text" value={value} placeholder="Ginger beer" onChange={(e) => onChange(e.target.value)} />
      </Field>
    );
  }
  return <StyleList value={value} onChange={onChange} type={type} styles={styles} />;
}

function StyleList({ value, onChange, type, styles }: Required<Props> & { styles: { name: string; about: string }[] }) {
  const [open, setOpen] = useState(false);
  const labelId = useId();
  const about = styleAbout(value, type);
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
            {styles.map((style) => {
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
              <input type="text" value={custom} placeholder={CUSTOM_PLACEHOLDER[type]} onChange={(e) => setCustom(e.target.value)} />
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

interface Suggestable {
  name: string;
  style: string;
  icon: string;
  color: string;
  beverageType: BeverageType;
}

/**
 * Picking an icon fills in the name and style while the name is empty or still
 * the suggestion. Once the person types a name, it's left alone.
 */
export function useNameAndStyle<D extends Suggestable>(draft: D, set: (patch: Partial<D>) => void) {
  const [nameAuto, setNameAuto] = useState(draft.name.trim() === '');
  const [styleAuto, setStyleAuto] = useState(false);
  const suggesting = nameAuto || draft.name.trim() === '';

  /** The name and style for this icon and type, keeping a style the person chose. */
  const suggestion = (icon: string, type: BeverageType, style: string, styleIsAuto: boolean): Partial<Suggestable> => {
    const s = suggestFromIcon(icon, type, styleIsAuto ? '' : style);
    const patch: Partial<Suggestable> = { name: s.name };
    if (s.style != null && s.style !== style) {
      patch.style = s.style;
      setStyleAuto(true);
    } else if (s.style == null && styleIsAuto) {
      patch.style = '';
    }
    setNameAuto(true);
    return patch;
  };

  return {
    onName: (name: string) => {
      setNameAuto(false);
      set({ name } as Partial<D>);
    },
    onIcon: (next: { icon: string; color: string }) => {
      const patch: Partial<Suggestable> = { ...next };
      if (suggesting && next.icon !== draft.icon) Object.assign(patch, suggestion(next.icon, draft.beverageType, draft.style, styleAuto));
      set(patch as Partial<D>);
    },
    onType: (beverageType: BeverageType) => {
      const style = styleForType(draft.style, beverageType);
      const patch: Partial<Suggestable> = { beverageType, style };
      if (nameAuto && draft.name.trim()) Object.assign(patch, suggestion(draft.icon, beverageType, style, styleAuto || style === ''));
      set(patch as Partial<D>);
    },
    onStyle: (style: string) => {
      setStyleAuto(false);
      const patch: Partial<Suggestable> = { style };
      // A suggested name follows the style the person picks: Maple with Melomel gives "Maple Melomel".
      if (nameAuto && draft.name.trim()) patch.name = suggestFromIcon(draft.icon, draft.beverageType, style).name;
      set(patch as Partial<D>);
    },
  };
}
