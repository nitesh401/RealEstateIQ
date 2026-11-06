import type { Direction } from './types';

const R = 6371.0088; // km
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial compass bearing (0-360, clockwise from true north) from point 1 to point 2. */
export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

const ORDER: Direction[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Convert a compass bearing to one of the 8 principal directions. */
export function bearingToDirection(b: number): Direction {
  if (!Number.isFinite(b)) return 'unknown';
  const norm = ((b % 360) + 360) % 360;
  return ORDER[Math.round(norm / 45) % 8];
}

export function validCoords(lat: number | null, lon: number | null): boolean {
  return lat !== null && lon !== null && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

/** Rough bounding box check for India; used only to warn, never to block. */
export function looksLikeIndia(lat: number, lon: number): boolean {
  return lat >= 6 && lat <= 37.5 && lon >= 68 && lon <= 98;
}
