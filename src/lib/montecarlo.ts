// Motor Monte Carlo de robustez.
//
// Idea: a partir de la lista de resultados (P&L) de un backtest, se generan miles
// de "vidas paralelas" reordenando o remuestreando las operaciones. Eso revela el
// abanico real de resultados posibles (no solo la única curva "bonita" del backtest)
// y permite estimar la probabilidad real de pasar un fondeo.

export type ResampleMethod = 'shuffle' | 'bootstrap';
export type DDType = 'static' | 'trailing';

export interface MCConfig {
  /** 'shuffle' = mismas operaciones en distinto orden · 'bootstrap' = remuestreo con reemplazo. */
  method: ResampleMethod;
  numSims: number;
  account: number;
  /** Objetivo de beneficio (%) para considerar "fondeo pasado". */
  target: number;
  /** Drawdown máximo permitido (%). */
  maxDD: number;
  ddType: DDType;
  /** Ruido aleatorio por operación (% ±) para estresar aún más. 0 = desactivado. */
  noisePct: number;
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
  finalReturns: number[];
  maxDDs: number[];
  /** % de simulaciones que alcanzan el objetivo sin romper el max DD. */
  passRate: number;
  /** % de simulaciones que acaban en positivo. */
  profitableRate: number;
  /** % de simulaciones que rompen el max DD en algún momento. */
  breachRate: number;
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

export function runMonteCarlo(profits: number[], cfg: MCConfig): MCResult {
  const n = profits.length;
  const account = cfg.account;
  const sims = Math.max(1, Math.floor(cfg.numSims));
  const targetEq = account * (1 + cfg.target / 100);
  const maxAmt = (account * cfg.maxDD) / 100;
  // Semilla determinista por config → resultados estables (mejor para capturas).
  const rand = mulberry32(0x9e3779b9 ^ (sims * 2654435761) ^ Math.round(account) ^ (cfg.method === 'shuffle' ? 1 : 2));

  const allPaths: Float32Array[] = new Array(sims);
  const finalReturns = new Array<number>(sims);
  const maxDDs = new Array<number>(sims);
  let passed = 0,
    profitable = 0,
    breached = 0;

  const seq = new Float64Array(n);
  for (let s = 0; s < sims; s++) {
    if (cfg.method === 'bootstrap') {
      for (let i = 0; i < n; i++) seq[i] = profits[(rand() * n) | 0];
    } else {
      for (let i = 0; i < n; i++) seq[i] = profits[i];
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
    let pathMaxDD = 0;
    let didBreach = false;
    let didPass = false;
    path[0] = account;
    for (let i = 0; i < n; i++) {
      let p = seq[i];
      if (cfg.noisePct > 0) p *= 1 + (rand() * 2 - 1) * (cfg.noisePct / 100);
      eq += p;
      if (eq > peak) peak = eq;
      const dd = peak > 0 ? ((peak - eq) / peak) * 100 : 0;
      if (dd > pathMaxDD) pathMaxDD = dd;
      path[i + 1] = eq;
      if (!didPass && !didBreach) {
        const floor = cfg.ddType === 'trailing' ? peak - maxAmt : account - maxAmt;
        if (eq <= floor) didBreach = true;
        else if (eq >= targetEq) didPass = true;
      }
    }
    allPaths[s] = path;
    finalReturns[s] = ((eq - account) / account) * 100;
    maxDDs[s] = pathMaxDD;
    if (didPass) passed++;
    if (eq > account) profitable++;
    if (didBreach) breached++;
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

  // Curva real del backtest.
  const original = new Array<number>(n + 1);
  let e = account;
  original[0] = account;
  for (let i = 0; i < n; i++) {
    e += profits[i];
    original[i + 1] = e;
  }

  // Submuestra de curvas para dibujar (máx. 300, suficiente para la "maraña").
  const cap = Math.min(sims, 300);
  const renderPaths: number[][] = [];
  for (let k = 0; k < cap; k++) {
    renderPaths.push(Array.from(allPaths[Math.floor((k * sims) / cap)]));
  }

  return {
    numTrades: n,
    account,
    paths: renderPaths,
    band: { p5, p50, p95 },
    original,
    finalReturns,
    maxDDs,
    passRate: (passed / sims) * 100,
    profitableRate: (profitable / sims) * 100,
    breachRate: (breached / sims) * 100,
    ret: percentiles(finalReturns),
    dd: percentiles(maxDDs),
  };
}

/** Histograma (conteo por bucket) de un array de valores. */
export function histogram(values: number[], buckets = 30): { mid: number; lo: number; hi: number; count: number }[] {
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

/** Veredicto de robustez a partir del % de fondeos pasados. */
export function robustnessVerdict(passRate: number): { label: string; tone: 'pos' | 'brand' | 'neg' } {
  if (passRate >= 75) return { label: 'Muy robusto', tone: 'pos' };
  if (passRate >= 50) return { label: 'Robusto', tone: 'pos' };
  if (passRate >= 30) return { label: 'Dudoso', tone: 'brand' };
  return { label: 'Frágil / posible curve-fit', tone: 'neg' };
}

export const DEFAULT_MC: MCConfig = {
  method: 'shuffle',
  numSims: 1000,
  account: 10000,
  target: 10,
  maxDD: 6,
  ddType: 'static',
  noisePct: 0,
};
