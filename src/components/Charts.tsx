import type { ValuationResult } from '../lib/types';
import { fmtINR } from '../lib/format';

/** Horizontal bars of adjusted comparable rates against the asking rate and the estimated range. Plain SVG – no chart lib needed. */
export function CompChart({ v }: { v: ValuationResult }) {
  if (!v.used.length) return null;
  const rows = [...v.used].sort((a, b) => a.adjustedRate - b.adjustedRate);
  const all = [...rows.map((r) => r.adjustedRate), v.askingRate, v.fairRate ?? v.askingRate, v.lowRate ?? v.askingRate, v.highRate ?? v.askingRate];
  const min = Math.min(...all) * 0.9, max = Math.max(...all) * 1.05;
  const W = 640, left = 130, right = 24, rowH = 26, top = 24;
  const H = top + rows.length * rowH + 34;
  const x = (n: number) => left + ((n - min) / (max - min)) * (W - left - right);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Comparable rates versus asking rate and estimated range">
      {v.lowRate !== null && v.highRate !== null && <rect x={x(v.lowRate)} y={top - 8} width={Math.max(2, x(v.highRate) - x(v.lowRate))} height={rows.length * rowH + 10} fill="#73d7d0" opacity=".12" />}
      {rows.map((r, i) => (
        <g key={r.comp.id} transform={`translate(0 ${top + i * rowH})`}>
          <text x={left - 8} y={14} textAnchor="end" fontSize="11" fill="#91a0b5">{r.comp.label.slice(0, 18)}</text>
          <rect x={left} y={3} width={Math.max(2, x(r.adjustedRate) - left)} height={15} rx={4} fill={r.comp.kind === 'transaction' ? '#72d6ad' : '#8fb4ff'} opacity={r.comp.isDemo ? 0.45 : 0.9} />
          <text x={x(r.adjustedRate) + 6} y={15} fontSize="10.5" fill="#edf2f8">{fmtINR(r.adjustedRate)}</text>
        </g>
      ))}
      {v.fairRate !== null && <g><line x1={x(v.fairRate)} x2={x(v.fairRate)} y1={top - 12} y2={H - 28} stroke="#e8bd75" strokeWidth="2" /><text x={x(v.fairRate)} y={H - 14} textAnchor="middle" fontSize="10.5" fill="#e8bd75">Fair {fmtINR(v.fairRate)}</text></g>}
      <g><line x1={x(v.askingRate)} x2={x(v.askingRate)} y1={top - 12} y2={H - 28} stroke="#ef9b85" strokeWidth="2" strokeDasharray="5 4" /><text x={x(v.askingRate)} y={H - 2} textAnchor="middle" fontSize="10.5" fill="#ef9b85">Asking {fmtINR(v.askingRate)}</text></g>
      <g transform={`translate(${left} 8)`} fontSize="10" fill="#91a0b5"><rect width="9" height="9" fill="#72d6ad" /><text x="13" y="8">transaction</text><rect x="80" width="9" height="9" fill="#8fb4ff" /><text x="93" y="8">asking</text><rect x="140" width="9" height="9" fill="#73d7d0" opacity=".3" /><text x="153" y="8">est. range</text></g>
    </svg>
  );
}

export function RangeBar({ low, fair, high, asking }: { low: number; fair: number; high: number; asking: number }) {
  const lo = Math.min(low, asking) * 0.96, hi = Math.max(high, asking) * 1.04;
  const p = (n: number) => `${((n - lo) / (hi - lo)) * 100}%`;
  return (
    <div className="relative mt-8 h-3 rounded-full bg-ink-600" role="img" aria-label={`Estimated range ${fmtINR(low)} to ${fmtINR(high)}, fair value ${fmtINR(fair)}, asking ${fmtINR(asking)}`}>
      <div className="absolute top-0 h-3 rounded-full bg-teal-300/50" style={{ left: p(low), width: `calc(${p(high)} - ${p(low)})` }} />
      <div className="absolute -top-1 h-5 w-0.5 bg-gold-400" style={{ left: p(fair) }} />
      <div className="absolute -top-7 -translate-x-1/2 text-[11px] font-semibold text-coral-300" style={{ left: p(asking) }}>▼ asking</div>
      <div className="absolute top-5 -translate-x-1/2 whitespace-nowrap text-[11px] text-slate-400" style={{ left: p(low) }}>{fmtINR(low)}</div>
      <div className="absolute top-5 -translate-x-1/2 whitespace-nowrap text-[11px] text-gold-400" style={{ left: p(fair) }}>{fmtINR(fair)}</div>
      <div className="absolute top-5 -translate-x-1/2 whitespace-nowrap text-[11px] text-slate-400" style={{ left: p(high) }}>{fmtINR(high)}</div>
    </div>
  );
}
