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
