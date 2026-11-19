// The target in the batch and recipe forms: a final gravity (the ABV follows)
// or an ABV (the final gravity follows), with a switch between them.

import type { TargetMode } from '../db/types.ts';
import { DRIEST_FG } from '../lib/batch.ts';
import { abv } from '../lib/calc.ts';
import { fmtPercent, fmtSG, parseNum } from '../lib/format.ts';
import { UnitField } from './ui.tsx';

const MODES = [
  { id: 'fg' as const, label: 'FG', name: 'Target final gravity' },
  { id: 'abv' as const, label: 'ABV', name: 'Target ABV' },
];

export interface TargetDraft {
  targetMode: TargetMode;
  targetFG: string;
  targetAbv: string;
}

/** The problem with what was typed, or null. */
export function targetError(draft: TargetDraft): string | null {
  if (draft.targetMode === 'abv') {
    if (draft.targetAbv.trim() === '') return null;
    const value = parseNum(draft.targetAbv.replace('%', ''));
    return value == null || value <= 0 || value > 25 ? 'Target ABV should be a percentage between 0 and 25, such as 14.' : null;
  }
  if (draft.targetFG.trim() === '') return null;
  const value = parseNum(draft.targetFG);
  return value == null || value < 0.98 || value > 1.2 ? 'Target final gravity should be a gravity between 0.980 and 1.200, such as 1.010.' : null;
}

/** The numbers to save. An empty ABV target falls back to aiming for an FG. */
export function targetValues(draft: TargetDraft, defaultFG: number | null): { targetMode: TargetMode; targetFG: number | null; targetAbv: number | null } {
  const targetAbv = parseNum(draft.targetAbv.replace('%', ''));
  const targetFG = parseNum(draft.targetFG) ?? defaultFG;
  if (draft.targetMode === 'abv' && targetAbv != null) return { targetMode: 'abv', targetFG, targetAbv };
  return { targetMode: 'fg', targetFG, targetAbv };
}

interface Props {
  value: TargetDraft;
  onChange: (patch: Partial<TargetDraft>) => void;
  /** The OG plus any sugar added so far, for the line under the field. Null when there's no OG yet. */
  og: number | null;
}

export function TargetField({ value, onChange, og }: Props) {
  const isAbv = value.targetMode === 'abv';
  const fg = parseNum(value.targetFG);
  const abvTarget = parseNum(value.targetAbv.replace('%', ''));
  const valid = (n: number | null, low: number, high: number) => (n != null && n >= low && n <= high ? n : null);

  let follows = '';
  if (og != null) {
    if (isAbv && valid(abvTarget, 0.1, 25) != null) {
      const finish = og - (abvTarget as number) / 131.25;
      // Meads can finish below 1.000, down to about 0.990. Lower than that, the target needs more sugar.
      follows =
        finish < DRIEST_FG - 1e-9
          ? `More than this OG can reach (${fmtPercent(abv(og, DRIEST_FG))} even at ${fmtSG(DRIEST_FG)}). It needs about ${Math.ceil((DRIEST_FG - finish) * 1000 - 1e-6)} more points of sugar, such as step feeding.`
          : finish < 0.9995
            ? `Finishes around ${fmtSG(finish)}, drier than most meads get. Step feeding raises this, not the target.`
            : `Finishes around ${fmtSG(finish)}. Step feeding raises this, not the target.`;
    }
    if (!isAbv && valid(fg, 0.98, 1.2) != null) follows = `≈ ${fmtPercent(abv(og, fg as number))} ABV. Step feeding raises this.`;
  }
  const hint = follows || (isAbv ? 'The strength you are aiming for.' : 'Where you expect fermentation to stop. 1.000 is fully dry.');

  return (
    <UnitField
      label="Target"
      value={isAbv ? value.targetAbv : value.targetFG}
      placeholder={isAbv ? '14' : '1.000'}
      onChange={(text) => onChange(isAbv ? { targetAbv: text } : { targetFG: text })}
      unit={value.targetMode}
      units={MODES}
      hint={hint}
      onUnit={(mode) => {
        // Switching fills the other value in from this one, when it's empty and there's an OG.
        const patch: Partial<TargetDraft> = { targetMode: mode };
        if (og != null && mode === 'abv' && value.targetAbv.trim() === '' && valid(fg, 0.98, 1.2) != null) patch.targetAbv = abv(og, fg as number).toFixed(1);
        if (og != null && mode === 'fg' && value.targetFG.trim() === '' && valid(abvTarget, 0.1, 25) != null) patch.targetFG = fmtSG(og - (abvTarget as number) / 131.25);
        onChange(patch);
      }}
    />
  );
}
