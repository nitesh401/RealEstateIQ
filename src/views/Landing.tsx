import { motion } from 'framer-motion';
import { ArrowRight, Compass, FileText, MapPinned, Scale, ShieldCheck } from 'lucide-react';

const features = [
  { icon: MapPinned, t: 'Location intelligence', d: 'Map-based context from OpenStreetMap: schools, hospitals, transport, highways, rail and airports – with distances. Gaps are shown, never invented.' },
  { icon: Scale, t: 'Transparent valuation', d: 'A weighted comparable method that never mixes plots with flats, or asking prices with registered sales. Thin evidence lowers confidence.' },
  { icon: Compass, t: 'Vastu, kept honest', d: 'Facing, entrance and road direction are assessed separately – clearly labelled as traditional belief, not science.' },
  { icon: ShieldCheck, t: 'Legal due-diligence', d: 'A Madhya Pradesh–oriented checklist. A document being uploaded is never treated as legally verified.' },
  { icon: FileText, t: 'Professional PDF report', d: 'Nineteen-section property intelligence report with sources, timestamps, confidence and methodology.' },
];

function Cube() {
  const s = 110;
  const faces: { t: string }[] = [
    { t: `translateZ(${s / 2}px)` }, { t: `rotateY(180deg) translateZ(${s / 2}px)` }, { t: `rotateY(90deg) translateZ(${s / 2}px)` },
    { t: `rotateY(-90deg) translateZ(${s / 2}px)` }, { t: `rotateX(90deg) translateZ(${s / 2}px)` },
  ];
  return (
    <div className="scene" aria-hidden>
      <div className="cube">
        <div className="plot" />
        <div className="bx" style={{ width: s, height: s, marginLeft: -s / 2, marginTop: -s / 2 - 10, transformStyle: 'preserve-3d' }}>
          {faces.map((f, i) => <div key={i} className="face" style={{ width: s, height: s, transform: f.t }} />)}
        </div>
      </div>
    </div>
  );
}

export default function Landing({ onStart, onReports }: { onStart: () => void; onReports: () => void }) {
  return (
    <div>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.1fr_.9fr] lg:pt-24">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="eyebrow mb-4">Real estate, with clarity · India edition</div>
          <h1 className="font-display text-[42px] font-extrabold leading-[1.02] tracking-tight sm:text-[64px]">Know the value.<br /><span className="text-gold-400">Before you buy.</span></h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-slate-300">Enter a property’s location and details. EstateIQ tests the asking price against comparable evidence, maps the surroundings, checks Vastu orientation, lists legal checks and produces a professional report – and tells you plainly what it could not verify.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button className="btn btn-primary !px-6" onClick={onStart} data-testid="start">Analyse a property <ArrowRight size={16} /></button>
            <button className="btn btn-ghost" onClick={onReports}>Reports history</button>
          </div>
          <dl className="mt-10 grid max-w-lg grid-cols-4 gap-4 font-mono text-[11px] text-slate-400">
            {['LOCATION', 'VALUATION', 'VASTU', 'LEGAL'].map((t, i) => (<div key={t}><dt className="text-[20px] font-bold text-gold-400">0{i + 1}</dt><dd>{t}</dd></div>))}
          </dl>
        </motion.div>
        <motion.div className="glass relative flex min-h-[340px] items-center justify-center overflow-hidden p-6" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.15 }}>
          <Cube />
          <div className="absolute left-4 top-4 rounded-xl border border-white/10 bg-ink-900/80 px-3 py-2 text-[11px]"><div className="font-mono text-slate-400">PRICE ENGINE</div><div className="font-semibold text-gold-400">Fair value range</div></div>
          <div className="absolute bottom-4 right-4 rounded-xl border border-white/10 bg-ink-900/80 px-3 py-2 text-[11px]"><div className="font-mono text-slate-400">CONFIDENCE</div><div className="font-semibold text-mint-300">HIGH · MEDIUM · LOW</div></div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="eyebrow mb-3">Transparent by design</div>
        <h2 className="mb-8 font-display text-[28px] font-extrabold sm:text-[36px]">Numbers you can <span className="text-gold-400">interrogate.</span></h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, t, d }, i) => (
            <motion.article key={t} className="glass p-6" initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
              <Icon className="mb-3 text-gold-400" size={22} aria-hidden /><h3 className="font-display text-[16px] font-bold">{t}</h3><p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-400">{d}</p>
            </motion.article>
          ))}
          <article className="glass border-gold-400/30 p-6"><div className="eyebrow mb-2">What it won’t do</div><p className="text-[13.5px] leading-relaxed text-slate-300">It does not scrape property portals, invent comparables or claim verified accuracy. With thin data it says so, lowers confidence and withholds a BUY verdict.</p></article>
        </div>
      </section>
    </div>
  );
}
