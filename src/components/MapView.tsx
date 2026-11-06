import L from 'leaflet';
import { useEffect, useRef } from 'react';
import type { AmenityCategory, Place } from '../lib/types';
import { CATEGORY_META } from '../lib/location';

const INDIA_CENTER: [number, number] = [22.7196, 75.8577];

interface Props {
  lat: number | null;
  lon: number | null;
  onPick?: (lat: number, lon: number) => void;
  places?: Place[];
  visible?: Set<AmenityCategory>;
  height?: number;
  radiusM?: number;
  label?: string;
}

export default function MapView({ lat, lon, onPick, places = [], visible, height = 360, radiusM, label }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const circle = useRef<L.Circle | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { scrollWheelZoom: false, zoomControl: true }).setView(lat !== null && lon !== null ? [lat, lon] : INDIA_CENTER, lat !== null ? 15 : 11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    if (onPick) m.on('click', (e: L.LeafletMouseEvent) => pickRef.current?.(e.latlng.lat, e.latlng.lng));
    map.current = m;
    setTimeout(() => m.invalidateSize(), 200);
    return () => { m.remove(); map.current = null; marker.current = null; layer.current = null; circle.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // subject marker
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (lat === null || lon === null) { marker.current?.remove(); marker.current = null; return; }
    const ll: L.LatLngExpression = [lat, lon];
    if (!marker.current) {
      const icon = L.divIcon({ className: '', html: '<div class="eiq-pin"></div>', iconSize: [26, 26], iconAnchor: [13, 26] });
      marker.current = L.marker(ll, { icon, draggable: !!onPick, keyboard: true, title: label ?? 'Property location' }).addTo(m);
      marker.current.on('dragend', () => { const p = marker.current!.getLatLng(); pickRef.current?.(p.lat, p.lng); });
      m.setView(ll, Math.max(m.getZoom(), 15));
    } else {
      marker.current.setLatLng(ll);
      if (!m.getBounds().contains(ll)) m.panTo(ll);
    }
  }, [lat, lon, onPick, label]);

  // radius circle
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    circle.current?.remove(); circle.current = null;
    if (lat !== null && lon !== null && radiusM) circle.current = L.circle([lat, lon], { radius: radiusM, color: '#e8bd75', weight: 1, fillOpacity: 0.04, dashArray: '4 6' }).addTo(m);
  }, [lat, lon, radiusM]);

  // amenities
  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    for (const p of places) {
      if (visible && !visible.has(p.category)) continue;
      const meta = CATEGORY_META[p.category];
      const icon = L.divIcon({ className: '', html: `<div class="eiq-dot" style="background:${meta.color}"></div>`, iconSize: [14, 14], iconAnchor: [7, 7] });
      const mk = L.marker([p.lat, p.lon], { icon, title: p.name });
      const pop = document.createElement('div');
      const b = document.createElement('b'); b.textContent = p.name; pop.appendChild(b);
      const s = document.createElement('div'); s.textContent = `${meta.label} · ${p.distanceKm.toFixed(2)} km`; s.style.cssText = 'font-size:12px;color:#91a0b5'; pop.appendChild(s);
      mk.bindPopup(pop);
      mk.addTo(g);
    }
  }, [places, visible]);

  return <div ref={el} style={{ height }} className="w-full overflow-hidden rounded-2xl border border-ink-600" role="application" aria-label={onPick ? 'Interactive map. Click to move the property marker.' : 'Location map with nearby places'} data-testid="map" />;
}
