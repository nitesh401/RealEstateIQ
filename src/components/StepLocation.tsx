import { LocateFixed, MapPin, Search } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { PropertyInput } from '../lib/types';
import { looksLikeIndia, validCoords } from '../lib/geo';
import { reverseGeocode, searchAddress, type GeoResult } from '../services/nominatim';
import { Card, Field, Notice, Spinner } from './ui';
import MapView from './MapView';

interface Props { input: PropertyInput; update: (fn: (i: PropertyInput) => PropertyInput) => void; errors: Record<string, string> }

export default function StepLocation({ input, update, errors }: Props) {
  const L = input.location;
  const [q, setQ] = useState(L.displayName || '');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: 'ok' | 'err' | 'info'; text: string }>({ tone: 'info', text: 'Search an address or landmark, drop the marker on the map, or enter coordinates.' });
  const [results, setResults] = useState<GeoResult[]>([]);
  const [manualLat, setManualLat] = useState(L.lat?.toString() ?? '');
  const [manualLon, setManualLon] = useState(L.lon?.toString() ?? '');

  const setLoc = useCallback((patch: Partial<PropertyInput['location']>) => update((i) => ({ ...i, location: { ...i.location, ...patch } })), [update]);

  const applyGeo = (g: GeoResult, source: PropertyInput['location']['source']) => {
    update((i) => ({
      ...i,
      location: {
        ...i.location, lat: g.lat, lon: g.lon, displayName: g.displayName, source,
        country: g.address.country || i.location.country, state: g.address.state || i.location.state,
        city: g.address.city || i.location.city, locality: g.address.locality || i.location.locality, pincode: g.address.pincode || i.location.pincode,
      },
    }));
    setManualLat(g.lat.toFixed(6)); setManualLon(g.lon.toFixed(6));
  };

  const doSearch = async () => {
    setBusy(true); setResults([]);
    setStatus({ tone: 'info', text: 'Searching OpenStreetMap…' });
    try {
      const r = await searchAddress(q || [L.project, L.locality, L.city, L.state].filter(Boolean).join(', '));
      setResults(r);
      setStatus({ tone: 'ok', text: `${r.length} match${r.length > 1 ? 'es' : ''} found. Choose the correct one below.` });
    } catch (e) {
      setStatus({ tone: 'err', text: e instanceof Error ? e.message : 'Search failed.' });
    } finally { setBusy(false); }
  };

  const onPick = useCallback(async (lat: number, lon: number) => {
    setLoc({ lat, lon, source: 'marker' });
    setManualLat(lat.toFixed(6)); setManualLon(lon.toFixed(6));
    setStatus({ tone: 'info', text: `Marker set to ${lat.toFixed(5)}, ${lon.toFixed(5)}. Looking up the address…` });
    try {
      const g = await reverseGeocode(lat, lon);
      if (g) {
        update((i) => ({ ...i, location: { ...i.location, lat, lon, displayName: g.displayName, source: 'marker', state: g.address.state || i.location.state, city: g.address.city || i.location.city, locality: g.address.locality || i.location.locality, pincode: g.address.pincode || i.location.pincode } }));
        setQ(g.displayName);
        setStatus({ tone: 'ok', text: 'Location updated from the marker position.' });
      } else setStatus({ tone: 'info', text: 'Coordinates saved. No address was found for this point (reverse geocoding returned nothing).' });
    } catch (e) {
      setStatus({ tone: 'info', text: `Coordinates saved. Address lookup unavailable: ${e instanceof Error ? e.message : 'error'}` });
    }
  }, [setLoc, update]);

  const applyManual = () => {
    const lat = Number(manualLat), lon = Number(manualLon);
    if (manualLat.trim() === '' || manualLon.trim() === '' || !validCoords(lat, lon)) { setStatus({ tone: 'err', text: 'Enter valid coordinates: latitude −90…90 and longitude −180…180.' }); return; }
    if (!looksLikeIndia(lat, lon)) setStatus({ tone: 'info', text: 'These coordinates look outside India. EstateIQ is designed for Indian properties.' });
    else setStatus({ tone: 'ok', text: 'Manual coordinates applied.' });
    setLoc({ lat, lon, source: 'manual' });
  };

  const useDevice = () => {
    if (!('geolocation' in navigator)) { setStatus({ tone: 'err', text: 'This browser does not support device location.' }); return; }
    setStatus({ tone: 'info', text: 'Waiting for your browser’s location permission…' });
    navigator.geolocation.getCurrentPosition(
      (p) => { void onPick(p.coords.latitude, p.coords.longitude).then(() => setLoc({ source: 'device' })); },
      (err) => setStatus({ tone: 'err', text: err.code === err.PERMISSION_DENIED ? 'Location permission was declined. You can still search or place the marker manually.' : 'Could not read your device location. Try searching instead.' }),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  return (
    <div className="space-y-5">
      <Card eyebrow="Step 1" title="Where is the property?">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Country" htmlFor="country"><input id="country" className="input" value={L.country} onChange={(e) => setLoc({ country: e.target.value })} /></Field>
          <Field label="State" htmlFor="state"><input id="state" className="input" value={L.state} onChange={(e) => setLoc({ state: e.target.value })} /></Field>
          <Field label="City *" htmlFor="city" error={errors.city}><input id="city" className="input" aria-invalid={!!errors.city} value={L.city} onChange={(e) => setLoc({ city: e.target.value })} /></Field>
          <Field label="Locality / area" htmlFor="locality"><input id="locality" className="input" placeholder="e.g. Super Corridor" value={L.locality} onChange={(e) => setLoc({ locality: e.target.value })} /></Field>
          <Field label="Street / project / township" htmlFor="project"><input id="project" className="input" value={L.project} onChange={(e) => setLoc({ project: e.target.value })} /></Field>
          <Field label="Pin code" htmlFor="pin"><input id="pin" className="input" inputMode="numeric" maxLength={6} value={L.pincode} onChange={(e) => setLoc({ pincode: e.target.value.replace(/\D/g, '') })} /></Field>
        </div>
      </Card>

      <Card eyebrow="Exact location" title="Find it on the map">
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void doSearch(); }} role="search">
          <div className="relative flex-1">
            <MapPin size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
            <input aria-label="Search address or landmark" data-testid="addr-search" className="input !pl-10" placeholder="Search address, locality or landmark (e.g. Super Corridor, Indore)" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy} data-testid="addr-search-btn">{busy ? <Spinner /> : <><Search size={16} /> Search</>}</button>
          <button type="button" className="btn btn-ghost" onClick={useDevice}><LocateFixed size={16} /> Use my device location</button>
        </form>
        <p className="mt-2 text-[11.5px] text-slate-500">Search runs when you press Search (OpenStreetMap’s public service does not permit type-ahead). Your device location is never read unless you press the button and grant permission.</p>

        <div aria-live="polite" data-testid="geo-status" className={`mt-3 text-[13px] ${status.tone === 'err' ? 'text-coral-300' : status.tone === 'ok' ? 'text-mint-300' : 'text-slate-400'}`}>{status.text}</div>

        {results.length > 0 && (
          <ul className="mt-3 max-h-64 divide-y divide-ink-600 overflow-auto rounded-xl border border-ink-600" data-testid="geo-results">
            {results.map((r, i) => (
              <li key={`${r.lat}-${r.lon}-${i}`}>
                <button type="button" className="w-full px-4 py-3 text-left text-[13px] text-slate-200 hover:bg-white/[.05]" onClick={() => { applyGeo(r, 'search'); setQ(r.displayName); setResults([]); setStatus({ tone: 'ok', text: 'Location selected. Fine-tune it by dragging the marker.' }); }}>
                  {r.displayName}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4"><MapView lat={L.lat} lon={L.lon} onPick={onPick} height={340} label="Property location (drag to adjust)" /></div>
        <p className="mt-2 text-[11.5px] text-slate-500">Click the map or drag the marker to adjust. Keyboard: focus the marker and use arrow keys, then edit the coordinates below.</p>

        <div className="mt-4 grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Field label="Latitude" htmlFor="lat"><input id="lat" data-testid="lat" className="input" inputMode="decimal" value={manualLat} onChange={(e) => setManualLat(e.target.value)} /></Field>
          <Field label="Longitude" htmlFor="lon"><input id="lon" data-testid="lon" className="input" inputMode="decimal" value={manualLon} onChange={(e) => setManualLon(e.target.value)} /></Field>
          <button type="button" className="btn btn-ghost" onClick={applyManual} data-testid="apply-coords">Apply coordinates</button>
        </div>

        {L.lat !== null && L.lon !== null ? (
          <div className="mt-4 rounded-xl border border-white/[.07] bg-white/[.03] p-4 text-[13px]" data-testid="selected-location">
            <div className="eyebrow !text-slate-400">Selected property location</div>
            <div className="mt-1 text-slate-100">{L.displayName || 'Coordinates only (no address resolved)'}</div>
            <div className="mt-1 font-mono text-[12px] text-teal-300">{L.lat.toFixed(6)}, {L.lon.toFixed(6)} · set by: {L.source}</div>
          </div>
        ) : (
          <div className="mt-4"><Notice tone="warn">No exact location selected yet. Without coordinates, nearby-amenity analysis and the map in the report are skipped.</Notice></div>
        )}
      </Card>
    </div>
  );
}
