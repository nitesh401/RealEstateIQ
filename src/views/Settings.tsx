import { useState } from 'react';
import type { Assumptions } from '../lib/types';
import { STATE_PRESETS, applyPreset } from '../lib/costs';
import { clearAll } from '../services/storage';
import { searchAddress } from '../services/nominatim';
import { fetchLocationIntel } from '../services/overpass';
import { fetchMarketComparables } from '../services/market';
import { Card, Field, NumInput, Notice, Spinner, Toggle } from '../components/ui';

type Probe = { state: 'idle' | 'running' | 'ok' | 'fail'; msg: string };
const idle: Probe = { state: 'idle', msg: 'Not tested' };

export default function Settings({ a, onChange }: { a: Assumptions; onChange: (a: Assumptions) => void }) {
  const set = (p: Partial<Assumptions>) => onChange({ ...a, ...p });
  const preset = STATE_PRESETS.find((s) => s.code === a.stateCode);
  const [probes, setProbes] = useState<Record<string, Probe>>({ nominatim: idle, overpass: idle, market: idle });
  const setProbe = (k: string, p: Probe) => setProbes((s) => ({ ...s, [k]: p }));

  const test = async () => {
    setProbe('nominatim', { state: 'running', msg: 'Testing…' });
    try { const r = await searchAddress('Super Corridor, Indore'); setProbe('nominatim', { state: 'ok', msg: `OK – ${r.length} result(s); first: ${r[0].lat.toFixed(4)}, ${r[0].lon.toFixed(4)}` }); }
    catch (e) { setProbe('nominatim', { state: 'fail', msg: e instanceof Error ? e.message : 'Failed' }); }
    setProbe('overpass', { state: 'running', msg: 'Testing (can take ~30 s)…' });
    try { const r = await fetchLocationIntel(22.7196, 75.8577, 1000); setProbe('overpass', { state: r.partial ? 'fail' : 'ok', msg: r.partial ? `Partial/failed – ${r.errors.join(' | ')}` : `OK – ${r.places.length} features` }); }
    catch (e) { setProbe('overpass', { state: 'fail', msg: e instanceof Error ? e.message : 'Failed' }); }
    if (a.marketEndpoint.trim()) {
      setProbe('market', { state: 'running', msg: 'Testing…' });
      try { const r = await fetchMarketComparables(a.marketEndpoint.trim(), { lat: 22.7196, lon: 75.8577, type: 'plot', radiusKm: a.maxCompDistanceKm }); setProbe('market', { state: 'ok', msg: `OK – ${r.comparables.length} valid comparable(s) from “${r.sourceName}”` }); }
      catch (e) { setProbe('market', { state: 'fail', msg: e instanceof Error ? e.message : 'Failed' }); }
    } else setProbe('market', { state: 'idle', msg: 'No endpoint configured' });
  };

  const dot = (s: Probe['state']) => (s === 'ok' ? 'bg-mint-300' : s === 'fail' ? 'bg-coral-300' : s === 'running' ? 'bg-gold-400' : 'bg-slate-500');

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 pb-24 pt-8 sm:px-6">
      <div><div className="eyebrow mb-1">Configuration</div><h1 className="font-display text-[28px] font-extrabold">Settings & data sources</h1></div>

      <Card eyebrow="Registration costs" title="Stamp duty & registration assumptions">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="State preset" htmlFor="st"><select id="st" className="input" value={a.stateCode} onChange={(e) => onChange(applyPreset(a, e.target.value))}>{STATE_PRESETS.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select></Field>
          <Field label="Rates as of (date label)" htmlFor="asof"><input id="asof" className="input" placeholder="YYYY-MM" value={a.ratesAsOf} onChange={(e) => set({ ratesAsOf: e.target.value })} /></Field>
          <Field label="Stamp duty (% of duty base)" htmlFor="sd"><NumInput id="sd" value={a.stampDutyPct} step="0.1" onChange={(v) => set({ stampDutyPct: v ?? 0 })} /></Field>
          <Field label="Registration fee (% of duty base)" htmlFor="rf"><NumInput id="rf" value={a.registrationPct} step="0.1" onChange={(v) => set({ registrationPct: v ?? 0 })} /></Field>
          <Field label="Source of these rates" htmlFor="rs"><input id="rs" className="input" value={a.ratesSource} onChange={(e) => set({ ratesSource: e.target.value })} /></Field>
          <div className="flex items-end"><Toggle checked={a.ratesVerified} onChange={(v) => set({ ratesVerified: v })} label="I verified these on the official notification" /></div>
        </div>
        {preset && <p className="mt-3 text-[12.5px] text-slate-400">{preset.note}</p>}
        <div className="mt-5 grid gap-4 sm:grid-cols-4">
          <Field label="Brokerage %" htmlFor="br"><NumInput id="br" value={a.brokeragePct} step="0.1" onChange={(v) => set({ brokeragePct: v ?? 0 })} /></Field>
          <Field label="Legal fee (₹)" htmlFor="lf"><NumInput id="lf" value={a.legalFeeFlat} onChange={(v) => set({ legalFeeFlat: v ?? 0 })} /></Field>
          <Field label="Other costs (₹)" htmlFor="oc"><NumInput id="oc" value={a.otherCostsFlat} onChange={(v) => set({ otherCostsFlat: v ?? 0 })} /></Field>
          <Field label="GST % (under-construction)" htmlFor="gst"><NumInput id="gst" value={a.gstPct} step="0.5" onChange={(v) => set({ gstPct: v ?? 0 })} /></Field>
        </div>
      </Card>

      <Card eyebrow="Valuation model" title="Comparable screening & adjustments">
        <p className="mb-4 text-[12.5px] text-slate-400">These are transparent, editable assumptions – they are not calibrated against market data.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Max evidence age (days)" htmlFor="ma"><NumInput id="ma" value={a.maxCompAgeDays} onChange={(v) => set({ maxCompAgeDays: v ?? 730 })} /></Field>
          <Field label="Max distance (km)" htmlFor="md"><NumInput id="md" value={a.maxCompDistanceKm} step="0.5" onChange={(v) => set({ maxCompDistanceKm: v ?? 5 })} /></Field>
          <Field label="Asking-price haircut %" htmlFor="ad" hint="Applied only to asking-price comparables. Default 0."><NumInput id="ad" value={a.askingDiscountPct} step="0.5" onChange={(v) => set({ askingDiscountPct: v ?? 0 })} /></Field>
          <Field label="Road width adj. % per 10 ft" htmlFor="ra"><NumInput id="ra" value={a.roadAdjPctPer10ft} step="0.5" onChange={(v) => set({ roadAdjPctPer10ft: v ?? 0 })} /></Field>
          <Field label="Corner adj. %" htmlFor="ca"><NumInput id="ca" value={a.cornerAdjPct} step="0.5" onChange={(v) => set({ cornerAdjPct: v ?? 0 })} /></Field>
          <Field label="Township adj. %" htmlFor="ta"><NumInput id="ta" value={a.townshipAdjPct} step="0.5" onChange={(v) => set({ townshipAdjPct: v ?? 0 })} /></Field>
        </div>
      </Card>

      <Card eyebrow="Optional integration" title="Market-data endpoint">
        <Field label="HTTPS endpoint returning comparables" htmlFor="ep" hint="Your own serverless/back-end URL. Never put API keys here – keep them server-side. Leave empty to use only comparables you enter.">
          <input id="ep" data-testid="market-endpoint" className="input" type="url" placeholder="https://your-worker.example.workers.dev/comparables" value={a.marketEndpoint} onChange={(e) => set({ marketEndpoint: e.target.value })} /></Field>
        <p className="mt-2 text-[12px] text-slate-500">Contract: <code>GET ?lat&amp;lon&amp;type&amp;radiusKm</code> → <code>{'{ sourceName, retrievedAt, comparables: [...] }'}</code>. See the README.</p>
      </Card>

      <Card eyebrow="Connectivity" title="Data source status" right={<button className="btn btn-ghost !min-h-[38px] text-[12.5px]" onClick={() => void test()} data-testid="test-sources">Test live connections</button>}>
        <ul className="divide-y divide-ink-600 text-[13px]">
          {([['nominatim', 'OpenStreetMap Nominatim', 'Address search & reverse geocoding'], ['overpass', 'OpenStreetMap Overpass', 'Nearby amenities, roads, rail, airports'], ['market', 'Your market-data endpoint', 'Optional comparables feed']] as const).map(([k, n, d]) => (
            <li key={k} className="flex items-start gap-3 py-3"><span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot(probes[k].state)}`} /><div><div className="font-semibold">{n} <span className="font-normal text-slate-500">· {d}</span></div><div className="text-slate-400">{probes[k].state === 'running' ? <Spinner label={probes[k].msg} /> : probes[k].msg}</div></div></li>
          ))}
          <li className="flex items-start gap-3 py-3"><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-slate-500" /><div><div className="font-semibold">Property portals, SAMPADA, land records, RERA</div><div className="text-slate-400">Not integrated – no permitted public API; check manually.</div></div></li>
        </ul>
        <p className="mt-3 text-[12px] text-slate-500">Tests run from your browser. OpenStreetMap’s public services have fair-use limits (about 1 request/second for Nominatim) and are not for high-volume use.</p>
      </Card>

      <Card eyebrow="Privacy" title="Your data">
        <p className="text-[13px] text-slate-400">Everything is stored in this browser (localStorage). Nothing is sent to an EstateIQ server – there isn’t one. Location lookups go to OpenStreetMap services you can see listed above.</p>
        <button className="btn btn-ghost mt-3 hover:!text-coral-300" onClick={() => { if (confirm('Delete all saved reports, drafts and settings from this browser?')) { clearAll(); location.reload(); } }}>Delete all local data</button>
      </Card>
      <Notice>Vastu content is traditional belief, not science. Valuations are decision support, not certified valuations.</Notice>
    </div>
  );
}
