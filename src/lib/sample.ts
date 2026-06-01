// Backtest de ejemplo para probar la herramienta sin un archivo real.

import type { ParseResult, Trade } from '../types';

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSample(): ParseResult {
  const rand = mulberry32(424242);
  const trades: Trade[] = [];
  let balance = 10000;
  let time = new Date(2024, 0, 8, 9, 0, 0).getTime();
  const N = 180;
  for (let i = 0; i < N; i++) {
    time += (4 + rand() * 20) * 3600 * 1000;
    let d = new Date(time);
    while (d.getDay() === 0 || d.getDay() === 6) {
      time += 24 * 3600 * 1000;
      d = new Date(time);
    }
    const win = rand() < 0.54;
    const lots = 0.1;
    let profit = win ? 60 + rand() * 220 : -(60 + rand() * 170);
    profit = Math.round(profit * 100) / 100;
    balance += profit;
    trades.push({
      index: i,
      openTime: new Date(time),
      closeTime: new Date(time + 3600 * 1000),
      symbol: 'XAUUSD',
      type: rand() > 0.5 ? 'long' : 'short',
      lots,
      openPrice: null,
      closePrice: null,
      sl: null,
      tp: null,
      commission: 0,
      swap: 0,
      profit,
      balanceAfter: Math.round(balance * 100) / 100,
    });
  }
  return {
    trades,
    meta: {
      source: 'sample',
      fileName: 'Ejemplo · estrategia XAUUSD',
      symbol: 'XAUUSD',
      initialDeposit: 10000,
      currency: 'USD',
    },
    warnings: [],
  };
}
