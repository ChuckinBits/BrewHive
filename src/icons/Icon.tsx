// Line icons for the interface, drawn on a 24 px grid. They take the
// current text color, so one set works in light and dark themes.

import type { ReactNode } from 'react';

const carboy = (
  <>
    <rect x="11" y="2" width="2" height="3.5" rx="0.8" />
    <path d="M10 5.5h4" />
    <path d="M10.5 5.5v2.2C7.3 8.5 6 10.3 6 13v5.5A2.5 2.5 0 0 0 8.5 21h7a2.5 2.5 0 0 0 2.5-2.5V13c0-2.7-1.3-4.5-4.5-5.3V5.5" />
    <path d="M6 14h12" />
  </>
);

const PATHS = {
  batches: carboy,
  recipes: (
    <>
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v14H7.5A2.5 2.5 0 0 0 5 19.5z" />
      <path d="M5 19.5A2.5 2.5 0 0 0 7.5 22H19v-5" />
      <polygon points="12,6.5 14.6,8 14.6,11 12,12.5 9.4,11 9.4,8" />
    </>
  ),
  cellar: (
    <>
      <path d="M10.5 2.5h3" />
      <path d="M11 2.5v4.2C9.3 7.5 8.5 8.8 8.5 10.5V20a1.5 1.5 0 0 0 1.5 1.5h4a1.5 1.5 0 0 0 1.5-1.5v-9.5c0-1.7-.8-3-2.5-3.8V2.5" />
      <path d="M8.5 12.5h7M8.5 16.5h7" />
      <path d="M3 21.5h5.5M15.5 21.5H21" />
    </>
  ),
  more: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  back: <path d="M15 5l-7 7 7 7" />,
  chevron: <path d="M9 5l7 7-7 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  edit: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v5M14 11v5" />
    </>
  ),
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  shelf: (
    <>
      <path d="M3 11h18M3 21h18" />
      <rect x="5" y="4" width="4" height="7" rx="1" />
      <rect x="12" y="6" width="5" height="5" rx="1" />
      <rect x="6" y="15" width="5" height="6" rx="1" />
      <rect x="14" y="14" width="4" height="7" rx="1" />
    </>
  ),
  download: <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />,
  upload: <path d="M12 15.5V4.5M7 9l5-5 5 5M5 20h14" />,
  droplet: <path d="M12 3c-3 4-6 7.5-6 11.5a6 6 0 0 0 12 0C18 10.5 15 7 12 3z" />,
  thermometer: (
    <>
      <path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z" />
      <path d="M12 9v8" />
    </>
  ),
  note: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M9 11h7M9 15h7M9 7h3" />
    </>
  ),
  flask: (
    <>
      <path d="M9 3h6" />
      <path d="M10 3v14a2 2 0 0 0 4 0V3" />
      <path d="M10 12h4" />
    </>
  ),
  nutrient: (
    <>
      <path d="M7 3h10" />
      <path d="M7.5 3L7 6v13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6l-.5-3" />
      <path d="M12 10.5v6M9 13.5h6" />
    </>
  ),
  yeast: (
    <>
      <circle cx="9.5" cy="9.5" r="5" />
      <circle cx="17" cy="15.5" r="3" />
      <circle cx="9" cy="19" r="2" />
    </>
  ),
  rack: (
    <>
      <path d="M8 21V8a4 4 0 0 1 8 0v2" />
      <path d="M16 10c0 4 3 5 3 8v3" />
      <path d="M6.5 21h3" />
    </>
  ),
  glass: (
    <>
      <path d="M7 3h10l-1 7a4 4 0 0 1-8 0z" />
      <path d="M12 14v6M8.5 21h7" />
    </>
  ),
  flag: <path d="M6 21V4M6 5h11l-2.5 4 2.5 4H6" />,
  pin: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  honey: (
    <>
      <rect x="7" y="3" width="10" height="3" rx="1" />
      <path d="M7.5 6h9c1.5 1 2.5 2.5 2.5 4.5V18a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-7.5C5 8.5 6 7 7.5 6z" />
      <polygon points="12,11 14.2,12.25 14.2,14.75 12,16 9.8,14.75 9.8,12.25" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 14.1c2.9.4 5 2.8 5 5.9" />
    </>
  ),
  sparkle: <path d="M12 3l2 6.5L20.5 12 14 14l-2 7-2-7-6.5-2L10 9.5z" />,
  star: <path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
