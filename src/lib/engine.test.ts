import { describe, expect, it } from 'vitest';
import { basePrice, resolveAsking, valuate, weightedPercentile, median, ageInDays } from './valuation';
import { computeCosts, DEFAULT_ASSUMPTIONS, applyPreset } from './costs';
import { assessVastu } from './vastu';
import { buildReport, demoComparables, emptyInput, validateForAnalysis } from './analysis';
import { summariseLegal, itemsFor } from './legal';
import { bearingToDirection, haversineKm } from './geo';
import { fmtINR, fmtWords } from './format';
import { locationScore } from './location';
import type { Comparable, LegalStatus, PropertyInput } from './types';

const NOW = new Date('2026-11-01T00:00:00Z');
const A = DEFAULT_ASSUMPTIONS;

const mk = (over: Partial<PropertyInput> = {}): PropertyInput => ({ ...emptyInput(), pricingArea: 1500, askingRate: 4500, ...over });
const comp = (i: number, over: Partial<Comparable> = {}): Comparable => ({
  id: 'c' + i, label: 'c' + i, propertyType: 'plot', kind: 'transaction', ratePerSqft: 4000, areaSqft: 1500, distanceKm: 1,
  observedOn: '2026-09-01', sourceName: 'test', ...over,
});
const verifyAll = (i: PropertyInput): Record<string, LegalStatus> =>
  Object.fromEntries(itemsFor(i.type).map((x) => [x.id, 'lawyer_verified' as LegalStatus]));

describe('exact base price (TEST 1 & 2)', () => {
  it('1,500 sqft x Rs 4,500 = Rs 67,50,000', () => {
    expect(basePrice(1500, 4500)).toBe(6750000);
    expect(fmtINR(6750000)).toBe('₹67,50,000');
  });
  it('1,200 sqft x Rs 5,000 = Rs 60,00,000', () => {
    expect(basePrice(1200, 5000)).toBe(6000000);
    expect(fmtINR(6000000)).toBe('₹60,00,000');
  });
  it('resolveAsking prefers area x rate and derives rate from total otherwise', () => {
    expect(resolveAsking(1500, 4500, null)).toMatchObject({ total: 6750000, derivedFrom: 'area_x_rate' });
    expect(resolveAsking(1200, null, 6000000)).toMatchObject({ rate: 5000, derivedFrom: 'total_over_area' });
    expect(resolveAsking(null, 4500, null).derivedFrom).toBe('invalid');
  });
  it('valuation base price excludes registration costs', () => {
    const v = valuate(mk(), A, { now: NOW });
    expect(v.askingTotal).toBe(6750000);
    const c = computeCosts(mk(), A, v.askingTotal, null);
    expect(c.basePrice).toBe(6750000);
    expect(c.totalAcquisition).toBeGreaterThan(6750000);
  });
  it('formats lakh/crore', () => {
    expect(fmtWords(6750000)).toBe('67.50 Lakh');
    expect(fmtWords(25000000)).toBe('2.50 Crore');
  });
});

describe('valuation rules', () => {
  it('never manufactures comparables: no evidence => no estimate', () => {
    const v = valuate(mk(), A, { now: NOW });
    expect(v.estimated).toBe(false);
    expect(v.fairValue).toBeNull();
    expect(v.confidence).toBe('LOW');
    expect(v.used).toHaveLength(0);
  });
  it('does not mix property types', () => {
    const v = valuate(mk({ comparables: [comp(1, { propertyType: 'apartment', ratePerSqft: 9000 }), comp(2)] }), A, { now: NOW });
    expect(v.used).toHaveLength(1);
    expect(v.excluded[0].reason).toMatch(/Different property type/);
    expect(v.fairRate).toBeCloseTo(4000, 5);
  });
  it('excludes stale and far comparables', () => {
    const v = valuate(mk({ comparables: [comp(1, { observedOn: '2020-01-01' }), comp(2, { distanceKm: 40 }), comp(3)] }), A, { now: NOW });
    expect(v.used).toHaveLength(1);
    expect(v.excluded).toHaveLength(2);
  });
  it('weights nearer, newer, transaction evidence more', () => {
    const near = comp(1, { ratePerSqft: 4000, distanceKm: 0.2, observedOn: '2026-10-15' });
    const far = comp(2, { ratePerSqft: 6000, distanceKm: 4.5, observedOn: '2025-02-01', kind: 'asking' });
    const v = valuate(mk({ comparables: [near, far] }), A, { now: NOW });
    expect(v.fairRate!).toBeLessThan(5000); // closer to 4000 than to simple mean 5000
  });
  it('computes premium, negotiation and max price transparently', () => {
    const comps = [3900, 4000, 4100, 4000, 4050].map((r, i) => comp(i, { ratePerSqft: r }));
    const v = valuate(mk({ comparables: comps }), A, { now: NOW });
    expect(v.estimated).toBe(true);
    expect(v.differencePct!).toBeGreaterThan(10);
    expect(v.negotiationPrice!).toBeLessThan(v.askingTotal);
    expect(v.negotiationPrice!).toBeLessThanOrEqual(v.maxPurchasePrice!);
    expect(v.lowValue!).toBeLessThanOrEqual(v.fairValue!);
    expect(v.highValue!).toBeGreaterThanOrEqual(v.fairValue!);
  });
  it('confidence: HIGH needs >=5 recent comps incl. a transaction with low dispersion', () => {
    const comps = [3950, 4000, 4050, 4000, 4020].map((r, i) => comp(i, { ratePerSqft: r, kind: i === 0 ? 'transaction' : 'asking' }));
    expect(valuate(mk({ comparables: comps }), A, { now: NOW }).confidence).toBe('HIGH');
  });
  it('confidence: MEDIUM with 3 decent comps, LOW with 2', () => {
    const three = [3950, 4000, 4100].map((r, i) => comp(i, { ratePerSqft: r }));
    expect(valuate(mk({ comparables: three }), A, { now: NOW }).confidence).toBe('MEDIUM');
    expect(valuate(mk({ comparables: three.slice(0, 2) }), A, { now: NOW }).confidence).toBe('LOW');
  });
  it('confidence LOW when evidence is old or dispersed', () => {
    const old = [4000, 4010, 3990, 4005, 4000].map((r, i) => comp(i, { ratePerSqft: r, observedOn: '2025-01-01' }));
    expect(valuate(mk({ comparables: old }), A, { now: NOW }).confidence).toBe('LOW');
  });
  it('demo comparables are always LOW confidence and flagged', () => {
    const v = valuate(mk({ comparables: demoComparables('plot', NOW) }), A, { now: NOW });
    expect(v.demoData).toBe(true);
    expect(v.confidence).toBe('LOW');
    expect(v.preliminary).toBe(true);
  });
  it('removes statistical outliers only when >= 5 comps', () => {
    const rates = [4000, 4020, 3980, 4010, 3990, 9000];
    const v = valuate(mk({ comparables: rates.map((r, i) => comp(i, { ratePerSqft: r })) }), A, { now: NOW });
    expect(v.used).toHaveLength(5);
    expect(v.excluded.some((e) => /outlier/i.test(e.reason))).toBe(true);
    const few = valuate(mk({ comparables: [4000, 9000, 4010].map((r, i) => comp(i, { ratePerSqft: r })) }), A, { now: NOW });
    expect(few.used).toHaveLength(3);
  });
  it('applies road-width adjustment only when comp states it, bounded', () => {
    const c = comp(1, { roadWidthFt: 20 });
    const v = valuate(mk({ roadWidthFt: 40, comparables: [c] }), A, { now: NOW });
    expect(v.used[0].adjustedRate).toBeCloseTo(4000 * 1.04, 5);
    const none = valuate(mk({ roadWidthFt: 40, comparables: [comp(2)] }), A, { now: NOW });
    expect(none.used[0].adjustedRate).toBe(4000);
  });
  it('guideline value is a reference floor, not an estimate', () => {
    const v = valuate(mk({ guidelineRate: 2500 }), A, { now: NOW });
    expect(v.guidelineValue).toBe(3750000);
    expect(v.estimated).toBe(false);
  });
  it('helpers', () => {
    expect(median([1, 3, 2])).toBe(2);
    expect(weightedPercentile([1, 2, 3], [1, 1, 1], 0.5)).toBe(2);
    expect(ageInDays('2026-10-02', NOW)).toBe(30);
  });
});

describe('cost calculator', () => {
  it('MP indicative: 7.5% + 3% on deed price', () => {
    const c = computeCosts(mk(), A, 6750000, null);
    expect(c.duties[0].amount).toBeCloseTo(506250, 2);
    expect(c.duties[1].amount).toBeCloseTo(202500, 2);
    expect(c.indicative).toBe(true);
    expect(c.warnings.join(' ')).toMatch(/INDICATIVE/);
  });
  it('duty base is the higher of price and guideline value', () => {
    const c = computeCosts(mk(), A, 6000000, 8000000);
    expect(c.dutyBase).toBe(8000000);
    expect(c.duties[0].amount).toBeCloseTo(600000, 2);
  });
  it('does not hardcode one rate: other state requires entry and warns', () => {
    const o = applyPreset(A, 'OTHER');
    expect(o.stampDutyPct).toBe(0);
    expect(computeCosts(mk(), o, 6750000, null).warnings.join(' ')).toMatch(/zero/);
  });
  it('GST only for non-plot under-construction', () => {
    const uc = mk({ type: 'apartment', saleKind: 'under_construction' });
    expect(computeCosts(uc, A, 1e7, null).additional.some((l) => /GST/.test(l.label))).toBe(true);
    expect(computeCosts(mk({ type: 'apartment', saleKind: 'resale' }), A, 1e7, null).additional.some((l) => /GST/.test(l.label))).toBe(false);
    expect(computeCosts(mk({ saleKind: 'under_construction' }), A, 1e7, null).additional.some((l) => /GST/.test(l.label))).toBe(false);
  });
  it('A + B = C', () => {
    const c = computeCosts(mk(), A, 6750000, null);
    expect(c.totalAcquisition).toBeCloseTo(c.basePrice + c.additionalTotal, 2);
  });
});

describe('vastu', () => {
  it('separates facing, entrance and road direction', () => {
    const r = assessVastu(mk({ facing: 'E', entrance: 'N', roadDirection: 'W', plotShape: 'rectangle' }));
    const txt = r.findings.map((f) => f.text).join(' ');
    expect(txt).toMatch(/facing .* and entrance .* differ/i);
    expect(txt).toMatch(/road is on the West side but the plot is recorded as East-facing/);
  });
  it('NE-facing/NE entrance/square scores higher than SW/SW/triangular', () => {
    const hi = assessVastu(mk({ facing: 'NE', entrance: 'NE', plotShape: 'square', roadDirection: 'NE' }));
    const lo = assessVastu(mk({ facing: 'SW', entrance: 'SW', plotShape: 'triangular', roadDirection: 'SW' }));
    expect(hi.score!).toBeGreaterThan(lo.score!);
    expect(hi.score!).toBeGreaterThanOrEqual(78);
    expect(lo.score!).toBeLessThan(58);
  });
  it('insufficient inputs gives no score and always includes the disclaimer', () => {
    const r = assessVastu(mk());
    expect(r.score).toBeNull();
    expect(r.disclaimer).toMatch(/not scientifically validated/);
  });
  it('never claims guaranteed outcomes', () => {
    const r = assessVastu(mk({ facing: 'NE', entrance: 'NE', plotShape: 'square', roadDirection: 'N' }));
    expect(JSON.stringify(r)).not.toMatch(/guarantee[sd]? (prosperity|wealth|health)/i);
  });
  it('room zones enter the score only when given', () => {
    const base = assessVastu(mk({ facing: 'E', entrance: 'E', plotShape: 'square' }));
    const z = assessVastu(mk({ facing: 'E', entrance: 'E', plotShape: 'square', zones: { kitchen: 'NE', masterBedroom: 'unknown', pooja: 'unknown', toilet: 'unknown' } }));
    expect(z.score!).toBeLessThan(base.score!);
  });
  it('bearing to direction', () => {
    expect(bearingToDirection(0)).toBe('N');
    expect(bearingToDirection(44)).toBe('NE');
    expect(bearingToDirection(181)).toBe('S');
    expect(bearingToDirection(359)).toBe('N');
  });
});

describe('recommendation rules', () => {
  const fairComps = [3950, 4000, 4050, 4000, 4020].map((r, i) => comp(i, { ratePerSqft: r, kind: i === 0 ? 'transaction' : 'asking' }));
  const run = (input: PropertyInput) => buildReport({ input, assumptions: A, intel: null, marketFetchError: null, now: NOW }).recommendation;

  it('never BUY while critical legal checks are unresolved', () => {
    const r = run(mk({ askingRate: 4000, comparables: fairComps, approvedLayout: 'yes' }));
    expect(r.verdict).not.toBe('BUY');
    expect(r.unresolved.join(' ')).toMatch(/critical legal checks/);
  });
  it('BUY only with fair price + HIGH confidence + all critical items verified', () => {
    const i = mk({ askingRate: 4000, comparables: fairComps, approvedLayout: 'yes' });
    i.legal = verifyAll(i);
    expect(run(i).verdict).toBe('BUY');
  });
  it('uploaded documents do not count as verification', () => {
    const i = mk({ askingRate: 4000, comparables: fairComps, attachments: [{ id: '1', name: 'deed.pdf', size: 1, mime: 'application/pdf', category: 'title_deed' }] });
    expect(summariseLegal(i).criticalVerified).toBe(0);
    expect(run(i).verdict).not.toBe('BUY');
  });
  it('AVOID for unapproved layout or flagged legal issue', () => {
    expect(run(mk({ approvedLayout: 'no', comparables: fairComps, askingRate: 4000 })).verdict).toBe('AVOID');
    const i = mk({ comparables: fairComps, askingRate: 4000 });
    i.legal = { title: 'issue_found' };
    expect(run(i).verdict).toBe('AVOID');
  });
  it('overpriced => NEGOTIATE; grossly overpriced => AVOID', () => {
    const i = mk({ askingRate: 4500, comparables: fairComps }); // ~ +12%
    i.legal = verifyAll(i);
    expect(run(i).verdict).toBe('NEGOTIATE');
    const j = mk({ askingRate: 6000, comparables: fairComps });
    j.legal = verifyAll(j);
    expect(run(j).verdict).toBe('AVOID');
  });
  it('small premium with verified legal => BUY AFTER NEGOTIATION', () => {
    const i = mk({ askingRate: 4150, comparables: fairComps });
    i.legal = verifyAll(i);
    expect(run(i).verdict).toBe('BUY AFTER NEGOTIATION');
  });
  it('no evidence => HOLD with unresolved items listed (TEST 6 fallback)', () => {
    const rep = buildReport({ input: mk(), assumptions: A, intel: null, marketFetchError: 'Network error', now: NOW });
    expect(rep.recommendation.verdict).toBe('HOLD');
    expect(rep.valuation.preliminary).toBe(true);
    expect(rep.valuation.askingTotal).toBe(6750000);
    expect(rep.sources.some((s) => s.status === 'unavailable' && /market-data endpoint/.test(s.name))).toBe(true);
  });
  it('demo data cannot produce BUY', () => {
    const i = mk({ askingRate: 4600, comparables: demoComparables('plot', NOW) });
    i.legal = verifyAll(i);
    expect(run(i).verdict).not.toBe('BUY');
  });
});

describe('misc', () => {
  it('validation requires area, price and city', () => {
    expect(validateForAnalysis(emptyInput()).length).toBeGreaterThanOrEqual(2);
    expect(validateForAnalysis(mk())).toHaveLength(0);
  });
  it('haversine ~ known distance (Indore-Bhopal ~ 165-175 km)', () => {
    const d = haversineKm(22.7196, 75.8577, 23.2599, 77.4126);
    expect(d).toBeGreaterThan(160);
    expect(d).toBeLessThan(180);
  });
  it('location score is null when amenity data is missing (never "nothing nearby")', () => {
    expect(locationScore(null).score).toBeNull();
    expect(locationScore({ fetchedAt: '', radiusM: 2000, places: [], errors: ['x'], partial: true, source: '', sourceUrl: '', attempted: true }).score).toBeNull();
  });
});

import { parseComparablesCsv } from './csv';
describe('csv import', () => {
  it('parses valid rows, reports bad ones, ignores header', () => {
    const r = parseComparablesCsv('label,kind,rate,area,dist,date,source\nA,asking,4200,1500,0.8,2026-09-01,99acres listing seen\nB,bogus,1,1,1,2026-09-01,x\nC,transaction,abc,1,1,2026-09-01,x\nD,transaction,4100,,,2026-08-01,Sub-registrar', 'plot');
    expect(r.comps.map((c) => c.label)).toEqual(['A', 'D']);
    expect(r.errors).toHaveLength(2);
  });
});
