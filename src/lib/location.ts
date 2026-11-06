import type { AmenityCategory, LocationIntel, Place } from './types';

export const CATEGORY_META: Record<AmenityCategory, { label: string; color: string; radiusNote: string }> = {
  school: { label: 'Schools', color: '#73d7d0', radiusNote: 'within search radius' },
  hospital: { label: 'Hospitals & clinics', color: '#ef9b85', radiusNote: 'within search radius' },
  shopping: { label: 'Shopping centres', color: '#e8bd75', radiusNote: 'within search radius' },
  bus: { label: 'Public transport stops', color: '#8fb4ff', radiusNote: 'within search radius' },
  railway: { label: 'Railway stations', color: '#c79bff', radiusNote: 'within 15 km' },
  airport: { label: 'Airports', color: '#ffd37a', radiusNote: 'within 60 km' },
  highway: { label: 'Highways / expressways', color: '#9fe0b4', radiusNote: 'motorway/trunk/primary roads' },
  it_park: { label: 'IT parks & employment centres', color: '#ff9ed1', radiusNote: 'mapped tech / office parks' },
  water: { label: 'Water bodies (proximity only)', color: '#5fb7ff', radiusNote: 'proximity indicator, not a flood assessment' },
  development: { label: 'Mapped development projects', color: '#f5f06a', radiusNote: 'roads/rail marked proposed or under construction in OSM' },
};

export const CATEGORY_ORDER: AmenityCategory[] = ['school', 'hospital', 'shopping', 'bus', 'railway', 'airport', 'highway', 'it_park', 'development', 'water'];

export function byCategory(intel: LocationIntel | null): Record<AmenityCategory, Place[]> {
  const out = {} as Record<AmenityCategory, Place[]>;
  for (const c of CATEGORY_ORDER) out[c] = [];
  if (!intel) return out;
  for (const p of intel.places) out[p.category].push(p);
  for (const c of CATEGORY_ORDER) out[c].sort((a, b) => a.distanceKm - b.distanceKm);
  return out;
}

/**
 * Location score 0-100 from mapped (OpenStreetMap) evidence only. Returns null when the data was not obtained,
 * because a missing dataset must never be read as "nothing nearby".
 * OSM coverage is community-maintained – absence of a feature is not proof the feature does not exist.
 */
export function locationScore(intel: LocationIntel | null): { score: number | null; notes: string[] } {
  if (!intel || !intel.attempted || (intel.partial && intel.places.length === 0)) {
    return { score: null, notes: ['Nearby-amenity data could not be retrieved, so no location score is given.'] };
  }
  const g = byCategory(intel);
  const notes: string[] = [];
  const near = (c: AmenityCategory) => g[c][0]?.distanceKm;
  const pts: { w: number; s: number }[] = [];
  const add = (c: AmenityCategory, w: number, good: number, ok: number) => {
    const d = near(c);
    if (d === undefined) { pts.push({ w, s: 15 }); notes.push(`${CATEGORY_META[c].label}: none mapped (data may be incomplete).`); return; }
    const s = d <= good ? 100 : d <= ok ? 100 - ((d - good) / (ok - good)) * 45 : Math.max(10, 55 - (d - ok) * 6);
    pts.push({ w, s });
    notes.push(`${CATEGORY_META[c].label}: nearest ${d.toFixed(1)} km.`);
  };
  add('school', 15, 1, 3);
  add('hospital', 15, 1.5, 4);
  add('shopping', 10, 1.5, 4);
  add('bus', 12, 0.5, 1.5);
  add('railway', 10, 5, 12);
  add('airport', 6, 15, 40);
  add('highway', 12, 1, 4);
  add('it_park', 10, 4, 12);
  const wsum = pts.reduce((a, b) => a + b.w, 0);
  const score = Math.round(pts.reduce((a, b) => a + b.w * b.s, 0) / wsum);
  if (intel.partial) notes.push('Some queries failed – the score is based on partial data.');
  return { score, notes };
}
