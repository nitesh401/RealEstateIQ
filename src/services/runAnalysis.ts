import type { AnalysisReport, Assumptions, LocationIntel, PropertyInput } from '../lib/types';
import { buildReport } from '../lib/analysis';
import { validCoords } from '../lib/geo';
import { fetchLocationIntel } from './overpass';
import { fetchMarketComparables } from './market';

export type Progress = (msg: string) => void;

/**
 * Orchestrates the optional network lookups, then builds the report from pure functions.
 * Any failure degrades gracefully: the report is still produced and every gap is recorded.
 */
export async function runAnalysis(input: PropertyInput, assumptions: Assumptions, onProgress: Progress = () => undefined): Promise<AnalysisReport> {
  const { lat, lon } = input.location;
  const hasCoords = validCoords(lat, lon);

  onProgress('Collecting location and market data…');
  const intelP: Promise<LocationIntel | null> = hasCoords
    ? fetchLocationIntel(lat as number, lon as number).catch((e): LocationIntel => ({
        fetchedAt: new Date().toISOString(), radiusM: 2000, places: [], errors: [e instanceof Error ? e.message : 'Unknown error'], partial: true, attempted: true,
        source: 'OpenStreetMap contributors via Overpass API', sourceUrl: 'https://www.openstreetmap.org/copyright',
      }))
    : Promise.resolve(null);

  let marketError: string | null = null;
  let marketSource: { name: string; url?: string; retrievedAt: string } | null = null;
  const marketP = assumptions.marketEndpoint.trim() && hasCoords
    ? fetchMarketComparables(assumptions.marketEndpoint.trim(), { lat: lat as number, lon: lon as number, type: input.type, radiusKm: assumptions.maxCompDistanceKm })
        .then((r) => r)
        .catch((e: unknown) => { marketError = e instanceof Error ? e.message : 'Market data unavailable'; return null; })
    : Promise.resolve(null);
  if (assumptions.marketEndpoint.trim() && !hasCoords) marketError = 'Market-data endpoint skipped: no coordinates set.';

  const [intel, market] = await Promise.all([intelP, marketP]);

  let merged = input;
  if (market) {
    const existing = new Set(input.comparables.map((c) => c.id));
    merged = { ...input, comparables: [...input.comparables, ...market.comparables.filter((c) => !existing.has(c.id))] };
    marketSource = { name: market.sourceName, url: assumptions.marketEndpoint, retrievedAt: market.retrievedAt };
    if (!market.comparables.length) marketError = 'The market-data endpoint returned no comparables for this area.';
  }
  onProgress('Calculating valuation…');
  return buildReport({ input: merged, assumptions, intel, marketFetchError: marketError, marketSource });
}
