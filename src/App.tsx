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
  type MCConfig,
  type MCResult,
  type ResampleMethod,
} from './lib/montecarlo';
import type { MCRequest, MCResponse } from './lib/montecarlo.worker';

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
          Monte <span className="text-gradient">Carlo</span> de tu estrategia
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-slate-400">
          Tu backtest es solo <strong className="text-slate-200">una</strong> de las miles de historias posibles.
          Barajamos tus operaciones <strong className="text-slate-200">miles de veces</strong> para enseñarte el
          abanico real de resultados y, sobre todo, el <strong className="text-slate-200">drawdown que de verdad
          debes esperar</strong>. Esto es lo que tu curva bonita no te cuenta.
        </p>
      </div>
      <FileDrop onLoaded={onLoaded} />
      <div className="mt-12">
        <CommunityCTA />
      </div>
    </div>
  );
}

function DDNum({ label, value, tone }: { label: string; value: string; tone: 'white' | 'cyan' | 'red' }) {
  const c = tone === 'white' ? 'text-white' : tone === 'cyan' ? 'text-accent-400' : 'text-neg';
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`tnum mt-0.5 text-3xl font-extrabold sm:text-4xl ${c}`}>{value}</div>
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

  // ¿Varía el retorno entre simulaciones? (al reordenar sin estresores, no).
  const returnsVary = cfg.method === 'bootstrap' || cfg.slippage > 0 || cfg.dropPct > 0 || cfg.noisePct > 0;

  const verdict = result ? robustnessVerdict(result) : null;

  const downloadImage = () => {
    const c = canvasRef.current;
    if (!c) return;
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = 'montecarlo-nico66fx.png';
    a.click();
  };

  const lucky = result && result.originalDDPercentile < 20;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      {/* Controles */}
      <Card>
        <h3 className="mb-3 font-semibold text-brand-400">Configuración</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Field label="Método" hint={cfg.method === 'shuffle' ? 'mismo set, otro orden' : 'con reemplazo'}>
            <select value={cfg.method} onChange={(e) => set('method', e.target.value as ResampleMethod)} className={inputClass}>
              <option value="shuffle">Reordenar</option>
              <option value="bootstrap">Remuestreo</option>
            </select>
          </Field>
          <Field label="Nº simulaciones">
            <select value={cfg.numSims} onChange={(e) => set('numSims', +e.target.value)} className={inputClass}>
              {[500, 1000, 2000, 5000].map((n) => (
                <option key={n} value={n}>{fmtNum(n, 0)}</option>
              ))}
            </select>
          </Field>
          <Field label="Capital inicial">
            <input type="number" value={cfg.account} onChange={(e) => set('account', +e.target.value)} className={inputClass} />
          </Field>
          <Field label="DD de ruina (%)" hint="DD que no tolerarías">
            <input type="number" value={cfg.ruinThreshold} step={1} min={1} onChange={(e) => set('ruinThreshold', +e.target.value)} className={inputClass} />
          </Field>
          <Field label="Ruido por op. (± %)" hint="0 = desactivado">
            <input type="number" value={cfg.noisePct} step={1} min={0} onChange={(e) => set('noisePct', +e.target.value)} className={inputClass} />
          </Field>
          <Field label="Slippage máx. ($/op)" hint="resta un aleatorio adverso">
            <input type="number" value={cfg.slippage} step={1} min={0} onChange={(e) => set('slippage', +e.target.value)} className={inputClass} />
          </Field>
          <Field label="Señales perdidas (%)" hint="ops que no se ejecutan">
            <input type="number" value={cfg.dropPct} step={1} min={0} max={90} onChange={(e) => set('dropPct', +e.target.value)} className={inputClass} />
          </Field>
        </div>
      </Card>

      {result && verdict && (
        <>
          {/* Hero: reality check del drawdown */}
          <Card className="relative overflow-hidden">
            <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-brand/20 blur-3xl" />
            <div className="relative">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="eyebrow text-accent-400">El drawdown que deberías esperar</div>
                <div className="flex items-center gap-2">
                  <Badge tone={verdict.tone}>{verdict.label}</Badge>
                  <button onClick={downloadImage} className="btn-primary print:hidden text-sm">Descargar imagen</button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <DDNum label="Tu backtest" value={`-${fmtNum(result.originalMaxDD, 1)}%`} tone="white" />
                <DDNum label="Típico (mediana)" value={`-${fmtNum(result.dd.p50, 1)}%`} tone="cyan" />
                <DDNum label="Peor caso (5%)" value={`-${fmtNum(result.dd.p95, 1)}%`} tone="red" />
              </div>
              <p className="mt-3 max-w-3xl text-sm text-slate-400">
                Tu backtest marcó <strong className="text-slate-200">-{fmtNum(result.originalMaxDD, 1)}%</strong> de
                drawdown, pero {cfg.method === 'shuffle' ? 'reordenando' : 'remuestreando'} las mismas operaciones lo
                normal es <strong className="text-accent-400">-{fmtNum(result.dd.p50, 1)}%</strong> y en el 5% de los
                peores casos llegarías a <strong className="text-neg">-{fmtNum(result.dd.p95, 1)}%</strong>.
                {lucky && (
                  <> Además, tu backtest tuvo un orden <strong className="text-neg">afortunado</strong> (percentil
                  {' '}{fmtNum(result.originalDDPercentile, 0)} de drawdown): no te fíes de esa curva tan suave.</>
                )}
              </p>
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
              Cada hilo es una "vida paralela" de tu sistema. Si la curva blanca real va pegada al borde de arriba del
              abanico, tu backtest tuvo suerte con el orden de las operaciones.
            </p>
          </Card>

          {/* Métricas de robustez */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Índice de robustez" value={`${fmtNum(verdict.score, 0)}/100`} tone={verdict.tone === 'neg' ? 'neg' : verdict.tone === 'brand' ? 'brand' : 'pos'} hint={verdict.label} />
            <StatCard label="Escenarios rentables" value={fmtPct(result.profitableRate, 0)} tone="pos" hint="acaban en verde" />
            <StatCard
              label="Retorno mediano"
              value={fmtPct(result.ret.p50, 1)}
              tone="brand"
              hint={cfg.method === 'shuffle' ? 'fijo al reordenar' : `${fmtPct(result.ret.p5, 0)} … ${fmtPct(result.ret.p95, 0)}`}
            />
            <StatCard label={`Riesgo de ruina (DD>${cfg.ruinThreshold}%)`} value={fmtPct(result.ruinRate, 0)} tone="neg" hint="de las simulaciones" />
          </div>

          {/* Distribuciones */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-white">Distribución de retornos</h3>
                <Badge tone="neutral">mediana {fmtPct(result.ret.p50, 1)}</Badge>
              </div>
              {returnsVary ? (
                <Histogram values={result.finalReturns} palette="sign" />
              ) : (
                <div className="flex h-36 flex-col items-center justify-center text-center text-sm text-slate-400">
                  <span className="tnum text-2xl font-bold text-pos">{fmtPct(result.ret.p50, 1)}</span>
                  <span className="mt-1 max-w-xs text-xs text-slate-500">
                    Al reordenar sin estresores, el retorno total no cambia (misma suma). Activa "Remuestreo", coste,
                    slippage o señales perdidas para ver el abanico de retornos.
                  </span>
                </div>
              )}
            </Card>
            <Card delay={60}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-white">Distribución de Max Drawdown</h3>
                <Badge tone="neg">peor {fmtPct(result.dd.max, 1)}</Badge>
              </div>
              <Histogram values={result.maxDDs} palette="dd" unit="%" />
            </Card>
          </div>

          <p className="rounded-xl border border-white/10 bg-surface/40 px-4 py-3 text-xs text-slate-500">
            ⚠️ Monte Carlo asume que tus operaciones son intercambiables y reordena/remuestrea su secuencia. Es una
            aproximación de robustez (no modela cambios de régimen ni correlación temporal). Contenido educativo, no
            asesoramiento financiero.
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
