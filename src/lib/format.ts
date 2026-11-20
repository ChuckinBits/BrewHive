// Display and input helpers shared by the screens.

import { cToF, fToC, gallonsToLiters, litersToGallons } from './calc.ts';

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Fallback for old browsers and non-secure contexts.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const pad = (n: number) => String(n).padStart(2, '0');

/** A Date as yyyy-mm-dd in the device's own time zone. */
export function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function today(): string {
  return toDateInput(new Date());
}

/** The current local date and time as yyyy-mm-ddThh:mm, the format of a datetime-local input. */
export function nowLocal(): string {
  return toLocalMinute(new Date().toISOString());
}

/** An exact moment (ISO, as in createdAt) as a local yyyy-mm-ddThh:mm, the format timeline entries are dated in. */
export function toLocalMinute(iso: string): string {
  const d = new Date(iso);
  return `${toDateInput(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** yyyy-mm-dd for a day some number of days before (negative) or after today. */
export function daysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toDateInput(d);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Nov 16, 2026" from a yyyy-mm-dd or ISO string, read as a calendar day. */
export function fmtDate(value: string | null | undefined): string {
  if (!value) return '';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return value;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** "Nov 16" when the date is in the current year, otherwise the full date. */
export function fmtDateShort(value: string | null | undefined): string {
  if (!value) return '';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return value;
  return y === new Date().getFullYear() ? `${MONTHS[m - 1]} ${d}` : `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** "Nov 16, 2:15 PM" (the year added when it isn't this year) from a local yyyy-mm-ddThh:mm string. */
export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const day = fmtDateShort(value);
  const [h, min] = value.slice(11, 16).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(min) || value.length < 16) return day;
  return `${day}, ${h % 12 || 12}:${String(min).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function fmtSG(sg: number | null | undefined): string {
  return sg == null ? '–' : sg.toFixed(3);
}

export function fmtPercent(value: number | null | undefined, digits = 1): string {
  return value == null ? '–' : `${value.toFixed(digits)}%`;
}

function trim(n: number, digits: number): string {
  return String(Number(n.toFixed(digits)));
}

export function fmtVolume(liters: number | null | undefined, unit: 'gal' | 'L'): string {
  if (liters == null) return '–';
  return unit === 'gal' ? `${trim(litersToGallons(liters), 2)} gal` : `${trim(liters, 1)} L`;
}

/** Liters to the number shown in a volume input. */
export function volumeToInput(liters: number | null, unit: 'gal' | 'L'): string {
  if (liters == null) return '';
  return unit === 'gal' ? trim(litersToGallons(liters), 2) : trim(liters, 2);
}

export function volumeFromInput(text: string, unit: 'gal' | 'L'): number | null {
  const n = parseNum(text);
  if (n == null) return null;
  return unit === 'gal' ? gallonsToLiters(n) : n;
}

export function fmtTemp(celsius: number | null | undefined, unit: 'F' | 'C'): string {
  if (celsius == null) return '–';
  return unit === 'F' ? `${trim(cToF(celsius), 1)} °F` : `${trim(celsius, 1)} °C`;
}

/** A volume in its record's own unit, with the default unit in brackets when they differ: "19 L (5 gal)". */
export function fmtVolumeBoth(liters: number | null | undefined, unit: 'gal' | 'L' | null | undefined, defaultUnit: 'gal' | 'L'): string {
  const own = unit ?? defaultUnit;
  if (liters == null || own === defaultUnit) return fmtVolume(liters, own);
  return `${fmtVolume(liters, own)} (${fmtVolume(liters, defaultUnit)})`;
}

/** A temperature in its entry's own unit, with the default unit in brackets when they differ: "20 °C (68 °F)". */
export function fmtTempBoth(celsius: number | null | undefined, unit: 'F' | 'C' | null | undefined, defaultUnit: 'F' | 'C'): string {
  const own = unit ?? defaultUnit;
  if (celsius == null || own === defaultUnit) return fmtTemp(celsius, own);
  return `${fmtTemp(celsius, own)} (${fmtTemp(celsius, defaultUnit)})`;
}

/** Celsius to the number shown in a temperature input. */
export function tempToInput(celsius: number | null, unit: 'F' | 'C'): string {
  if (celsius == null) return '';
  return trim(unit === 'F' ? cToF(celsius) : celsius, 1);
}

export function tempFromInput(text: string, unit: 'F' | 'C'): number | null {
  const n = parseNum(text);
  if (n == null) return null;
  return unit === 'F' ? fToC(n) : n;
}

export function fmtBottle(ml: number): string {
  return ml >= 1000 ? `${trim(ml / 1000, 2)} L` : `${trim(ml, 0)} mL`;
}

export function fmtRating(rating: number | null | undefined): string {
  return rating == null ? '' : trim(rating, 1);
}

/** Parses a number typed by a person. Accepts a comma as the decimal mark. Empty or invalid gives null. */
export function parseNum(text: string): number | null {
  const cleaned = text.trim().replace(',', '.');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function plural(count: number, one: string, many = one + 's'): string {
  return `${count} ${count === 1 ? one : many}`;
}
