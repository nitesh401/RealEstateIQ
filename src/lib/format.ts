const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export const fmtINR = (n: number | null | undefined): string =>
  n === null || n === undefined || !Number.isFinite(n) ? '—' : (n < 0 ? '-₹' : '₹') + inr.format(Math.abs(Math.round(n)));

/** Plain-ASCII money for the PDF (standard PDF fonts have no rupee glyph). */
export const fmtRs = (n: number | null | undefined): string =>
  n === null || n === undefined || !Number.isFinite(n) ? '-' : (n < 0 ? '-Rs ' : 'Rs ') + inr.format(Math.abs(Math.round(n)));

export const fmtNum = (n: number | null | undefined, d = 0): string =>
  n === null || n === undefined || !Number.isFinite(n) ? '—' : n.toLocaleString('en-IN', { maximumFractionDigits: d });

/** 6750000 -> "67.50 Lakh", 25000000 -> "2.50 Crore" */
export function fmtWords(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  const s = n < 0 ? '-' : '';
  if (a >= 1e7) return `${s}${(a / 1e7).toFixed(2)} Crore`;
  if (a >= 1e5) return `${s}${(a / 1e5).toFixed(2)} Lakh`;
  return `${s}${inr.format(Math.round(a))}`;
}

export const fmtPct = (n: number | null | undefined, d = 1): string =>
  n === null || n === undefined || !Number.isFinite(n) ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(d)}%`;

export const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
export const fmtDateTime = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const TYPE_LABEL: Record<string, string> = {
  plot: 'Residential plot',
  house: 'Independent house',
  apartment: 'Apartment / flat',
  commercial: 'Commercial property',
};
export const DIR_LABEL: Record<string, string> = {
  N: 'North', NE: 'North-East', E: 'East', SE: 'South-East', S: 'South', SW: 'South-West', W: 'West', NW: 'North-West', unknown: 'Not sure',
};
