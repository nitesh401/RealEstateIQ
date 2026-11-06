import type { Comparable, PropertyType } from '../lib/types';
import { fetchJson, ServiceError } from './http';

export interface MarketResponse { comparables: Comparable[]; sourceName: string; retrievedAt: string }

/**
 * Optional market-data hook. EstateIQ ships no listing/transaction feed (portal terms forbid scraping).
 * If you host your own licensed endpoint (serverless function etc.), set its URL in Settings. Contract:
 *   GET {endpoint}?lat=..&lon=..&type=plot|house|apartment|commercial&radiusKm=5
 *   -> { "sourceName": "...", "retrievedAt": "ISO", "comparables": [ { id,label,propertyType,kind,ratePerSqft,observedOn,sourceName, ... } ] }
 */
export async function fetchMarketComparables(endpoint: string, p: { lat: number; lon: number; type: PropertyType; radiusKm: number }): Promise<MarketResponse> {
  let url: URL;
  try { url = new URL(endpoint); } catch { throw new ServiceError('The configured market-data endpoint is not a valid URL.', 'parse'); }
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new ServiceError('The market-data endpoint must use https.', 'parse');
  url.searchParams.set('lat', String(p.lat)); url.searchParams.set('lon', String(p.lon));
  url.searchParams.set('type', p.type); url.searchParams.set('radiusKm', String(p.radiusKm));
  const raw = await fetchJson<unknown>(url.toString(), {}, 12000);
  return validateMarketResponse(raw);
}

export function validateMarketResponse(raw: unknown): MarketResponse {
  if (!raw || typeof raw !== 'object') throw new ServiceError('Market endpoint returned an unexpected shape.', 'parse');
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.comparables)) throw new ServiceError('Market endpoint response is missing "comparables".', 'parse');
  const comps: Comparable[] = [];
  for (const c of o.comparables as Record<string, unknown>[]) {
    if (!c || typeof c.ratePerSqft !== 'number' || c.ratePerSqft <= 0 || typeof c.observedOn !== 'string' || typeof c.propertyType !== 'string') continue;
    if (c.kind !== 'asking' && c.kind !== 'transaction') continue;
    comps.push({
      id: String(c.id ?? `m_${comps.length}`), label: String(c.label ?? 'Market comparable'), propertyType: c.propertyType as PropertyType,
      kind: c.kind, ratePerSqft: c.ratePerSqft, observedOn: c.observedOn, sourceName: String(c.sourceName ?? o.sourceName ?? 'Market endpoint'),
      areaSqft: typeof c.areaSqft === 'number' ? c.areaSqft : undefined, distanceKm: typeof c.distanceKm === 'number' ? c.distanceKm : undefined,
      sourceUrl: typeof c.sourceUrl === 'string' ? c.sourceUrl : undefined, roadWidthFt: typeof c.roadWidthFt === 'number' ? c.roadWidthFt : undefined,
      corner: typeof c.corner === 'boolean' ? c.corner : undefined, township: typeof c.township === 'boolean' ? c.township : undefined,
      verified: c.verified === true,
    });
  }
  return { comparables: comps, sourceName: String(o.sourceName ?? 'Market endpoint'), retrievedAt: String(o.retrievedAt ?? new Date().toISOString()) };
}
