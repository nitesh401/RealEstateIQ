import { Download, FolderOpen, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import type { AnalysisReport } from '../lib/types';
import { fmtDateTime, fmtINR } from '../lib/format';
import { deleteReport, importReports } from '../services/storage';
import { Card, Notice, VERDICT_STYLE } from '../components/ui';

export default function Reports({ reports, onOpen, onRefresh, onNew }: { reports: AnalysisReport[]; onOpen: (r: AnalysisReport) => void; onRefresh: () => void; onNew: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');

  const exportAll = () => {
    const blob = new Blob([JSON.stringify(reports, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'estateiq-reports.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try { const n = importReports(await f.text()); setMsg(`${n} report(s) read from file.`); onRefresh(); } catch { setMsg('That file is not a valid EstateIQ export.'); }
    if (ref.current) ref.current.value = '';
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div><div className="eyebrow mb-1">Saved analyses</div><h1 className="font-display text-[28px] font-extrabold">Reports history</h1></div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost" onClick={exportAll} disabled={!reports.length}><Download size={16} /> Export JSON</button>
          <button className="btn btn-ghost" onClick={() => ref.current?.click()}><Upload size={16} /> Import</button>
          <input ref={ref} type="file" accept="application/json" className="sr-only" aria-label="Import reports file" onChange={(e) => void onImport(e.target.files?.[0])} />
        </div>
      </div>
      <p className="mb-4 text-[12.5px] text-slate-500">Reports are stored only in this browser’s local storage. Clearing site data deletes them – export a backup if they matter.</p>
      {msg && <div className="mb-4" role="status"><Notice>{msg}</Notice></div>}
      {reports.length === 0 ? (
        <Card><p className="text-[14px] text-slate-300">No saved reports yet.</p><button className="btn btn-primary mt-4" onClick={onNew}>Analyse a property</button></Card>
      ) : (
        <ul className="space-y-3" data-testid="reports-list">
          {reports.map((r) => (
            <li key={r.id} className="glass flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-0 flex-1"><div className="truncate font-display text-[15px] font-bold">{r.title}</div>
                <div className="mt-0.5 text-[12px] text-slate-400">{fmtDateTime(r.createdAt)} · asking {fmtINR(r.valuation.askingTotal)} · {r.valuation.confidence} confidence{r.valuation.demoData ? ' · DEMO DATA' : ''}</div></div>
              <span className={`chip border bg-gradient-to-br ${VERDICT_STYLE[r.recommendation.verdict]}`}>{r.recommendation.verdict}</span>
              <div className="flex gap-1">
                <button className="btn btn-ghost !min-h-[40px] !px-3" onClick={() => onOpen(r)} aria-label={`Open ${r.title}`}><FolderOpen size={16} /> Open</button>
                <button className="btn btn-ghost !min-h-[40px] !px-3" aria-label="Download PDF" onClick={() => void import('../services/pdf').then((m) => m.downloadPdf(r))}><Download size={16} /></button>
                <button className="btn btn-ghost !min-h-[40px] !px-3 hover:!text-coral-300" aria-label={`Delete ${r.title}`} onClick={() => { if (confirm('Delete this saved report?')) { deleteReport(r.id); onRefresh(); } }}><Trash2 size={16} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
