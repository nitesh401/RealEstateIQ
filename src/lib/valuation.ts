import type {
  Assumptions, Comparable, Confidence, ExcludedComp, PropertyInput, UsedComp, ValuationResult,
} from './types';

/* ---------- exact arithmetic ---------- */

/** Base price = area x rate. Excludes stamp duty, registration and all other charges. */
export function basePrice(area: number, rate: number): number {
  // Round to paise-safe integer arithmetic to avoid float artefacts such as 0.1+0.2.
  return Math.round(area * rate * 100) / 100;
}

export interface AskingPrice {
  area: number;
  rate: number;
  total: number;
  derivedFrom: 'area_x_rate' | 'total_over_area' | 'invalid';
}

/**
 * Resolve the asking price from whatever the user supplied.
 * area + rate -> total = area x rate (preferred, exact)
 * area + total -> rate = total / area
 */
export function resolveAsking(area: number | null, rate: number | null, total: number | null): AskingPrice {
  const a = area && area > 0 ? area : 0;
  if (a > 0 && rate && rate > 0) return { area: a, rate, total: basePrice(a, rate), derivedFrom: 'area_x_rate' };
  if (a > 0 && total && total > 0) return { area: a, rate: total / a, total, derivedFrom: 'total_over_area' };
  return { area: a, rate: 0, total: 0, derivedFrom: 'invalid' };
}

/* ---------- statistics helpers ---------- */

export function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function weightedMean(values: number[], weights: number[]): number {
  const sw = weights.reduce((a, b) => a + b, 0);
  if (sw <= 0) return NaN;
  return values.reduce((s, v, i) => s + v * weights[i], 0) / sw;
}

/** Weighted percentile (p in 0..1) using the cumulative-weight midpoint method with linear interpolation. */
export function weightedPercentile(values: number[], weights: number[], p: number): number {
  if (!values.length) return NaN;
  const pairs = values.map((v, i) => ({ v, w: weights[i] })).sort((a, b) => a.v - b.v);
  const total = pairs.reduce((s, x) => s + x.w, 0);
  if (pairs.length === 1) return pairs[0].v;
  let cum = 0;
  const mids = pairs.map((x) => {
    const mid = (cum + x.w / 2) / total;
    cum += x.w;
    return mid;
  });
  if (p <= mids[0]) return pairs[0].v;
  if (p >= mids[mids.length - 1]) return pairs[pairs.length - 1].v;
  for (let i = 1; i < mids.length; i++) {
    if (p <= mids[i]) {
      const t = (p - mids[i - 1]) / (mids[i] - mids[i - 1]);
      return pairs[i - 1].v + t * (pairs[i].v - pairs[i - 1].v);
    }
  }
  return pairs[pairs.length - 1].v;
}

const MS_DAY = 86_400_000;
export function ageInDays(isoDate: string, now: Date): number {
  const t = new Date(isoDate).getTime();
  if (Number.isNaN(t)) return Infinity;
  return Math.max(0, Math.round((now.getTime() - t) / MS_DAY));
}

/* ---------- weighting model ---------- */

export const RECENCY_HALF_LIFE_DAYS = 270;
export const UNKNOWN_DISTANCE_KM = 3; // assumed (penalised) when a comparable has no distance

export function recencyFactor(ageDays: number): number {
  return Math.max(0.15, Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS));
}
export function distanceFactor(km: number | undefined): number {
  const d = km === undefined || !Number.isFinite(km) ? UNKNOWN_DISTANCE_KM : Math.max(0, km);
  return 1 / (1 + d); // 0 km -> 1.0, 1 km -> 0.5, 4 km -> 0.2
}
export function evidenceFactor(kind: Comparable['kind']): number {
  return kind === 'transaction' ? 1 : 0.6; // asking prices carry less evidential weight
}
export function sizeFactor(subjectArea: number, compArea: number | undefined): number {
  if (!compArea || compArea <= 0 || subjectArea <= 0) return 0.8; // unknown size: mild penalty
  const r = Math.abs(Math.log(compArea / subjectArea)) / Math.log(4); // 0 when equal, 1 at 4x difference
  return Math.max(0.4, 1 - 0.6 * Math.min(1, r));
}

/** Multiplicative adjustments bringing a comparable's rate to the subject's characteristics. Only applied when the comp states the attribute. */
export function adjustRate(comp: Comparable, subject: PropertyInput, a: Assumptions, askingDiscountPct: number): { rate: number; applied: string[] } {
  let rate = comp.ratePerSqft;
  const applied: string[] = [];
  if (comp.kind === 'asking' && askingDiscountPct > 0) {
    rate *= 1 - askingDiscountPct / 100;
    applied.push(`asking-price haircut -${askingDiscountPct}% (assumption)`);
  }
  if (subject.roadWidthFt && comp.roadWidthFt) {
    const steps = (subject.roadWidthFt - comp.roadWidthFt) / 10;
    const pct = Math.max(-8, Math.min(8, steps * a.roadAdjPctPer10ft));
    if (pct !== 0) {
      rate *= 1 + pct / 100;
      applied.push(`road width ${comp.roadWidthFt}->${subject.roadWidthFt} ft: ${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`);
    }
  }
  if (comp.corner !== undefined && comp.corner !== subject.corner) {
    const pct = subject.corner ? a.cornerAdjPct : -a.cornerAdjPct;
    rate *= 1 + pct / 100;
    applied.push(`corner position: ${pct > 0 ? '+' : ''}${pct}%`);
  }
  if (comp.township !== undefined && comp.township !== subject.township) {
    const pct = subject.township ? a.townshipAdjPct : -a.townshipAdjPct;
    rate *= 1 + pct / 100;
    applied.push(`township/gated: ${pct > 0 ? '+' : ''}${pct}%`);
  }
  return { rate, applied };
}

/* ---------- main engine ---------- */

export interface ValuationOptions {
  now?: Date;
}

export function valuate(input: PropertyInput, a: Assumptions, opts: ValuationOptions = {}): ValuationResult {
  const now = opts.now ?? new Date();
  const ask = resolveAsking(input.pricingArea, input.askingRate, input.askingTotal);
  const notes: string[] = [];
  const excluded: ExcludedComp[] = [];
  const candidates: UsedComp[] = [];

  const guidelineRate = input.guidelineRate && input.guidelineRate > 0 ? input.guidelineRate : null;
  const guidelineValue = guidelineRate && ask.area > 0 ? basePrice(ask.area, guidelineRate) : null;

  for (const comp of input.comparables) {
    if (!(comp.ratePerSqft > 0)) { excluded.push({ comp, reason: 'Invalid or missing rate' }); continue; }
    if (comp.propertyType !== input.type) { excluded.push({ comp, reason: `Different property type (${comp.propertyType}) – not mixed with ${input.type}` }); continue; }
    const age = ageInDays(comp.observedOn, now);
    if (!Number.isFinite(age)) { excluded.push({ comp, reason: 'Missing or invalid observation date' }); continue; }
    if (age > a.maxCompAgeDays) { excluded.push({ comp, reason: `Older than ${a.maxCompAgeDays} days (${age} days)` }); continue; }
    if (comp.distanceKm !== undefined && comp.distanceKm > a.maxCompDistanceKm) { excluded.push({ comp, reason: `Farther than ${a.maxCompDistanceKm} km (${comp.distanceKm} km)` }); continue; }
    const adj = adjustRate(comp, input, a, a.askingDiscountPct);
    const factors = {
      recency: recencyFactor(age),
      distance: distanceFactor(comp.distanceKm),
      evidence: evidenceFactor(comp.kind),
      size: sizeFactor(ask.area, comp.areaSqft),
    };
    const weight = factors.recency * factors.distance * factors.evidence * factors.size;
    candidates.push({ comp, adjustedRate: adj.rate, weight, ageDays: age, factors, adjustmentsApplied: adj.applied });
  }

  // Robust outlier screen (median +/- 3 scaled MAD) – only with >= 5 comps so we never discard scarce evidence.
  let used = candidates;
  if (candidates.length >= 5) {
    const rates = candidates.map((c) => c.adjustedRate);
    const med = median(rates);
    const mad = median(rates.map((r) => Math.abs(r - med))) * 1.4826;
    if (mad > 0) {
      used = [];
      for (const c of candidates) {
        if (Math.abs(c.adjustedRate - med) > 3 * mad) excluded.push({ comp: c.comp, reason: 'Statistical outlier vs. other comparables (> 3 scaled MAD from median)' });
        else used.push(c);
      }
    }
  }

  const demoData = used.some((u) => u.comp.isDemo);
  const evidenceSummary = {
    transactions: used.filter((u) => u.comp.kind === 'transaction').length,
    asking: used.filter((u) => u.comp.kind === 'asking').length,
    verified: used.filter((u) => u.comp.verified).length,
  };

  const base: ValuationResult = {
    area: ask.area, askingRate: ask.rate, askingTotal: ask.total,
    estimated: false, preliminary: true,
    fairRate: null, lowRate: null, highRate: null, fairValue: null, lowValue: null, highValue: null,
    difference: null, differencePct: null, negotiationPrice: null, maxPurchasePrice: null,
    guidelineValue, guidelineRate, used, excluded,
    confidence: 'LOW', confidenceReasons: [], dispersionCv: null, medianAgeDays: null,
    demoData, evidenceSummary, notes,
  };

  if (ask.derivedFrom === 'invalid') {
    base.confidenceReasons.push('Area and asking rate (or total) are required to compute the asking price.');
    return base;
  }
  if (ask.derivedFrom === 'total_over_area') notes.push('Asking rate was derived as total / area because no per-sqft rate was entered.');

  if (used.length === 0) {
    base.confidenceReasons.push(
      input.comparables.length
        ? 'No usable comparables remain after filtering (type, age, distance, validity). No market estimate was produced.'
        : 'No comparable evidence is available, so no market estimate is produced. Only the asking-price arithmetic is shown.',
    );
    if (guidelineValue) notes.push('A government guideline value is shown as a reference floor only. It is not a market valuation.');
    return base;
  }

  const rates = used.map((u) => u.adjustedRate);
  const w = used.map((u) => u.weight);
  const fairRate = weightedMean(rates, w);
  let lowRate = weightedPercentile(rates, w, 0.25);
  let highRate = weightedPercentile(rates, w, 0.75);
  if (used.length < 3) {
    lowRate = fairRate * 0.85;
    highRate = fairRate * 1.15;
    notes.push('Fewer than 3 comparables: the range is a +/-15% placeholder band, not a statistical interval.');
  } else {
    lowRate = Math.min(lowRate, fairRate);
    highRate = Math.max(highRate, fairRate);
  }

  const mean = rates.reduce((s, r) => s + r, 0) / rates.length;
  const sd = Math.sqrt(rates.reduce((s, r) => s + (r - mean) ** 2, 0) / rates.length);
  const cv = mean > 0 ? sd / mean : 0;
  const medAge = median(used.map((u) => u.ageDays));

  const fairValue = basePrice(ask.area, fairRate);
  const difference = ask.total - fairValue;
  const differencePct = fairValue > 0 ? (difference / fairValue) * 100 : null;
  // Negotiation target: midway between the low-end and fair rate, never above the asking price.
  const negotiationRate = Math.min(ask.rate, (lowRate + fairRate) / 2);
  const maxRate = Math.min(ask.rate, highRate);

  // Confidence
  const reasons: string[] = [];
  let confidence: Confidence = 'LOW';
  const n = used.length;
  if (n >= 5 && medAge <= 180 && cv <= 0.2 && evidenceSummary.transactions >= 1) confidence = 'HIGH';
  else if (n >= 3 && medAge <= 365 && cv <= 0.35) confidence = 'MEDIUM';
  reasons.push(`${n} usable comparable${n === 1 ? '' : 's'} (${evidenceSummary.transactions} transaction, ${evidenceSummary.asking} asking-price).`);
  reasons.push(`Median evidence age ${Math.round(medAge)} days; price dispersion (CV) ${(cv * 100).toFixed(0)}%.`);
  if (evidenceSummary.transactions === 0) reasons.push('No registered-transaction evidence: asking prices are offers, not completed sales.');
  if (n < 3) reasons.push('Fewer than 3 comparables – confidence is capped at LOW.');
  if (cv > 0.35) reasons.push('Comparable prices are widely dispersed.');
  if (medAge > 365) reasons.push('Evidence is more than a year old on median.');
  if (demoData) {
    confidence = 'LOW';
    reasons.push('DEMO data is included. Demo comparables are illustrative, not real market evidence – confidence forced to LOW.');
  }

  return {
    ...base,
    estimated: true,
    preliminary: confidence === 'LOW',
    fairRate, lowRate, highRate,
    fairValue, lowValue: basePrice(ask.area, lowRate), highValue: basePrice(ask.area, highRate),
    difference, differencePct,
    negotiationPrice: basePrice(ask.area, negotiationRate),
    maxPurchasePrice: basePrice(ask.area, maxRate),
    confidence, confidenceReasons: reasons, dispersionCv: cv, medianAgeDays: medAge,
  };
}
