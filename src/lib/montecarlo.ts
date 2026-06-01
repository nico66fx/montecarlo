// Motor Monte Carlo de robustez de estrategia.
//
// Idea: tu backtest es UNA sola realización de tu sistema. Reordenando (shuffle) o
// remuestreando (bootstrap) tus operaciones miles de veces obtenemos el abanico real
// de resultados posibles: cómo de ancho es el cono, qué retorno esperar de verdad y,
// sobre todo, qué drawdown deberías esperar (el backtest casi siempre lo subestima).

export type ResampleMethod = 'shuffle' | 'bootstrap';

export interface MCConfig {
  /** 'shuffle' = mismas operaciones en distinto orden · 'bootstrap' = remuestreo con reemplazo. */
  method: ResampleMethod;
  numSims: number;
  account: number;
  /** Drawdown (%) que considerarías inaceptable → para el "riesgo de ruina". */
  ruinThreshold: number;
  /** Ruido aleatorio por operación (% ±) para estresar aún más. 0 = desactivado. */
  noisePct: number;
  /** Coste extra por lote (spread+comisión, ida+vuelta, en divisa). Resta lots×coste a cada op. */
  costPerLot: number;
  /** Slippage máximo adverso por operación (en divisa). Resta un aleatorio 0..slippage. */
  slippage: number;
  /** % de operaciones que se "pierden" (señal fallada/VPS caído): cuentan como 0. */
  dropPct: number;
}

export interface Percentiles {
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  mean: number;
  min: number;
  max: number;
}

export interface MCResult {
  numTrades: number;
  account: number;
  /** Submuestra de curvas de equity para dibujar la maraña. */
  paths: number[][];
  /** Bandas de percentiles por paso (cono p5 / mediana / p95). */
  band: { p5: number[]; p50: number[]; p95: number[] };
  /** Curva real del backtest (referencia). */
  original: number[];
  /** Retorno y drawdown del backtest original. */
  originalReturn: number;
  originalMaxDD: number;
  /** Percentil donde cae el DD del backtest entre todas las simulaciones (0–100). */
  originalDDPercentile: number;
  finalReturns: number[];
  maxDDs: number[];
  /** % de simulaciones que acaban en positivo. */
  profitableRate: number;
  /** % de simulaciones cuyo Max DD supera el umbral de ruina. */
  ruinRate: number;
  ret: Percentiles;
  dd: Percentiles;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function quantile(sorted: Float64Array, q: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const idx = q * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

function percentiles(arr: number[]): Percentiles {
  const sorted = Float64Array.from(arr).sort();
  const mean = arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
  return {
    p5: quantile(sorted, 0.05),
    p25: quantile(sorted, 0.25),
    p50: quantile(sorted, 0.5),
    p75: quantile(sorted, 0.75),
    p95: quantile(sorted, 0.95),
    mean,
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
  };
}

/** Max drawdown (peak-to-trough, %) de una secuencia de equity. */
function maxDrawdown(path: ArrayLike<number>): number {
  let peak = path[0];
  let mdd = 0;
  for (let i = 1; i < path.length; i++) {
    if (path[i] > peak) peak = path[i];
    const dd = peak > 0 ? ((peak - path[i]) / peak) * 100 : 0;
    if (dd > mdd) mdd = dd;
  }
  return mdd;
}

export function runMonteCarlo(profits: number[], lots: number[], cfg: MCConfig): MCResult {
  const n = profits.length;
  const account = cfg.account;
  const sims = Math.max(1, Math.floor(cfg.numSims));
  const rand = mulberry32(0x9e3779b9 ^ (sims * 2654435761) ^ Math.round(account) ^ (cfg.method === 'shuffle' ? 1 : 2));

  // Coste determinista por lote (spread+comisión) aplicado a cada operación.
  const base = new Float64Array(n);
  for (let i = 0; i < n; i++) base[i] = profits[i] - (lots[i] || 0) * cfg.costPerLot;

  const allPaths: Float32Array[] = new Array(sims);
  const finalReturns = new Array<number>(sims);
  const maxDDs = new Array<number>(sims);
  let profitable = 0,
    ruin = 0;

  const seq = new Float64Array(n);
  for (let s = 0; s < sims; s++) {
    if (cfg.method === 'bootstrap') {
      for (let i = 0; i < n; i++) seq[i] = base[(rand() * n) | 0];
    } else {
      for (let i = 0; i < n; i++) seq[i] = base[i];
      for (let i = n - 1; i > 0; i--) {
        const j = (rand() * (i + 1)) | 0;
        const t = seq[i];
        seq[i] = seq[j];
        seq[j] = t;
      }
    }

    const path = new Float32Array(n + 1);
    let eq = account;
    let peak = account;
    let mdd = 0;
    path[0] = account;
    for (let i = 0; i < n; i++) {
      let p = seq[i];
      // Señal perdida (cuenta como 0).
      if (cfg.dropPct > 0 && rand() * 100 < cfg.dropPct) p = 0;
      else {
        if (cfg.slippage > 0) p -= rand() * cfg.slippage;
        if (cfg.noisePct > 0) p *= 1 + (rand() * 2 - 1) * (cfg.noisePct / 100);
      }
      eq += p;
      if (eq > peak) peak = eq;
      const dd = peak > 0 ? ((peak - eq) / peak) * 100 : 0;
      if (dd > mdd) mdd = dd;
      path[i + 1] = eq;
    }
    allPaths[s] = path;
    finalReturns[s] = ((eq - account) / account) * 100;
    maxDDs[s] = mdd;
    if (eq > account) profitable++;
    if (mdd >= cfg.ruinThreshold) ruin++;
  }

  // Bandas de percentiles por paso.
  const steps = n + 1;
  const p5 = new Array<number>(steps);
  const p50 = new Array<number>(steps);
  const p95 = new Array<number>(steps);
  const col = new Float64Array(sims);
  for (let st = 0; st < steps; st++) {
    for (let s = 0; s < sims; s++) col[s] = allPaths[s][st];
    const sorted = Float64Array.from(col).sort();
    p5[st] = quantile(sorted, 0.05);
    p50[st] = quantile(sorted, 0.5);
    p95[st] = quantile(sorted, 0.95);
  }

  // Curva real del backtest (con el coste determinista aplicado) + su DD/retorno.
  const original = new Array<number>(n + 1);
  let e = account;
  original[0] = account;
  for (let i = 0; i < n; i++) {
    e += base[i];
    original[i + 1] = e;
  }
  const originalMaxDD = maxDrawdown(original);
  const originalReturn = ((e - account) / account) * 100;
  // ¿En qué percentil de DD cae el backtest? (bajo = tuvo un orden "suave"/afortunado)
  let below = 0;
  for (const d of maxDDs) if (d <= originalMaxDD) below++;
  const originalDDPercentile = (below / sims) * 100;

  // Submuestra de curvas para dibujar (máx. 300).
  const cap = Math.min(sims, 300);
  const renderPaths: number[][] = [];
  for (let k = 0; k < cap; k++) renderPaths.push(Array.from(allPaths[Math.floor((k * sims) / cap)]));

  return {
    numTrades: n,
    account,
    paths: renderPaths,
    band: { p5, p50, p95 },
    original,
    originalReturn,
    originalMaxDD,
    originalDDPercentile,
    finalReturns,
    maxDDs,
    profitableRate: (profitable / sims) * 100,
    ruinRate: (ruin / sims) * 100,
    ret: percentiles(finalReturns),
    dd: percentiles(maxDDs),
  };
}

/** Histograma (conteo por bucket) de un array de valores. */
export function histogram(values: number[], buckets = 28): { mid: number; lo: number; hi: number; count: number }[] {
  if (!values.length) return [];
  let min = Infinity,
    max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === max) return [{ mid: min, lo: min, hi: max, count: values.length }];
  const w = (max - min) / buckets;
  const bins = Array.from({ length: buckets }, (_, i) => ({
    lo: min + i * w,
    hi: min + (i + 1) * w,
    mid: min + (i + 0.5) * w,
    count: 0,
  }));
  for (const v of values) {
    let idx = Math.floor((v - min) / w);
    if (idx >= buckets) idx = buckets - 1;
    if (idx < 0) idx = 0;
    bins[idx].count++;
  }
  return bins;
}

/**
 * Veredicto de robustez. Combina cuánto se infla el drawdown respecto al backtest y
 * el % de escenarios rentables. Un sistema robusto: el backtest está cerca de la
 * mediana, el cono es manejable y casi siempre gana.
 */
export function robustnessVerdict(r: MCResult): { label: string; tone: 'pos' | 'brand' | 'neg'; score: number } {
  const inflation = r.originalMaxDD > 0 ? r.dd.p50 / r.originalMaxDD : 1; // DD típico vs backtest
  const luck = r.originalDDPercentile; // bajo = el backtest fue "afortunado"
  // score 0–100: penaliza pérdidas, DD inflado y backtest afortunado.
  let score = r.profitableRate;
  score -= Math.max(0, inflation - 1.2) * 40;
  score -= Math.max(0, 15 - luck) * 1.5;
  score = Math.max(0, Math.min(100, score));
  if (score >= 75) return { label: 'Muy robusto', tone: 'pos', score };
  if (score >= 55) return { label: 'Robusto', tone: 'pos', score };
  if (score >= 35) return { label: 'Dudoso', tone: 'brand', score };
  return { label: 'Frágil / posible curve-fit', tone: 'neg', score };
}

export const DEFAULT_MC: MCConfig = {
  method: 'shuffle',
  numSims: 1000,
  account: 10000,
  ruinThreshold: 20,
  noisePct: 0,
  costPerLot: 0,
  slippage: 0,
  dropPct: 0,
};
