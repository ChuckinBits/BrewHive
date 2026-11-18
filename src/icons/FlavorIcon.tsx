// The colorful flavor icons (strawberry, hops, maple...) used on recipes,
// batches and bottles. The drawings live in flavors.ts.

import { FLAVORS, type Flavor } from './flavors.ts';

const BY_ID = new Map(FLAVORS.map((f) => [f.id, f]));

export const DEFAULT_FLAVOR = 'traditional';

export function getFlavor(id: string | null | undefined): Flavor {
  return BY_ID.get(id ?? '') ?? (BY_ID.get(DEFAULT_FLAVOR) as Flavor);
}

interface Props {
  id: string | null | undefined;
  size?: number;
  /** Position and size when the icon is nested inside another SVG. */
  x?: number;
  y?: number;
}

export function FlavorIcon({ id, size = 40, x, y }: Props) {
  const flavor = getFlavor(id);
  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      stroke="#2A1F14"
      strokeWidth={flavor.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: flavor.body }}
    />
  );
}

/** How many icons a batch, recipe or bottle can show. The first is the main one. */
export const MAX_ICONS = 3;

/** A record's icons, main first. */
export function iconsOf(record: { icon: string; extraIcons?: string[] }): string[] {
  return [record.icon, ...(record.extraIcons ?? [])].slice(0, MAX_ICONS);
}

interface StackProps {
  icons: string[];
  size?: number;
  x?: number;
  y?: number;
}

/**
 * The main icon in front, with the 2nd peeking out behind it on the left and
 * the 3rd on the right. With one icon it's just that icon. For use inside an SVG.
 */
export function FlavorStack({ icons, size = 40, x = 0, y = 0 }: StackProps) {
  const [main, left, right] = icons;
  if (!left) return <FlavorIcon id={main} size={size} x={x} y={y} />;
  const cx = x + size / 2;
  const cy = y + size / 2;
  const small = size * 0.62;
  const big = size * 0.86;
  const side = size * 0.42;
  return (
    <g>
      <FlavorIcon id={left} size={small} x={cx - side - small / 2} y={cy - size * 0.12 - small / 2} />
      {right && <FlavorIcon id={right} size={small} x={cx + side - small / 2} y={cy - size * 0.12 - small / 2} />}
      <FlavorIcon id={main} size={big} x={cx - big / 2} y={cy + size * 0.06 - big / 2} />
    </g>
  );
}

/** FlavorStack on its own, for use in HTML (list rows, the picker). */
export function FlavorIcons({ icons, size = 40 }: { icons: string[]; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" overflow="visible" aria-hidden="true">
      <FlavorStack icons={icons} size={48} />
    </svg>
  );
}
