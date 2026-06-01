import { useEffect, useMemo, useRef, useState } from 'react';
import type { ParseResult } from './types';
import { Nav } from './components/Nav';
import { FileDrop } from './components/FileDrop';
import { Card } from './components/Card';
import { StatCard } from './components/StatCard';
import { Badge } from './components/Badge';
import { SpaghettiCanvas } from './components/SpaghettiCanvas';
import { Histogram } from './components/Histogram';
import { CommunityCTA } from './components/CommunityCTA';
import { ScrollProgress } from './components/ScrollFx';
import { LINKS } from './lib/links';
import { fmtNum, fmtPct } from './lib/format';
import {
  DEFAULT_MC,
  robustnessVerdict,
  type DDType,
  type MCConfig,
  type MCResult,
  type ResampleMethod,
} from './lib/montecarlo';
import type { MCRequest, MCResponse } from './lib/montecarlo.worker';

const PRESETS: Record<string, { label: string; patch: Partial<MCConfig> }> = {
  stellar1: { label: 'FundedNext Stellar 1-Step', patch: { target: 10, maxDD: 6, ddType: 'static' } },
  ftmo: { label: 'FTMO', patch: { target: 10, maxDD: 10, ddType: 'static' } },
  oneStepTrailing: { label: 'Genérico trailing', patch: { target: 10, maxDD: 6, ddType: 'trailing' } },
};

function useMCWorker() {
  const ref = useRef<Worker | null>(null);
  const [result, setResult] = useState<MCResult | null>(null);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    const w = new Worker(new URL('./lib/montecarlo.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<MCResponse>) => {
      setResult(e.data.result);
      setRunning(false);
    };
    ref.current = w;
    return () => w.terminate();
  }, []);
  const run = (req: MCRequest) => {
    if (!ref.current) return;
    setRunning(true);
    ref.current.postMessage(req);
  };
  return { result, running, run };
}

const inputClass =
  'rounded-lg border border-white/10 bg-surface-2 px-3 py-1.5 text-sm text-white focus:border-brand focus:outline-none';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</label>
      {children}
      {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
    </div>
  );
}

function Landing({ onLoaded }: { onLoaded: (r: ParseResult) => void }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="mb-10 text-center">
        <div className="eyebrow mb-3 text-accent-400">Test de robustez · by nico66fx</div>
        <h1 className="text-4xl font-extrabold text-white sm:text-5xl">
          Monte <span className="text-gradient">Carlo</span> de tu backtest
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-slate-400">
          Tu backtest es solo <strong className="text-slate-200">una</strong> de las miles de historias posibles.
          Barajamos tus operaciones <strong className="text-slate-200">miles de veces</strong> y te enseñamos el
          abanico real de resultados y la probabilidad de pasar un fondeo. Esto es lo que tu curva bonita no te cuenta.
        </p>
      </div>
      <FileDrop onLoaded={onLoaded} />
      <div className="mt-12">
        <CommunityCTA />
      </div>
    </div>
  );
}

function Dashboard({ data, onReset }: { data: ParseResult; onReset: () => void }) {
  const { result, running, run } = useMCWorker();
  const [cfg, setCfg] = useState<MCConfig>(DEFAULT_MC);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const profits = useMemo(() => data.trades.map((t) => t.profit), [data]);
  const set = <K extends keyof MCConfig>(k: K, v: MCConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));

  useEffect(() => {
    if (profits.length === 0) return;
    const id = setTimeout(() => run({ profits, config: cfg }), 120);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profits, cfg]);

  const verdict = result ? robustnessVerdict(result.passRate) : null;

  const downloadImage = () => {
    const c = canvasRef.current;
    if (!c) return;
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = 'montecarlo-nico66fx.png';
    a.click();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      {/* Controles */}
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-brand-400">Configuración</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PRESETS).map(([k, p]) => (
              <button
                key={k}
                onClick={() => setCfg((c) => ({ ...c, ...p.patch }))}
                className="rounded-lg border border-white/10 bg-surface/50 px-2.5 py-1 text-xs font-semibold text-slate-300 transition hover:border-brand/50 hover:text-brand-400"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Método">
            <select value={cfg.method} onChange={(e) => set('method', e.target.value as ResampleMethod)} className={inputClass}>
              <option value="shuffle">Reordenar (mismo set)</option>
              <option value="bootstrap">Remuestreo (con reemplazo)</option>
            </select>
          </Field>
          <Field label="Nº de simulaciones">
            <select value={cfg.numSims} onChange={(e) => set('numSims', +e.target.value)} className={inputClass}>
              {[500, 1000, 2000, 5000].map((n) => (
                <option key={n} value={n}>{fmtNum(n, 0)}</option>
              ))}
            </select>
          </Field>
          <Field label="Capital cuenta">
            <input type="number" value={cfg.account} onChange={(e) => set('account', +e.target.value)} className={inputClass} />
          </Field>
          <Field label="Objetivo beneficio (%)">
            <input type="number" value={cfg.target} step={0.5} onChange={(e) => set('target', +e.target.value)} className={inputClass} />
          </Field>
          <Field label="Max Drawdown (%)">
            <input type="number" value={cfg.maxDD} step={0.5} onChange={(e) => set('maxDD', +e.target.value)} className={inputClass} />
          </Field>
          <Field label="Tipo de Max DD">
            <select value={cfg.ddType} onChange={(e) => set('ddType', e.target.value as DDType)} className={inputClass}>
              <option value="static">Estático</option>
              <option value="trailing">Trailing</option>
            </select>
          </Field>
          <Field label="Ruido por op. (± %)" hint="Estresa cada resultado">
            <input type="number" value={cfg.noisePct} step={1} min={0} onChange={(e) => set('noisePct', +e.target.value)} className={inputClass} />
          </Field>
          <Field label="Operaciones">
            <div className={`${inputClass} pointer-events-none opacity-80`}>{profits.length} ops</div>
          </Field>
        </div>
      </Card>

      {result && verdict && (
        <>
          {/* Hero: probabilidad de pasar el fondeo */}
          <Card className="relative overflow-hidden">
            <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-brand/20 blur-3xl" />
            <div className="relative flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="eyebrow text-accent-400">Probabilidad de pasar el fondeo</div>
                <div className="mt-1 flex items-end gap-3">
                  <span className={`glow-num text-6xl font-extrabold ${verdict.tone === 'neg' ? 'text-neg' : verdict.tone === 'brand' ? 'text-brand-400' : 'text-pos'}`}>
                    {fmtPct(result.passRate, 0)}
                  </span>
                  <Badge tone={verdict.tone}>{verdict.label}</Badge>
                </div>
                <p className="mt-2 max-w-md text-sm text-slate-400">
                  De {fmtNum(cfg.numSims, 0)} historias posibles, tu sistema alcanza el +{cfg.target}% sin reventar el
                  {' '}-{cfg.maxDD}% en <strong className="text-slate-200">{fmtPct(result.passRate, 0)}</strong> de los casos.
                </p>
              </div>
              <button onClick={downloadImage} className="btn-primary print:hidden">Descargar imagen</button>
            </div>
          </Card>

          {/* Maraña */}
          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-white">Abanico de {fmtNum(cfg.numSims, 0)} simulaciones</h3>
              <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-white" /> Backtest real</span>
                <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-accent-400" /> Mediana</span>
                <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-brand/40" /> Cono 5–95%</span>
              </div>
            </div>
            <SpaghettiCanvas result={result} cfg={cfg} innerRef={canvasRef} />
            <p className="mt-2 text-xs text-slate-500">
              Cada hilo es una "vida paralela" de tu sistema. Si la curva blanca real va por el borde de arriba del abanico,
              cuidado: tu backtest tuvo suerte con el orden de las operaciones.
            </p>
          </Card>

          {/* Métricas */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Acaba en positivo" value={fmtPct(result.profitableRate, 0)} tone="pos" hint="de las simulaciones" />
            <StatCard label="Rompe el Max DD" value={fmtPct(result.breachRate, 0)} tone="neg" hint="en algún momento" />
            <StatCard label="Retorno mediano" value={fmtPct(result.ret.p50, 1)} tone="brand" hint={`peor 5%: ${fmtPct(result.ret.p5, 1)}`} />
            <StatCard label="Max DD mediano" value={fmtPct(result.dd.p50, 1)} tone="neg" hint={`peor 5%: ${fmtPct(result.dd.p95, 1)}`} />
          </div>

          {/* Distribuciones */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-white">Distribución de retornos</h3>
                <Badge tone="neutral">mediana {fmtPct(result.ret.p50, 1)}</Badge>
              </div>
              <Histogram values={result.finalReturns} palette="sign" />
            </Card>
            <Card delay={60}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-white">Distribución de Max Drawdown</h3>
                <Badge tone="neg">peor {fmtPct(result.dd.max, 1)}</Badge>
              </div>
              <Histogram values={result.maxDDs} palette="dd" />
            </Card>
          </div>

          <p className="rounded-xl border border-white/10 bg-surface/40 px-4 py-3 text-xs text-slate-500">
            ⚠️ Monte Carlo asume que tus operaciones son intercambiables y reordena/remuestrea su orden. No modela el
            drawdown intradía exacto ni el daily loss (el orden es aleatorio). Es una aproximación de robustez, no una
            garantía. Contenido educativo, no asesoramiento financiero.
          </p>

          <div className="pt-2">
            <CommunityCTA />
          </div>
        </>
      )}

      {!result && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span className="live-dot" /> {running ? 'Simulando…' : 'Preparando…'}
        </div>
      )}

      <p className="text-center text-xs text-slate-600">
        {data.meta.fileName} · {profits.length} operaciones ·{' '}
        <button onClick={onReset} className="underline hover:text-slate-400">cargar otro</button>
      </p>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<ParseResult | null>(null);
  return (
    <div className="flex min-h-full flex-col">
      <ScrollProgress />
      <Nav hasData={!!data} onReset={() => setData(null)} fileName={data?.meta.fileName} />
      <main className="flex-1">
        {data ? <Dashboard data={data} onReset={() => setData(null)} /> : <Landing onLoaded={setData} />}
      </main>
      <footer className="border-t border-white/10 px-4 py-8 text-center text-xs text-slate-500 sm:px-6">
        <div className="mx-auto mb-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <a href="https://nico66fx.github.io/tools/" className="font-semibold text-slate-300 hover:text-brand-400">Más herramientas</a>
          <span className="text-slate-700">·</span>
          <a href={LINKS.site} target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-300 hover:text-brand-400">nico66fx.github.io</a>
          <span className="text-slate-700">·</span>
          <a href={LINKS.telegram} target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-300 hover:text-accent-400">Telegram</a>
        </div>
        <p className="mx-auto max-w-3xl">
          <strong className="text-slate-400">Aviso:</strong> contenido educativo. Resultados pasados no garantizan
          resultados futuros. No es asesoramiento financiero.
        </p>
        <p className="mt-2 text-slate-600">🔒 100% local · tu backtest nunca sale de tu equipo · by nico66fx</p>
      </footer>
    </div>
  );
}
