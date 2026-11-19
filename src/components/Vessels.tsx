// The shelf artwork: a carboy for a batch, a book for a recipe and a bottle
// for the cellar. Each one shows its flavor icon large and centered.
// All three share a 96 x 132 canvas and stand on y = 124, so they line up
// on a shelf.

import { useId } from 'react';
import { FlavorStack } from '../icons/FlavorIcon.tsx';

const W = 96;
const H = 132;
const LABEL_FILL = '#FFF4DC';
const LABEL_INK = '#2A1F14';

interface Common {
  icon: string;
  /** Up to two more icons, shown smaller behind the main one. */
  extraIcons?: string[];
  color: string;
  /** Height in pixels. Width follows. */
  size?: number;
}

const CARBOY_BODY = 'M41 25V32C41 41 11 42 11 64V112Q11 124 23 124H73Q85 124 85 112V64C85 42 55 41 55 32V25Z';

interface CarboyProps extends Common {
  /** 0 (empty) to 1 (full). */
  level: number;
  /** Bubbles rise and the airlock ticks while the batch is in primary. */
  fermenting?: boolean;
}

export function Carboy({ icon, extraIcons = [], color, level, fermenting = false, size = 118 }: CarboyProps) {
  const clip = useId();
  const top = 124 - Math.max(0, Math.min(1, level)) * 84;
  return (
    <svg className="vessel" width={(size * W) / H} height={size} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <path d={CARBOY_BODY} />
        </clipPath>
      </defs>
      {/* Airlock and bung */}
      <rect className="vessel-glass vessel-line" x="41" y="2" width="14" height="11" rx="3.5" strokeWidth="1.75" />
      {fermenting && <circle className="airlock-bubble" cx="48" cy="7.5" r="2.2" />}
      <rect className="vessel-glass vessel-line" x="45.5" y="13" width="5" height="8" strokeWidth="1.75" />
      <rect className="vessel-line" x="40" y="20" width="16" height="6" rx="2" fill="#C9A27A" strokeWidth="1.75" />
      {/* Glass, then the liquid clipped to the glass */}
      <path className="vessel-glass" d={CARBOY_BODY} />
      <g clipPath={`url(#${clip})`}>
        {level > 0 && (
          <>
            <rect x="6" y={top} width="84" height={130 - top} fill={color} />
            <rect x="6" y={top} width="84" height={fermenting ? 5 : 2.5} fill="#FFFFFF" opacity={fermenting ? 0.5 : 0.28} />
          </>
        )}
        {fermenting && (
          <g className="bubbles" fill="#FFFFFF">
            <circle cx="20" cy="116" r="2" />
            <circle cx="76" cy="118" r="1.6" />
            <circle cx="25" cy="119" r="1.3" />
            <circle cx="72" cy="114" r="2.2" />
          </g>
        )}
      </g>
      <path className="vessel-line" d={CARBOY_BODY} fill="none" strokeWidth="2" strokeLinejoin="round" />
      <path d="M18 70V106" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* Label with the flavor icon */}
      <circle cx="48" cy="86" r="21" fill={LABEL_FILL} stroke={LABEL_INK} strokeWidth="1.5" />
      <FlavorStack icons={[icon, ...extraIcons]} size={30} x={33} y={71} />
    </svg>
  );
}

export function Book({ icon, extraIcons = [], color, size = 118 }: Common) {
  return (
    <svg className="vessel" width={(size * W) / H} height={size} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      {/* Pages peek out behind the cover */}
      <rect className="vessel-line" x="22" y="24" width="60" height="100" rx="3" fill="#FFF8EA" strokeWidth="1.75" />
      <path d="M78 30V120M74 30V120" stroke="#D9CBB2" strokeWidth="1" fill="none" />
      {/* Cover, spine and label */}
      <rect className="vessel-line" x="14" y="18" width="60" height="106" rx="4" fill={color} strokeWidth="2" />
      <path d="M18 18h5v106h-5a4 4 0 0 1-4-4V22a4 4 0 0 1 4-4z" fill="#000000" opacity="0.2" />
      <circle cx="47" cy="60" r="21" fill={LABEL_FILL} stroke={LABEL_INK} strokeWidth="1.5" />
      <FlavorStack icons={[icon, ...extraIcons]} size={30} x={32} y={45} />
      <rect x="32" y="93" width="30" height="3.5" rx="1.75" fill="#FFFFFF" opacity="0.6" />
      <rect x="38" y="101" width="18" height="3.5" rx="1.75" fill="#FFFFFF" opacity="0.4" />
    </svg>
  );
}

const BOTTLE_BODY = 'M42 10H54V38C54 48 67 50 67 63V118Q67 124 61 124H35Q29 124 29 118V63C29 50 42 48 42 38Z';

interface BottleProps extends Common {
  /** An empty bottle is drawn as clear glass. */
  empty?: boolean;
}

export function Bottle({ icon, extraIcons = [], color, empty = false, size = 118 }: BottleProps) {
  const clip = useId();
  return (
    <svg className="vessel" width={(size * W) / H} height={size} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <path d={BOTTLE_BODY} />
        </clipPath>
      </defs>
      <path className="vessel-glass" d={BOTTLE_BODY} />
      {!empty && (
        <g clipPath={`url(#${clip})`}>
          <rect x="24" y="26" width="48" height="100" fill={color} />
        </g>
      )}
      <path className="vessel-line" d={BOTTLE_BODY} fill="none" strokeWidth="2" strokeLinejoin="round" />
      <rect className="vessel-line" x="40.5" y="4" width="15" height="9" rx="2.5" fill="#F2A93B" strokeWidth="1.75" />
      <path d="M35 62V84" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <rect x="31.5" y="68" width="33" height="38" rx="5" fill={LABEL_FILL} stroke={LABEL_INK} strokeWidth="1.5" />
      <FlavorStack icons={[icon, ...extraIcons]} size={27} x={34.5} y={73.5} />
    </svg>
  );
}
