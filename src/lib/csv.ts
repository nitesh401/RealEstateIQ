import type { Comparable, PropertyType } from './types';

/**
 * Parse pasted comparables. Header row optional. Columns:
 * label, kind(asking|transaction), ratePerSqft, areaSqft, distanceKm, date(YYYY-MM-DD), sourceName
 */
export function parseComparablesCsv(text: string, type: PropertyType): { comps: Comparable[]; errors: string[] } {
  const comps: Comparable[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  lines.forEach((line, idx) => {
    const cells = line.split(/[,\t]/).map((c) => c.trim());
    if (idx === 0 && /rate|label/i.test(cells.join(' ')) && !/^\d/.test(cells[2] ?? '')) return; // header
    const [label, kindRaw, rateRaw, areaRaw, distRaw, date, source] = cells;
    const rate = Number((rateRaw ?? '').replace(/[₹,\s]/g, ''));
    const kind = /trans|regist|deed|sale/i.test(kindRaw ?? '') ? 'transaction' : /ask|list|offer/i.test(kindRaw ?? '') ? 'asking' : null;
    if (!kind) { errors.push(`Line ${idx + 1}: kind must be "asking" or "transaction".`); return; }
    if (!(rate > 0)) { errors.push(`Line ${idx + 1}: invalid rate.`); return; }
    if (!date || Number.isNaN(new Date(date).getTime())) { errors.push(`Line ${idx + 1}: date must be YYYY-MM-DD.`); return; }
    const area = areaRaw ? Number(areaRaw) : undefined;
    const dist = distRaw ? Number(distRaw) : undefined;
    comps.push({
      id: `csv_${Date.now().toString(36)}_${idx}`, label: label || `Comparable ${idx + 1}`, propertyType: type, kind,
      ratePerSqft: rate, areaSqft: area && area > 0 ? area : undefined, distanceKm: dist !== undefined && dist >= 0 && Number.isFinite(dist) ? dist : undefined,
      observedOn: date, sourceName: source || 'User-supplied (pasted)',
    });
  });
  return { comps, errors };
}
