import { fetchJson, ServiceError } from './http';

const BASE = 'https://nominatim.openstreetmap.org';

export interface GeoResult {
  lat: number;
  lon: number;
  displayName: string;
  address: { country?: string; state?: string; city?: string; locality?: string; road?: string; pincode?: string };
}

interface RawNominatim {
  lat: string; lon: string; display_name: string;
  address?: Record<string, string>;
}

let lastCall = 0;
const cache = new Map<string, GeoResult[]>();

/** Nominatim's public usage policy: max 1 request/second, no type-ahead auto-complete. We search on submit and throttle. */
async function throttle(): Promise<void> {
  const wait = lastCall + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

function normalise(r: RawNominatim): GeoResult {
  const a = r.address ?? {};
  return {
    lat: parseFloat(r.lat), lon: parseFloat(r.lon), displayName: r.display_name,
    address: {
      country: a.country, state: a.state,
      city: a.city || a.town || a.municipality || a.county || a.state_district || a.village,
      locality: a.suburb || a.neighbourhood || a.city_district || a.quarter || a.hamlet || a.village,
      road: a.road, pincode: a.postcode,
    },
  };
}

export async function searchAddress(q: string): Promise<GeoResult[]> {
  const query = q.trim();
  if (query.length < 3) throw new ServiceError('Enter at least 3 characters to search.', 'empty');
  const key = query.toLowerCase();
  if (cache.has(key)) return cache.get(key) as GeoResult[];
  await throttle();
  const url = `${BASE}/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=in&accept-language=en&q=${encodeURIComponent(query)}`;
  const raw = await fetchJson<RawNominatim[]>(url);
  const out = raw.map(normalise).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon));
  if (!out.length) throw new ServiceError('No matching location found. Try adding the city and state, or drop the street name.', 'empty');
  cache.set(key, out);
  return out;
}

export async function reverseGeocode(lat: number, lon: number): Promise<GeoResult | null> {
  const key = `rev:${lat.toFixed(5)},${lon.toFixed(5)}`;
  const hit = cache.get(key);
  if (hit) return hit[0] ?? null;
  await throttle();
  const url = `${BASE}/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=en&lat=${lat}&lon=${lon}`;
  const raw = await fetchJson<RawNominatim & { error?: string }>(url);
  if (!raw || raw.error || !raw.display_name) return null;
  const res = normalise({ ...raw, lat: String(lat), lon: String(lon) });
  cache.set(key, [res]);
  return res;
}
