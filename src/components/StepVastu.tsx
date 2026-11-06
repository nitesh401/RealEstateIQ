import { Compass } from 'lucide-react';
import { useState } from 'react';
import type { PropertyInput } from '../lib/types';
import { bearingToDirection } from '../lib/geo';
import { DIR_LABEL } from '../lib/format';
import { VASTU_DISCLAIMER } from '../lib/vastu';
import Attachments from './Attachments';
import { DirSelect } from './StepProperty';
import { Card, Field, Notice } from './ui';

interface Props { input: PropertyInput; update: (fn: (i: PropertyInput) => PropertyInput) => void }

export default function StepVastu({ input: p, update }: Props) {
  const set = (patch: Partial<PropertyInput>) => update((i) => ({ ...i, ...patch }));
  const [bearing, setBearing] = useState('');
  const b = Number(bearing);
  const derived = bearing !== '' && Number.isFinite(b) ? bearingToDirection(b) : null;
  const setZone = (k: keyof PropertyInput['zones'], d: PropertyInput['zones']['kitchen']) => update((i) => ({ ...i, zones: { ...i.zones, [k]: d } }));

  return (
    <div className="space-y-5">
      <Notice>{VASTU_DISCLAIMER}</Notice>
      <Card eyebrow="Step 4" title="Orientation details" right={<Compass className="text-gold-400" aria-hidden />}>
        <p className="mb-4 text-[13px] text-slate-400">These three directions are different things and are assessed separately: <b>plot facing</b> (the side facing the main road/front), the <b>main entrance</b> (where the door/gate is) and the <b>road direction</b> (which side the road is on). Every field is optional – skip what you do not know.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Property / plot facing" htmlFor="v-facing"><DirSelect id="v-facing" value={p.facing} onChange={(d) => set({ facing: d })} /></Field>
          <Field label="Main entrance direction" htmlFor="v-ent"><DirSelect id="v-ent" value={p.entrance} onChange={(d) => set({ entrance: d })} /></Field>
          <Field label="Road direction (side the road is on)" htmlFor="v-road"><DirSelect id="v-road" value={p.roadDirection} onChange={(d) => set({ roadDirection: d })} /></Field>
          <Field label="Plot shape" htmlFor="v-shape"><select id="v-shape" className="input" value={p.plotShape} onChange={(e) => set({ plotShape: e.target.value as PropertyInput['plotShape'] })}>
            <option value="unknown">Not sure</option><option value="square">Square</option><option value="rectangle">Rectangular</option><option value="irregular">Irregular</option><option value="l_shaped">L-shaped</option><option value="triangular">Triangular</option></select></Field>
          <Field label="How was north determined?" htmlFor="v-north"><select id="v-north" className="input" value={p.northReference} onChange={(e) => set({ northReference: e.target.value as PropertyInput['northReference'] })}>
            <option value="unknown">Not determined</option><option value="compass">Compass on site</option><option value="map">Map (north-up)</option><option value="surveyor">Surveyor / site plan</option></select></Field>
          <div className="flex items-end"><p className="text-[12px] text-slate-500">Corner status comes from step 3 ({p.corner ? 'corner property' : 'not a corner property'}).</p></div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/[.08] bg-ink-950/40 p-4">
          <div className="eyebrow mb-2">Compass helper</div>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Compass bearing the front of the plot faces (0–360°)" htmlFor="bearing" hint="Stand at the front gate facing outward toward the road and read a compass (or a phone compass).">
              <input id="bearing" className="input !w-44" inputMode="decimal" value={bearing} onChange={(e) => setBearing(e.target.value)} placeholder="e.g. 45" />
            </Field>
            <button type="button" className="btn btn-ghost" disabled={!derived} onClick={() => derived && set({ facing: derived })}>{derived ? `Set facing = ${DIR_LABEL[derived]}` : 'Enter a bearing'}</button>
          </div>
          <p className="mt-2 text-[11.5px] text-slate-500">Phone compasses show magnetic north; true north differs by a small local declination. The helper rounds to the nearest of 8 directions.</p>
        </div>
      </Card>

      <Card eyebrow="Optional" title="Floor-plan zones">
        <p className="mb-4 text-[13px] text-slate-400">EstateIQ does not read floor-plan images automatically. If you have a plan, tell us which zone of the house each room is in and it is included in the Vastu score.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kitchen zone" htmlFor="z-k"><DirSelect id="z-k" value={p.zones.kitchen} onChange={(d) => setZone('kitchen', d)} /></Field>
          <Field label="Master bedroom zone" htmlFor="z-m"><DirSelect id="z-m" value={p.zones.masterBedroom} onChange={(d) => setZone('masterBedroom', d)} /></Field>
          <Field label="Pooja / prayer room zone" htmlFor="z-p"><DirSelect id="z-p" value={p.zones.pooja} onChange={(d) => setZone('pooja', d)} /></Field>
          <Field label="Toilet zone" htmlFor="z-t"><DirSelect id="z-t" value={p.zones.toilet} onChange={(d) => setZone('toilet', d)} /></Field>
        </div>
        <div className="mt-5"><div className="label">Floor plan upload (optional, for your records)</div>
          <Attachments items={p.attachments} onChange={(a) => set({ attachments: a })} only={['floor_plan', 'site_plan']} /></div>
      </Card>
    </div>
  );
}
