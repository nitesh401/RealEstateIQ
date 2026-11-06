import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AnalysisReport, Assumptions, PropertyInput } from '../lib/types';
import { validateForAnalysis } from '../lib/analysis';
import { runAnalysis } from '../services/runAnalysis';
import StepLocation from '../components/StepLocation';
import StepProperty, { syncPricingArea } from '../components/StepProperty';
import StepVastu from '../components/StepVastu';
import StepExtra from '../components/StepExtra';
import { Notice, Skeleton, Spinner } from '../components/ui';

const STEPS = ['Location', 'Property type', 'Property details', 'Vastu', 'Deal & evidence'];

interface Props {
  input: PropertyInput;
  step: number;
  setStep: (n: number) => void;
  update: (fn: (i: PropertyInput) => PropertyInput) => void;
  assumptions: Assumptions;
  onDone: (r: AnalysisReport) => void;
  onReset: () => void;
}

export default function Wizard({ input, step, setStep, update, assumptions, onDone, onReset }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [fatal, setFatal] = useState('');

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [step]);

  const upd = (fn: (i: PropertyInput) => PropertyInput) => update((i) => syncPricingArea(fn(i)));

  const validate = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 0 && !input.location.city.trim()) e.city = 'City is required.';
    if (s === 2) for (const v of validateForAnalysis(input)) if (v.field !== 'city') e[v.field] = v.message;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate(step)) setStep(Math.min(STEPS.length - 1, step + 1)); };

  const run = async () => {
    const all = validateForAnalysis(input);
    if (all.length) { setErrors(Object.fromEntries(all.map((v) => [v.field, v.message]))); setStep(all.some((v) => v.field === 'city') ? 0 : 2); return; }
    setRunning(true); setFatal('');
    try {
      const rep = await runAnalysis(input, assumptions, setProgress);
      onDone(rep);
    } catch (e) {
      setFatal(e instanceof Error ? e.message : 'Analysis failed unexpectedly.');
    } finally { setRunning(false); }
  };

  if (running) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-16" role="status" aria-live="polite" data-testid="analysis-loading">
        <Spinner label={progress || 'Analysing…'} />
        <Skeleton className="h-28" /><div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div><Skeleton className="h-64" />
        <p className="text-[12.5px] text-slate-500">Querying OpenStreetMap services (they can take up to ~30 s and may be rate-limited). If a service is down, the analysis continues and labels what is missing.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div><div className="eyebrow mb-1">Property assessment</div><h1 className="font-display text-[26px] font-extrabold sm:text-[32px]">Analyse a property</h1></div>
        <button type="button" className="btn btn-ghost !min-h-[38px] text-[12.5px]" onClick={onReset}>Start over</button>
      </div>

      <ol className="mb-8 grid grid-cols-5 gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={() => (i <= step || validate(step)) && setStep(i)} aria-current={i === step ? 'step' : undefined} className="w-full text-left">
              <div className={`h-1.5 rounded-full transition-all duration-500 ${i < step ? 'bg-gold-400' : i === step ? 'bg-gold-400/70' : 'bg-ink-600'}`} />
              <div className={`mt-2 flex items-center gap-1.5 text-[11.5px] font-medium sm:text-[12.5px] ${i === step ? 'text-gold-400' : 'text-slate-500'}`}>
                {i < step ? <Check size={13} aria-hidden /> : <span className="font-mono">{i + 1}</span>}<span className="hidden sm:inline">{s}</span><span className="sm:hidden">{s.split(' ').pop()}</span>
              </div>
            </button>
          </li>
        ))}
      </ol>

      {fatal && <div className="mb-4"><Notice tone="warn">Analysis could not be completed: {fatal}</Notice></div>}

      {step === 0 && <StepLocation input={input} update={upd} errors={errors} />}
      {step === 1 && <StepProperty part="type" input={input} update={upd} errors={errors} />}
      {step === 2 && <StepProperty part="details" input={input} update={upd} errors={errors} />}
      {step === 3 && <StepVastu input={input} update={upd} />}
      {step === 4 && <StepExtra input={input} update={upd} />}

      <div className="sticky bottom-0 -mx-4 mt-8 flex items-center justify-between gap-3 border-t border-ink-600 bg-ink-900/90 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <button type="button" className="btn btn-ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}><ArrowLeft size={16} /> Back</button>
        <div className="flex items-center gap-3">
          {step >= 3 && step < STEPS.length - 1 && <button type="button" className="btn btn-ghost" onClick={() => setStep(step + 1)}>Skip</button>}
          {step < STEPS.length - 1
            ? <button type="button" className="btn btn-primary" onClick={next} data-testid="next">Continue <ArrowRight size={16} /></button>
            : <button type="button" className="btn btn-primary" onClick={() => void run()} data-testid="run-analysis"><Sparkles size={16} /> Run analysis</button>}
        </div>
      </div>
    </div>
  );
}
