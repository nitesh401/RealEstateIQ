import { Building2, History, Home, Settings as Cog } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnalysisReport, Assumptions, PropertyInput } from './lib/types';
import { emptyInput } from './lib/analysis';
import { clearDraft, loadAssumptions, loadDraft, loadReports, saveAssumptions, saveDraft, saveReport } from './services/storage';
import { Notice } from './components/ui';
import Landing from './views/Landing';
import Wizard from './views/Wizard';
import Results from './views/Results';
import Reports from './views/Reports';
import Settings from './views/Settings';

type Route = { name: 'home' } | { name: 'analyze' } | { name: 'report'; id: string } | { name: 'reports' } | { name: 'settings' };

/** Hash routing keeps every URL valid under a GitHub Pages sub-path without 404 fallbacks. */
function parseHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, '');
  if (h === 'analyze') return { name: 'analyze' };
  if (h === 'reports') return { name: 'reports' };
  if (h === 'settings') return { name: 'settings' };
  if (h.startsWith('report/')) return { name: 'report', id: decodeURIComponent(h.slice(7)) };
  return { name: 'home' };
}
const go = (path: string) => { window.location.hash = '#/' + path; };

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash);
  const [draft, setDraft] = useState(loadDraft);
  const [assumptions, setAssumptions] = useState<Assumptions>(loadAssumptions);
  const [reports, setReports] = useState<AnalysisReport[]>(loadReports);
  const [saveWarn, setSaveWarn] = useState('');
  const first = useRef(true);

  useEffect(() => { const f = () => setRoute(parseHash()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  useEffect(() => { if (first.current) { first.current = false; return; } if (!saveDraft(draft)) setSaveWarn('Could not save your draft (browser storage is full or blocked).'); }, [draft]);
  useEffect(() => { saveAssumptions(assumptions); }, [assumptions]);
  useEffect(() => { window.scrollTo(0, 0); }, [route.name]);

  const refresh = useCallback(() => setReports(loadReports()), []);
  const update = useCallback((fn: (i: PropertyInput) => PropertyInput) => setDraft((d) => ({ ...d, input: fn(d.input) })), []);
  const setStep = useCallback((step: number) => setDraft((d) => ({ ...d, step })), []);

  const current = route.name === 'report' ? reports.find((r) => r.id === route.id) ?? null : null;
  const persist = (r: AnalysisReport) => { if (!saveReport(r)) setSaveWarn('Report could not be saved to browser storage; download the PDF to keep it.'); refresh(); };

  const nav = [
    { k: 'home', l: 'Home', icon: Home, path: '' }, { k: 'analyze', l: 'Analyse', icon: Building2, path: 'analyze' },
    { k: 'reports', l: 'Reports', icon: History, path: 'reports' }, { k: 'settings', l: 'Settings', icon: Cog, path: 'settings' },
  ] as const;
  const active = route.name === 'report' ? 'reports' : route.name;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/[.07] bg-ink-900/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="#/" className="flex items-center gap-2.5 font-display text-[18px] font-extrabold" aria-label="EstateIQ home">
            <span className="grid h-8 w-8 rotate-45 place-items-center border border-gold-400 text-gold-400"><span className="-rotate-45 text-[15px]">E</span></span>
            <span>estate<span className="text-gold-400">IQ</span></span>
          </a>
          <nav aria-label="Main" className="flex gap-1">
            {nav.map(({ k, l, icon: Icon, path }) => (
              <a key={k} href={`#/${path}`} aria-current={active === k ? 'page' : undefined} className={`flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-[13px] font-semibold transition ${active === k ? 'bg-white/[.08] text-gold-400' : 'text-slate-300 hover:bg-white/[.05]'}`}>
                <Icon size={17} aria-hidden /><span className="hidden sm:inline">{l}</span>
              </a>
            ))}
          </nav>
        </div>
      </header>

      {saveWarn && <div className="mx-auto max-w-5xl px-4 pt-4"><Notice tone="warn">{saveWarn}</Notice></div>}

      <main>
        {route.name === 'home' && <Landing onStart={() => go('analyze')} onReports={() => go('reports')} />}
        {route.name === 'analyze' && (
          <Wizard input={draft.input} step={draft.step} setStep={setStep} update={update} assumptions={assumptions}
            onDone={(r) => { persist(r); go(`report/${r.id}`); }}
            onReset={() => { if (confirm('Clear the current inputs and start over?')) { clearDraft(); setDraft({ input: emptyInput(), step: 0 }); } }} />
        )}
        {route.name === 'report' && (current
          ? <Results report={current} onChange={persist} onNew={() => { clearDraft(); setDraft({ input: emptyInput(), step: 0 }); go('analyze'); }} onEdit={() => { setDraft({ input: current.input, step: 2 }); go('analyze'); }} />
          : <div className="mx-auto max-w-xl px-4 py-24 text-center"><h1 className="font-display text-[24px] font-bold">Report not found</h1><p className="mt-2 text-slate-400">It may have been deleted, or it was saved in a different browser.</p><a className="btn btn-primary mt-6" href="#/reports">Reports history</a></div>)}
        {route.name === 'reports' && <Reports reports={reports} onRefresh={refresh} onOpen={(r) => go(`report/${r.id}`)} onNew={() => go('analyze')} />}
        {route.name === 'settings' && <Settings a={assumptions} onChange={setAssumptions} />}
      </main>

      <footer className="mx-auto max-w-6xl border-t border-white/[.07] px-4 py-8 text-[12px] text-slate-500 sm:px-6">
        <div className="flex flex-wrap justify-between gap-3"><span>ESTATE<span className="text-gold-400">IQ</span> © 2026 · Decision support, not a valuation certificate or legal advice.</span><span>Map data © OpenStreetMap contributors</span></div>
      </footer>
    </div>
  );
}
