import type { AmenityCategory, LocationIntel, Place } from '../lib/types';
import { haversineKm } from '../lib/geo';
import { fetchJson, ServiceError } from './http';

export const OVERPASS_ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

export interface OverpassElement {
  type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string>;
}
interface OverpassResponse { elements: OverpassElement[]; remark?: string }

export function nearbyQuery(lat: number, lon: number, radiusM: number): string {
  const a = `(around:${radiusM},${lat},${lon})`;
  const hw = `(around:${Math.max(radiusM, 3000)},${lat},${lon})`;
  return `[out:json][timeout:25];(
nwr${a}[amenity~"^(school|college|university)$"];
nwr${a}[amenity~"^(hospital|clinic)$"];
nwr${a}[shop~"^(mall|supermarket|department_store)$"];
nwr${a}[amenity=marketplace];
nwr${a}[highway=bus_stop];
nwr${a}[public_transport=station];
way${hw}[highway~"^(motorway|trunk|primary)$"][name];
nwr${a}[office=it];
nwr${a}[name~"(IT|Tech|Technology|Software) ?(Park|City|SEZ)|SEZ",i][building];
nwr${a}[natural=water];
nwr${a}[waterway~"^(river|canal)$"];
way${hw}[highway~"^(construction|proposed)$"][name];
way${hw}[railway~"^(construction|proposed)$"];
);out center tags 400;`;
}

export function farQuery(lat: number, lon: number): string {
  return `[out:json][timeout:25];(
nwr(around:15000,${lat},${lon})[railway=station][name];
nwr(around:60000,${lat},${lon})[aeroway=aerodrome][iata];
);out center tags 60;`;
}

export function classify(t: Record<string, string>): AmenityCategory | null {
  if (/^(school|college|university)$/.test(t.amenity ?? '')) return 'school';
  if (/^(hospital|clinic)$/.test(t.amenity ?? '')) return 'hospital';
  if (/^(mall|supermarket|department_store)$/.test(t.shop ?? '') || t.amenity === 'marketplace') return 'shopping';
  if (t.aeroway === 'aerodrome') return 'airport';
  if (t.railway === 'station') return 'railway';
  if (/^(construction|proposed)$/.test(t.highway ?? '') || /^(construction|proposed)$/.test(t.railway ?? '')) return 'development';
  if (/^(motorway|trunk|primary)$/.test(t.highway ?? '')) return 'highway';
  if (t.highway === 'bus_stop' || t.public_transport === 'station') return 'bus';
  if (t.office === 'it' || (t.building && /(IT|Tech|Technology|Software) ?(Park|City|SEZ)|SEZ/i.test(t.name ?? ''))) return 'it_park';
  if (t.natural === 'water' || /^(river|canal)$/.test(t.waterway ?? '')) return 'water';
  return null;
}

export function parseElements(els: OverpassElement[], lat: number, lon: number): Place[] {
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const e of els) {
    const t = e.tags ?? {};
    const c = classify(t);
    const la = e.lat ?? e.center?.lat;
    const lo = e.lon ?? e.center?.lon;
    if (!c || la === undefined || lo === undefined) continue;
    const name = t.name || t['name:en'] || (c === 'bus' ? 'Bus stop' : c === 'water' ? 'Water body' : c === 'school' ? 'School (unnamed)' : c === 'hospital' ? 'Healthcare (unnamed)' : c === 'highway' ? 'Road' : 'Unnamed feature');
    const key = `${c}|${name}|${la.toFixed(3)}|${lo.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: `${e.type}${e.id}`, category: c, name, lat: la, lon: lo, distanceKm: haversineKm(lat, lon, la, lo), tags: { ...(t.operator ? { operator: t.operator } : {}), ...(t.iata ? { iata: t.iata } : {}) } });
  }
  return out;
}

async function run(query: string, timeoutMs: number): Promise<OverpassResponse> {
  let lastErr: unknown;
  for (const ep of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetchJson<OverpassResponse>(ep, { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, timeoutMs);
      if (res.remark && /error|timed out|out of memory/i.test(res.remark) && !res.elements?.length) throw new ServiceError('Overpass reported: ' + res.remark, 'http');
      return res;
    } catch (e) {
      lastErr = e;
      if (e instanceof ServiceError && e.kind === 'rate_limit') break; // do not hammer a rate-limited service via the mirror
    }
  }
  throw lastErr instanceof Error ? lastErr : new ServiceError('Overpass unavailable', 'network');
}

export async function fetchLocationIntel(lat: number, lon: number, radiusM = 2000): Promise<LocationIntel> {
  const errors: string[] = [];
  let places: Place[] = [];
  let ok = 0;
  try {
    const r = await run(nearbyQuery(lat, lon, radiusM), 28000);
    places = places.concat(parseElements(r.elements ?? [], lat, lon));
    ok++;
  } catch (e) { errors.push('Nearby amenities: ' + (e instanceof Error ? e.message : 'failed')); }
  try {
    const r = await run(farQuery(lat, lon), 28000);
    places = places.concat(parseElements(r.elements ?? [], lat, lon));
    ok++;
  } catch (e) { errors.push('Railway/airport: ' + (e instanceof Error ? e.message : 'failed')); }
  return {
    fetchedAt: new Date().toISOString(), radiusM, places, errors, partial: ok < 2, attempted: true,
    source: 'OpenStreetMap contributors via Overpass API', sourceUrl: 'https://www.openstreetmap.org/copyright',
  };
}
