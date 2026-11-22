// The US / metric setting: what it means for volumes, and reading older saves.

import type { Settings, UnitSystem, VolumeUnit } from '../db/types.ts';

/** The volume unit for new batches and recipes, and for costs per gallon or liter. */
export function volumeUnitOf(settings: Pick<Settings, 'units'>): VolumeUnit {
  return settings.units === 'metric' ? 'L' : 'gal';
}

/**
 * Settings as saved, brought up to date: saves and backups from v0.2.0 and earlier had
 * volumeUnit ('gal' or 'L') where the setting is now units ('us' or 'metric').
 */
export function upgradeSettings<T extends object>(saved: T): T & { units?: UnitSystem } {
  const { volumeUnit, ...rest } = saved as T & { volumeUnit?: unknown; units?: UnitSystem };
  if (rest.units === 'us' || rest.units === 'metric') return rest as T & { units: UnitSystem };
  if (volumeUnit === 'gal') return { ...rest, units: 'us' } as T & { units: UnitSystem };
  if (volumeUnit === 'L') return { ...rest, units: 'metric' } as T & { units: UnitSystem };
  return rest as T;
}
