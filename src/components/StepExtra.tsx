import { Database, Plus, Trash2, Upload, X } from 'lucide-react';
import { useState } from 'react';
import type { Comparable, PropertyInput } from '../lib/types';
import { demoComparables } from '../lib/analysis';
import { parseComparablesCsv } from '../lib/csv';
import { fmtDate, fmtINR } from '../lib/format';
import { Card, DemoBanner, Field, NumInput, Notice, Segmented, Toggle } from './ui';

interface Props { input: PropertyInput; update: (fn: (i: PropertyInput) => PropertyInput) => void }

const today = () => new Date().toISOString().slice(0, 10);

function CompForm({ type, onAdd }: { type: PropertyInput['type']; onAdd: (c: Comparable) => void }) {
  const [c, setC] = useState({ label: '', kind: 'asking' as Comparable['kind'], rate: null as number | null, area: null as number | null, dist: null as number | null, date: today(), source: '', url: '', road: null as number | null, corner: false, township: false, verified: false });
  const [err, setErr] = useState('');
  const submit = () => {
    if (!c.rate || c.rate <= 0) return setErr('Enter the comparable’s rate per sqft.');
    if (!c.date || Number.isNaN(new Date(c.date).getTime())) return setErr('Enter the date the price was observed.');
    if (!c.source.trim()) return setErr('Name the source (e.g. "99acres listing seen 12 Oct", "Sub-registrar deed").');
    setErr('');
    onAdd({ id: `m_${Date.now().toString(36)}`, label: c.label || 'Comparable', propertyType: type, kind: c.kind, ratePerSqft: c.rate, areaSqft: c.area ?? undefined, distanceKm: c.dist ?? undefined, observedOn: c.date, sourceName: c.source.trim(), sourceUrl: c.url.trim() || undefined, roadWidthFt: c.road ?? undefined, corner: c.corner || undefined, township: c.township || undefined, verified: c.verified });
    setC({ ...c, label: '', rate: null, area: null, dist: null, source: '', url: '', road: null, verified: false });
  };
  return (
    <div className="rounded-2xl border border-white/[.08] bg-ink-950/40 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Label" htmlFor="c-label"><input id="c-label" className="input" placeholder="e.g. Plot near X" value={c.label} onChange={(e) => setC({ ...c, label: e.target.value })} /></Field>
        <Field label="Evidence type" htmlFor="c-kind"><select id="c-kind" className="input" value={c.kind} onChange={(e) => setC({ ...c, kind: e.target.value as Comparable['kind'] })}><option value="asking">Published asking price</option><option value="transaction">Registered transaction</option></select></Field>
        <Field label="Rate (₹/sqft) *" htmlFor="c-rate"><NumInput id="c-rate" value={c.rate} onChange={(v) => setC({ ...c, rate: v })} /></Field>
        <Field label="Area (sqft)" htmlFor="c-area"><NumInput id="c-area" value={c.area} onChange={(v) => setC({ ...c, area: v })} /></Field>
        <Field label="Distance from subject (km)" htmlFor="c-dist"><NumInput id="c-dist" value={c.dist} onChange={(v) => setC({ ...c, dist: v })} step="0.1" /></Field>
        <Field label="Date observed *" htmlFor="c-date"><input id="c-date" type="date" className="input" value={c.date} max={today()} onChange={(e) => setC({ ...c, date: e.target.value })} /></Field>
        <Field label="Source name *" htmlFor="c-src"><input id="c-src" className="input" value={c.source} onChange={(e) => setC({ ...c, source: e.target.value })} /></Field>
        <Field label="Source URL" htmlFor="c-url"><input id="c-url" className="input" type="url" placeholder="https://…" value={c.url} onChange={(e) => setC({ ...c, url: e.target.value })} /></Field>
        <Field label="Road width (ft)" htmlFor="c-road"><NumInput id="c-road" value={c.road} onChange={(v) => setC({ ...c, road: v })} /></Field>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-6"><Toggle checked={c.corner} onChange={(v) => setC({ ...c, corner: v })} label="Corner" /><Toggle checked={c.township} onChange={(v) => setC({ ...c, township: v })} label="In township" /><Toggle checked={c.verified} onChange={(v) => setC({ ...c, verified: v })} label="I verified this against the listing / deed" /></div>
      {err && <p role="alert" className="mt-2 text-[12.5px] text-coral-300">{err}</p>}
      <button type="button" className="btn btn-ghost mt-3" onClick={submit} data-testid="add-comp"><Plus size={16} /> Add comparable</button>
    </div>
  );
}

export default function StepExtra({ input: p, update }: Props) {
  const set = (patch: Partial<PropertyInput>) => update((i) => ({ ...i, ...patch }));
  const [csv, setCsv] = useState('');
  const [csvMsg, setCsvMsg] = useState('');
  const hasDemo = p.comparables.some((c) => c.isDemo);

  const importCsv = () => {
    const { comps, errors } = parseComparablesCsv(csv, p.type);
    if (comps.length) set({ comparables: [...p.comparables, ...comps] });
    setCsvMsg(`${comps.length} imported${errors.length ? `; ${errors.length} skipped – ${errors.slice(0, 3).join(' ')}` : '.'}`);
    if (comps.length) setCsv('');
  };

  return (
    <div className="space-y-5">
      <Card eyebrow="Step 5" title="Deal context (all optional)">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Resale or new?" htmlFor="sale"><select id="sale" className="input" value={p.saleKind} onChange={(e) => set({ saleKind: e.target.value as PropertyInput['saleKind'] })}><option value="unknown">Not stated</option><option value="resale">Resale</option><option value="new">Newly developed / ready</option><option value="under_construction">Under construction</option></select></Field>
          <Field label="Possession status" htmlFor="poss"><select id="poss" className="input" value={p.possession} onChange={(e) => set({ possession: e.target.value as PropertyInput['possession'] })}><option value="unknown">Not stated</option><option value="ready">Ready possession</option><option value="within_6m">Within 6 months</option><option value="later">Later than 6 months</option></select></Field>
          <Field label="Seller negotiability" htmlFor="neg"><select id="neg" className="input" value={p.negotiability} onChange={(e) => set({ negotiability: e.target.value as PropertyInput['negotiability'] })}><option value="unknown">Not known</option><option value="firm">Firm price</option><option value="some">Some room</option><option value="high">Significant room</option></select></Field>
          <Field label="Your budget (₹)" htmlFor="bud"><NumInput id="bud" value={p.budget} onChange={(v) => set({ budget: v })} /></Field>
        </div>
        <div className="mt-4"><div className="label">Your purpose</div>
          <Segmented label="Purpose" value={p.purpose} onChange={(v) => set({ purpose: v })} options={[{ v: 'self_use', l: 'Self-use' }, { v: 'investment', l: 'Investment' }, { v: 'rental', l: 'Rental' }]} /></div>
        <div className="mt-4"><Toggle checked={p.constructionEstimate.enabled} onChange={(v) => set({ constructionEstimate: { ...p.constructionEstimate, enabled: v } })} label="Include a construction estimate in total cost" />
          {p.constructionEstimate.enabled && <div className="mt-2 grid gap-4 sm:grid-cols-2"><Field label="Built-up area to construct (sqft)" htmlFor="ce-a"><NumInput id="ce-a" value={p.constructionEstimate.builtUpSqft} onChange={(v) => set({ constructionEstimate: { ...p.constructionEstimate, builtUpSqft: v } })} /></Field><Field label="Construction rate (₹/sqft)" htmlFor="ce-r"><NumInput id="ce-r" value={p.constructionEstimate.ratePerSqft} onChange={(v) => set({ constructionEstimate: { ...p.constructionEstimate, ratePerSqft: v } })} /></Field></div>}
        </div>
      </Card>

      <Card eyebrow="Market evidence" title="Comparable properties & guideline rate" right={<Database className="text-gold-400" aria-hidden />}>
        <Notice>EstateIQ does <b>not</b> scrape property portals (their terms prohibit it) and ships no listing database. The valuation uses comparables <b>you enter</b> (or that your own licensed endpoint supplies – see Settings). Only comparables of the same property type are used; asking prices are never treated as registered sale prices. With no comparables, no market value is invented.</Notice>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Government guideline / collector rate (₹/sqft)" htmlFor="gl" hint="From the official guideline schedule for this locality. Used as a reference floor and for the stamp-duty base."><NumInput id="gl" value={p.guidelineRate} onChange={(v) => set({ guidelineRate: v })} /></Field>
          <Field label="Guideline source / year" htmlFor="gls"><input id="gls" className="input" placeholder="e.g. MP IGR guideline 2025-26, ward X" value={p.guidelineSource} onChange={(e) => set({ guidelineSource: e.target.value })} /></Field>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <h4 className="font-display text-[15px] font-bold">Comparables ({p.comparables.length})</h4>
          {!hasDemo ? <button type="button" className="btn btn-ghost !min-h-[38px] !py-1.5 text-[12.5px]" data-testid="load-demo" onClick={() => set({ comparables: [...p.comparables, ...demoComparables(p.type)] })}>Load DEMO data to explore</button>
            : <button type="button" className="btn btn-ghost !min-h-[38px] !py-1.5 text-[12.5px]" onClick={() => set({ comparables: p.comparables.filter((c) => !c.isDemo) })}><X size={14} /> Remove DEMO data</button>}
        </div>
        {hasDemo && <div className="mt-3"><DemoBanner>DEMO comparables are loaded. They are <b>illustrative, not real market data</b>. Results using them are forced to LOW confidence and are labelled in the report.</DemoBanner></div>}

        {p.comparables.length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-xl border border-ink-600">
            <table className="w-full min-w-[640px] text-left text-[12.5px]">
              <thead className="bg-white/[.04] text-slate-400"><tr><th className="p-2.5">Label</th><th>Type</th><th>Evidence</th><th>₹/sqft</th><th>Dist</th><th>Date</th><th>Source</th><th /></tr></thead>
              <tbody>{p.comparables.map((c) => (
                <tr key={c.id} className="border-t border-ink-600">
                  <td className="p-2.5">{c.label}{c.isDemo && <span className="chip ml-2 bg-coral-300/15 text-coral-300">DEMO</span>}</td><td>{c.propertyType}</td><td>{c.kind}{c.verified ? ' ✓' : ''}</td><td>{fmtINR(c.ratePerSqft)}</td><td>{c.distanceKm ?? '—'}</td><td>{fmtDate(c.observedOn)}</td><td className="max-w-[180px] truncate" title={c.sourceName}>{c.sourceName}</td>
                  <td><button type="button" aria-label={`Remove ${c.label}`} className="p-2 text-slate-400 hover:text-coral-300" onClick={() => set({ comparables: p.comparables.filter((x) => x.id !== c.id) })}><Trash2 size={15} /></button></td>
                </tr>))}</tbody>
            </table>
          </div>
        )}

        <div className="mt-4"><CompForm type={p.type} onAdd={(c) => set({ comparables: [...p.comparables, c] })} /></div>

        <details className="mt-4 rounded-xl border border-ink-600 p-4">
          <summary className="cursor-pointer text-[13px] font-semibold text-slate-200">Paste many comparables (CSV)</summary>
          <p className="mt-2 text-[12px] text-slate-500">Columns: <code>label, kind (asking|transaction), rate, area, distanceKm, date YYYY-MM-DD, source</code></p>
          <textarea aria-label="Comparables CSV" className="input mt-2 min-h-[110px] font-mono !text-[12px]" value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={'Plot A,asking,4300,1500,0.8,2026-10-02,Listing seen 2 Oct\nPlot B,transaction,4100,1200,1.6,2026-08-14,Sub-registrar deed'} />
          <button type="button" className="btn btn-ghost mt-2" onClick={importCsv}><Upload size={15} /> Import</button>
          {csvMsg && <p className="mt-2 text-[12.5px] text-slate-300" role="status">{csvMsg}</p>}
        </details>
      </Card>

      <Card eyebrow="Legal documents" title="Upload status is not verification">
        <p className="text-[13px] text-slate-400">You can mark each legal check later, on the results page. Attaching a document only records that you have a copy – it never marks anything as legally verified.</p>
      </Card>
    </div>
  );
}
