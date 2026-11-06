import type { AnalysisReport, Assumptions, PropertyInput } from '../lib/types';
import { DEFAULT_ASSUMPTIONS } from '../lib/costs';
import { emptyInput } from '../lib/analysis';

const K_REPORTS = 'estateiq.reports.v2';
const K_DRAFT = 'estateiq.draft.v2';
const K_SETTINGS = 'estateiq.settings.v2';

function read<T>(key: string): T | null {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : null;
  } catch { return null; }
}
function write(key: string, v: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch { return false; }
}

export const loadReports = (): AnalysisReport[] => {
  const r = read<AnalysisReport[]>(K_REPORTS);
  return Array.isArray(r) ? r : [];
};
export function saveReport(rep: AnalysisReport): boolean {
  const all = loadReports().filter((r) => r.id !== rep.id);
  all.unshift(rep);
  return write(K_REPORTS, all.slice(0, 100));
}
export function deleteReport(id: string): void { write(K_REPORTS, loadReports().filter((r) => r.id !== id)); }
export function importReports(json: string): number {
  const parsed = JSON.parse(json) as unknown;
  const arr = Array.isArray(parsed) ? parsed : [];
  const valid = arr.filter((r): r is AnalysisReport => !!r && typeof r === 'object' && typeof (r as AnalysisReport).id === 'string' && !!(r as AnalysisReport).valuation && !!(r as AnalysisReport).input);
  const existing = loadReports();
  const ids = new Set(existing.map((r) => r.id));
  const merged = [...valid.filter((r) => !ids.has(r.id)), ...existing];
  write(K_REPORTS, merged.slice(0, 100));
  return valid.length;
}

export interface Draft { input: PropertyInput; step: number }
export function loadDraft(): Draft {
  const d = read<Draft>(K_DRAFT);
  if (!d || !d.input) return { input: emptyInput(), step: 0 };
  // merge over defaults so older drafts survive added fields
  const base = emptyInput();
  return { step: Math.min(Math.max(0, d.step ?? 0), 4), input: { ...base, ...d.input, location: { ...base.location, ...d.input.location }, zones: { ...base.zones, ...d.input.zones }, constructionEstimate: { ...base.constructionEstimate, ...d.input.constructionEstimate } } };
}
export const saveDraft = (d: Draft): boolean => write(K_DRAFT, d);
export const clearDraft = (): void => { try { localStorage.removeItem(K_DRAFT); } catch { /* ignore */ } };

export const loadAssumptions = (): Assumptions => ({ ...DEFAULT_ASSUMPTIONS, ...(read<Partial<Assumptions>>(K_SETTINGS) ?? {}) });
export const saveAssumptions = (a: Assumptions): boolean => write(K_SETTINGS, a);
export function clearAll(): void { try { [K_REPORTS, K_DRAFT, K_SETTINGS].forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ } }
