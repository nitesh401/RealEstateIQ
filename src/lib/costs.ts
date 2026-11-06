import type { Assumptions, CostLine, CostResult, PropertyInput } from './types';
import { basePrice } from './valuation';

export interface StatePreset {
  code: string;
  name: string;
  stampDutyPct: number;
  registrationPct: number;
  asOf: string;
  source: string;
  verified: boolean;
  note: string;
}

/**
 * Registration-cost presets. Every preset is date-labelled and editable in Settings.
 * Only Madhya Pradesh is pre-filled (initial target market). Other states are deliberately NOT guessed:
 * choose "Other state" and enter the current notified rates.
 */
export const STATE_PRESETS: StatePreset[] = [
  {
    code: 'MP', name: 'Madhya Pradesh', stampDutyPct: 7.5, registrationPct: 3, asOf: '2026-06',
    source: 'Secondary sources (property-finance guides citing MP IGR, 2026). Not read from the official portal by this app.',
    verified: false,
    note: 'Charged on the higher of the deed value and the guideline (circle) value. Sources disagree on gender concessions – confirm on mpigr.gov.in before paying.',
  },
  {
    code: 'OTHER', name: 'Other state (enter rates)', stampDutyPct: 0, registrationPct: 0, asOf: '',
    source: 'User supplied', verified: false,
    note: 'Rates are not pre-filled for this state. Enter the currently notified stamp duty and registration percentages.',
  },
];

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  stateCode: 'MP',
  stampDutyPct: 7.5,
  registrationPct: 3,
  ratesAsOf: '2026-06',
  ratesSource: STATE_PRESETS[0].source,
  ratesVerified: false,
  brokeragePct: 1,
  legalFeeFlat: 15000,
  otherCostsFlat: 10000,
  gstPct: 5,
  askingDiscountPct: 0,
  maxCompAgeDays: 730,
  maxCompDistanceKm: 5,
  roadAdjPctPer10ft: 2,
  cornerAdjPct: 4,
  townshipAdjPct: 5,
  marketEndpoint: '',
};

export function applyPreset(a: Assumptions, code: string): Assumptions {
  const p = STATE_PRESETS.find((s) => s.code === code);
  if (!p) return a;
  return { ...a, stateCode: p.code, stampDutyPct: p.stampDutyPct, registrationPct: p.registrationPct, ratesAsOf: p.asOf, ratesSource: p.source, ratesVerified: p.verified };
}

export function computeCosts(input: PropertyInput, a: Assumptions, askingTotal: number, guidelineValue: number | null, priceOverride?: number): CostResult {
  const price = priceOverride ?? askingTotal;
  const warnings: string[] = [];
  const dutyBase = Math.max(price, guidelineValue ?? 0);
  if (guidelineValue && guidelineValue > price) warnings.push('Guideline value exceeds the deed price – duty and registration are charged on the higher guideline value.');
  if (!guidelineValue) warnings.push('No guideline value entered: duty is computed on the deed price only. If the official guideline value is higher, actual duty will be higher.');

  const stamp = (dutyBase * a.stampDutyPct) / 100;
  const reg = (dutyBase * a.registrationPct) / 100;
  const duties: CostLine[] = [
    { label: `Stamp duty (${a.stampDutyPct}%)`, amount: stamp, note: `On ${dutyBase === price ? 'deed price' : 'guideline value'}` },
    { label: `Registration fee (${a.registrationPct}%)`, amount: reg },
  ];
  const additional: CostLine[] = [];
  const brokerage = (price * a.brokeragePct) / 100;
  if (brokerage > 0) additional.push({ label: `Brokerage (${a.brokeragePct}%)`, amount: brokerage, note: 'Assumption – negotiable, may be nil' });
  if (a.legalFeeFlat > 0) additional.push({ label: 'Legal verification / drafting', amount: a.legalFeeFlat, note: 'Assumption – flat estimate' });
  if (a.otherCostsFlat > 0) additional.push({ label: 'Other transaction costs', amount: a.otherCostsFlat, note: 'Assumption – documentation, mutation, society transfer etc.' });

  const gstApplies = input.type !== 'plot' && input.saleKind === 'under_construction';
  if (gstApplies && a.gstPct > 0) additional.push({ label: `GST (${a.gstPct}%)`, amount: (price * a.gstPct) / 100, note: 'Applies to under-construction purchases; rate depends on category – verify' });
  if (input.type !== 'plot' && input.saleKind === 'unknown') warnings.push('Sale type unknown: GST (applicable only on under-construction units) was not added.');

  if (input.constructionEstimate.enabled && input.constructionEstimate.builtUpSqft && input.constructionEstimate.ratePerSqft) {
    additional.push({ label: 'Construction estimate', amount: basePrice(input.constructionEstimate.builtUpSqft, input.constructionEstimate.ratePerSqft), note: 'User-supplied area x rate' });
  }
  if (input.maintenanceMonthly && input.type === 'apartment') warnings.push(`Recurring maintenance of about ₹${input.maintenanceMonthly}/month is not included in acquisition cost.`);

  const additionalTotal = duties.concat(additional).reduce((s, l) => s + l.amount, 0);
  const indicative = !a.ratesVerified || !a.ratesAsOf;
  if (indicative) warnings.push('Stamp duty and registration rates are INDICATIVE (not verified against the official notification). Confirm before paying.');
  if (!a.stampDutyPct && !a.registrationPct) warnings.push('Stamp duty and registration percentages are zero – enter the rates for your state in Settings.');

  return {
    basePrice: price, duties, additional, additionalTotal, totalAcquisition: price + additionalTotal,
    dutyBase, indicative, ratesAsOf: a.ratesAsOf, ratesSource: a.ratesSource, warnings,
  };
}
