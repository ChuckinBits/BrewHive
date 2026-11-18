// A batch's ingredients, grouped under a divider for each stage they go in.
// Used two ways:
// - In the batch form, each ingredient opens the ingredient sheet to edit it.
// - On the batch page, ingredients for the current stage can be tapped to log
//   them on the timeline; ones already logged show when they went in.

import { useId, useState } from 'react';
import { INGREDIENT_STAGES, INGREDIENT_UNITS, type BatchEvent, type IngredientLine, type IngredientStage } from '../db/types.ts';
import { Icon } from '../icons/Icon.tsx';
import { fmtDateShort, newId } from '../lib/format.ts';
import { groupByStage, ingredientStageLabel, joinAmount, splitAmount } from '../lib/stages.ts';
import { Field, Sheet } from './ui.tsx';

interface EditableProps {
  lines: IngredientLine[];
  onEdit: (line: IngredientLine) => void;
}

/** In the batch form: every ingredient opens for editing. */
export function EditableIngredients({ lines, onEdit }: EditableProps) {
  return (
    <div className="staged-ingredients">
      {groupByStage(lines).map((group) => (
        <section key={group.stage} aria-label={`${ingredientStageLabel(group.stage)} ingredients`}>
          <h3 className="stage-divider">{ingredientStageLabel(group.stage)} ingredients</h3>
          <ul className="staged-list">
            {group.lines.map((line) => (
              <li key={line.id}>
                <button type="button" className="staged-row" onClick={() => onEdit(line)}>
                  <span className="staged-name">{line.name}</span>
                  <span className="muted">{line.amount}</span>
                  <span className="staged-action staged-action-quiet">
                    <Icon name="edit" size={18} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

interface LoggableProps {
  lines: IngredientLine[];
  /** The stage whose ingredients can be logged, or null when none can (a planned batch). */
  current: IngredientStage | null;
  /** The timeline entry that logged each ingredient, by line id. */
  added: Map<string, BatchEvent>;
  onLog: (line: IngredientLine) => void;
}

/** On the batch page: ingredients for the current stage can be tapped to log them on the timeline. */
export function LoggableIngredients({ lines, current, added, onLog }: LoggableProps) {
  return (
    <div className="staged-ingredients">
      {groupByStage(lines).map((group) => {
        const isCurrent = group.stage === current;
        return (
          <section key={group.stage} aria-label={`${ingredientStageLabel(group.stage)} ingredients`}>
            <h3 className={isCurrent ? 'stage-divider stage-divider-current' : 'stage-divider'}>
              {ingredientStageLabel(group.stage)} ingredients
              {isCurrent && <span className="stage-now">Now</span>}
            </h3>
            <ul className="staged-list">
              {group.lines.map((line) => {
                const entry = added.get(line.id);
                if (entry) {
                  return (
                    <li key={line.id}>
                      <div className="staged-row staged-row-done">
                        <span className="staged-name">{line.name}</span>
                        <span className="muted">{line.amount}</span>
                        <span className="staged-action staged-action-done" aria-label={`Added ${fmtDateShort(entry.date)}`}>
                          <Icon name="check" size={16} />
                          {fmtDateShort(entry.date)}
                        </span>
                      </div>
                    </li>
                  );
                }
                if (isCurrent) {
                  return (
                    <li key={line.id}>
                      <button type="button" className="staged-row staged-row-open" onClick={() => onLog(line)} aria-label={`Log ${line.name} as added`}>
                        <span className="staged-name">{line.name}</span>
                        <span className="muted">{line.amount}</span>
                        <span className="staged-action staged-action-add">
                          <Icon name="plus" size={16} />
                          Add
                        </span>
                      </button>
                    </li>
                  );
                }
                return (
                  <li key={line.id}>
                    <div className="staged-row">
                      <span className="staged-name">{line.name}</span>
                      <span className="muted">{line.amount}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

interface SheetProps {
  /** The ingredient being edited, or null to add one. */
  line: IngredientLine | null;
  /** The stage a new ingredient starts in. */
  defaultStage: IngredientStage;
  /** The unit a new ingredient starts with. */
  defaultUnit: string;
  onSave: (line: IngredientLine) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

/** Adds or edits one ingredient: what it is, how much, and which stage it goes in. */
export function IngredientSheet({ line, defaultStage, defaultUnit, onSave, onRemove, onClose }: SheetProps) {
  const initial = line ? splitAmount(line) : { quantity: '', unit: defaultUnit };
  const [name, setName] = useState(line?.name ?? '');
  const [quantity, setQuantity] = useState(initial.quantity);
  const [unit, setUnit] = useState(initial.unit);
  const [stage, setStage] = useState<IngredientStage>(line?.stage ?? (line ? 'primary' : defaultStage));
  const [error, setError] = useState('');
  const formId = useId();
  // Keep a unit from an older entry selectable even if it is not in the usual list.
  const units = INGREDIENT_UNITS.includes(unit) ? INGREDIENT_UNITS : [...INGREDIENT_UNITS, unit];

  const save = () => {
    if (!name.trim()) return setError('Enter the ingredient, such as Wildflower honey.');
    onSave({
      id: line?.id ?? newId(),
      name: name.trim(),
      quantity: quantity.trim(),
      unit,
      amount: joinAmount(quantity, unit),
      stage,
    });
    onClose();
  };

  return (
    <Sheet title={line ? 'Edit ingredient' : 'Add ingredient'} onClose={onClose}>
      <form
        id={formId}
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Ingredient">
          <input type="text" value={name} placeholder="Wildflower honey" autoFocus={!line} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="form-pair">
          <Field label="Quantity">
            <input type="text" inputMode="decimal" value={quantity} placeholder="3" onChange={(e) => setQuantity(e.target.value)} />
          </Field>
          <Field label="Unit">
            <select value={unit} onChange={(e) => setUnit(e.target.value)}>
              {units.map((u) => (
                <option key={u} value={u}>
                  {u === '' ? 'No unit (a count)' : u}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Stage" hint="When it goes in. Bottling is for priming sugar and other additions at bottling.">
          <select value={stage} onChange={(e) => setStage(e.target.value as IngredientStage)}>
            {INGREDIENT_STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block">
          {line ? 'Save ingredient' : 'Add ingredient'}
        </button>
        {line && (
          <button
            type="button"
            className="btn btn-danger-quiet btn-block"
            onClick={() => {
              onRemove(line.id);
              onClose();
            }}
          >
            <Icon name="trash" size={20} />
            Remove ingredient
          </button>
        )}
      </form>
    </Sheet>
  );
}
