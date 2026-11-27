// The shelf artwork: a batch in its vessel (a carboy, bucket, jar, keg, barrel or conical tank), a
// book for a recipe and a bottle for the cellar. Each one shows its flavor icon large and centered.
// All three share a 96 x 132 canvas and stand on y = 124, so they line up
// on a shelf.

import { useId, type CSSProperties, type ReactNode } from 'react';
import { FlavorStack } from '../icons/FlavorIcon.tsx';
import type { CarbLevel } from '../db/types.ts';

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

/** What a batch sits in on the shelf and the batch page. Other vessels are drawn as a carboy. */
export type VesselShape = 'carboy' | 'bucket' | 'jar' | 'keg' | 'barrel' | 'tank';

interface Shape {
  /** The inside, where the liquid goes (also the glass). */
  body: string;
  /** The liquid fills up from `bottom`, `span` high when full. */
  bottom: number;
  span: number;
  /** Where the airlock sits: its top. It is 14 wide, centered on x = 48. */
  airlockTop: number;
  /** The flavor label. */
  label: { cx: number; cy: number; r: number };
  /** A light streak down the glass. */
  shine: string;
  /** Bubbles near the bottom while fermenting. */
  bubbles: [number, number, number][];
  /** Drawn behind the glass (legs), and on top of it (lids, hoops, collars). */
  behind?: ReactNode;
  front?: ReactNode;
  /** Drawn over the liquid, under the outline (a wood tint, staves). */
  tint?: ReactNode;
}

const TAN = '#C9A27A';
const RUBBER = '#3A322B';
const IRON = '#4A3A2C';

const SHAPES: Record<VesselShape, Shape> = {
  carboy: {
    body: 'M41 25V32C41 41 11 42 11 64V112Q11 124 23 124H73Q85 124 85 112V64C85 42 55 41 55 32V25Z',
    bottom: 124,
    span: 84,
    airlockTop: 2,
    label: { cx: 48, cy: 86, r: 21 },
    shine: 'M18 70V106',
    bubbles: [[20, 116, 2], [76, 118, 1.6], [25, 119, 1.3], [72, 114, 2.2]],
    front: <rect className="vessel-line" x="40" y="20" width="16" height="6" rx="2" fill={TAN} strokeWidth="1.75" />,
  },
  // A clear plastic pail: lid with a grommet, and lugs for its handle.
  bucket: {
    body: 'M14 38L20 119Q20.4 124 25 124H71Q75.6 124 76 119L82 38Z',
    bottom: 124,
    span: 82,
    airlockTop: 7,
    label: { cx: 48, cy: 84, r: 21 },
    shine: 'M22 52L25.5 106',
    bubbles: [[26, 116, 2], [70, 118, 1.6], [30, 119, 1.3], [66, 114, 2.2]],
    front: (
      <>
        {/* Handle lugs on the sides, where the wire handle hooks in */}
        <rect className="vessel-line" x="11.5" y="44" width="5" height="9" rx="2" fill={TAN} strokeWidth="1.5" />
        <rect className="vessel-line" x="79.5" y="44" width="5" height="9" rx="2" fill={TAN} strokeWidth="1.5" />
        <rect className="vessel-glass vessel-line" x="10" y="31" width="76" height="8" rx="2.5" strokeWidth="2" />
        <path className="vessel-line" d="M15 45H81" strokeWidth="1" opacity="0.45" />
        <rect className="vessel-line" x="41.5" y="26" width="13" height="5" rx="1.5" fill={TAN} strokeWidth="1.5" />
      </>
    ),
  },
  // A wide-mouth jar: shoulders, a short neck and a screw lid with the airlock through it.
  jar: {
    body: 'M30 36V41C30 46 17 46 17 55V116Q17 124 25 124H71Q79 124 79 116V55C79 46 66 46 66 41V36Z',
    bottom: 124,
    span: 80,
    airlockTop: 5,
    label: { cx: 48, cy: 87, r: 21 },
    shine: 'M23 62V108',
    bubbles: [[24, 116, 2], [72, 118, 1.6], [28, 119, 1.3], [68, 114, 2.2]],
    front: (
      <>
        <rect className="vessel-line" x="27" y="25" width="42" height="11" rx="2.5" fill="#B9B1A5" strokeWidth="2" />
        <path className="vessel-line" d="M33 28V33M39 28V33M45 28V33M51 28V33M57 28V33M63 28V33" strokeWidth="1" opacity="0.5" />
      </>
    ),
  },
  // A ball-lock keg: rubber collar with a handle slot on top, rubber base below.
  keg: {
    body: 'M20 34Q20 30 25 30H71Q76 30 76 34V114H20Z',
    bottom: 114,
    span: 80,
    airlockTop: 1,
    label: { cx: 48, cy: 74, r: 20 },
    shine: 'M26 40V104',
    bubbles: [[26, 106, 2], [70, 108, 1.6], [30, 109, 1.3], [66, 104, 2.2]],
    front: (
      <>
        <path d="M20 17Q20 13 25 13H71Q76 13 76 17V33H20Z" fill={RUBBER} className="vessel-line" strokeWidth="2" strokeLinejoin="round" />
        <rect x="31" y="18" width="34" height="6" rx="3" className="vessel-glass" />
        <path d="M18 112H78V120Q78 124 74 124H22Q18 124 18 120Z" fill={RUBBER} className="vessel-line" strokeWidth="2" strokeLinejoin="round" />
        <rect className="vessel-line" x="41.5" y="10" width="13" height="4" rx="1.5" fill={TAN} strokeWidth="1.5" />
      </>
    ),
  },
  // An upright barrel: bulging staves, iron hoops, a bung with the airlock.
  barrel: {
    body: 'M24 30C13 56 13 98 24 124H72C83 98 83 56 72 30Z',
    bottom: 124,
    span: 90,
    airlockTop: 6,
    label: { cx: 48, cy: 80, r: 20 },
    shine: 'M22 60C20 74 20 88 22 102',
    bubbles: [[26, 116, 2], [70, 118, 1.6], [30, 120, 1.3], [66, 114, 2.2]],
    tint: (
      <>
        <rect x="8" y="26" width="80" height="100" fill="#8A5A2B" opacity="0.18" />
        <path d="M33 30C30 56 30 98 33 124M48 30V124M63 30C66 56 66 98 63 124" stroke="#6B4423" strokeWidth="1" opacity="0.35" fill="none" />
        <rect x="8" y="37" width="80" height="5" fill={IRON} opacity="0.9" />
        <rect x="8" y="50" width="80" height="5" fill={IRON} opacity="0.9" />
        <rect x="8" y="105" width="80" height="5" fill={IRON} opacity="0.9" />
        <rect x="8" y="117" width="80" height="4" fill={IRON} opacity="0.9" />
      </>
    ),
    front: (
      <>
        <path className="vessel-line" d="M24 30H72" strokeWidth="2" />
        <rect className="vessel-line" x="41.5" y="25" width="13" height="5" rx="1.5" fill={TAN} strokeWidth="1.5" />
      </>
    ),
  },
  // A conical fermenter: domed lid, straight body, a cone down to a dump valve, three legs.
  tank: {
    body: 'M22 34H74V84L53 106H43L22 84Z',
    bottom: 106,
    span: 72,
    airlockTop: 1,
    label: { cx: 48, cy: 60, r: 19 },
    shine: 'M27 40V80',
    bubbles: [[44, 100, 2], [52, 101, 1.6], [34, 92, 1.3], [62, 92, 2.2]],
    behind: (
      <g className="vessel-line" strokeWidth="2.5" strokeLinecap="round" fill="none">
        <path d="M26 82L15 122M70 82L81 122M48 98V122" />
        <path d="M11 123H19M77 123H85M44 123H52" strokeWidth="3" />
      </g>
    ),
    front: (
      <>
        <path className="vessel-glass vessel-line" d="M20 34Q48 16 76 34Z" strokeWidth="2" strokeLinejoin="round" />
        <path className="vessel-line" d="M18 34H78" strokeWidth="2.5" strokeLinecap="round" />
        <path className="vessel-line" d="M22 84H74" strokeWidth="1" opacity="0.4" />
        <rect className="vessel-line" x="43" y="106" width="10" height="6" rx="1.5" fill="#B9B1A5" strokeWidth="1.5" />
        <path className="vessel-line" d="M53 109H61" strokeWidth="2.5" strokeLinecap="round" />
        <rect className="vessel-line" x="74" y="70" width="7" height="5" rx="1.5" fill="#B9B1A5" strokeWidth="1.5" />
        <rect className="vessel-line" x="41.5" y="21" width="13" height="5" rx="1.5" fill={TAN} strokeWidth="1.5" />
      </>
    ),
  },
};

/** The shape for a vessel type: kinds without a drawing of their own are carboys. */
export function shapeFor(vesselType: string | undefined): VesselShape {
  return vesselType && vesselType in SHAPES ? (vesselType as VesselShape) : 'carboy';
}

interface VesselProps extends Common {
  /** 0 (empty) to 1 (full). */
  level: number;
  /** Bubbles rise and the airlock ticks while the batch is in primary. */
  fermenting?: boolean;
  /** Carbonated: fine streams of bubbles, gentler when petillant, and no airlock (the vessel is sealed). */
  carbonation?: CarbLevel;
  shape?: VesselShape;
}

/**
 * Carbonation: fine streams of tiny bubbles, each rising from a spot near the bottom up to the
 * liquid's top, unlike fermentation's few big ones. `columns` are the streams' starting points.
 */
function Fizz({ columns, top, level }: { columns: [number, number][]; top: number; level: CarbLevel }) {
  // Sparkling: four bubbles a stream, every 0.55 s. Petillant: two, slower, every 1.8 s.
  const gentle = level === 'petillant';
  const perStream = gentle ? 2 : 4;
  const every = gentle ? 1.8 : 0.55;
  return (
    <g className={gentle ? 'fizz fizz-gentle' : 'fizz'} fill="#FFFFFF">
      {columns.flatMap(([x, y], c) => {
        const rise = y - top - 3;
        if (rise < 8) return [];
        return Array.from({ length: perStream }, (_, i) => (
          <circle
            key={`${c}-${i}`}
            cx={x}
            cy={y}
            r={(i + c) % 2 ? 0.8 : 1}
            style={{ '--rise': `${-rise}px`, '--at': (i + 0.5) / perStream, animationDelay: `${(i * every + c * (gentle ? 0.7 : 0.15)).toFixed(2)}s` } as CSSProperties}
          />
        ));
      })}
    </g>
  );
}

/** A batch in its vessel: clear, with the liquid at its level, an airlock and the flavor label. */
export function VesselArt({ icon, extraIcons = [], color, level, fermenting: active = false, carbonation, size = 118, shape = 'carboy' }: VesselProps) {
  // A carbonated batch is sealed, so it shows its fizz rather than fermenting.
  const carbonated = carbonation != null;
  const fermenting = active && !carbonated;
  const clip = useId();
  const s = SHAPES[shape];
  const top = s.bottom - Math.max(0, Math.min(1, level)) * s.span;
  const a = s.airlockTop;
  return (
    <svg className="vessel" width={(size * W) / H} height={size} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" data-shape={shape}>
      <defs>
        <clipPath id={clip}>
          <path d={s.body} />
        </clipPath>
      </defs>
      {s.behind}
      {/* Airlock and its stem, down into the stopper. Carbonated vessels are sealed instead. */}
      {!carbonated && (
        <>
          <rect className="vessel-glass vessel-line" x="41" y={a} width="14" height="11" rx="3.5" strokeWidth="1.75" />
          {fermenting && <circle className="airlock-bubble" cx="48" cy={a + 5.5} r="2.2" />}
          <rect className="vessel-glass vessel-line" x="45.5" y={a + 11} width="5" height="8" strokeWidth="1.75" />
        </>
      )}
      {/* Glass, then the liquid clipped to the glass */}
      <path className="vessel-glass" d={s.body} />
      <g clipPath={`url(#${clip})`}>
        {level > 0 && (
          <>
            <rect x="0" y={top} width={W} height={H - top} fill={color} />
            <rect x="0" y={top} width={W} height={fermenting ? 5 : 2.5} fill="#FFFFFF" opacity={fermenting ? 0.5 : 0.28} />
          </>
        )}
        {carbonation && level > 0 && <Fizz columns={s.bubbles.map(([x, y]) => [x, y])} top={top} level={carbonation} />}
        {fermenting && (
          <g className="bubbles" fill="#FFFFFF">
            {s.bubbles.map(([cx, cy, r]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
            ))}
          </g>
        )}
        {s.tint}
      </g>
      <path className="vessel-line" d={s.body} fill="none" strokeWidth="2" strokeLinejoin="round" />
      <path d={s.shine} stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" fill="none" />
      {s.front}
      {/* Label with the flavor icon */}
      <circle cx={s.label.cx} cy={s.label.cy} r={s.label.r} fill={LABEL_FILL} stroke={LABEL_INK} strokeWidth="1.5" />
      <FlavorStack icons={[icon, ...extraIcons]} size={s.label.r * 1.43} x={s.label.cx - s.label.r * 0.715} y={s.label.cy - s.label.r * 0.715} />
    </svg>
  );
}

/** A batch in a carboy: the shelf's default. */
export function Carboy(props: Omit<VesselProps, 'shape'>) {
  return <VesselArt {...props} shape="carboy" />;
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
  /** Sparkling or petillant: fine streams of bubbles, gentler when petillant. */
  carbonation?: CarbLevel;
}

export function Bottle({ icon, extraIcons = [], color, empty = false, carbonation, size = 118 }: BottleProps) {
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
          {carbonation && <Fizz columns={[[34, 121], [40, 122], [56, 122], [62, 121]]} top={26} level={carbonation} />}
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
