import { Download, FilePlus2, Printer, ShieldAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AmenityCategory, AnalysisReport, LegalStatus } from '../lib/types';
import { DIR_LABEL, fmtDate, fmtDateTime, fmtINR, fmtNum, fmtPct, fmtWords, TYPE_LABEL } from '../lib/format';
import { itemsFor, legalStatusOf, STATUS_HELP, STATUS_LABEL, summariseLegal } from '../lib/legal';
import { CATEGORY_META, CATEGORY_ORDER, byCategory, locationScore } from '../lib/location';
import { rebuildReport } from '../lib/analysis';
import MapView from '../components/MapView';
import { CompChart, RangeBar } from '../components/Charts';
import { AnimatedNumber, Card, ConfidenceBadge, DemoBanner, Notice, ScoreRing, Stat, VERDICT_STYLE } from '../components/ui';

const TABS = ['Overview', 'Valuation', 'Costs', 'Location', 'Vastu', 'Legal', 'Risks', 'Sources'] as const;
type Tab = (typeof TABS)[number];

export default function Results({ report, onChange, onNew, onEdit }: { report: AnalysisReport; onChange: (r: AnalysisReport) => void; onNew: () => void; onEdit: () => void }) {
  const [tab, setTab] = useState<Tab>('Overview');
  const [pdfErr, setPdfErr] = useState('');
  const { valuation: v, recommendation: rec, costs, vastu, input } = report;

  const act = async (kind: 'download' | 'print') => { try { setPdfErr(''); const m = await import('../services/pdf'); if (kind === 'download') m.downloadPdf(report); else m.printPdf(report); } catch (e) { setPdfErr('PDF generation failed: ' + (e instanceof Error ? e.message : 'unknown error')); } };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div><div className="eyebrow mb-1">Property intelligence report</div><h1 className="font-display text-[22px] font-extrabold sm:text-[30px]">{report.title}</h1>
          <p className="mt-1 text-[12.5px] text-slate-400">Generated {fmtDateTime(report.createdAt)} · saved in this browser</p></div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" data-testid="download-pdf" onClick={() => void act('download')}><Download size={16} /> Download PDF</button>
          <button className="btn btn-ghost" onClick={() => void act('print')}><Printer size={16} /> Print</button>
          <button className="btn btn-ghost" onClick={onEdit}>Edit inputs</button>
          <button className="btn btn-ghost" onClick={onNew}><FilePlus2 size={16} /> New</button>
        </div>
      </div>
      {pdfErr && <div className="mb-4"><Notice tone="warn">{pdfErr}</Notice></div>}
      <div className="mb-4 space-y-3">
        {v.demoData && <DemoBanner><b>DEMO DATA IN USE.</b> The comparables behind this valuation are illustrative, not real market evidence. Do not rely on these figures.</DemoBanner>}
        {report.marketFetchError && <Notice tone="warn">Market-data endpoint problem: {report.marketFetchError} A preliminary result is shown from the inputs you provided.</Notice>}
        {v.preliminary && !v.demoData && <Notice tone="warn" ><span data-testid="preliminary-banner">PRELIMINARY – evidence is limited ({v.confidence} confidence). {v.estimated ? 'The market estimate is indicative only.' : 'No market estimate could be computed; only the asking-price arithmetic is shown.'}</span></Notice>}
      </div>

      <div role="tablist" aria-label="Report sections" className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-ink-600 bg-white/[.03] p-1.5">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-[13px] font-semibold transition min-h-[44px] ${tab === t ? 'bg-gold-400 text-ink-950' : 'text-slate-300 hover:bg-white/[.06]'}`}>{t}</button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="space-y-5" role="tabpanel">
          <div className={`rounded-3xl border bg-gradient-to-br p-6 sm:p-8 ${VERDICT_STYLE[rec.verdict]}`} data-testid="verdict-card">
            <div className="eyebrow !text-current opacity-80">Recommendation</div>
            <div className="mt-1 font-display text-[34px] font-extrabold leading-none sm:text-[46px]" data-testid="verdict">{rec.verdict}</div>
            <p className="mt-3 max-w-2xl text-[15px] text-slate-100">{rec.headline}</p>
            <div className="mt-3"><ConfidenceBadge level={v.confidence} preliminary={v.preliminary} /></div>
          </div>

          {rec.unresolved.length > 0 && (
            <section className="rounded-2xl border border-coral-300/40 bg-coral-300/[.07] p-5" aria-labelledby="unres">
              <h2 id="unres" className="mb-2 flex items-center gap-2 font-display text-[16px] font-bold text-coral-300"><ShieldAlert size={18} /> Unresolved risks</h2>
              <ul className="list-disc space-y-1.5 pl-5 text-[13.5px] text-slate-200">{rec.unresolved.map((u) => <li key={u}>{u}</li>)}</ul>
            </section>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Asking price (excl. registry)" value={<AnimatedNumber value={v.askingTotal} format={fmtINR} />} sub={`${fmtNum(v.area)} sqft × ${fmtINR(v.askingRate)}`} />
            <Stat label="Estimated market value" value={v.estimated ? <AnimatedNumber value={v.fairValue as number} format={fmtINR} /> : 'Not estimated'} sub={v.estimated ? `${fmtINR(v.lowValue)} – ${fmtINR(v.highValue)}` : 'Needs comparables'} />
            <Stat label="Premium / discount" value={v.estimated ? fmtPct(v.differencePct) : '—'} tone={v.differencePct === null ? undefined : v.differencePct > 8 ? 'bad' : v.differencePct < -8 ? 'warn' : 'good'} sub={v.estimated ? `${fmtINR(v.difference)} vs estimate` : undefined} />
            <Stat label="Total acquisition cost" value={<AnimatedNumber value={costs.totalAcquisition} format={fmtINR} />} sub={costs.indicative ? 'Indicative rates' : 'Rates verified by you'} />
          </div>

          <Card eyebrow="Scorecard" title="How the property scores">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{rec.scores.map((s) => <ScoreRing key={s.label} value={s.value} label={s.label} note={s.note} />)}</div>
          </Card>

          <Card eyebrow="Why" title="Reasons for this verdict"><ul className="list-disc space-y-1.5 pl-5 text-[13.5px] text-slate-200">{rec.reasons.map((r) => <li key={r}>{r}</li>)}</ul></Card>
          {v.estimated && v.negotiationPrice !== null && (
            <Card eyebrow="Negotiation" title="Suggested price points">
              <div className="grid gap-4 sm:grid-cols-3">
                <Stat label="Negotiation target" value={fmtINR(v.negotiationPrice)} sub={fmtWords(v.negotiationPrice)} tone="good" />
                <Stat label="Maximum purchase price" value={fmtINR(v.maxPurchasePrice)} sub="Upper end of estimated range, capped at asking" />
                <Stat label="Seller negotiability" value={({ firm: 'Firm', some: 'Some room', high: 'High room', unknown: 'Not stated' })[input.negotiability]} />
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === 'Valuation' && (
        <div className="space-y-5" role="tabpanel">
          <Card eyebrow="Valuation breakdown" title="Asking price vs estimated market value" right={<ConfidenceBadge level={v.confidence} preliminary={v.preliminary} />}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="1 · Asking price" value={fmtINR(v.askingTotal)} sub={`${fmtNum(v.area)} sqft × ${fmtINR(v.askingRate)}/sqft`} />
              <Stat label="2 · Estimated value" value={v.estimated ? fmtINR(v.fairValue) : '—'} sub={v.estimated ? `Fair rate ${fmtINR(v.fairRate)}/sqft` : 'No estimate'} />
              <Stat label="3 · Price difference" value={v.estimated ? `${fmtINR(v.difference)} (${fmtPct(v.differencePct)})` : '—'} />
              <Stat label="4 · Low estimate" value={fmtINR(v.lowValue)} sub={v.lowRate ? `${fmtINR(v.lowRate)}/sqft` : undefined} />
              <Stat label="5 · High estimate" value={fmtINR(v.highValue)} sub={v.highRate ? `${fmtINR(v.highRate)}/sqft` : undefined} />
              <Stat label="6 · Guideline value (user-entered)" value={fmtINR(v.guidelineValue)} sub="Reference floor – not a market value" />
            </div>
            {v.estimated && <div className="px-2 pb-10"><RangeBar low={v.lowValue as number} fair={v.fairValue as number} high={v.highValue as number} asking={v.askingTotal} /></div>}
            {!v.estimated && <div className="mt-4"><Notice tone="warn">{v.confidenceReasons.join(' ')}</Notice></div>}
          </Card>

          {v.used.length > 0 && <Card eyebrow="Market intelligence" title="Comparable rates"><CompChart v={v} /></Card>}

          <Card eyebrow="Evidence" title={`Comparable property evidence (${v.used.length} used, ${v.excluded.length} excluded)`}>
            {v.used.length === 0 && <p className="text-[13.5px] text-slate-400">No usable comparables. Add comparables in step 5 or configure a market-data endpoint in Settings.</p>}
            {v.used.length > 0 && (
              <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-[12.5px]" data-testid="comp-table">
                <thead className="text-slate-400"><tr><th className="py-2">Comparable</th><th>Evidence</th><th>Rate</th><th>Adjusted</th><th>Dist</th><th>Age</th><th>Weight</th><th>Source</th></tr></thead>
                <tbody>{v.used.map((u) => (
                  <tr key={u.comp.id} className="border-t border-ink-600 align-top">
                    <td className="py-2">{u.comp.label}{u.comp.isDemo && <span className="chip ml-2 bg-coral-300/15 text-coral-300">DEMO</span>}{u.adjustmentsApplied.length > 0 && <div className="text-[11px] text-slate-500">{u.adjustmentsApplied.join('; ')}</div>}</td>
                    <td>{u.comp.kind === 'transaction' ? 'Transaction' : 'Asking price'}{u.comp.verified ? ' · verified' : ''}</td><td>{fmtINR(u.comp.ratePerSqft)}</td><td>{fmtINR(u.adjustedRate)}</td><td>{u.comp.distanceKm === undefined ? 'n/a' : `${u.comp.distanceKm} km`}</td><td>{u.ageDays} d</td><td>{u.weight.toFixed(2)}</td>
                    <td>{u.comp.sourceUrl ? <a className="text-teal-300 underline" href={u.comp.sourceUrl} target="_blank" rel="noopener noreferrer">{u.comp.sourceName}</a> : u.comp.sourceName}<div className="text-[11px] text-slate-500">{fmtDate(u.comp.observedOn)}</div></td>
                  </tr>))}</tbody>
              </table></div>
            )}
            {v.excluded.length > 0 && <details className="mt-4"><summary className="cursor-pointer text-[13px] font-semibold text-slate-300">Excluded evidence and why</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-[12.5px] text-slate-400">{v.excluded.map((e) => <li key={e.comp.id}>{e.comp.label}: {e.reason}</li>)}</ul></details>}
          </Card>

          <Card eyebrow="Confidence" title="Why this confidence level">
            <ul className="list-disc space-y-1 pl-5 text-[13.5px] text-slate-200">{v.confidenceReasons.map((r) => <li key={r}>{r}</li>)}</ul>
            {v.notes.map((n) => <p key={n} className="mt-2 text-[12.5px] text-slate-400">{n}</p>)}
            <p className="mt-3 text-[12px] text-slate-500">A calculated result is not a verified market valuation. Weighted by recency, distance, evidence type and size; asking and transaction prices are never mixed up.</p>
          </Card>
        </div>
      )}

      {tab === 'Costs' && (
        <div className="space-y-5" role="tabpanel" data-testid="costs">
          <Card eyebrow="Purchase cost" title="Total acquisition cost">
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="A · Property price (excl. registration)" value={fmtINR(costs.basePrice)} sub={fmtWords(costs.basePrice)} />
              <Stat label="B · Estimated additional expenses" value={fmtINR(costs.additionalTotal)} sub={`${fmtPct((costs.additionalTotal / costs.basePrice) * 100, 1).replace('+', '')} of price`} />
              <Stat label="C · Total acquisition cost" value={fmtINR(costs.totalAcquisition)} sub={fmtWords(costs.totalAcquisition)} tone="warn" />
            </div>
            <table className="mt-5 w-full text-left text-[13px]"><tbody>
              {[...costs.duties, ...costs.additional].map((l) => (<tr key={l.label} className="border-t border-ink-600"><td className="py-2.5">{l.label}{l.note && <div className="text-[11.5px] text-slate-500">{l.note}</div>}</td><td className="text-right font-mono">{fmtINR(l.amount)}</td></tr>))}
            </tbody></table>
            <p className="mt-4 text-[12px] text-slate-400">Duty basis {fmtINR(costs.dutyBase)} · rates as of {costs.ratesAsOf || 'n/a'} · {costs.indicative ? 'INDICATIVE – not verified against the official notification' : 'marked verified by you'}. Source: {costs.ratesSource}. Edit assumptions in Settings.</p>
            <div className="mt-3 space-y-2">{costs.warnings.map((w) => <Notice key={w} tone="warn">{w}</Notice>)}</div>
          </Card>
        </div>
      )}

      {tab === 'Location' && <LocationTab report={report} />}

      {tab === 'Vastu' && (
        <div className="space-y-5" role="tabpanel">
          <Notice>{vastu.disclaimer}</Notice>
          <Card eyebrow="Traditional guidance" title="Vastu compatibility">
            <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
              <div className="flex flex-col items-center"><div className="relative h-40 w-40 rounded-full border border-ink-600" aria-hidden>
                {(['N', 'E', 'S', 'W'] as const).map((d, i) => <span key={d} className="absolute font-mono text-[12px] text-slate-400" style={{ left: i % 2 ? (i === 1 ? 'calc(100% - 16px)' : '8px') : '50%', top: i % 2 === 0 ? (i === 0 ? '4px' : 'calc(100% - 20px)') : '50%', transform: i % 2 === 0 ? 'translateX(-50%)' : 'translateY(-50%)' }}>{d}</span>)}
                <div className="absolute left-1/2 top-1/2 h-14 w-0.5 origin-bottom bg-gold-400" style={{ transform: `translate(-50%,-100%) rotate(${({ N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315, unknown: 0 })[input.facing]}deg)` }} />
              </div><div className="mt-3 text-center text-[13px] text-slate-300">Facing: {DIR_LABEL[input.facing]}<br />Entrance: {DIR_LABEL[input.entrance]}<br />Road: {DIR_LABEL[input.roadDirection]}</div></div>
              <div>
                <div className="font-display text-[34px] font-extrabold text-gold-400" data-testid="vastu-score">{vastu.score === null ? '—' : <><AnimatedNumber value={vastu.score} format={(n) => String(Math.round(n))} /><span className="text-[16px] text-slate-400"> / 100</span></>}</div>
                <div className="text-[14px] text-slate-200">{vastu.label}</div>
                <div className="mt-4 space-y-2">{vastu.breakdown.map((b) => (<div key={b.name}><div className="flex justify-between text-[12px] text-slate-400"><span>{b.name} · weight {Math.round(b.weight * 100)}%</span><span>{b.score === null ? 'not provided' : Math.round(b.score)}</span></div><div className="h-1.5 rounded-full bg-ink-600"><div className="h-full rounded-full bg-teal-300" style={{ width: `${b.score ?? 0}%`, transition: 'width .8s' }} /></div></div>))}</div>
              </div>
            </div>
          </Card>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Positive aspects"><ul className="list-disc space-y-1.5 pl-5 text-[13.5px] text-slate-200">{vastu.findings.filter((f) => f.tone === 'positive').map((f) => <li key={f.text}>{f.text}</li>)}{!vastu.findings.some((f) => f.tone === 'positive') && <li className="text-slate-400">None identified from the inputs provided.</li>}</ul></Card>
            <Card title="Potential concerns & notes"><ul className="list-disc space-y-1.5 pl-5 text-[13.5px] text-slate-200">{vastu.findings.filter((f) => f.tone !== 'positive').map((f) => <li key={f.text}>{f.text}</li>)}</ul></Card>
            <Card title="Recommended improvements"><ul className="list-disc space-y-1.5 pl-5 text-[13.5px] text-slate-200">{vastu.improvements.map((f) => <li key={f}>{f}</li>)}</ul></Card>
            <Card title="Principles applied"><ul className="list-disc space-y-1.5 pl-5 text-[13.5px] text-slate-200">{vastu.principles.map((f) => <li key={f}>{f}</li>)}</ul></Card>
          </div>
        </div>
      )}

      {tab === 'Legal' && <LegalTab report={report} onChange={onChange} />}

      {tab === 'Risks' && (
        <div className="space-y-5" role="tabpanel">
          <Card eyebrow="Risk analysis" title="Risks identified">
            {rec.risks.length === 0 ? <p className="text-[13.5px] text-slate-400">No specific risks were triggered. This is not an all-clear – missing inputs are not evidence of safety.</p> :
              <ul className="space-y-3">{rec.risks.map((r) => (<li key={r.title} className="flex gap-3"><span className={`chip h-fit shrink-0 ${r.severity === 'high' ? 'bg-coral-300/15 text-coral-300' : r.severity === 'medium' ? 'bg-gold-400/15 text-gold-400' : 'bg-slate-500/20 text-slate-300'}`}>{r.severity.toUpperCase()}</span><div><div className="text-[14px] font-semibold">{r.title}</div><div className="text-[13px] text-slate-400">{r.detail}</div></div></li>))}</ul>}
          </Card>
          <Card eyebrow="Investment" title={rec.investment.suitability}><ul className="list-disc space-y-1.5 pl-5 text-[13.5px] text-slate-200">{rec.investment.points.map((p) => <li key={p}>{p}</li>)}</ul>
            <p className="mt-3 text-[12px] text-slate-500">Property type: {TYPE_LABEL[input.type]}. No future price or appreciation forecast is made.</p></Card>
        </div>
      )}

      {tab === 'Sources' && (
        <div className="space-y-5" role="tabpanel">
          <Card eyebrow="Transparency" title="Data sources & timestamps">
            <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-[12.5px]"><thead className="text-slate-400"><tr><th className="py-2">Source</th><th>Status</th><th>Retrieved</th><th>Detail</th></tr></thead>
              <tbody>{report.sources.map((s) => (<tr key={s.name + s.detail} className="border-t border-ink-600 align-top"><td className="py-2.5">{s.url ? <a className="text-teal-300 underline" href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a> : s.name}</td><td><span className={`chip ${s.status === 'used' ? 'bg-mint-300/15 text-mint-300' : s.status === 'user_supplied' ? 'bg-gold-400/15 text-gold-400' : 'bg-coral-300/15 text-coral-300'}`}>{s.status.replace('_', ' ')}</span></td><td>{fmtDateTime(s.retrievedAt)}</td><td className="text-slate-400">{s.detail}</td></tr>))}</tbody></table></div>
          </Card>
          <Card eyebrow="Method" title="Confidence & methodology">
            <p className="text-[13.5px] leading-relaxed text-slate-300">Comparables of the same property type are screened for validity, age and distance. With five or more, statistical outliers are removed. Each comparable is weighted by recency (270-day half-life) × distance (1/(1+km)) × evidence type (transaction 1.0, asking 0.6) × size similarity, optionally adjusted for road width, corner and township where the comparable states them. Fair rate is the weighted mean; the range is the weighted 25th–75th percentile (±15% placeholder under 3 comparables). HIGH needs 5+ comparables, median age ≤ 180 days, dispersion ≤ 20% and at least one transaction; MEDIUM needs 3+, ≤ 365 days, ≤ 35%; everything else is LOW. No accuracy percentage is claimed.</p>
            <p className="mt-3 text-[12.5px] text-slate-500">Disclaimer: EstateIQ is decision support, not a bank valuation, legal opinion or financial advice. Engage a qualified lawyer and registered valuer before paying any token amount.</p>
          </Card>
        </div>
      )}
    </div>
  );
}

function LocationTab({ report }: { report: AnalysisReport }) {
  const { intel, input } = report;
  const g = useMemo(() => byCategory(intel), [intel]);
  const [vis, setVis] = useState<Set<AmenityCategory>>(new Set(CATEGORY_ORDER.filter((c) => c !== 'airport' && c !== 'railway')));
  const ls = locationScore(intel);
  const L = input.location;
  const near = intel?.places.filter((p) => p.distanceKm <= (intel.radiusM / 1000)) ?? [];
  const far = intel?.places.filter((p) => p.distanceKm > (intel.radiusM / 1000)) ?? [];
  return (
    <div className="space-y-5" role="tabpanel">
      {L.lat === null && <Notice tone="warn">No exact location was set, so nearby amenities were not looked up.</Notice>}
      {intel?.errors.map((e) => <Notice key={e} tone="warn">Data gap – {e}</Notice>)}
      <Card eyebrow="Location intelligence" title="Surroundings" right={<span className="chip bg-white/[.06] text-slate-300">{ls.score === null ? 'Score n/a' : `Mapped score ${ls.score}/100`}</span>}>
        <MapView lat={L.lat} lon={L.lon} places={[...near, ...far]} visible={vis} radiusM={intel?.radiusM} height={420} />
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Map layers">
          {CATEGORY_ORDER.map((c) => (
            <button key={c} type="button" aria-pressed={vis.has(c)} onClick={() => { const n = new Set(vis); if (n.has(c)) n.delete(c); else n.add(c); setVis(n); }}
              className={`chip border ${vis.has(c) ? 'border-transparent text-ink-950' : 'border-ink-600 text-slate-400'}`} style={vis.has(c) ? { background: CATEGORY_META[c].color } : undefined}>{CATEGORY_META[c].label} ({g[c].length})</button>))}
        </div>
        <p className="mt-3 text-[12px] text-slate-500">{intel ? `Source: ${intel.source}, retrieved ${fmtDateTime(intel.fetchedAt)}. Community-maintained map data may be incomplete; “none mapped” is not proof that nothing exists.` : 'No amenity data.'}</p>
      </Card>
      {intel && intel.attempted && (
        <Card eyebrow="Distances" title="Nearest mapped features">
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-[13px]"><thead className="text-slate-400"><tr><th className="py-2">Category</th><th>Count</th><th>Nearest</th><th>Distance</th></tr></thead>
            <tbody>{CATEGORY_ORDER.map((c) => (<tr key={c} className="border-t border-ink-600"><td className="py-2.5"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: CATEGORY_META[c].color }} />{CATEGORY_META[c].label}<div className="text-[11px] text-slate-500">{CATEGORY_META[c].radiusNote}</div></td><td>{g[c].length}</td><td>{g[c][0]?.name ?? <span className="text-slate-500">none mapped</span>}</td><td>{g[c][0] ? `${g[c][0].distanceKm.toFixed(2)} km` : '—'}</td></tr>))}</tbody></table></div>
        </Card>
      )}
      <Notice>Flood-prone areas and other geographical risks are <b>not assessed</b>: no reliable open dataset is integrated. “Water bodies” is only a proximity indicator. Check state disaster-management flood maps and the local authority. Nearby development projects shown are only roads/rail tagged as proposed or under construction in OpenStreetMap.</Notice>
    </div>
  );
}

function LegalTab({ report, onChange }: { report: AnalysisReport; onChange: (r: AnalysisReport) => void }) {
  const { input } = report;
  const sum = summariseLegal(input);
  const set = (id: string, s: LegalStatus) => onChange(rebuildReport(report, { ...input, legal: { ...input.legal, [id]: s } }));
  const uploaded = new Set(input.attachments.map((a) => ({ title_deed: 'title', encumbrance: 'ec', layout_approval: 'layout', diversion: 'diversion', tax_receipt: 'tax', rera: 'rera' } as Record<string, string>)[a.category]).filter(Boolean));
  return (
    <div className="space-y-5" role="tabpanel">
      <Notice tone="warn">{STATUS_HELP} Official portals are not integrated – use the “how to verify” hints to check manually. A BUY verdict is withheld until all critical items are marked verified.</Notice>
      <Card eyebrow="Due diligence" title="Legal checklist" right={<span className="chip bg-white/[.06] text-slate-300">{sum.criticalVerified}/{sum.criticalTotal} critical verified</span>}>
        <ul className="divide-y divide-ink-600">
          {itemsFor(input.type).map((i) => {
            const s = legalStatusOf(input, i.id);
            return (
              <li key={i.id} className="grid gap-3 py-4 md:grid-cols-[1fr_260px]" data-testid={`legal-${i.id}`}>
                <div><div className="flex flex-wrap items-center gap-2 text-[14px] font-semibold">{i.title}{i.critical && <span className="chip bg-coral-300/15 text-coral-300">CRITICAL</span>}{uploaded.has(i.id) && <span className="chip bg-white/[.06] text-slate-300">file attached · unverified</span>}</div>
                  <p className="mt-1 text-[12.5px] text-slate-400">{i.why}</p><p className="mt-1 text-[12px] text-slate-500"><b>How to verify:</b> {i.howToVerify}</p></div>
                <div><label className="label" htmlFor={`st-${i.id}`}>Status</label>
                  <select id={`st-${i.id}`} className="input" value={s} onChange={(e) => set(i.id, e.target.value as LegalStatus)}>{(Object.keys(STATUS_LABEL) as LegalStatus[]).map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}</select></div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
