import type {
  AnalysisReport, Assumptions, Comparable, DataSourceRecord, LocationIntel, PropertyInput,
} from './types';
import { resolveAsking, valuate } from './valuation';
import { computeCosts } from './costs';
import { assessVastu } from './vastu';
import { buildRecommendation } from './recommendation';
import { TYPE_LABEL } from './format';

export const APP_VERSION = '2.0.0';

export function emptyInput(): PropertyInput {
  return {
    location: { country: 'India', state: 'Madhya Pradesh', city: 'Indore', locality: '', project: '', pincode: '', lat: null, lon: null, displayName: '', source: 'none' },
    type: 'plot',
    pricingArea: null, pricingAreaBasis: 'Plot area', askingRate: null, askingTotal: null,
    plotLength: null, plotWidth: null, corner: false, roadWidthFt: null, roadType: 'unknown', township: false, plotNumber: '', approvedLayout: 'unknown',
    carpetArea: null, builtUpArea: null, superBuiltUpArea: null, floor: null, totalFloors: null, bedrooms: null, parking: false, lift: false, amenities: '', maintenanceMonthly: null,
    landArea: null, houseFloors: null, constructionQuality: 'unknown',
    frontageFt: null, usage: '', rentalMonthly: null,
    ageYears: null, facing: 'unknown',
    entrance: 'unknown', roadDirection: 'unknown', plotShape: 'unknown', northReference: 'unknown',
    zones: { kitchen: 'unknown', masterBedroom: 'unknown', pooja: 'unknown', toilet: 'unknown' },
    saleKind: 'unknown', possession: 'unknown', negotiability: 'unknown', purpose: 'self_use', budget: null,
    guidelineRate: null, guidelineSource: '', comparables: [], attachments: [], legal: {},
    constructionEstimate: { enabled: false, builtUpSqft: null, ratePerSqft: null },
  };
}

/** Clearly labelled DEMO comparables so the engine can be explored. They are NOT real market data. */
export function demoComparables(type: PropertyInput['type'], now = new Date()): Comparable[] {
  const base: Record<PropertyInput['type'], number> = { plot: 4600, house: 6200, apartment: 5400, commercial: 9000 };
  const r = base[type];
  const iso = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString().slice(0, 10);
  const rows: [string, 'transaction' | 'asking', number, number, number, number][] = [
    ['DEMO comp 1', 'transaction', 0.96, 0.8, 60, 1500],
    ['DEMO comp 2', 'asking', 1.05, 1.2, 25, 1200],
    ['DEMO comp 3', 'asking', 0.99, 2.1, 45, 1800],
    ['DEMO comp 4', 'transaction', 1.02, 2.6, 120, 1500],
    ['DEMO comp 5', 'asking', 0.93, 3.4, 90, 2000],
  ];
  return rows.map(([label, kind, f, d, age, area], i) => ({
    id: `demo-${type}-${i}`, label, propertyType: type, kind, ratePerSqft: Math.round(r * f), areaSqft: area, distanceKm: d,
    observedOn: iso(age), sourceName: 'DEMO DATA – illustrative only, not real market data', isDemo: true,
  }));
}

export interface BuildArgs {
  input: PropertyInput;
  assumptions: Assumptions;
  intel: LocationIntel | null;
  marketFetchError: string | null;
  marketSource?: { name: string; url?: string; retrievedAt: string } | null;
  now?: Date;
}

export function buildReport(args: BuildArgs): AnalysisReport {
  const now = args.now ?? new Date();
  const { input, assumptions } = args;
  const valuation = valuate(input, assumptions, { now });
  const costs = computeCosts(input, assumptions, valuation.askingTotal, valuation.guidelineValue);
  const vastu = assessVastu(input);
  const intel = args.intel;
  const recommendation = buildRecommendation({ input, valuation, costs, vastu, intel });
  const ask = resolveAsking(input.pricingArea, input.askingRate, input.askingTotal);
  const place = [input.location.locality, input.location.city].filter(Boolean).join(', ') || input.location.displayName || 'Property';
  const iso = now.toISOString();

  const sources: DataSourceRecord[] = [];
  if (intel && intel.attempted) {
    sources.push({ name: 'OpenStreetMap contributors via Overpass API', url: 'https://overpass-api.de', retrievedAt: intel.fetchedAt, status: intel.places.length || !intel.partial ? 'used' : 'unavailable', detail: intel.errors.length ? `Partial: ${intel.errors.join(' | ')}` : `${intel.places.length} mapped features within ${intel.radiusM / 1000} km (distant-feature queries for rail/airport use larger radii).` });
  } else {
    sources.push({ name: 'OpenStreetMap Overpass (nearby amenities)', url: 'https://overpass-api.de', retrievedAt: iso, status: 'unavailable', detail: input.location.lat === null ? 'No coordinates were set, so the query was not run.' : 'Query was not run or failed.' });
  }
  sources.push({ name: 'OpenStreetMap Nominatim (geocoding)', url: 'https://nominatim.openstreetmap.org', retrievedAt: iso, status: input.location.source === 'search' || input.location.source === 'marker' || input.location.source === 'device' ? 'used' : input.location.source === 'manual' ? 'user_supplied' : 'unavailable', detail: `Location source: ${input.location.source}.` });
  if (args.marketSource) sources.push({ name: args.marketSource.name, url: args.marketSource.url, retrievedAt: args.marketSource.retrievedAt, status: 'used', detail: 'Comparables fetched from the configured market-data endpoint.' });
  else if (args.marketFetchError) sources.push({ name: 'Configured market-data endpoint', url: assumptions.marketEndpoint || undefined, retrievedAt: iso, status: 'unavailable', detail: args.marketFetchError });
  const manual = input.comparables.filter((c) => !c.isDemo);
  if (manual.length) sources.push({ name: 'User-supplied comparables', retrievedAt: iso, status: 'user_supplied', detail: `${manual.length} entries; source names recorded per entry. Not independently verified by EstateIQ.` });
  if (input.comparables.some((c) => c.isDemo)) sources.push({ name: 'DEMO comparables', retrievedAt: iso, status: 'user_supplied', detail: 'Illustrative demo data – NOT real market evidence.' });
  if (input.guidelineRate) sources.push({ name: input.guidelineSource || 'User-entered government guideline rate', retrievedAt: iso, status: 'user_supplied', detail: 'Entered by the user from the official guideline schedule; not read from a government API.' });
  sources.push({ name: 'Stamp duty / registration assumptions', retrievedAt: iso, status: 'user_supplied', detail: `${assumptions.stampDutyPct}% + ${assumptions.registrationPct}% as of ${assumptions.ratesAsOf || 'n/a'} – ${assumptions.ratesVerified ? 'verified' : 'NOT verified'} (${assumptions.ratesSource}).` });
  sources.push({ name: 'Public property portals (listings/transactions)', retrievedAt: iso, status: 'not_integrated', detail: 'Not scraped – portal terms prohibit automated collection. Enter listings manually or connect a licensed feed.' });
  sources.push({ name: 'Official government portals (SAMPADA, land records, RERA)', retrievedAt: iso, status: 'not_integrated', detail: 'No public API is integrated; links are provided for manual checks.' });

  return {
    id: `r_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: iso,
    title: `${TYPE_LABEL[input.type]} – ${place}${ask.area ? ` – ${ask.area.toLocaleString('en-IN')} sqft` : ''}`,
    input, assumptions, valuation, costs, vastu, intel, recommendation, sources,
    marketFetchError: args.marketFetchError, appVersion: APP_VERSION,
  };
}

export interface ValidationIssue { field: string; message: string }

export function validateForAnalysis(i: PropertyInput): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  if (!i.pricingArea || i.pricingArea <= 0) out.push({ field: 'pricingArea', message: 'Enter the area (sqft) used to price the property.' });
  if (!((i.askingRate && i.askingRate > 0) || (i.askingTotal && i.askingTotal > 0))) out.push({ field: 'askingRate', message: 'Enter the asking rate per sqft or the total asking price.' });
  if (!i.location.city.trim()) out.push({ field: 'city', message: 'Enter the city.' });
  return out;
}

/** Recompute everything from an edited input (e.g. legal statuses) while preserving identity, timestamp and fetched data. */
export function rebuildReport(rep: AnalysisReport, input: PropertyInput): AnalysisReport {
  const fresh = buildReport({ input, assumptions: rep.assumptions, intel: rep.intel, marketFetchError: rep.marketFetchError, now: new Date(rep.createdAt) });
  return { ...fresh, id: rep.id, createdAt: rep.createdAt, sources: rep.sources, title: rep.title };
}
