// The line icon for an ingredient category. The drawings live in categoryIcons.ts.

import { useId } from 'react';
import { CATEGORY_ICONS } from './categoryIcons.ts';

const BY_ID = new Map(CATEGORY_ICONS.map((i) => [i.id, i]));

interface Props {
  /** One of CATEGORY_ICONS; nothing is drawn for null or an unknown id. */
  id: string | null;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function CategoryIcon({ id, size = 16, strokeWidth = 2, className }: Props) {
  // Some drawings clip to their own outline, so each one gets an id of its own.
  const unique = `ci${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const icon = id ? BY_ID.get(id) : undefined;
  if (!icon) return null;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: icon.body.replaceAll('{id}', unique) }}
    />
  );
}
