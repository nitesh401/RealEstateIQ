import { Building2, Home, LandPlot, Store } from 'lucide-react';
import type { Direction, PropertyInput, PropertyType } from '../lib/types';
import { DIR_LABEL, TYPE_LABEL, fmtINR, fmtNum, fmtWords } from '../lib/format';
import { resolveAsking } from '../lib/valuation';
import Attachments from './Attachments';
import { Card, Field, NumInput, Toggle } from './ui';

interface Props { input: PropertyInput; update: (fn: (i: PropertyInput) => PropertyInput) => void; errors: Record<string, string>; part: 'type' | 'details' }

export const DIRS: Direction[] = ['unknown', 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const DirSelect = ({ id, value, onChange }: { id?: string; value: Direction; onChange: (d: Direction) => void }) => (
  <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value as Direction)}>
    {DIRS.map((d) => <option key={d} value={d}>{DIR_LABEL[d]}</option>)}
  </select>
);

const TYPES: { v: PropertyType; icon: typeof Home }[] = [
  { v: 'plot', icon: LandPlot }, { v: 'house', icon: Home }, { v: 'apartment', icon: Building2 }, { v: 'commercial', icon: Store },
];

export const BASIS: Record<PropertyType, string[]> = {
  plot: ['Plot area'], house: ['Land area', 'Built-up area'], apartment: ['Carpet area', 'Built-up area', 'Super built-up area'], commercial: ['Commercial area'],
};

/** Keep the pricing area consistent with the chosen basis for apartments/houses. */
export function syncPricingArea(i: PropertyInput): PropertyInput {
  let area = i.pricingArea;
  if (i.type === 'apartment') {
    area = i.pricingAreaBasis === 'Carpet area' ? i.carpetArea : i.pricingAreaBasis === 'Built-up area' ? i.builtUpArea : i.superBuiltUpArea;
  } else if (i.type === 'house') {
    area = i.pricingAreaBasis === 'Built-up area' ? i.builtUpArea : i.landArea;
  }
  return area === i.pricingArea ? i : { ...i, pricingArea: area };
}

export default function StepProperty({ input: p, update, errors, part }: Props) {
  const set = (patch: Partial<PropertyInput>) => update((i) => ({ ...i, ...patch }));
  const setType = (t: PropertyType) => update((i) => ({ ...i, type: t, pricingAreaBasis: BASIS[t][0], comparables: i.comparables.filter((c) => c.isDemo ? false : true) }));
  const ask = resolveAsking(p.pricingArea, p.askingRate, p.askingTotal);

  return (
    <div className="space-y-5">
      {part === 'type' && <Card eyebrow="Step 2" title="What type of property is it?">
        <div role="radiogroup" aria-label="Property type" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {TYPES.map(({ v, icon: Icon }) => (
            <button key={v} type="button" role="radio" aria-checked={p.type === v} data-testid={`type-${v}`} onClick={() => setType(v)}
              className={`flex min-h-[92px] flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all ${p.type === v ? 'border-gold-400 bg-gold-400/10 text-gold-400' : 'border-ink-600 text-slate-300 hover:border-slate-400'}`}>
              <Icon size={22} aria-hidden /><span className="text-[14px] font-semibold">{TYPE_LABEL[v]}</span>
            </button>
          ))}
        </div>
      </Card>}

      {part === 'details' && <><Card eyebrow="Step 3" title={`${TYPE_LABEL[p.type]} details`}>
        <div className="grid gap-4 sm:grid-cols-2">
          {p.type === 'plot' && (<>
            <Field label="Total area (sqft) *" htmlFor="area" error={errors.pricingArea}><NumInput id="area" value={p.pricingArea} onChange={(v) => set({ pricingArea: v })} invalid={!!errors.pricingArea} placeholder="e.g. 1500" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Length (ft)" htmlFor="pl"><NumInput id="pl" value={p.plotLength} onChange={(v) => set({ plotLength: v })} /></Field>
              <Field label="Width (ft)" htmlFor="pw"><NumInput id="pw" value={p.plotWidth} onChange={(v) => set({ plotWidth: v })} /></Field>
              {p.plotLength && p.plotWidth && p.pricingArea !== p.plotLength * p.plotWidth ? (
                <button type="button" className="btn btn-ghost col-span-2 !min-h-[38px] !py-1.5 text-[12px]" onClick={() => set({ pricingArea: Math.round(p.plotLength! * p.plotWidth! * 100) / 100 })}>Use {fmtNum(p.plotLength * p.plotWidth)} sqft from dimensions</button>
              ) : null}
            </div>
            <Field label="Road width (ft)" htmlFor="road"><NumInput id="road" value={p.roadWidthFt} onChange={(v) => set({ roadWidthFt: v })} placeholder="e.g. 30" /></Field>
            <Field label="Road type" htmlFor="roadtype"><select id="roadtype" className="input" value={p.roadType} onChange={(e) => set({ roadType: e.target.value as PropertyInput['roadType'] })}><option value="unknown">Not sure</option><option value="main">Main road</option><option value="internal">Internal road</option></select></Field>
            <Field label="Facing direction" htmlFor="facing"><DirSelect id="facing" value={p.facing} onChange={(d) => set({ facing: d })} /></Field>
            <Field label="Plot number" htmlFor="plotno"><input id="plotno" className="input" value={p.plotNumber} onChange={(e) => set({ plotNumber: e.target.value })} /></Field>
            <Field label="Approved layout?" htmlFor="appr"><select id="appr" className="input" value={p.approvedLayout} onChange={(e) => set({ approvedLayout: e.target.value as PropertyInput['approvedLayout'] })}><option value="unknown">Not verified</option><option value="yes">Yes – approved layout</option><option value="no">No / disputed</option></select></Field>
            <div className="space-y-1"><Toggle checked={p.corner} onChange={(v) => set({ corner: v })} label="Corner plot" /><Toggle checked={p.township} onChange={(v) => set({ township: v })} label="Township / gated community" /></div>
          </>)}

          {p.type === 'apartment' && (<>
            <Field label="Carpet area (sqft)" htmlFor="carp"><NumInput id="carp" value={p.carpetArea} onChange={(v) => update((i) => syncPricingArea({ ...i, carpetArea: v }))} /></Field>
            <Field label="Built-up area (sqft)" htmlFor="bua"><NumInput id="bua" value={p.builtUpArea} onChange={(v) => update((i) => syncPricingArea({ ...i, builtUpArea: v }))} /></Field>
            <Field label="Super built-up area (sqft)" htmlFor="sba"><NumInput id="sba" value={p.superBuiltUpArea} onChange={(v) => update((i) => syncPricingArea({ ...i, superBuiltUpArea: v }))} /></Field>
            <Field label="Price is quoted on *" htmlFor="basis" error={errors.pricingArea} hint="The area the seller’s per-sqft rate applies to."><select id="basis" className="input" value={p.pricingAreaBasis} onChange={(e) => update((i) => syncPricingArea({ ...i, pricingAreaBasis: e.target.value }))}>{BASIS.apartment.map((b) => <option key={b}>{b}</option>)}</select></Field>
            <Field label="Floor" htmlFor="floor"><NumInput id="floor" value={p.floor} onChange={(v) => set({ floor: v })} /></Field>
            <Field label="Total floors" htmlFor="tfl"><NumInput id="tfl" value={p.totalFloors} onChange={(v) => set({ totalFloors: v })} /></Field>
            <Field label="Bedrooms" htmlFor="bed"><NumInput id="bed" value={p.bedrooms} onChange={(v) => set({ bedrooms: v })} /></Field>
            <Field label="Property age (years)" htmlFor="age"><NumInput id="age" value={p.ageYears} onChange={(v) => set({ ageYears: v })} /></Field>
            <Field label="Maintenance (₹/month)" htmlFor="maint"><NumInput id="maint" value={p.maintenanceMonthly} onChange={(v) => set({ maintenanceMonthly: v })} /></Field>
            <Field label="Amenities" htmlFor="amen"><input id="amen" className="input" placeholder="Gym, pool, security…" value={p.amenities} onChange={(e) => set({ amenities: e.target.value })} /></Field>
            <div><Toggle checked={p.parking} onChange={(v) => set({ parking: v })} label="Parking" /><Toggle checked={p.lift} onChange={(v) => set({ lift: v })} label="Lift" /></div>
          </>)}

          {p.type === 'house' && (<>
            <Field label="Land area (sqft)" htmlFor="land"><NumInput id="land" value={p.landArea} onChange={(v) => update((i) => syncPricingArea({ ...i, landArea: v }))} /></Field>
            <Field label="Built-up area (sqft)" htmlFor="hbua"><NumInput id="hbua" value={p.builtUpArea} onChange={(v) => update((i) => syncPricingArea({ ...i, builtUpArea: v }))} /></Field>
            <Field label="Price is quoted on *" htmlFor="hbasis" error={errors.pricingArea}><select id="hbasis" className="input" value={p.pricingAreaBasis} onChange={(e) => update((i) => syncPricingArea({ ...i, pricingAreaBasis: e.target.value }))}>{BASIS.house.map((b) => <option key={b}>{b}</option>)}</select></Field>
            <Field label="Number of floors" htmlFor="hfl"><NumInput id="hfl" value={p.houseFloors} onChange={(v) => set({ houseFloors: v })} /></Field>
            <Field label="Construction age (years)" htmlFor="hage"><NumInput id="hage" value={p.ageYears} onChange={(v) => set({ ageYears: v })} /></Field>
            <Field label="Construction quality" htmlFor="hq"><select id="hq" className="input" value={p.constructionQuality} onChange={(e) => set({ constructionQuality: e.target.value as PropertyInput['constructionQuality'] })}><option value="unknown">Not assessed</option><option value="basic">Basic</option><option value="standard">Standard</option><option value="premium">Premium</option></select></Field>
            <Field label="Bedrooms" htmlFor="hbed"><NumInput id="hbed" value={p.bedrooms} onChange={(v) => set({ bedrooms: v })} /></Field>
            <Field label="Facing direction" htmlFor="hfacing"><DirSelect id="hfacing" value={p.facing} onChange={(d) => set({ facing: d })} /></Field>
            <Field label="Road width (ft)" htmlFor="hroad"><NumInput id="hroad" value={p.roadWidthFt} onChange={(v) => set({ roadWidthFt: v })} /></Field>
            <Field label="Approved layout?" htmlFor="happr"><select id="happr" className="input" value={p.approvedLayout} onChange={(e) => set({ approvedLayout: e.target.value as PropertyInput['approvedLayout'] })}><option value="unknown">Not verified</option><option value="yes">Yes</option><option value="no">No / disputed</option></select></Field>
            <div><Toggle checked={p.parking} onChange={(v) => set({ parking: v })} label="Parking" /><Toggle checked={p.corner} onChange={(v) => set({ corner: v })} label="Corner property" /><Toggle checked={p.township} onChange={(v) => set({ township: v })} label="Township / gated" /></div>
          </>)}

          {p.type === 'commercial' && (<>
            <Field label="Commercial area (sqft) *" htmlFor="carea" error={errors.pricingArea}><NumInput id="carea" value={p.pricingArea} onChange={(v) => set({ pricingArea: v })} invalid={!!errors.pricingArea} /></Field>
            <Field label="Built-up area (sqft)" htmlFor="cbua"><NumInput id="cbua" value={p.builtUpArea} onChange={(v) => set({ builtUpArea: v })} /></Field>
            <Field label="Floor" htmlFor="cfl"><NumInput id="cfl" value={p.floor} onChange={(v) => set({ floor: v })} /></Field>
            <Field label="Road frontage (ft)" htmlFor="cfront"><NumInput id="cfront" value={p.frontageFt} onChange={(v) => set({ frontageFt: v })} /></Field>
            <Field label="Road width (ft)" htmlFor="croad"><NumInput id="croad" value={p.roadWidthFt} onChange={(v) => set({ roadWidthFt: v })} /></Field>
            <Field label="Property usage" htmlFor="cuse"><input id="cuse" className="input" placeholder="Shop, office, showroom…" value={p.usage} onChange={(e) => set({ usage: e.target.value })} /></Field>
            <Field label="Expected rent (₹/month)" htmlFor="crent"><NumInput id="crent" value={p.rentalMonthly} onChange={(v) => set({ rentalMonthly: v })} /></Field>
            <Field label="Property age (years)" htmlFor="cage"><NumInput id="cage" value={p.ageYears} onChange={(v) => set({ ageYears: v })} /></Field>
            <Field label="Facing direction" htmlFor="cface"><DirSelect id="cface" value={p.facing} onChange={(d) => set({ facing: d })} /></Field>
            <div><Toggle checked={p.parking} onChange={(v) => set({ parking: v })} label="Parking" /><Toggle checked={p.corner} onChange={(v) => set({ corner: v })} label="Corner property" /></div>
          </>)}
        </div>

        <div className="mt-6 rounded-2xl border border-white/[.08] bg-ink-950/40 p-4 sm:p-5">
          <div className="eyebrow mb-3">Seller’s price</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Asking rate (₹ per sqft) *" htmlFor="rate" error={errors.askingRate}><NumInput id="rate" value={p.askingRate} onChange={(v) => set({ askingRate: v })} invalid={!!errors.askingRate} placeholder="e.g. 4500" /></Field>
            <Field label="…or total asking price (₹)" htmlFor="total" hint="Used only if no per-sqft rate is entered."><NumInput id="total" value={p.askingTotal} onChange={(v) => set({ askingTotal: v })} /></Field>
          </div>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1" aria-live="polite" data-testid="base-price">
            <span className="text-[12px] text-slate-400">Base price (excludes stamp duty & registration)</span>
            <span className="font-display text-[24px] font-extrabold text-gold-400" data-testid="base-price-value">{ask.derivedFrom === 'invalid' ? '—' : fmtINR(ask.total)}</span>
            {ask.derivedFrom !== 'invalid' && <span className="text-[12px] text-slate-400">{fmtWords(ask.total)} · {fmtNum(ask.area)} sqft × {fmtINR(ask.rate)}/sqft</span>}
          </div>
        </div>
      </Card>

      <Card eyebrow="Optional" title="Photographs, floor plans, site plans & documents">
        <Attachments items={p.attachments} onChange={(a) => set({ attachments: a })} />
      </Card></>}
    </div>
  );
}
