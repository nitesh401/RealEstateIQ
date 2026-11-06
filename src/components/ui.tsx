import { animate } from 'framer-motion';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Confidence, Verdict } from '../lib/types';

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <p role="alert" className="mt-1 text-[12px] text-coral-300">{error}</p> : hint ? <p className="mt-1 text-[11.5px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function NumInput({ id, value, onChange, placeholder, min = 0, step, invalid, 'aria-label': aria }: { id?: string; value: number | null; onChange: (v: number | null) => void; placeholder?: string; min?: number; step?: number | string; invalid?: boolean; 'aria-label'?: string }) {
  return (
    <input id={id} className="input" type="number" inputMode="decimal" min={min} step={step ?? 'any'} placeholder={placeholder} aria-invalid={invalid || undefined} aria-label={aria}
      value={value ?? ''} onChange={(e) => { const s = e.target.value; onChange(s === '' ? null : Number(s)); }} />
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { v: T; l: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.v} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)}
          className={`rounded-xl border px-3.5 py-2 text-[13px] font-medium transition-all min-h-[44px] ${value === o.v ? 'border-gold-400 bg-gold-400/10 text-gold-400' : 'border-ink-600 text-slate-300 hover:border-slate-400'}`}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-[13.5px] text-slate-200">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="relative h-6 w-11 rounded-full bg-ink-600 transition peer-checked:bg-gold-400 peer-focus-visible:ring-2 peer-focus-visible:ring-gold-400 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
      {label}
    </label>
  );
}

export function ConfidenceBadge({ level, preliminary }: { level: Confidence; preliminary?: boolean }) {
  const map = { HIGH: 'bg-mint-300/15 text-mint-300', MEDIUM: 'bg-gold-400/15 text-gold-400', LOW: 'bg-coral-300/15 text-coral-300' } as const;
  return <span className={`chip ${map[level]}`}>{level} CONFIDENCE{preliminary ? ' · PRELIMINARY' : ''}</span>;
}

export const VERDICT_STYLE: Record<Verdict, string> = {
  BUY: 'from-emerald-500/25 to-emerald-500/5 text-mint-300 border-mint-300/40',
  'BUY AFTER NEGOTIATION': 'from-emerald-500/20 to-teal-500/5 text-mint-300 border-mint-300/30',
  NEGOTIATE: 'from-amber-500/25 to-amber-500/5 text-gold-400 border-gold-400/40',
  HOLD: 'from-sky-500/20 to-sky-500/5 text-sky-300 border-sky-300/30',
  AVOID: 'from-red-500/25 to-red-500/5 text-coral-300 border-coral-300/40',
};

export function DemoBanner({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-xl border border-coral-300/40 bg-coral-300/10 px-4 py-3 text-[13px] text-coral-300">
      <AlertTriangle size={18} className="mt-0.5 shrink-0" /> <div>{children}</div>
    </div>
  );
}
export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px] ${tone === 'warn' ? 'border-gold-400/40 bg-gold-400/10 text-gold-400' : 'border-ink-600 bg-white/[.03] text-slate-300'}`}>
      {tone === 'warn' ? <AlertTriangle size={17} className="mt-0.5 shrink-0" /> : <Info size={17} className="mt-0.5 shrink-0 text-teal-300" />}
      <div>{children}</div>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return <span className="inline-flex items-center gap-2 text-[13px] text-slate-300"><Loader2 size={16} className="spin" aria-hidden /> {label}</span>;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

/** Animated counter. Falls back to the final value immediately when reduced motion is requested. */
export function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setShown(value); prev.current = value; return; }
    const c = animate(prev.current, value, { duration: 0.9, ease: 'easeOut', onUpdate: (n) => setShown(n), onComplete: () => { prev.current = value; } });
    return () => c.stop();
  }, [value]);
  return <span>{format(shown)}</span>;
}

export function ScoreRing({ value, label, note }: { value: number | null; label: string; note: string }) {
  const r = 28, c = 2 * Math.PI * r;
  const col = value === null ? '#475569' : value >= 70 ? '#72d6ad' : value >= 45 ? '#e8bd75' : '#ef9b85';
  return (
    <div className="flex items-center gap-3">
      <svg width="68" height="68" viewBox="0 0 68 68" role="img" aria-label={`${label}: ${value === null ? 'not available' : value + ' out of 100'}`}>
        <circle cx="34" cy="34" r={r} fill="none" stroke="#26344a" strokeWidth="6" />
        {value !== null && <circle cx="34" cy="34" r={r} fill="none" stroke={col} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * value) / 100} transform="rotate(-90 34 34)" style={{ transition: 'stroke-dashoffset .9s ease' }} />}
        <text x="34" y="39" textAnchor="middle" fontSize="15" fontWeight="700" fill="#edf2f8" fontFamily="Manrope, sans-serif">{value === null ? '—' : value}</text>
      </svg>
      <div><div className="text-[13px] font-semibold text-slate-100">{label}</div><div className="text-[11.5px] text-slate-400">{note}</div></div>
    </div>
  );
}

export function Card({ title, eyebrow, children, className = '', right }: { title?: string; eyebrow?: string; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <section className={`glass p-5 sm:p-6 ${className}`}>
      {(title || eyebrow) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>{eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}{title && <h3 className="font-display text-[17px] font-bold text-slate-50">{title}</h3>}</div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'bad' | 'warn' }) {
  const c = tone === 'good' ? 'text-mint-300' : tone === 'bad' ? 'text-coral-300' : tone === 'warn' ? 'text-gold-400' : 'text-slate-50';
  return (
    <div className="rounded-xl border border-white/[.07] bg-white/[.03] p-4">
      <div className="eyebrow !text-slate-400 !tracking-[.14em]">{label}</div>
      <div className={`mt-1.5 font-display text-[21px] font-extrabold leading-tight ${c}`}>{value}</div>
      {sub && <div className="mt-1 text-[12px] text-slate-400">{sub}</div>}
    </div>
  );
}
