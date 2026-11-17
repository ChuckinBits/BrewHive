// Gravity over time, drawn as a small SVG line chart.

import type { GravityPoint } from '../lib/batch.ts';
import { fmtDateShort, fmtSG } from '../lib/format.ts';

const W = 320;
const H = 150;
const PAD = { left: 44, right: 14, top: 12, bottom: 26 };

export function GravityChart({ points }: { points: GravityPoint[] }) {
  if (points.length < 2) return null;

  const times = points.map((p) => Date.parse(p.date.length <= 10 ? p.date + 'T00:00:00' : p.date));
  const t0 = times[0];
  const span = Math.max(1, times[times.length - 1] - t0);
  const values = points.map((p) => p.sg);
  const low = Math.min(...values, 1) - 0.004;
  const high = Math.max(...values) + 0.004;

  const x = (t: number) => PAD.left + ((t - t0) / span) * (W - PAD.left - PAD.right);
  const y = (sg: number) => PAD.top + ((high - sg) / (high - low)) * (H - PAD.top - PAD.bottom);

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(times[i]).toFixed(1)} ${y(p.sg).toFixed(1)}`).join('');
  const ticks = [high - 0.004, (high + low) / 2, low + 0.004];
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Gravity fell from ${fmtSG(first.sg)} to ${fmtSG(last.sg)}`}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="chart-grid" x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} />
            <text className="chart-text" x={PAD.left - 6} y={y(tick) + 4} textAnchor="end">
              {fmtSG(tick)}
            </text>
          </g>
        ))}
        {low < 1 && high > 1 && <line className="chart-baseline" x1={PAD.left} x2={W - PAD.right} y1={y(1)} y2={y(1)} />}
        <path className="chart-line" d={line} />
        {points.map((p, i) => (
          <circle className="chart-dot" key={i} cx={x(times[i])} cy={y(p.sg)} r="3.5">
            <title>{`${fmtDateShort(p.date)}: ${fmtSG(p.sg)}`}</title>
          </circle>
        ))}
        <text className="chart-text" x={PAD.left} y={H - 6}>
          {fmtDateShort(first.date)}
        </text>
        <text className="chart-text" x={W - PAD.right} y={H - 6} textAnchor="end">
          {fmtDateShort(last.date)}
        </text>
      </svg>
    </figure>
  );
}
