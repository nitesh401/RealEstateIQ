import type {
  CostResult, LocationIntel, PropertyInput, Recommendation, RiskItem, ValuationResult, VastuResult, Verdict,
} from './types';
import { summariseLegal } from './legal';
import { locationScore } from './location';
import { fmtINR, fmtPct } from './format';

export interface RecoContext {
  input: PropertyInput;
  valuation: ValuationResult;
  costs: CostResult;
  vastu: VastuResult;
  intel: LocationIntel | null;
}

export function buildRecommendation(ctx: RecoContext): Recommendation {
  const { input, valuation: v, costs, vastu, intel } = ctx;
  const legal = summariseLegal(input);
  const loc = locationScore(intel);
  const reasons: string[] = [];
  const unresolved: string[] = [];
  const risks: RiskItem[] = [];

  const pct = v.differencePct;
  const priceKnown = v.estimated && pct !== null;
  const lowConf = v.confidence === 'LOW';

  /* ---- unresolved items ---- */
  if (!v.estimated) unresolved.push('No market estimate could be produced – comparable evidence is missing or unusable.');
  else if (lowConf) unresolved.push('Valuation confidence is LOW – treat the market estimate as preliminary.');
  if (legal.criticalOpen.length) unresolved.push(`${legal.criticalOpen.length} of ${legal.criticalTotal} critical legal checks are not yet verified by a lawyer/official record: ${legal.criticalOpen.slice(0, 4).map((i) => i.title).join('; ')}${legal.criticalOpen.length > 4 ? '; …' : ''}.`);
  if (legal.issues.length) unresolved.push(`Issues flagged: ${legal.issues.map((i) => i.title).join('; ')}.`);
  if (input.approvedLayout === 'no') unresolved.push('Layout is recorded as NOT approved.');
  if (input.approvedLayout === 'unknown' && (input.type === 'plot' || input.type === 'house')) unresolved.push('Layout approval status is unknown.');
  if (loc.score === null) unresolved.push('Nearby-amenity data was not available (location score not computed).');
  if (input.location.lat === null) unresolved.push('Exact map location not set.');
  if (costs.indicative) unresolved.push('Stamp duty / registration rates are indicative, not verified.');
  if (!v.guidelineRate) unresolved.push('Government guideline rate not entered.');

  /* ---- risks ---- */
  if (input.approvedLayout === 'no') risks.push({ severity: 'high', title: 'Unapproved layout', detail: 'Unapproved layouts can block building permission, utilities and bank loans, and hurt resale.' });
  if (legal.issues.length) risks.push({ severity: 'high', title: 'Legal issue flagged', detail: legal.issues.map((i) => i.title).join('; ') });
  if (legal.criticalOpen.length) risks.push({ severity: legal.criticalVerified === 0 ? 'high' : 'medium', title: 'Unverified critical legal checks', detail: `${legal.criticalOpen.length} critical items remain open.` });
  if (priceKnown && (pct as number) > 15) risks.push({ severity: 'high', title: 'Overpricing', detail: `Asking price is ${fmtPct(pct)} above the estimated market value.` });
  else if (priceKnown && (pct as number) > 5) risks.push({ severity: 'medium', title: 'Premium to estimate', detail: `Asking price is ${fmtPct(pct)} above the estimated market value.` });
  if (priceKnown && (pct as number) < -15) risks.push({ severity: 'medium', title: 'Unusually low price', detail: 'A price far below the estimate can signal title, access, approval or condition problems – investigate before treating it as a bargain.' });
  if (!v.estimated || lowConf) risks.push({ severity: 'medium', title: 'Thin market evidence', detail: v.confidenceReasons.join(' ') });
  if (v.guidelineValue && v.askingTotal < v.guidelineValue) risks.push({ severity: 'low', title: 'Asking price below guideline value', detail: 'Stamp duty is charged on the higher guideline value; a below-guideline deed price can also draw scrutiny.' });
  if (input.budget && v.askingTotal > input.budget) risks.push({ severity: 'high', title: 'Above your budget', detail: `Asking ${fmtINR(v.askingTotal)} exceeds budget ${fmtINR(input.budget)}.` });
  else if (input.budget && costs.totalAcquisition > input.budget) risks.push({ severity: 'medium', title: 'Total cost above budget', detail: `Total acquisition cost ${fmtINR(costs.totalAcquisition)} exceeds budget ${fmtINR(input.budget)} after duties and charges.` });
  if (input.saleKind === 'under_construction') risks.push({ severity: 'medium', title: 'Delivery risk', detail: 'Under-construction purchases carry delivery and quality risk; check RERA registration and escrow.' });
  if (input.possession === 'later') risks.push({ severity: 'low', title: 'Delayed possession', detail: 'Possession is not immediate; holding costs and timeline slippage apply.' });
  if (loc.score !== null && loc.score < 40) risks.push({ severity: 'medium', title: 'Weak mapped connectivity/amenities', detail: 'Few mapped amenities/transport options nearby (OSM coverage may be incomplete).' });
  if (vastu.score !== null && vastu.score < 58) risks.push({ severity: 'low', title: 'Vastu concerns', detail: 'Several traditional Vastu concerns – relevant only if Vastu matters to you or to resale buyers you expect.' });

  /* ---- verdict ---- */
  let verdict: Verdict;
  let headline: string;
  const hardStop = input.approvedLayout === 'no' || legal.issues.length > 0;
  const noData = !v.estimated;

  if (hardStop) {
    verdict = 'AVOID';
    headline = 'Do not proceed until the flagged legal/approval issue is resolved.';
    reasons.push('A legal or approval issue is flagged. Price is secondary until title and approvals are clean.');
  } else if (noData) {
    verdict = 'HOLD';
    headline = 'Not enough market evidence to judge the price. Gather comparables before negotiating.';
    reasons.push('No market estimate could be produced, so the asking price cannot be tested.');
  } else if ((pct as number) > 25) {
    verdict = 'AVOID';
    headline = 'Asking price is far above the estimated market value.';
    reasons.push(`Asking price is ${fmtPct(pct)} above the estimate${lowConf ? ' (low-confidence estimate – confirm with more comparables)' : ''}.`);
  } else if ((pct as number) > 8) {
    verdict = 'NEGOTIATE';
    headline = `Price is above the estimate – negotiate toward ${fmtINR(v.negotiationPrice)}.`;
    reasons.push(`Asking price is ${fmtPct(pct)} above the estimated market value.`);
  } else if (legal.criticalOpen.length > 0 || lowConf) {
    verdict = (pct as number) > 3 ? 'NEGOTIATE' : 'HOLD';
    if (legal.criticalOpen.length > 0) {
      headline = 'Price looks reasonable, but critical legal checks are unresolved – a BUY verdict is withheld.';
      reasons.push(`Price is within ${fmtPct(pct)} of the estimate, but ${legal.criticalOpen.length} critical legal check(s) are not verified.`);
    } else {
      headline = 'Price appears near the estimate, but the evidence is thin – hold until confidence improves.';
      reasons.push('Valuation confidence is LOW.');
    }
  } else if ((pct as number) > 3) {
    verdict = 'BUY AFTER NEGOTIATION';
    headline = `Fairly priced with a small premium – negotiate to about ${fmtINR(v.negotiationPrice)}, then proceed.`;
    reasons.push(`Asking price is ${fmtPct(pct)} above the estimate; legal checks are verified.`);
  } else {
    verdict = 'BUY';
    headline = 'Price is in line with the estimate and critical legal checks are verified.';
    reasons.push(`Asking price is ${fmtPct(pct)} versus the estimated market value, with ${v.confidence} confidence.`);
    reasons.push('All critical legal checks are marked verified by a lawyer/official record.');
  }
  if (v.estimated) reasons.push(`Estimated fair value ${fmtINR(v.fairValue)} (range ${fmtINR(v.lowValue)}–${fmtINR(v.highValue)}), ${v.confidence} confidence, ${v.used.length} comparable(s).`);
  if (loc.score !== null) reasons.push(`Mapped location score ${loc.score}/100 (OpenStreetMap data; may be incomplete).`);
  if (vastu.score !== null) reasons.push(`Traditional Vastu conformity ${vastu.score}/100 – a belief-based indicator, not a quality measure.`);
  if (input.budget && v.askingTotal > input.budget && verdict === 'BUY') { verdict = 'BUY AFTER NEGOTIATION'; headline = 'Price fits the market but exceeds your budget – negotiation is required.'; }

  /* ---- investment suitability ---- */
  const points: string[] = [];
  let suitability = 'Insufficient information';
  const liquidity = input.type === 'plot' && input.township ? 'Plots in approved townships generally resell more easily than isolated plots.' : input.type === 'plot' && input.approvedLayout !== 'yes' ? 'Plots without confirmed layout approval can be hard to resell.' : null;
  if (liquidity) points.push(liquidity);
  if (input.purpose === 'rental' || input.purpose === 'investment') {
    if (input.type === 'commercial' && input.rentalMonthly && v.askingTotal > 0) {
      const y = ((input.rentalMonthly * 12) / v.askingTotal) * 100;
      points.push(`Entered rent gives a gross yield of ${y.toFixed(1)}% on the asking price (before vacancy, tax and maintenance).`);
      suitability = y >= 6 ? 'Reasonable gross yield on entered rent' : 'Modest gross yield on entered rent';
    } else if (input.purpose === 'rental') {
      points.push('No rent estimate entered, so rental yield cannot be assessed.');
    }
    if (input.type === 'plot') points.push('A plot produces no income; returns depend entirely on appreciation, which this app does not forecast.');
    points.push('Appreciation is not predicted – no future-price model is used.');
    if (suitability === 'Insufficient information' && v.estimated && !lowConf && (pct as number) <= 5 && legal.criticalOpen.length === 0) suitability = 'Acceptable entry price; returns not forecast';
    else if (suitability === 'Insufficient information' && (pct ?? 0) > 8) suitability = 'Weak – paying above estimated value';
  } else {
    suitability = 'Self-use: judge on location fit, legal safety and price rather than returns';
    points.push('For self-use, resale and liquidity matter less than legal clarity and fit to your needs.');
  }
  if (costs.totalAcquisition > 0 && v.askingTotal > 0) points.push(`Acquisition costs add about ${(((costs.totalAcquisition - v.askingTotal) / v.askingTotal) * 100).toFixed(1)}% to the base price.`);

  const priceScore = priceKnown ? Math.max(0, Math.min(100, Math.round(100 - Math.max(0, pct as number) * 3 - Math.max(0, -(pct as number) - 10) * 1.5))) : null;
  const legalScore = legal.total ? Math.round((legal.verified / legal.total) * 100) : null;
  const order = { high: 0, medium: 1, low: 2 } as const;
  risks.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    verdict, headline, reasons, unresolved,
    scores: [
      { label: 'Price vs market', value: priceScore, note: priceKnown ? `Asking ${fmtPct(pct)} vs estimate` : 'No estimate' },
      { label: 'Location (mapped)', value: loc.score, note: loc.score === null ? 'Data unavailable' : 'OpenStreetMap-based' },
      { label: 'Legal verification', value: legalScore, note: `${legal.verified}/${legal.total} items verified` },
      { label: 'Vastu conformity', value: vastu.score, note: 'Traditional belief' },
    ],
    investment: { suitability, points },
    risks,
  };
}
