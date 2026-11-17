// An editable list of ingredient lines, used by the recipe and batch forms.

import type { IngredientLine } from '../db/types.ts';
import { Icon } from '../icons/Icon.tsx';
import { newId } from '../lib/format.ts';

interface Props {
  value: IngredientLine[];
  onChange: (value: IngredientLine[]) => void;
}

export function IngredientEditor({ value, onChange }: Props) {
  const update = (id: string, patch: Partial<IngredientLine>) =>
    onChange(value.map((line) => (line.id === id ? { ...line, ...patch } : line)));

  return (
    <fieldset className="ingredient-editor">
      <legend className="field-label">Ingredients</legend>
      {value.map((line, index) => (
        <div className="ingredient-line" key={line.id}>
          <input
            type="text"
            value={line.name}
            placeholder="Honey"
            aria-label={`Ingredient ${index + 1}`}
            onChange={(e) => update(line.id, { name: e.target.value })}
          />
          <input
            type="text"
            value={line.amount}
            placeholder="3 lb"
            aria-label={`Amount of ingredient ${index + 1}`}
            onChange={(e) => update(line.id, { amount: e.target.value })}
          />
          <button
            type="button"
            className="icon-btn"
            aria-label={`Remove ingredient ${index + 1}`}
            onClick={() => onChange(value.filter((l) => l.id !== line.id))}
          >
            <Icon name="close" size={20} />
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-small" onClick={() => onChange([...value, { id: newId(), name: '', amount: '' }])}>
        <Icon name="plus" size={18} />
        Add ingredient
      </button>
    </fieldset>
  );
}

/** Drops empty lines before saving. */
export function cleanIngredients(lines: IngredientLine[]): IngredientLine[] {
  return lines
    .map((line) => ({ ...line, name: line.name.trim(), amount: line.amount.trim() }))
    .filter((line) => line.name !== '');
}

export function IngredientList({ lines }: { lines: IngredientLine[] }) {
  if (lines.length === 0) return null;
  return (
    <ul className="ingredient-list">
      {lines.map((line) => (
        <li key={line.id}>
          <span>{line.name}</span>
          <span className="muted">{line.amount}</span>
        </li>
      ))}
    </ul>
  );
}
